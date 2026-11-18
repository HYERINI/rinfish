import { ITEM_IDS, type ItemId } from '../data/meadowItems'
import { BUY_PRICE, DAILY_STOCK, VENDOR_TRADE, sellPrice, type VendorId } from '../data/meadowPrices'
import { addItems, removeItems, type ItemCounts } from './inventory'

/** 한 시계에서 산 수: day 일차에 물건마다 bought 개 */
export type DayStock = { day: number; bought: Partial<Record<ItemId, number>> }
/** 시계 종류: 혼자(저장된 내 시계) / 같이 하기(방 서버 시계) */
export type ClockSource = 'solo' | 'room'
/**
 * 농산물 가게에서 산 수. 혼자 시계와 방 시계는 날짜가 서로 달라서 따로 센다.
 * 규칙: 같은 시계에서 날짜가 기록보다 앞으로 갔을 때만 다시 가득. 같거나 더 이른 날이면 기록대로 남은 수량.
 * (한 줄로 두면 혼자 3일차 ↔ 방 10일차를 오갈 때마다 날짜가 '달라져' 다시 가득 차서 코인을 끝없이 벌 수 있었다)
 */
export type VendorStock = Record<ClockSource, DayStock>
const EMPTY_DAY: DayStock = { day: 0, bought: {} }
/** 아직 아무것도 안 샀다 (날짜는 1일차부터라 0 보다 앞이다) */
export const FULL_STOCK: VendorStock = { solo: EMPTY_DAY, room: EMPTY_DAY }

export type TradeResult = { ok: true; coins: number; items: ItemCounts } | { ok: false; reason: 'vendor' | 'qty' | 'coins' }
export type BuyResult = { ok: true; coins: number; items: ItemCounts; stock: VendorStock } | { ok: false; reason: 'vendor' | 'qty' | 'coins' | 'stock' }

/** 상인에게 qty 개를 판다. 그 상인이 사지 않는 물건이거나 개수가 모자라면 실패 */
export function sellToVendor(coins: number, items: ItemCounts, vendor: VendorId, id: ItemId, qty: number): TradeResult {
  if (!VENDOR_TRADE[vendor].buys(id)) return { ok: false, reason: 'vendor' }
  const next = removeItems(items, id, qty)
  if (!next) return { ok: false, reason: 'qty' }
  return { ok: true, coins: coins + sellPrice(id) * qty, items: next }
}

/** src 시계의 day 일차에 산 수 (기록보다 앞선 날이면 새 날이라 비었다) */
const boughtOn = (stock: VendorStock, src: ClockSource, day: number) => (day > stock[src].day ? {} : stock[src].bought)

/** src 시계의 day 일차에 id 를 몇 개 더 살 수 있나. 하루 수량이 없는 물건은 끝없이 */
export function stockLeft(stock: VendorStock, src: ClockSource, day: number, id: ItemId): number {
  const daily = DAILY_STOCK[id]
  if (daily === undefined) return Infinity
  return Math.max(0, daily - (boughtOn(stock, src, day)[id] ?? 0))
}

/** 상인에게서 qty 개를 산다 (src·day: 지금 시계와 날짜). 그 상인이 팔지 않거나, 오늘 남은 수량이나 코인이 모자라면 실패 */
export function buyFromVendor(coins: number, items: ItemCounts, stock: VendorStock, src: ClockSource, day: number, vendor: VendorId, id: ItemId, qty: number): BuyResult {
  const price = BUY_PRICE[id]
  if (!VENDOR_TRADE[vendor].sells.includes(id) || price === undefined) return { ok: false, reason: 'vendor' }
  if (!Number.isInteger(qty) || qty < 1) return { ok: false, reason: 'qty' }
  if (qty > stockLeft(stock, src, day, id)) return { ok: false, reason: 'stock' }
  if (coins < price * qty) return { ok: false, reason: 'coins' }
  const today = boughtOn(stock, src, day)
  // 기록 날짜는 뒤로 가지 않는다 (더 이른 날의 방에서 사도)
  const next: VendorStock = DAILY_STOCK[id] === undefined ? stock : { ...stock, [src]: { day: Math.max(day, stock[src].day), bought: { ...today, [id]: (today[id] ?? 0) + qty } } }
  return { ok: true, coins: coins - price * qty, items: addItems(items, id, qty), stock: next }
}

/** 저장본 한 시계 몫. 틀리면 null, 틀린 개수는 그 물건만 버린다 */
function readDayStock(v: unknown): DayStock | null {
  if (typeof v !== 'object' || v === null) return null
  const { day, bought } = v as Record<string, unknown>
  if (typeof day !== 'number' || !Number.isInteger(day) || day < 0 || typeof bought !== 'object' || bought === null) return null
  const out: DayStock = { day, bought: {} }
  for (const id of ITEM_IDS) {
    const n = (bought as Record<string, unknown>)[id]
    if (DAILY_STOCK[id] !== undefined && typeof n === 'number' && Number.isInteger(n) && n > 0) out.bought[id] = n
  }
  return out
}

/** 저장본의 하루 수량. 틀린 시계 몫은 가득. 옛 한 줄 저장본({day, bought})은 어느 시계였는지 몰라 두 시계 모두에 둔다 */
export function readStock(v: unknown): VendorStock {
  if (typeof v !== 'object' || v === null) return FULL_STOCK
  const old = readDayStock(v)
  if (old) return { solo: old, room: old }
  const { solo, room } = v as Record<string, unknown>
  return { solo: readDayStock(solo) ?? EMPTY_DAY, room: readDayStock(room) ?? EMPTY_DAY }
}
