import { describe, expect, it } from 'vitest'
import { buyGearUpgrade, gearStats, gearUpgradeCost, sellPrice } from './economy'
import { getSpecies } from '../data/fish'
import { GEAR } from '../data/gear'
import type { GearLevels } from '../data/types'

const START: GearLevels = { line: 0, reel: 0, rod: 0 }

describe('sellPrice', () => {
  const tuna = getSpecies('pirate-tuna') // 10~30kg, 기본가 200

  it('중간 무게면 기본가', () => {
    expect(sellPrice(tuna, 20)).toBe(200)
  })

  it('무거울수록 비싸다', () => {
    expect(sellPrice(tuna, 30)).toBeGreaterThan(sellPrice(tuna, 10))
  })

  it('아무리 작아도 1코인은 받는다', () => {
    expect(sellPrice(getSpecies('lost-anchovy'), 0.01)).toBe(1)
  })
})

describe('gearStats', () => {
  it('기본 장비 능력치', () => {
    expect(gearStats(START)).toEqual({ maxTension: 100, reelSpeed: 6, shockAbsorb: 1 })
  })
})

describe('buyGearUpgrade', () => {
  it('다음 단계 가격을 알려 주고, 최고 단계면 null', () => {
    expect(gearUpgradeCost('line', 0)).toBe(150)
    expect(gearUpgradeCost('line', 2)).toBe(1000)
    expect(gearUpgradeCost('line', GEAR.line.levels.length - 1)).toBeNull()
  })

  it('코인이 가격과 딱 같으면 살 수 있다', () => {
    const r = buyGearUpgrade(150, START, 'line')
    expect(r).toEqual({ ok: true, coins: 0, levels: { line: 1, reel: 0, rod: 0 } })
  })

  it('코인이 모자라면 살 수 없다', () => {
    expect(buyGearUpgrade(149, START, 'line')).toEqual({ ok: false, reason: 'coins' })
  })

  it('최고 단계면 코인이 많아도 살 수 없다', () => {
    expect(buyGearUpgrade(99999, { ...START, line: GEAR.line.levels.length - 1 }, 'line')).toEqual({ ok: false, reason: 'max' })
  })
})
