import { describe, expect, it } from 'vitest'
import { HUNGER, STAMINA } from '../data/balance'
import { FRESH_SURVIVAL, isWeak, spendStamina, type Survival } from './stamina'
import { afterDeath, afterSleep, eatFood, isStarving, takeDamage, tickSurvival } from './survival'

const at = (stamina: number, hunger = 100, graceLeft: number | null = null): Survival => ({ stamina, hunger, graceLeft, buffs: [] })
const idle = { fighting: false, resting: false }
const walking = { fighting: false, resting: false, exploring: true }

describe('밸런스', () => {
  it('은지 그대로: 12분에 100 → 0, 굶으면 초당 1.5, 배부르면(60 초과) 초당 0.8, 자는 동안 초당 3', () => {
    expect(HUNGER.perSecond * 720).toBeCloseTo(100)
    expect(HUNGER).toMatchObject({ max: 100, starvePerSecond: 1.5, regenAbove: 60, sleepCost: 15, sleepFloor: 10, afterDeath: 60 })
    expect(STAMINA).toMatchObject({ castCost: 2, fightCostPerSecond: 0.6, benchRegenPerSecond: 6, fedRegenPerSecond: 0.8, sleepRegenPerSecond: 3 })
  })
})

describe('tickSurvival', () => {
  it('배고픔은 언제나 줄고 0 아래로 내려가지 않는다', () => {
    expect(tickSurvival(at(50, 100), 72, idle).survival.hunger).toBeCloseTo(90)
    expect(tickSurvival(at(50, 0.5), 72, idle).survival.hunger).toBe(0)
  })

  it('줄다리기 중이면 체력이 줄고, 벤치에서 쉬면 회복한다', () => {
    expect(tickSurvival(at(50, 50), 2, { fighting: true, resting: false }).survival.stamina).toBeCloseTo(50 - STAMINA.fightCostPerSecond * 2)
    expect(tickSurvival(at(50, 50), 2, { fighting: false, resting: true }).survival.stamina).toBeCloseTo(50 + STAMINA.benchRegenPerSecond * 2)
  })

  it('돌아다닐 때 배고픔이 60 넘으면 초당 0.8 회복, 60 이하면 회복 없음', () => {
    expect(tickSurvival(at(50, 90), 10, walking).survival.stamina).toBeCloseTo(58)
    expect(tickSurvival(at(50, 60), 10, walking).survival.stamina).toBe(50)
    expect(tickSurvival(at(50, 90), 10, idle).survival.stamina).toBe(50)
  })

  it('저절로 회복은 약화(체력 0)를 풀지 않는다', () => {
    const weak = tickSurvival(at(0, 90, 100), 10, walking).survival
    expect(weak.stamina).toBe(0)
    expect(isWeak(weak)).toBe(true)
  })

  it('자는 동안(같이 하기 잠 투표) 초당 3 회복', () => {
    expect(tickSurvival(at(40, 50), 10, { ...idle, sleeping: true }).survival.stamina).toBeCloseTo(70)
  })

  it('배고픔 0 이면 체력이 초당 1.5 줄고, 약화 유예는 시작하지 않는다', () => {
    const r = tickSurvival(at(30, 0), 10, idle)
    expect(r.survival.stamina).toBeCloseTo(15)
    expect(r.survival.graceLeft).toBeNull()
    expect(r).toMatchObject({ fainted: false, died: false })
  })

  it('배고픔 0 인 채로 체력 0 이면 죽음 (쓰러짐이 아니다)', () => {
    const r = tickSurvival(at(1, 0), 1, idle)
    expect(r).toMatchObject({ fainted: false, died: true })
    expect(r.survival.stamina).toBe(0)
  })

  it('낚시로 지쳐(약화) 있는 동안 배고픔이 0 이 되면 죽음', () => {
    expect(tickSurvival(at(0, 0.1, 100), 1, idle)).toMatchObject({ died: true, fainted: false })
  })

  it('배가 차 있으면 체력 0 은 약화: 유예가 끝나면 쓰러진다 (진료소)', () => {
    expect(tickSurvival(at(0, 50, 1.5), 1, idle)).toEqual({ survival: at(0, 50 - HUNGER.perSecond, 0.5), fainted: false, died: false })
    expect(tickSurvival(at(0, 50, 0.5), 1, idle)).toMatchObject({ fainted: true, died: false })
  })

  it('줄다리기로 체력이 0 이 되면 약화가 시작된다 (배가 차 있을 때)', () => {
    const r = tickSurvival(at(0.5, 50), 1, { fighting: true, resting: false })
    expect(r.survival.stamina).toBe(0)
    expect(r.survival.graceLeft).toBeCloseTo(STAMINA.graceSeconds - 1)
    expect(r.died).toBe(false)
  })

  it('약화 중에 벤치에서 쉬면 쓰러지지 않고 정상으로 돌아온다', () => {
    const r = tickSurvival(at(0, 50, 0.5), 1, { fighting: false, resting: true })
    expect(r.fainted).toBe(false)
    expect(isWeak(r.survival)).toBe(false)
  })

  it('버프 남은 시간이 줄고, 다 되면 사라진다', () => {
    const s: Survival = { ...FRESH_SURVIVAL, buffs: [{ kind: 'reel', mul: 1.3, remaining: 1.5 }] }
    const once = tickSurvival(s, 1, idle).survival
    expect(once.buffs[0].remaining).toBeCloseTo(0.5)
    expect(tickSurvival(once, 1, idle).survival.buffs).toEqual([])
  })
})

describe('죽음 판정 (피해)', () => {
  it('동물·PvP 피해로 체력 0 이면 배가 차 있어도 바로 죽음', () => {
    expect(takeDamage(at(10, 100), 15)).toEqual({ survival: at(0, 100), died: true })
    expect(takeDamage(at(30, 100), 15)).toEqual({ survival: at(15, 100), died: false })
  })
})

describe('먹기·잠·깨어나기', () => {
  it('먹으면 체력과 배고픔이 차고(최대 100) 약화가 풀린다', () => {
    expect(eatFood(at(0, 95, 30), 25, 30)).toEqual(at(25, 100))
  })
  it('배고픔 0 이면 굶는 중', () => {
    expect(isStarving(at(50, 0))).toBe(true)
    expect(isStarving(at(50, 1))).toBe(false)
  })
  it('자고 나면 체력 100, 배고픔 −15 (최소 10). 버프는 남는다', () => {
    const buffs = [{ kind: 'reel' as const, mul: 1.3, remaining: 50 }]
    expect(afterSleep({ stamina: 20, hunger: 50, graceLeft: null, buffs })).toEqual({ stamina: 100, hunger: 35, graceLeft: null, buffs })
    expect(afterSleep(at(20, 20)).hunger).toBe(10)
  })
  it('죽었다 깨어나면 체력 100, 배고픔 60', () => {
    expect(afterDeath()).toEqual(at(100, 60))
  })
  it('spendStamina 는 배고픔을 건드리지 않는다', () => {
    expect(spendStamina(at(10, 40), 3).hunger).toBe(40)
  })
})
