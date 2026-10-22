import { describe, expect, it } from 'vitest'
import { EAT } from '../data/balance'
import { JUMP_POSE, SPRINT_MIN_SPEED } from '../data/characters'
import { aimWeights, characterPose, chewBite, clipTimeScale, eatArm, leanBack, poseClips } from './characterPose'
import { createFight } from './fight'
import type { FishingState } from './fishingSession'
import { IDLE_ACTION, type PlayerAction } from './playerMotion'
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

describe('점프·질주·감정 표현', () => {
  const air = (jumpAt: number): PlayerAction => ({ ...IDLE_ACTION, airborne: true, jumpAt })

  it('뛰어오른 직후엔 도약, 조금 지나면 공중 자세, 착지 직후엔 착지 자세', () => {
    expect(characterPose(null, 0, false, false, air(10), 10.1)).toBe('jumpStart')
    expect(characterPose(null, 6, false, false, air(10), 10 + JUMP_POSE.startTime + 0.1)).toBe('jumpLoop')
    const landed = { ...IDLE_ACTION, landedAt: 11 }
    expect(characterPose(null, 0, false, false, landed, 11.1)).toBe('jumpLand')
    expect(characterPose(null, 0, false, false, landed, 11 + JUMP_POSE.landTime + 0.1)).toBe('idle')
  })

  it('착지하자마자 움직이면 바로 걷거나 뛴다', () => {
    expect(characterPose(null, 6, false, false, { ...IDLE_ACTION, landedAt: 11 }, 11.1)).toBe('run')
  })

  it('질주 속도면 질주 자세', () => {
    expect(characterPose(null, SPRINT_MIN_SPEED + 1)).toBe('sprint')
    expect(characterPose(null, SPRINT_MIN_SPEED - 1)).toBe('run')
  })

  it('감정 표현 중엔 그 자세 (구르기는 몸이 앞으로 나아가도 구르기)', () => {
    for (const emote of ['dance', 'chat', 'roll', 'punch', 'spell'] as const) {
      expect(characterPose(null, 0, false, false, { ...IDLE_ACTION, emote, emoteAt: 10 }, 10.2)).toBe(emote)
    }
    expect(characterPose(null, 4, false, false, { ...IDLE_ACTION, emote: 'roll', emoteAt: 10 }, 10.2)).toBe('roll')
  })

  it('낚시·앉기 자세가 점프·감정 표현보다 먼저다', () => {
    const aiming = { stage: 'aiming', holding: false, holdTime: 0 } as const
    expect(characterPose(aiming, 0, false, false, air(10), 10.1)).toBe('aim')
    expect(characterPose(aiming, 0, false, false, { ...IDLE_ACTION, landedAt: 11 }, 11.1)).toBe('aim')
    expect(characterPose(aiming, 0, false, false, { ...IDLE_ACTION, emote: 'dance', emoteAt: 10 }, 10.2)).toBe('aim')
    expect(characterPose(null, 0, true, false, { ...IDLE_ACTION, emote: 'dance', emoteAt: 10 }, 10.2)).toBe('sit')
  })

  it('새 자세는 같은 이름의 클립 하나로 그린다', () => {
    expect(poseClips('sprint', 0)).toEqual([['sprint', 1]])
    expect(poseClips('roll', 0)).toEqual([['roll', 1]])
  })
})

describe('먹기 자세', () => {
  const eating: PlayerAction = { ...IDLE_ACTION, eat: 'stew', eatAt: 10 }

  it('먹는 중이면 eat 자세(서 있기 클립 위에 팔), 감정 표현·점프·낚시·앉기가 먼저다', () => {
    expect(characterPose(null, 0, false, false, eating, 10.5)).toBe('eat')
    expect(poseClips('eat', 0)).toEqual([['idle', 1]])
    expect(characterPose(null, 0, true, false, eating, 10.5)).toBe('sit')
    expect(characterPose(null, 0, false, false, { ...eating, airborne: true, jumpAt: 10.4 }, 10.5)).toBe('jumpStart')
  })

  it('팔은 처음에 올라가고 중간엔 다 올라간 채 냠냠 들썩이다가 끝에 내려온다', () => {
    expect(eatArm(IDLE_ACTION, 10)).toEqual({ raise: 0, chew: 0 })
    expect(eatArm(eating, 10).raise).toBe(0)
    expect(eatArm(eating, 10 + EAT.raiseTime / 2).raise).toBeCloseTo(0.5)
    const mid = [0.6, 0.7, 0.8, 0.9, 1].map((t) => eatArm(eating, 10 + t))
    for (const m of mid) expect(m.raise).toBe(1)
    expect(Math.max(...mid.map((m) => m.chew)) - Math.min(...mid.map((m) => m.chew))).toBeGreaterThan(0.3)
    expect(eatArm(eating, 10 + EAT.duration - 0.01).raise).toBeLessThan(0.1)
    expect(eatArm(eating, 10 + EAT.duration).raise).toBe(0)
  })

  it('한 입은 손이 다 올라간 뒤부터 일정한 간격으로 세고, 올리는 중·내리는 중엔 없다', () => {
    expect(chewBite(IDLE_ACTION, 10)).toBe(-1)
    expect(chewBite(eating, 10 + EAT.raiseTime / 2)).toBe(-1)
    expect(chewBite(eating, 10 + EAT.raiseTime + 0.01)).toBe(0)
    expect(chewBite(eating, 10 + EAT.raiseTime + EAT.biteEvery + 0.01)).toBe(1)
    expect(chewBite(eating, 10 + EAT.duration - EAT.raiseTime / 2)).toBe(-1)
    // 아구작·아구작·냠냠·쩝쩝이 다 뜰 만큼 길게 먹는다
    expect(chewBite(eating, 10 + EAT.duration - EAT.raiseTime - 0.01)).toBeGreaterThanOrEqual(3)
  })
})
