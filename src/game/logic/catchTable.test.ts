import { describe, expect, it } from 'vitest'
import { catchWeights, rollSpecies, rollWeight } from './catchTable'
import { castDistance, castPowerFromHold } from './cast'
import { fixedRng } from './rng'
import { getSpecies } from '../data/fish'

describe('rollSpecies', () => {
  it('rng가 0이면 그 구역 목록의 첫 물고기가 나온다', () => {
    expect(rollSpecies('beach', 0, fixedRng(0)).id).toBe('sleepy-sardine')
  })

  it('동굴에서는 에픽이 같이 살아도 전설이 가장 많이 나온다 (세게 던져 에픽이 3배가 되어도 40% 이상)', () => {
    const legendShare = (power: number) => {
      const table = catchWeights('cave', power)
      const total = table.reduce((sum, e) => sum + e.weight, 0)
      return table.filter((e) => e.species.rarity === 'legendary').reduce((sum, e) => sum + e.weight, 0) / total
    }
    expect(legendShare(0)).toBeGreaterThan(0.6)
    expect(legendShare(1)).toBeGreaterThanOrEqual(0.4)
  })

  it('새 어종도 자기 구역에서 나온다', () => {
    const ids = (zone: 'beach' | 'pond' | 'reef' | 'cave') => catchWeights(zone, 0.5).map((e) => e.species.id)
    expect(ids('beach')).toContain('selfie-flyingfish')
    expect(ids('pond')).toContain('sleepy-catfish-king')
    expect(ids('reef')).toContain('ninja-ray')
    expect(ids('cave')).toContain('crystal-eye-cavefish')
  })

  it('멀리 던질수록 에픽이 나올 확률이 올라간다', () => {
    const epicShare = (power: number) => {
      const table = catchWeights('reef', power)
      const total = table.reduce((sum, e) => sum + e.weight, 0)
      const epic = table.filter((e) => e.species.rarity === 'epic').reduce((sum, e) => sum + e.weight, 0)
      return epic / total
    }
    expect(epicShare(1)).toBeGreaterThan(epicShare(0))
  })

  it('희귀도 비율은 그 희귀도 어종 수와 상관없다 (같은 희귀도끼리 나눠 가진다)', () => {
    const shareOf = (zone: 'beach' | 'pond' | 'reef', rarity: string, power: number) => {
      const table = catchWeights(zone, power)
      const total = table.reduce((s, e) => s + e.weight, 0)
      return table.filter((e) => e.species.rarity === rarity).reduce((s, e) => s + e.weight, 0) / total
    }
    // 세 구역 모두 잡어·일반·희귀·에픽이 있다 → 비율이 같아야 한다
    for (const power of [0, 1]) {
      const beach = shareOf('beach', 'epic', power)
      expect(shareOf('pond', 'epic', power)).toBeCloseTo(beach)
      expect(shareOf('reef', 'epic', power)).toBeCloseTo(beach)
    }
  })

  it('같은 희귀도 어종끼리는 확률이 똑같다', () => {
    const rares = catchWeights('reef', 0.5).filter((e) => e.species.rarity === 'rare')
    for (const e of rares) expect(e.weight).toBeCloseTo(rares[0].weight)
  })
})

describe('rollWeight', () => {
  it('무게는 종의 무게 범위 안에서 나온다', () => {
    const sardine = getSpecies('sleepy-sardine')
    expect(rollWeight(sardine, fixedRng(0))).toBe(0.1)
    const heavy = rollWeight(sardine, fixedRng(0.999))
    expect(heavy).toBeGreaterThan(0.29)
    expect(heavy).toBeLessThanOrEqual(0.3)
  })
})

describe('cast', () => {
  it('누른 시간에 비례해 파워가 0~1로 정해진다', () => {
    expect(castPowerFromHold(0)).toBe(0)
    expect(castPowerFromHold(0.75)).toBe(0.5)
    expect(castPowerFromHold(10)).toBe(1)
  })

  it('파워에 따라 찌가 떨어지는 거리가 4~12가 된다', () => {
    expect(castDistance(0)).toBe(4)
    expect(castDistance(1)).toBe(12)
  })
})
