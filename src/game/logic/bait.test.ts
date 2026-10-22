import { describe, expect, it } from 'vitest'
import { affordableQty, buyBait, consumeBait, NO_BAIT, usableBait } from './bait'

describe('usableBait', () => {
  it('고른 미끼가 있으면 그것을 쓴다', () => {
    expect(usableBait('shrimp', { ...NO_BAIT, shrimp: 2 })).toBe('shrimp')
  })

  it('고른 미끼가 다 떨어졌거나 고르지 않았으면 미끼 없이 던진다', () => {
    expect(usableBait('lure', { ...NO_BAIT, worm: 5 })).toBeNull()
    expect(usableBait(null, { ...NO_BAIT, worm: 5 })).toBeNull()
  })
})

describe('consumeBait', () => {
  it('1개 줄인다. 없으면 그대로', () => {
    expect(consumeBait({ ...NO_BAIT, worm: 2 }, 'worm').worm).toBe(1)
    const empty = { ...NO_BAIT }
    expect(consumeBait(empty, 'worm')).toBe(empty)
  })
})

describe('buyBait', () => {
  it('가격 × 수량만큼 코인을 내고 개수가 는다', () => {
    const r = buyBait(100, { ...NO_BAIT, shrimp: 1 }, 'shrimp', 3)
    expect(r).toEqual({ ok: true, coins: 40, counts: { ...NO_BAIT, shrimp: 4 } })
  })

  it('코인이 모자라거나 수량이 이상하면 실패한다', () => {
    expect(buyBait(59, NO_BAIT, 'lure', 1)).toEqual({ ok: false, reason: 'coins' })
    expect(buyBait(100, NO_BAIT, 'worm', 0)).toEqual({ ok: false, reason: 'qty' })
    expect(buyBait(100, NO_BAIT, 'worm', 1.5)).toEqual({ ok: false, reason: 'qty' })
  })
})

describe('affordableQty', () => {
  it('살 수 있는 최대 수량 (상한 안에서)', () => {
    expect(affordableQty(47, 5, 20)).toBe(9)
    expect(affordableQty(1000, 5, 20)).toBe(20)
    expect(affordableQty(3, 5, 20)).toBe(0)
  })
})
