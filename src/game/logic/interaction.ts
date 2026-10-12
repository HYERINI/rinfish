/** 지금 플레이어가 무엇을 하고 있는지 (어떤 화면이 열려 있는지) */
export type Mode = 'explore' | 'fishing' | 'sell' | 'shop' | 'dex' | 'menu'

/** E 키로 상호작용할 수 있는 대상 */
export type Interactable = { kind: 'fishingSpot'; spotId: string } | { kind: 'sellBox' } | { kind: 'gearShop' }

export function isSameInteractable(a: Interactable | null, b: Interactable): boolean {
  if (!a || a.kind !== b.kind) return false
  if (a.kind === 'fishingSpot' && b.kind === 'fishingSpot') return a.spotId === b.spotId
  return true
}
