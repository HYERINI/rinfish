import type { FishInstance, TankTypeId, ZoneId } from './types'

export type TankLevelDef = {
  slots: number
  incomeMul: number
  /** 이 단계로 확장하는 가격. Lv1은 0 */
  price: number
  /** 3D 어항 크기 [가로, 높이, 세로] */
  size: [number, number, number]
}

/** 어항 단계. 구경꾼 길과 겹치지 않게 가로·세로는 Lv5부터 그대로 두고 높이만 키운다 */
export const TANK_LEVELS: TankLevelDef[] = [
  { slots: 6, incomeMul: 1, price: 0, size: [3, 1.6, 1.4] },
  { slots: 8, incomeMul: 1.1, price: 200, size: [3.5, 1.7, 1.5] },
  { slots: 9, incomeMul: 1.2, price: 350, size: [4, 1.8, 1.6] },
  { slots: 11, incomeMul: 1.35, price: 600, size: [4.5, 1.9, 1.7] },
  { slots: 12, incomeMul: 1.5, price: 900, size: [5, 2, 1.8] },
  { slots: 14, incomeMul: 1.65, price: 1300, size: [5, 2.15, 1.8] },
  { slots: 15, incomeMul: 1.8, price: 1800, size: [5, 2.3, 1.8] },
  { slots: 17, incomeMul: 2, price: 2400, size: [5, 2.45, 1.8] },
  { slots: 18, incomeMul: 2.2, price: 3200, size: [5, 2.6, 1.8] },
  { slots: 20, incomeMul: 2.5, price: 4200, size: [5, 2.75, 1.8] },
]

/** 5단계였던 저장본의 어항 단계 → 지금 10단계 중 같은 칸 수 자리 */
export const TANK_LEVEL_FROM_V1 = [0, 2, 4, 6, 8]

export type TankTypeDef = {
  id: TankTypeId
  name: string
  description: string
  price: number
  /** 이 구역 물고기를 전시하면 수입 보너스 */
  bonusZones: ZoneId[]
  water: string
  waterOpacity: number
  floor: string
}

export const TANK_TYPES: TankTypeDef[] = [
  { id: 'basic', name: '기본 유리 어항', description: '투명 유리, 모래 바닥', price: 0, bonusZones: [], water: '#cfefff', waterOpacity: 0.12, floor: '#e9d8a6' },
  { id: 'sea', name: '바다 수조', description: '파란 물, 산호. 해변·암초 물고기 보너스', price: 300, bonusZones: ['beach', 'reef'], water: '#29b6f6', waterOpacity: 0.28, floor: '#f5deb3' },
  { id: 'fresh', name: '민물 수조', description: '초록 물, 수초·돌. 연못 물고기 보너스', price: 300, bonusZones: ['pond'], water: '#66bb6a', waterOpacity: 0.28, floor: '#6d4c41' },
  { id: 'cave', name: '동굴 수조', description: '어두운 물, 발광 이끼. 동굴 물고기 보너스', price: 600, bonusZones: ['cave'], water: '#1a237e', waterOpacity: 0.45, floor: '#37474f' },
]

export function getTankType(id: TankTypeId): TankTypeDef {
  const type = TANK_TYPES.find((t) => t.id === id)
  if (!type) throw new Error(`알 수 없는 어항 종류: ${id}`)
  return type
}

/**
 * 구경용 물고기: 크게 보기에서 전시한 물고기가 하나도 없을 때만 대신 헤엄치는 흔한 물고기들.
 * 플레이어 물고기가 아니라서 입장료·먹이·방생에 들어가지 않는다
 */
export const SHOWCASE_FISH: FishInstance[] = [
  { id: 'showcase-sardine', speciesId: 'sleepy-sardine', weight: 0.2, caughtAtPlayTime: 0 },
  { id: 'showcase-mackerel', speciesId: 'chatty-mackerel', weight: 0.4, caughtAtPlayTime: 0 },
  { id: 'showcase-puffer', speciesId: 'bubble-puffer', weight: 0.5, caughtAtPlayTime: 0 },
  { id: 'showcase-minnow', speciesId: 'firefly-minnow', weight: 0.1, caughtAtPlayTime: 0 },
  { id: 'showcase-seabream', speciesId: 'buff-seabream', weight: 1.8, caughtAtPlayTime: 0 },
]
