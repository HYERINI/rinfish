import type { GunId } from './guns'
import { ITEMS, hasTag, isOre, type ItemId, type RawItemId } from './meadowItems'

/**
 * 마을 상인 가격 (코인). 은지 "원" 값의 약 2배: 고기 ≈ 흔한 물고기 하위 값, 요리 ≈ 간식. 나중에 맞추기 쉽게 숫자는 여기에만 둔다.
 * 탄약 묶음은 장비 값(60~2200) 쪽으로 조금 비싸게 (AMMO_PACKS, 잡화점이 판다)
 */
export const SELL_PRICE: Record<RawItemId, number> = {
  beef: 12,
  pork: 10,
  boar: 14,
  venison: 14,
  rabbit: 6,
  foxmeat: 6,
  chicken: 8,
  bone: 4,
  fat: 4,
  egg: 4,
  pumpkin: 6,
  mushroom: 4,
  // 광석: 돌은 흔해서 싸고, 금은 탄약 한 묶음 값에 가깝게
  stone: 3,
  copper: 10,
  iron: 16,
  silver: 30,
  gold: 55,
}

/** 요리 파는 값: 포만감 × 6 + 10 (22~46) */
export const DISH_PRICE = { perSate: 6, base: 10 }

/** 상인이 파는 물건과 값 (달걀·호박·버섯만) */
export const BUY_PRICE: Partial<Record<ItemId, number>> = { egg: 8, pumpkin: 12, mushroom: 8 }

/**
 * 농산물 가게 하루 수량: 게임 하루(06:00 ~ 다음 06:00)에 물건마다 이만큼만 판다 (사람마다 따로, 저장된다).
 * 사서 요리해 되파는 돈 벌이(달걀 8 → 달걀 프라이 22)가 끝없이 돌지 않게 막는다
 */
export const DAILY_STOCK: Partial<Record<ItemId, number>> = { egg: 3, pumpkin: 3, mushroom: 3 }

/** 잡화점 탄약 묶음: 권총 12발 80 · 소총 30발 150 · 산탄 6발 120 · 저격 5발 250 (예비 탄약에 더한다) */
export const AMMO_PACKS: Record<GunId, { n: number; price: number }> = {
  pistol: { n: 12, price: 80 },
  rifle: { n: 30, price: 150 },
  shotgun: { n: 6, price: 120 },
  sniper: { n: 5, price: 250 },
}

/** 물건 하나를 상인에게 팔 때 받는 값 */
export function sellPrice(id: ItemId): number {
  const sate = ITEMS[id].sate
  return sate !== undefined ? sate * DISH_PRICE.perSate + DISH_PRICE.base : SELL_PRICE[id as RawItemId]
}

export type VendorId = 'butcher' | 'general' | 'grocer'
export const VENDOR_IDS: VendorId[] = ['butcher', 'general', 'grocer']

/** 누가 무엇을 사고(buys) 파는지(sells). 은지 VENDORS 그대로: 정육점 고기·요리 삼 / 잡화점 뼈·비계·광석 삼 (탄약은 AMMO_PACKS) / 농산물 사고팜 */
export const VENDOR_TRADE: Record<VendorId, { buys: (id: ItemId) => boolean; sells: ItemId[] }> = {
  butcher: { buys: (id) => hasTag(id, 'meat') || hasTag(id, 'dish'), sells: [] },
  general: { buys: (id) => id === 'bone' || id === 'fat' || isOre(id), sells: [] },
  grocer: { buys: (id) => id === 'egg' || id === 'pumpkin' || id === 'mushroom', sells: ['egg', 'pumpkin', 'mushroom'] },
}
