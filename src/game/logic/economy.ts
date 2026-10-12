import { GEAR } from '../data/gear'
import type { FishSpecies, GearLevels, GearSlot, GearStats } from '../data/types'

/** 판매가는 무게에 비례한다. 범위 중간 무게일 때 basePrice */
export function sellPrice(species: FishSpecies, weight: number): number {
  const [min, max] = species.weightRange
  const mid = (min + max) / 2
  return Math.max(1, Math.round((species.basePrice * weight) / mid))
}

export function gearStats(levels: GearLevels): GearStats {
  return {
    maxTension: GEAR.line.levels[levels.line].value,
    reelSpeed: GEAR.reel.levels[levels.reel].value,
    shockAbsorb: GEAR.rod.levels[levels.rod].value,
  }
}

export function gearUpgradeCost(slot: GearSlot, currentLevel: number): number | null {
  const next = GEAR[slot].levels[currentLevel + 1]
  return next ? next.price : null
}

export type BuyResult = { ok: true; coins: number; levels: GearLevels } | { ok: false; reason: 'max' | 'coins' }

export function buyGearUpgrade(coins: number, levels: GearLevels, slot: GearSlot): BuyResult {
  const cost = gearUpgradeCost(slot, levels[slot])
  if (cost === null) return { ok: false, reason: 'max' }
  if (coins < cost) return { ok: false, reason: 'coins' }
  return { ok: true, coins: coins - cost, levels: { ...levels, [slot]: levels[slot] + 1 } }
}
