import { describe, expect, it } from 'vitest'
import { ITEM_IDS } from '../data/meadowItems'
import { BUY_PRICE, DAILY_STOCK, VENDOR_TRADE, sellPrice } from '../data/meadowPrices'
import { NO_ITEMS } from './inventory'
import { FULL_STOCK, buyFromVendor, readStock, sellToVendor, stockLeft } from './meadowShop'

describe('마을 상인 가격 (스펙 표)', () => {
  it('파는 값: 고기·부산물·채집, 요리는 sate×6+10', () => {
    expect([sellPrice('beef'), sellPrice('pork'), sellPrice('boar'), sellPrice('venison'), sellPrice('rabbit'), sellPrice('foxmeat'), sellPrice('chicken')]).toEqual([12, 10, 14, 14, 6, 6, 8])
    expect([sellPrice('bone'), sellPrice('fat'), sellPrice('egg'), sellPrice('pumpkin'), sellPrice('mushroom')]).toEqual([4, 4, 4, 6, 4])
    expect(sellPrice('roast')).toBe(22)
    expect(sellPrice('boarstew')).toBe(46)
  })
  it('사는 값: 달걀 8 · 호박 12 · 버섯 8', () => {
    expect(BUY_PRICE).toEqual({ egg: 8, pumpkin: 12, mushroom: 8 })
  })
  it('모든 물건은 누군가 산다 (팔 곳 없는 물건이 없다)', () => {
    for (const id of ITEM_IDS) expect(Object.values(VENDOR_TRADE).some((v) => v.buys(id))).toBe(true)
  })
})

describe('사고팔기', () => {
  it('정육점은 고기·요리를 산다. 달걀은 안 산다', () => {
    const r = sellToVendor(5, { ...NO_ITEMS, beef: 3, steak: 1 }, 'butcher', 'beef', 2)
    expect(r).toEqual({ ok: true, coins: 29, items: { ...NO_ITEMS, beef: 1, steak: 1 } })
    expect(sellToVendor(0, { ...NO_ITEMS, egg: 1 }, 'butcher', 'egg', 1)).toEqual({ ok: false, reason: 'vendor' })
  })
  it('가진 것보다 많이 팔 수 없다', () => {
    expect(sellToVendor(0, { ...NO_ITEMS, bone: 1 }, 'general', 'bone', 2)).toEqual({ ok: false, reason: 'qty' })
  })
  it('농산물 가게에서 산다. 코인이 모자라거나 안 파는 물건이면 실패', () => {
    expect(buyFromVendor(20, NO_ITEMS, FULL_STOCK, 'solo', 1, 'grocer', 'pumpkin', 1)).toEqual({ ok: true, coins: 8, items: { ...NO_ITEMS, pumpkin: 1 }, stock: { ...FULL_STOCK, solo: { day: 1, bought: { pumpkin: 1 } } } })
    expect(buyFromVendor(20, NO_ITEMS, FULL_STOCK, 'solo', 1, 'grocer', 'pumpkin', 2)).toEqual({ ok: false, reason: 'coins' })
    expect(buyFromVendor(100, NO_ITEMS, FULL_STOCK, 'solo', 1, 'butcher', 'egg', 1)).toEqual({ ok: false, reason: 'vendor' })
    expect(buyFromVendor(100, NO_ITEMS, FULL_STOCK, 'solo', 1, 'grocer', 'egg', 0)).toEqual({ ok: false, reason: 'qty' })
  })
})

