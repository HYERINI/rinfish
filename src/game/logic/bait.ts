import { BAIT_IDS, getBait, type BaitId } from '../data/bait'

/** 미끼별 보유 개수 */
export type BaitCounts = Record<BaitId, number>

export const NO_BAIT: BaitCounts = Object.fromEntries(BAIT_IDS.map((id) => [id, 0])) as BaitCounts

/** 이번에 던질 때 실제로 쓰는 미끼. 고른 미끼가 다 떨어졌으면 미끼 없이 던진다 */
export function usableBait(selected: BaitId | null, counts: BaitCounts): BaitId | null {
  return selected && counts[selected] > 0 ? selected : null
}

/** 미끼 1개 쓰기. 없으면 그대로 */
export function consumeBait(counts: BaitCounts, id: BaitId): BaitCounts {
  return counts[id] > 0 ? { ...counts, [id]: counts[id] - 1 } : counts
}

export type BaitBuyResult = { ok: true; coins: number; counts: BaitCounts } | { ok: false; reason: 'coins' | 'qty' }

/** qty 개를 산다. 수량은 1 이상의 정수 */
export function buyBait(coins: number, counts: BaitCounts, id: BaitId, qty: number): BaitBuyResult {
  if (!Number.isInteger(qty) || qty < 1) return { ok: false, reason: 'qty' }
  const cost = getBait(id).price * qty
  if (coins < cost) return { ok: false, reason: 'coins' }
  return { ok: true, coins: coins - cost, counts: { ...counts, [id]: counts[id] + qty } }
}

/** 지금 코인으로 살 수 있는 최대 수량 (상한 max) */
export function affordableQty(coins: number, price: number, max: number): number {
  return Math.max(0, Math.min(max, Math.floor(coins / price)))
}
