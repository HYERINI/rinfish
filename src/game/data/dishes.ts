import type { BuffKind, DishId, Rarity } from './types'

/** 메뉴 분류: 찜(미스터찜 대표 메뉴) · 회와 탕 · 비밀 메뉴 */
export type DishCategory = 'steam' | 'raw' | 'secret'

export type DishDef = {
  id: DishId
  name: string
  description: string
  category: DishCategory
  /** 물고기와 함께 내는 조리비 */
  cookFee: number
  /** 일반 물고기로 만들었을 때 회복량 (희귀도 배율이 곱해진다. 여러 마리면 배율 평균) */
  heal: number
  /** duration: 일반 물고기로 만들었을 때 지속시간(초) */
  buff: { kind: BuffKind; mul: number; duration: number } | null
  /**
   * 재료 물고기: count 마리. rarities 가 있으면 그 희귀도만, speciesId 가 있으면 그 물고기만
   */
  needs: { count: number; rarities?: Rarity[]; speciesId?: string }
  /** 이 요리를 내올 때 사장님이 하는 말 (없으면 COOK_LINES 에서 아무거나) */
  chefLine?: string
}

const RARE_UP: Rarity[] = ['rare', 'epic', 'legendary']

export const DISHES: DishDef[] = [
  { id: 'fishSteam', name: '물고기찜', description: '일반 물고기 한 마리를 푹 쪄 낸 기본 찜', category: 'steam', cookFee: 10, heal: 30, buff: null, needs: { count: 1, rarities: ['common'] } },
  {
    id: 'spicySteam',
    name: '매콤 해물찜',
    description: '물고기 두 마리로 만드는 매콤한 찜. 잠시 텐션 상승 완화',
    category: 'steam',
    cookFee: 25,
    heal: 50,
    buff: { kind: 'tension', mul: 0.75, duration: 120 },
    needs: { count: 2 },
  },
  {
    id: 'bossSteam',
    name: '사장님 특제 대왕찜',
    description: '희귀 이상 물고기로만 만드는 사장님 자신작. 잠시 릴 속도 증가',
    category: 'steam',
    cookFee: 40,
    heal: 80,
    buff: { kind: 'reel', mul: 1.35, duration: 150 },
    needs: { count: 1, rarities: RARE_UP },
  },
  { id: 'sashimi', name: '회', description: '체력 회복', category: 'raw', cookFee: 5, heal: 20, buff: null, needs: { count: 1 } },
  { id: 'bowl', name: '회덮밥', description: '체력 회복 + 잠시 릴 속도 증가', category: 'raw', cookFee: 15, heal: 15, buff: { kind: 'reel', mul: 1.3, duration: 90 }, needs: { count: 1 } },
  { id: 'stew', name: '매운탕', description: '체력 크게 회복 + 잠시 텐션 상승 완화', category: 'raw', cookFee: 25, heal: 40, buff: { kind: 'tension', mul: 0.75, duration: 90 }, needs: { count: 1 } },
  {
    id: 'xxlSteam',
    name: 'XXL배정빈찜 (8인분)',
    description: '보관함에 XXL배정빈이 있을 때만 열리는 비밀 메뉴. 8인분이라 오래 든든하다',
    category: 'secret',
    cookFee: 30,
    heal: 100,
    buff: { kind: 'reel', mul: 1.5, duration: 400 },
    needs: { count: 1, speciesId: 'eelgas-baejeongbin' },
    chefLine: '...이건 좀 양심이 찔리는데... 일단 찝니다',
  },
]

export const DISH_CATEGORY_LABEL: Record<DishCategory, string> = {
  steam: '찜',
  raw: '회·탕',
  secret: '비밀 메뉴',
}

export const BUFF_LABEL: Record<BuffKind, string> = {
  reel: '릴 속도 증가',
  tension: '텐션 완화',
}

export function getDish(id: DishId): DishDef {
  const dish = DISHES.find((d) => d.id === id)
  if (!dish) throw new Error(`알 수 없는 요리: ${id}`)
  return dish
}
