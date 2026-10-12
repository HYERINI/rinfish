import { describe, expect, it } from 'vitest'
import { activePattern, createFight, stepFight, type FightState } from './fight'
import { fixedRng } from './rng'
import type { GearStats } from '../data/types'

const rng = fixedRng(0.5)
const GEAR_LV1: GearStats = { maxTension: 100, reelSpeed: 8, shockAbsorb: 1 }
const weakFish = { strength: 1, pattern: 'endurance' as const }

/** 결과가 날 때까지 0.05초씩 진행 */
function runUntilDone(state: FightState, reeling: boolean): FightState {
  let s = state
  for (let i = 0; i < 4000 && s.outcome === 'fighting'; i++) {
    s = stepFight(s, { reeling }, 0.05, rng)
  }
  return s
}

describe('stepFight', () => {
  it('계속 감기만 하면 줄이 끊긴다', () => {
    const end = runUntilDone(createFight(weakFish, GEAR_LV1, rng), true)
    expect(end.outcome).toBe('snapped')
  })

  it('아무것도 안 하면 바늘이 빠져 도망간다', () => {
    const end = runUntilDone(createFight(weakFish, GEAR_LV1, rng), false)
    expect(end.outcome).toBe('escaped')
  })

  it('낚싯줄 단계가 높으면 더 오래 버틴다', () => {
    const lv1 = runUntilDone(createFight(weakFish, GEAR_LV1, rng), true)
    const lv3 = runUntilDone(createFight(weakFish, { ...GEAR_LV1, maxTension: 190 }, rng), true)
    expect(lv3.outcome).toBe('snapped')
    expect(lv3.elapsed).toBeGreaterThan(lv1.elapsed)
  })

  it('거리가 0이 되면 잡힌다', () => {
    const near: FightState = {
      ...createFight(weakFish, GEAR_LV1, rng),
      distance: 0.1,
      pull: { active: false, timer: 10, intensity: 0, pattern: 'endurance' },
    }
    expect(stepFight(near, { reeling: true }, 0.05, rng).outcome).toBe('caught')
  })

  it('힘센 물고기가 당기면 손을 떼고 있어도 텐션이 오른다', () => {
    const pulling: FightState = {
      ...createFight({ strength: 10, pattern: 'dasher' }, GEAR_LV1, rng),
      tension: 30,
      pull: { active: true, timer: 1, intensity: 1.6, pattern: 'dasher' },
    }
    expect(stepFight(pulling, { reeling: false }, 0.1, rng).tension).toBeGreaterThan(30)
  })

  it('좋은 낚싯대는 당김 충격을 줄인다', () => {
    const pull = { active: true, timer: 1, intensity: 1.6, pattern: 'dasher' as const }
    const rod1: FightState = { ...createFight({ strength: 10, pattern: 'dasher' }, GEAR_LV1, rng), tension: 30, pull }
    const rod3: FightState = { ...createFight({ strength: 10, pattern: 'dasher' }, { ...GEAR_LV1, shockAbsorb: 0.55 }, rng), tension: 30, pull }
    const t1 = stepFight(rod1, { reeling: false }, 0.1, rng).tension
    const t3 = stepFight(rod3, { reeling: false }, 0.1, rng).tension
    expect(t3).toBeLessThan(t1)
  })

  it('dt가 아무리 커도 한 번에 0.1초까지만 진행한다 (탭 전환 대비)', () => {
    const s = stepFight(createFight(weakFish, GEAR_LV1, rng), { reeling: true }, 5, rng)
    expect(s.elapsed).toBeCloseTo(0.1)
    expect(s.outcome).toBe('fighting')
  })

  it('끝난 싸움은 더 진행되지 않는다', () => {
    const done: FightState = { ...createFight(weakFish, GEAR_LV1, rng), outcome: 'snapped' }
    expect(stepFight(done, { reeling: true }, 0.05, rng)).toBe(done)
  })
})

describe('activePattern', () => {
  it('전설(mixed)은 남은 거리에 따라 돌진 → 지구전 → 변덕으로 바뀐다', () => {
    const base = createFight({ strength: 10, pattern: 'mixed' }, GEAR_LV1, rng)
    expect(activePattern({ ...base, distance: 60 })).toBe('dasher')
    expect(activePattern({ ...base, distance: 30 })).toBe('endurance')
    expect(activePattern({ ...base, distance: 10 })).toBe('erratic')
  })
})
