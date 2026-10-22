export type SnackId = 'gimbap' | 'ramen' | 'energy'

export type SnackDef = {
  id: SnackId
  name: string
  description: string
  /** 1개 가격 */
  price: number
  /** 먹으면 바로 오르는 체력 */
  heal: number
}

/** 미스터찜 간식. 물고기 없이 코인만으로 사서 바로 먹거나 가방에 넣어 두고 HUD 에서 꺼내 먹는다 */
export const SNACKS: SnackDef[] = [
  { id: 'gimbap', name: '김밥', description: '든든한 한 줄', price: 10, heal: 25 },
  { id: 'ramen', name: '컵라면', description: '뜨끈한 국물이 최고', price: 20, heal: 45 },
  { id: 'energy', name: '에너지 음료', description: '한 캔이면 기운이 번쩍', price: 35, heal: 70 },
]

export const SNACK_IDS: SnackId[] = SNACKS.map((s) => s.id)

/** 가방에 한 번에 담을 수 있는 최대 수량 (상점에서 한 번에 고르는 수) */
export const SNACK_MAX_QTY = 10

export function getSnack(id: SnackId): SnackDef {
  const snack = SNACKS.find((s) => s.id === id)
  if (!snack) throw new Error(`알 수 없는 간식: ${id}`)
  return snack
}
