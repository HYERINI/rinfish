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

  it('해변 에픽은 구조대 가자미와 추멸치떼가 반씩 나눠 가진다 (해변 에픽 몫 전체는 그대로)', () => {
    const epics = catchWeights('beach', 0.5).filter((e) => e.species.rarity === 'epic')
    expect(epics.map((e) => e.species.id).sort()).toEqual(['anchovy-school-chu', 'lifeguard-flounder'])
    expect(epics[0].weight).toBeCloseTo(epics[1].weight)
  })

  it('같은 희귀도 어종끼리는 확률이 똑같다', () => {
    const rares = catchWeights('reef', 0.5).filter((e) => e.species.rarity === 'rare')
    for (const e of rares) expect(e.weight).toBeCloseTo(rares[0].weight)
  })
})

describe('미끼', () => {
  type B = 'worm' | 'shrimp' | 'lure' | null
  const rarityWeight = (zone: 'beach' | 'reef' | 'cave', rarity: string, power: number, bait: B) =>
    catchWeights(zone, power, bait)
      .filter((e) => e.species.rarity === rarity)
      .reduce((s, e) => s + e.weight, 0)
  const share = (zone: 'beach' | 'reef' | 'cave', rarity: string, power: number, bait: B) => {
    const total = catchWeights(zone, power, bait).reduce((s, e) => s + e.weight, 0)
    return rarityWeight(zone, rarity, power, bait) / total
  }

  it('미끼가 없으면 예전과 같다', () => {
    expect(catchWeights('reef', 0.5, null)).toEqual(catchWeights('reef', 0.5))
  })

  it('지렁이는 잡어만 절반으로 줄이고 나머지 희귀도 가중치는 그대로다', () => {
    expect(rarityWeight('beach', 'junk', 0, 'worm')).toBeCloseTo(rarityWeight('beach', 'junk', 0, null) / 2)
    for (const r of ['common', 'rare', 'epic']) expect(rarityWeight('beach', r, 0, 'worm')).toBeCloseTo(rarityWeight('beach', r, 0, null))
  })

  it('미끼 배율은 던진 힘 보너스와 곱해진다 (루어 에픽 ×2.5, 최대 파워 에픽 ×3 → ×7.5)', () => {
    expect(rarityWeight('reef', 'epic', 1, 'lure')).toBeCloseTo(rarityWeight('reef', 'epic', 0, null) * 7.5)
    expect(rarityWeight('reef', 'rare', 1, 'shrimp')).toBeCloseTo(rarityWeight('reef', 'rare', 0, null) * 2 * 1.5)
  })

  it('좋은 미끼일수록 희귀 이상이 잘 나온다', () => {
    const good = (bait: B) => share('reef', 'rare', 0.5, bait) + share('reef', 'epic', 0.5, bait)
    expect(good('shrimp')).toBeGreaterThan(good(null))
    expect(good('lure')).toBeGreaterThan(good('shrimp'))
  })

  it('루어는 전설 묶음 가중치를 2배로 한다', () => {
    expect(rarityWeight('cave', 'legendary', 0, 'lure')).toBeCloseTo(rarityWeight('cave', 'legendary', 0, null) * 2)
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