describe('농산물 가게 하루 수량 (06:00 에 다시 채움)', () => {
  it('하루에 물건마다 3개까지', () => {
    expect(DAILY_STOCK).toEqual({ egg: 3, pumpkin: 3, mushroom: 3 })
    expect(stockLeft(FULL_STOCK, 'solo', 5, 'egg')).toBe(3)
  })
  it('산 만큼 줄고, 남은 것보다 많이는 못 산다', () => {
    const a = buyFromVendor(100, NO_ITEMS, FULL_STOCK, 'solo', 5, 'grocer', 'egg', 2)
    if (!a.ok) throw new Error('살 수 있어야 한다')
    expect(stockLeft(a.stock, 'solo', 5, 'egg')).toBe(1)
    expect(stockLeft(a.stock, 'solo', 5, 'pumpkin')).toBe(3)
    expect(buyFromVendor(a.coins, a.items, a.stock, 'solo', 5, 'grocer', 'egg', 2)).toEqual({ ok: false, reason: 'stock' })
    const b = buyFromVendor(a.coins, a.items, a.stock, 'solo', 5, 'grocer', 'egg', 1)
    if (!b.ok) throw new Error('하나는 남았다')
    expect(stockLeft(b.stock, 'solo', 5, 'egg')).toBe(0)
    expect(buyFromVendor(b.coins, b.items, b.stock, 'solo', 5, 'grocer', 'egg', 1)).toEqual({ ok: false, reason: 'stock' })
  })
  it('날짜가 바뀌면(다음 날 06:00) 다시 가득', () => {
    const a = buyFromVendor(100, NO_ITEMS, FULL_STOCK, 'solo', 5, 'grocer', 'egg', 3)
    if (!a.ok) throw new Error('살 수 있어야 한다')
    expect(stockLeft(a.stock, 'solo', 6, 'egg')).toBe(3)
    const b = buyFromVendor(a.coins, a.items, a.stock, 'solo', 6, 'grocer', 'egg', 1)
    expect(b.ok && b.stock.solo).toEqual({ day: 6, bought: { egg: 1 } })
  })
  it('저장본: 깨진 값은 그 물건만 버리고, 없으면 가득', () => {
    expect(readStock(undefined)).toEqual(FULL_STOCK)
    const rec = { day: 3, bought: { egg: 2 } }
    expect(readStock({ solo: { day: 3, bought: { egg: 2, pumpkin: -1, mushroom: 1.5, pizza: 2 } }, room: { day: 'x' } })).toEqual({ solo: rec, room: FULL_STOCK.room })
    expect(readStock({ day: 'x', bought: { egg: 2 } })).toEqual(FULL_STOCK)
    // 옛(v4·v5) 한 줄 저장본: 어느 시계의 날짜였는지 모르니 두 시계 모두에 둔다 (다시 가득 차지 않게)
    expect(readStock({ day: 3, bought: { egg: 2 } })).toEqual({ solo: rec, room: rec })
  })
  it('혼자 ↔ 같이 하기를 오가도 다시 가득 차지 않는다 (시계마다 따로, 앞으로만)', () => {
    const a = buyFromVendor(100, NO_ITEMS, FULL_STOCK, 'solo', 3, 'grocer', 'egg', 3)
    if (!a.ok) throw new Error('살 수 있어야 한다')
    // 방(서버) 시계는 10일차: 방 몫은 따로 3개
    const b = buyFromVendor(a.coins, a.items, a.stock, 'room', 10, 'grocer', 'egg', 3)
    if (!b.ok) throw new Error('방 몫은 따로')
    // 혼자로 돌아오면 혼자 3일차 몫은 이미 다 샀다
    expect(stockLeft(b.stock, 'solo', 3, 'egg')).toBe(0)
    expect(buyFromVendor(b.coins, b.items, b.stock, 'solo', 3, 'grocer', 'egg', 1)).toEqual({ ok: false, reason: 'stock' })
    // 다시 방에 가도 방 10일차 몫은 다 샀다
    expect(stockLeft(b.stock, 'room', 10, 'egg')).toBe(0)
    // 날짜가 더 이른 다른 방(5일차)에 가도 다시 채우지 않는다
    expect(stockLeft(b.stock, 'room', 5, 'egg')).toBe(0)
    expect(buyFromVendor(b.coins, b.items, b.stock, 'room', 5, 'grocer', 'egg', 1)).toEqual({ ok: false, reason: 'stock' })
    // 그 시계에서 날짜가 앞으로 가면 다시 가득
    expect(stockLeft(b.stock, 'room', 11, 'egg')).toBe(3)
    expect(stockLeft(b.stock, 'solo', 4, 'egg')).toBe(3)
  })
  it('더 이른 날짜에 사도 기록 날짜는 뒤로 가지 않는다', () => {
    const a = buyFromVendor(100, NO_ITEMS, FULL_STOCK, 'room', 10, 'grocer', 'egg', 1)
    if (!a.ok) throw new Error('살 수 있어야 한다')
    const b = buyFromVendor(a.coins, a.items, a.stock, 'room', 5, 'grocer', 'egg', 1)
    expect(b.ok && b.stock.room).toEqual({ day: 10, bought: { egg: 2 } })
  })
})
