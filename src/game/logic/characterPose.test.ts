import { describe, expect, it } from 'vitest'
import { aimWeights, characterPose, clipTimeScale, leanBack, poseClips } from './characterPose'
import { createFight } from './fight'
import type { FishingState } from './fishingSession'
import { fixedRng } from './rng'

const gear = { maxTension: 100, reelSpeed: 8, shockAbsorb: 1 }

function fighting(tension: number, pulling: boolean): FishingState {
  const fight = createFight({ strength: 2, pattern: 'endurance' }, gear, fixedRng(0))
  return {
    stage: 'fighting',
    castPower: 1,
    speciesId: 'sleepy-sardine',
    weight: 1,
    fight: { ...fight, tension, pull: { ...fight.pull, active: pulling } },
  }
}

describe('characterPose', () => {
  it('낚시 중이 아니면 속도로 서기/걷기/뛰기를 고른다', () => {
    expect(characterPose(null, 0)).toBe('idle')
    expect(characterPose(null, 1)).toBe('walk')
    expect(characterPose(null, 6)).toBe('run')
  })

  it('조준·대기 중엔 낚싯대를 쥔 자세', () => {
    expect(characterPose({ stage: 'aiming', holding: true, holdTime: 0.5 }, 0)).toBe('aim')
  })

  it('줄다리기: 평소엔 버티고, 물고기가 당기면 끌려간다', () => {
    expect(characterPose(fighting(50, false), 0)).toBe('tug')
    expect(characterPose(fighting(50, true), 0)).toBe('dragged')
  })

  it('결과별 반응: 잡으면 춤, 끊기면 벌러덩, 놓치면 낙담', () => {
    const done = (result: 'caught' | 'snapped' | 'escaped') => ({ stage: 'done', result, castPower: 1, speciesId: 'sleepy-sardine', weight: 1 }) as const
    expect(characterPose(done('caught'), 0)).toBe('celebrate')
    expect(characterPose(done('snapped'), 0)).toBe('fallBack')
    expect(characterPose(done('escaped'), 0)).toBe('dejected')
    expect(characterPose({ stage: 'done', result: 'missed', castPower: 1 }, 0)).toBe('dejected')
  })
})

describe('aimWeights', () => {
  it('비율의 합은 항상 1', () => {
    for (let a = -2; a <= 2; a += 0.1) {
      const w = aimWeights(a)
      expect(w.up + w.neutral + w.down).toBeCloseTo(1)
    }
  })

  it('끝까지 젖히면 팔을 머리 위로, 내리치면 아래로', () => {
    expect(aimWeights(-1.3).up).toBe(1)
    expect(aimWeights(0.5).neutral).toBeCloseTo(1)
    expect(aimWeights(1.3).down).toBe(1)
  })
})

describe('poseClips', () => {
  it('조준 자세는 세 클립을 섞고, 나머지는 클립 하나', () => {
    expect(poseClips('tug', 0.9).map(([c]) => c)).toEqual(['aimUp', 'aimNeutral', 'aimDown'])
    expect(poseClips('celebrate', 0)).toEqual([['celebrate', 1]])
  })
})

describe('clipTimeScale', () => {
  it('뛰기 재생 속도는 이동 속도를 따라간다', () => {
    expect(clipTimeScale('run', 5.36)).toBeCloseTo(1)
    expect(clipTimeScale('run', 6)).toBeGreaterThan(1)
  })
})

describe('leanBack', () => {
  it('텐션이 높을수록 더 젖히고, 끌려갈 땐 젖히지 않는다', () => {
    expect(leanBack(fighting(90, false))).toBeGreaterThan(leanBack(fighting(10, false)))
    expect(leanBack(fighting(90, true))).toBe(0)
    expect(leanBack(null)).toBe(0)
  })
})

describe('앉기', () => {
  it('벤치에서 쉬는 중이면 앉는다', () => {
    expect(characterPose(null, 0, true)).toBe('sit')
  })

  it('일어나는 중이고 움직이지 않으면 일어서는 자세, 움직이면 바로 걷는다', () => {
    expect(characterPose(null, 0, false, true)).toBe('standUp')
    expect(characterPose(null, 1, false, true)).toBe('walk')
  })

  it('앉는 중엔 앉기 시작 클립, 다 앉으면 앉아 있기 클립, 일어설 땐 일어나기 클립', () => {
    expect(poseClips('sit', 0, true)).toEqual([['sitEnter', 1]])
    expect(poseClips('sit', 0, false)).toEqual([['sitIdle', 1]])
    expect(poseClips('standUp', 0)).toEqual([['sitExit', 1]])
  })
})
