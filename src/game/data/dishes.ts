import type { BuffKind, DishId } from './types'

export type DishDef = {
  id: DishId
  name: string
  description: string
  /** 물고기 1마리와 함께 내는 조리비 */
  cookFee: number
  /** 일반 물고기로 만들었을 때 회복량 (희귀도 배율이 곱해진다) */
  heal: number
  /** duration: 일반 물고기로 만들었을 때 지속시간(초) */
  buff: { kind: BuffKind; mul: number; duration: number } | null
}

export const DISHES: DishDef[] = [
  { id: 'sashimi', name: '회', description: '체력 회복', cookFee: 5, heal: 20, buff: null },
  { id: 'bowl', name: '회덮밥', description: '체력 회복 + 잠시 릴 속도 증가', cookFee: 15, heal: 15, buff: { kind: 'reel', mul: 1.3, duration: 90 } },
  { id: 'stew', name: '매운탕', description: '체력 크게 회복 + 잠시 텐션 상승 완화', cookFee: 25, heal: 40, buff: { kind: 'tension', mul: 0.75, duration: 90 } },
]

export const BUFF_LABEL: Record<BuffKind, string> = {
  reel: '릴 속도 증가',
  tension: '텐션 완화',
}

export function getDish(id: DishId): DishDef {
  const dish = DISHES.find((d) => d.id === id)
  if (!dish) throw new Error(`알 수 없는 요리: ${id}`)
  return dish
}
