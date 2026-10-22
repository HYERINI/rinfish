import { CAST_RARITY_BONUS, RARITY_WEIGHTS, ZONE_RARITY_WEIGHTS } from '../data/balance'
import { FISH_SPECIES } from '../data/fish'
import type { FishSpecies, Rarity, ZoneId } from '../data/types'
import { lerpRange, type Rng } from './rng'

export type CatchEntry = { species: FishSpecies; weight: number }

export function catchWeights(zone: ZoneId, castPower: number): CatchEntry[] {
  const species = FISH_SPECIES.filter((s) => s.zones.includes(zone))
  // 희귀도 묶음 가중치를 같은 희귀도끼리 나눈다 — 어종이 늘어도 희귀도 비율이 유지된다
  const countByRarity = new Map<Rarity, number>()
  for (const s of species) countByRarity.set(s.rarity, (countByRarity.get(s.rarity) ?? 0) + 1)
  return species.map((s) => ({
    species: s,
    weight: rarityWeight(zone, s.rarity, castPower) / (countByRarity.get(s.rarity) ?? 1),
  }))
}

function rarityWeight(zone: ZoneId, rarity: Rarity, castPower: number): number {
  const base = ZONE_RARITY_WEIGHTS[zone]?.[rarity] ?? RARITY_WEIGHTS[rarity]
  if (rarity === 'rare') return base * (1 + CAST_RARITY_BONUS.rare * castPower)
  if (rarity === 'epic') return base * (1 + CAST_RARITY_BONUS.epic * castPower)
  return base
}

export function rollSpecies(zone: ZoneId, castPower: number, rng: Rng): FishSpecies {
  const table = catchWeights(zone, castPower)
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
