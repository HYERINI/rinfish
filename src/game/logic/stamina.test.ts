import { describe, expect, it } from 'vitest'
import { STAMINA } from '../data/balance'
import {
  FRESH_SURVIVAL,
  addBuff,
  faintPenalty,
  fightMods,
  healStamina,
  isWeak,
  spendStamina,
  tickSurvival,
  type Survival,
} from './stamina'

const at = (stamina: number, graceLeft: number | null = null): Survival => ({ stamina, graceLeft, buffs: [] })
const rest = { fighting: false, resting: false }

describe('spendStamina / healStamina', () => {
  it('0이 되는 순간 유예 시간이 시작되고, 더 써도 유예 시간은 그대로다', () => {
    const zero = spendStamina(at(3), 5)
    expect(zero.stamina).toBe(0)
    expect(zero.graceLeft).toBe(STAMINA.graceSeconds)
    expect(isWeak(zero)).toBe(true)
    expect(spendStamina({ ...zero, graceLeft: 50 }, 5).graceLeft).toBe(50)
  })

  it('조금이라도 회복하면 약화가 풀리고, 최대치를 넘지 않는다', () => {
    const healed = healStamina(at(0, 30), 1)
    expect(healed).toEqual(at(1, null))
    expect(healStamina(at(95), 20).stamina).toBe(STAMINA.max)
  })

  it('0만큼 회복하면 아무것도 바뀌지 않는다', () => {
    const weak = at(0, 30)
    expect(healStamina(weak, 0)).toBe(weak)
  })
})

describe('addBuff', () => {
  it('같은 종류는 겹치지 않고 새 것으로 바뀐다(남은 시간 갱신)', () => {
    const buffs = addBuff([{ kind: 'reel', mul: 1.3, remaining: 5 }], { kind: 'reel', mul: 1.3, remaining: 90 })
    expect(buffs).toEqual([{ kind: 'reel', mul: 1.3, remaining: 90 }])
  })

  it('다른 종류는 함께 유지된다', () => {
    const buffs = addBuff([{ kind: 'reel', mul: 1.3, remaining: 5 }], { kind: 'tension', mul: 0.75, remaining: 90 })
    expect(buffs).toHaveLength(2)
  })
})

describe('tickSurvival', () => {
  it('줄다리기 중이면 체력이 줄고, 벤치에서 쉬면 회복한다', () => {
    expect(tickSurvival(at(50), 2, { fighting: true, resting: false }).survival.stamina).toBe(50 - STAMINA.fightCostPerSecond * 2)
    expect(tickSurvival(at(50), 2, { fighting: false, resting: true }).survival.stamina).toBe(50 + STAMINA.benchRegenPerSecond * 2)
  })

  it('버프 남은 시간이 줄고, 다 되면 사라진다', () => {
    const s: Survival = { ...FRESH_SURVIVAL, buffs: [{ kind: 'reel', mul: 1.3, remaining: 1.5 }] }
    const once = tickSurvival(s, 1, rest).survival
    expect(once.buffs[0].remaining).toBeCloseTo(0.5)
    expect(tickSurvival(once, 1, rest).survival.buffs).toEqual([])
  })

  it('유예 시간이 끝나면 쓰러진다', () => {
    expect(tickSurvival(at(0, 1.5), 1, rest)).toEqual({ survival: at(0, 0.5), fainted: false })
    expect(tickSurvival(at(0, 0.5), 1, rest).fainted).toBe(true)
  })

  it('약화 중에 벤치에서 쉬면 쓰러지지 않고 정상으로 돌아온다', () => {
    const result = tickSurvival(at(0, 0.5), 1, { fighting: false, resting: true })
    expect(result.fainted).toBe(false)
    expect(isWeak(result.survival)).toBe(false)
  })
})

describe('fightMods', () => {
  it('보통 상태면 1배', () => {
    expect(fightMods(FRESH_SURVIVAL)).toEqual({ reelSpeedMul: 1, tensionMul: 1 })
  })

  it('버프와 약화가 곱해진다', () => {
    const s: Survival = {
      stamina: 0,
      graceLeft: 10,
      buffs: [
        { kind: 'reel', mul: 1.5, remaining: 10 },
        { kind: 'tension', mul: 0.5, remaining: 10 },
      ],
    }
    const mods = fightMods(s)
    expect(mods.reelSpeedMul).toBeCloseTo(1.5 * STAMINA.weakReelMul)
    expect(mods.tensionMul).toBeCloseTo(0.5 * STAMINA.weakTensionMul)
  })
})

describe('faintPenalty', () => {
  it('보유 코인의 20%를 내림해서 뗀다', () => {
    expect(faintPenalty(100)).toBe(20)
    expect(faintPenalty(9)).toBe(1)
    expect(faintPenalty(4)).toBe(0)
  })
})
