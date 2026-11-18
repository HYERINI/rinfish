import { describe, expect, it } from 'vitest'
import { STAMINA } from '../data/balance'
import { SNACKS } from '../data/snacks'
import { NO_SNACKS, buyAndEatSnack, buySnacks, eatSnackFromBag } from './snacks'
import { FRESH_SURVIVAL, spendStamina } from './stamina'

const tired = { ...FRESH_SURVIVAL, stamina: 20 }

describe('간식', () => {
  it('김밥 10코인 +25, 컵라면 20코인 +45, 에너지 음료 35코인 +70', () => {
    expect(SNACKS.map((s) => [s.id, s.price, s.heal])).toEqual([
      ['gimbap', 10, 25],
      ['ramen', 20, 45],
      ['energy', 35, 70],
    ])
  })

  it('배고픔: 김밥 +30, 컵라면 +50, 에너지 음료 +10 (최대 100)', () => {
    expect(SNACKS.map((s) => [s.id, s.hunger])).toEqual([
      ['gimbap', 30],
      ['ramen', 50],
      ['energy', 10],
    ])
    const r = buyAndEatSnack(30, NO_SNACKS, { ...tired, hunger: 20 }, 'ramen')
    if (r.ok) expect(r.survival.hunger).toBe(70)
    const full = eatSnackFromBag(0, { ...NO_SNACKS, gimbap: 1 }, { ...tired, hunger: 90 }, 'gimbap')
    if (full.ok) expect(full.survival.hunger).toBe(100)
  })

  it('사서 바로 먹으면 코인을 내고 체력이 오른다 (최대치를 넘지 않는다)', () => {
    const r = buyAndEatSnack(30, NO_SNACKS, tired, 'ramen')
    expect(r).toMatchObject({ ok: true, coins: 10, snacks: NO_SNACKS })
    if (r.ok) expect(r.survival.stamina).toBe(65)
    const full = buyAndEatSnack(100, NO_SNACKS, { ...FRESH_SURVIVAL, stamina: 90 }, 'energy')
    if (full.ok) expect(full.survival.stamina).toBe(STAMINA.max)
    expect(buyAndEatSnack(9, NO_SNACKS, tired, 'gimbap')).toEqual({ ok: false, reason: 'coins' })
  })

  it('가방에 사 두었다가 하나씩 꺼내 먹는다. 약화 중이어도 먹으면 풀린다', () => {
    const bought = buySnacks(50, NO_SNACKS, 'gimbap', 3)
    expect(bought).toEqual({ ok: true, coins: 20, snacks: { ...NO_SNACKS, gimbap: 3 } })
    if (!bought.ok) return
    const weak = spendStamina(FRESH_SURVIVAL, STAMINA.max)
    const eaten = eatSnackFromBag(20, bought.snacks, weak, 'gimbap')
    expect(eaten).toMatchObject({ ok: true, coins: 20, snacks: { gimbap: 2 } })
    if (eaten.ok) expect(eaten.survival).toMatchObject({ stamina: 25, graceLeft: null })
    expect(eatSnackFromBag(20, NO_SNACKS, tired, 'ramen')).toEqual({ ok: false, reason: 'empty' })
  })

  it('코인이 모자라거나 수량이 이상하면 사지 못한다', () => {
    expect(buySnacks(30, NO_SNACKS, 'energy', 1)).toEqual({ ok: false, reason: 'coins' })
    expect(buySnacks(30, NO_SNACKS, 'gimbap', 0)).toEqual({ ok: false, reason: 'qty' })
  })
})
