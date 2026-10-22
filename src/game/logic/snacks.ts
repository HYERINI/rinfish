import { SNACK_IDS, getSnack, type SnackId } from '../data/snacks'
import { healStamina, type Survival } from './stamina'

/** 간식별 가방 속 개수 */
export type SnackCounts = Record<SnackId, number>

export const NO_SNACKS: SnackCounts = Object.fromEntries(SNACK_IDS.map((id) => [id, 0])) as SnackCounts

export type SnackBuyResult = { ok: true; coins: number; snacks: SnackCounts } | { ok: false; reason: 'coins' | 'qty' }

/** qty 개를 사서 가방에 넣는다 */
export function buySnacks(coins: number, snacks: SnackCounts, id: SnackId, qty: number): SnackBuyResult {
  if (!Number.isInteger(qty) || qty < 1) return { ok: false, reason: 'qty' }
  const cost = getSnack(id).price * qty
  if (coins < cost) return { ok: false, reason: 'coins' }
  return { ok: true, coins: coins - cost, snacks: { ...snacks, [id]: snacks[id] + qty } }
}

export type SnackEatResult = { ok: true; coins: number; snacks: SnackCounts; survival: Survival } | { ok: false; reason: 'coins' | 'empty' }

/** 사서 바로 먹는다 (가방은 그대로) */
export function buyAndEatSnack(coins: number, snacks: SnackCounts, survival: Survival, id: SnackId): SnackEatResult {
  const snack = getSnack(id)
  if (coins < snack.price) return { ok: false, reason: 'coins' }
  return { ok: true, coins: coins - snack.price, snacks, survival: healStamina(survival, snack.heal) }
}

/** 가방에서 하나 꺼내 먹는다 */
export function eatSnackFromBag(coins: number, snacks: SnackCounts, survival: Survival, id: SnackId): SnackEatResult {
  if (snacks[id] <= 0) return { ok: false, reason: 'empty' }
  return { ok: true, coins, snacks: { ...snacks, [id]: snacks[id] - 1 }, survival: healStamina(survival, getSnack(id).heal) }
}
