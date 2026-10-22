import type { FishInstance, TankTypeId, ZoneId } from './types'

export type TankLevelDef = {
  slots: number
  incomeMul: number
  /** 이 단계로 확장하는 가격. Lv1은 0 */
  price: number
  /** 3D 어항 크기 [가로, 높이, 세로] */
  size: [number, number, number]
}

export const TANK_LEVELS: TankLevelDef[] = [
  { slots: 6, incomeMul: 1, price: 0, size: [3, 1.6, 1.4] },
  { slots: 9, incomeMul: 1.2, price: 400, size: [4, 1.8, 1.6] },
  { slots: 12, incomeMul: 1.5, price: 1000, size: [5, 2, 1.8] },
]

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
