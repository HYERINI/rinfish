import { CAST } from '../data/balance'

export function castPowerFromHold(seconds: number): number {
  return Math.min(1, Math.max(0, seconds / CAST.fullPowerHoldSeconds))
}

export function castDistance(power: number): number {
  return CAST.minDistance + CAST.extraDistance * power
}
