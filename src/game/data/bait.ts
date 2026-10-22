import type { Rarity } from './types'

export type BaitId = 'worm' | 'shrimp' | 'lure'

export type BaitDef = {
  id: BaitId
  name: string
  description: string
  /** 1개 가격 */
  price: number
  /** 낚시 중 이 미끼를 고르는 키 (e.code) */
  key: string
  /** 희귀도 묶음 가중치에 곱하는 값. 없는 희귀도는 ×1 */
  rarityMul: Partial<Record<Rarity, number>>
}

/** 미끼. 던질 때마다 1개 쓴다. 없으면 미끼 없이(기본 확률로) 던진다 */
export const BAITS: BaitDef[] = [
  { id: 'worm', name: '지렁이', description: '꿈틀꿈틀 기본 미끼. 잡어가 절반만 걸린다', price: 5, key: 'Digit1', rarityMul: { junk: 0.5 } },
  { id: 'shrimp', name: '새우', description: '희귀·에픽 물고기가 1.5배 잘 문다', price: 20, key: 'Digit2', rarityMul: { rare: 1.5, epic: 1.5 } },
  { id: 'lure', name: '루어', description: '반짝반짝 가짜 미끼. 희귀 2배·에픽 2.5배·전설 2배', price: 60, key: 'Digit3', rarityMul: { rare: 2, epic: 2.5, legendary: 2 } },
]

export const BAIT_IDS: BaitId[] = BAITS.map((b) => b.id)

/** 낚시 중 "미끼 없이"를 고르는 키 */
export const NO_BAIT_KEY = 'Digit0'

/** 상점에서 한 번에 고를 수 있는 최대 수량 */
export const BAIT_MAX_QTY = 20

export function getBait(id: BaitId): BaitDef {
  const bait = BAITS.find((b) => b.id === id)
  if (!bait) throw new Error(`알 수 없는 미끼: ${id}`)
  return bait
}
