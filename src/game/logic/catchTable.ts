import { CAST_RARITY_BONUS, RARITY_WEIGHTS, ZONE_RARITY_WEIGHTS } from '../data/balance'
import { getBait, type BaitId } from '../data/bait'
import { FISH_SPECIES } from '../data/fish'
import type { FishSpecies, Rarity, ZoneId } from '../data/types'
import { lerpRange, type Rng } from './rng'

export type CatchEntry = { species: FishSpecies; weight: number }

/** bait: 이번에 쓰는 미끼 (없으면 null). 희귀도 묶음 가중치에 던진 힘 보너스와 함께 곱해진다 */
export function catchWeights(zone: ZoneId, castPower: number, bait: BaitId | null = null): CatchEntry[] {
  const species = FISH_SPECIES.filter((s) => s.zones.includes(zone))
  // 희귀도 묶음 가중치를 같은 희귀도끼리 나눈다 — 어종이 늘어도 희귀도 비율이 유지된다
  const countByRarity = new Map<Rarity, number>()
  for (const s of species) countByRarity.set(s.rarity, (countByRarity.get(s.rarity) ?? 0) + 1)
  return species.map((s) => ({
    species: s,
    weight: (rarityWeight(zone, s.rarity, castPower) * baitMul(bait, s.rarity)) / (countByRarity.get(s.rarity) ?? 1),
  }))
}

function rarityWeight(zone: ZoneId, rarity: Rarity, castPower: number): number {
  const base = ZONE_RARITY_WEIGHTS[zone]?.[rarity] ?? RARITY_WEIGHTS[rarity]
  if (rarity === 'rare') return base * (1 + CAST_RARITY_BONUS.rare * castPower)
  if (rarity === 'epic') return base * (1 + CAST_RARITY_BONUS.epic * castPower)
  return base
}

function baitMul(bait: BaitId | null, rarity: Rarity): number {
  return bait ? (getBait(bait).rarityMul[rarity] ?? 1) : 1
}

export function rollSpecies(zone: ZoneId, castPower: number, rng: Rng, bait: BaitId | null = null): FishSpecies {
  const table = catchWeights(zone, castPower, bait)
  if (table.length === 0) throw new Error(`물고기가 없는 구역: ${zone}`)
  const total = table.reduce((sum, e) => sum + e.weight, 0)
  let r = rng() * total
  for (const entry of table) {
    if (r < entry.weight) return entry.species
    r -= entry.weight
  }
  return table[table.length - 1].species
}

/** 소수 둘째 자리(kg)까지 */
export function rollWeight(species: FishSpecies, rng: Rng): number {
  return Math.round(lerpRange(species.weightRange, rng()) * 100) / 100
}
