import { ITEM_IDS, type ItemId } from '../data/meadowItems'
import { BUY_PRICE, DAILY_STOCK, VENDOR_TRADE, sellPrice, type VendorId } from '../data/meadowPrices'
import { addItems, removeItems, type ItemCounts } from './inventory'

/** 농산물 가게에서 산 수: day 일차에 물건마다 bought 개. 날짜가 다르면(06:00 를 지났으면) 다시 가득 */
export type VendorStock = { day: number; bought: Partial<Record<ItemId, number>> }
/** 아직 아무것도 안 샀다 (날짜는 1일차부터라 0 은 어느 날과도 다르다) */
export const FULL_STOCK: VendorStock = { day: 0, bought: {} }

export type TradeResult = { ok: true; coins: number; items: ItemCounts } | { ok: false; reason: 'vendor' | 'qty' | 'coins' }
export type BuyResult = { ok: true; coins: number; items: ItemCounts; stock: VendorStock } | { ok: false; reason: 'vendor' | 'qty' | 'coins' | 'stock' }

/** 상인에게 qty 개를 판다. 그 상인이 사지 않는 물건이거나 개수가 모자라면 실패 */
export function sellToVendor(coins: number, items: ItemCounts, vendor: VendorId, id: ItemId, qty: number): TradeResult {
  if (!VENDOR_TRADE[vendor].buys(id)) return { ok: false, reason: 'vendor' }
  const next = removeItems(items, id, qty)
  if (!next) return { ok: false, reason: 'qty' }
  return { ok: true, coins: coins + sellPrice(id) * qty, items: next }
}

/** day 일차에 id 를 몇 개 더 살 수 있나. 하루 수량이 없는 물건은 끝없이 */
export function stockLeft(stock: VendorStock, day: number, id: ItemId): number {
  const daily = DAILY_STOCK[id]
  if (daily === undefined) return Infinity
  const bought = stock.day === day ? (stock.bought[id] ?? 0) : 0
  return Math.max(0, daily - bought)
}

/** 상인에게서 qty 개를 산다 (day: 지금 날짜). 그 상인이 팔지 않거나, 오늘 남은 수량이나 코인이 모자라면 실패 */
export function buyFromVendor(coins: number, items: ItemCounts, stock: VendorStock, day: number, vendor: VendorId, id: ItemId, qty: number): BuyResult {
  const price = BUY_PRICE[id]
  if (!VENDOR_TRADE[vendor].sells.includes(id) || price === undefined) return { ok: false, reason: 'vendor' }
  if (!Number.isInteger(qty) || qty < 1) return { ok: false, reason: 'qty' }
  if (qty > stockLeft(stock, day, id)) return { ok: false, reason: 'stock' }
  if (coins < price * qty) return { ok: false, reason: 'coins' }
  const today = stock.day === day ? stock.bought : {}
  const next: VendorStock = DAILY_STOCK[id] === undefined ? stock : { day, bought: { ...today, [id]: (today[id] ?? 0) + qty } }
  return { ok: true, coins: coins - price * qty, items: addItems(items, id, qty), stock: next }
}

/** 저장본의 하루 수량. 날짜가 틀리면 가득, 틀린 개수는 그 물건만 버린다 */
export function readStock(v: unknown): VendorStock {
  if (typeof v !== 'object' || v === null) return FULL_STOCK
  const { day, bought } = v as Record<string, unknown>
  if (typeof day !== 'number' || !Number.isInteger(day) || day < 0 || typeof bought !== 'object' || bought === null) return FULL_STOCK
  const out: VendorStock = { day, bought: {} }
  for (const id of ITEM_IDS) {
    const n = (bought as Record<string, unknown>)[id]
    if (DAILY_STOCK[id] !== undefined && typeof n === 'number' && Number.isInteger(n) && n > 0) out.bought[id] = n
  }
  return out
}
