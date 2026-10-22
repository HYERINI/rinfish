import { BAITS, NO_BAIT_KEY, type BaitId } from '../data/bait'
import type { ZoneId } from '../data/types'
import type { FishingPlace } from './fishingEdge'

/**
 * 지금 플레이어가 무엇을 하고 있는지 (어떤 화면이 열려 있는지). rest = 벤치에 앉아 쉬는 중,
 * unlock = 잠긴 구역 문 앞에서 여는 창, cutscene = 수리기사님 연출 (조작 없음)
 */
export type Mode = 'explore' | 'fishing' | 'sell' | 'shop' | 'dex' | 'menu' | 'market' | 'aquarium' | 'rest' | 'wardrobe' | 'aquariumView' | 'unlock' | 'cutscene'

/** E 키로 상호작용할 수 있는 대상. fishingSpot 은 물가에 선 자리에서 그때그때 만든 낚시 자리 (logic/fishingEdge) */
export type Interactable =
  | { kind: 'fishingSpot'; spot: FishingPlace }
  | { kind: 'sellBox' }
  | { kind: 'gearShop' }
  | { kind: 'market' }
  | { kind: 'bench' }
  | { kind: 'aquarium' }
  | { kind: 'wardrobe' }
  | { kind: 'zoneGate'; zoneId: ZoneId }

export function isSameInteractable(a: Interactable | null, b: Interactable): boolean {
  if (!a || a.kind !== b.kind) return false
  if (a.kind === 'fishingSpot' && b.kind === 'fishingSpot') return a.spot.id === b.spot.id
  if (a.kind === 'zoneGate' && b.kind === 'zoneGate') return a.zoneId === b.zoneId
  return true
}

export type KeyAction =
  | { type: 'none' }
  | { type: 'startFishing'; spot: FishingPlace }
  | { type: 'openMode'; mode: Mode }
  | { type: 'stopFishing' }
  | { type: 'closePanel' }
  | { type: 'selectBait'; bait: BaitId | null }

/** 요리 연출을 건너뛰는 키 (E·Space·Enter·ESC). 수리 연출은 건너뛰지 않는다 */
export function isCookingSkipKey(code: string): boolean {
  return code === 'KeyE' || code === 'Space' || code === 'Enter' || code === 'Escape'
}

/** panelLocked: 지금 패널을 닫으면 안 된다 (처음 캐릭터를 만드는 중) */
export function resolveKeyAction(code: string, mode: Mode, nearby: Interactable | null, panelLocked = false): KeyAction {
  // 연출 중엔 아무 키도 받지 않는다 (끝나면 저절로 탐험으로 돌아온다)
  if (mode === 'cutscene') return { type: 'none' }
  if (code === 'Escape') {
    if (panelLocked) return { type: 'none' }
    if (mode === 'aquariumView') return { type: 'openMode', mode: 'aquarium' }
    if (mode === 'explore') return { type: 'openMode', mode: 'menu' }
    if (mode === 'fishing') return { type: 'stopFishing' }
    return { type: 'closePanel' }
  }
  // 낚시 중 숫자 키는 미끼 고르기 (탐험 중 숫자 키는 감정 표현이라 여기서 받지 않는다)
  if (mode === 'fishing') {
    if (code === NO_BAIT_KEY) return { type: 'selectBait', bait: null }
    const bait = BAITS.find((b) => b.key === code)
    if (bait) return { type: 'selectBait', bait: bait.id }
  }
  // 벤치에 앉아 있으면 E로도 일어난다
  if (code === 'KeyE' && mode === 'rest') return { type: 'closePanel' }
  if (code === 'KeyE' && mode === 'explore' && nearby) {
    switch (nearby.kind) {
      case 'fishingSpot':
        return { type: 'startFishing', spot: nearby.spot }
      case 'sellBox':
        return { type: 'openMode', mode: 'sell' }
      case 'gearShop':
        return { type: 'openMode', mode: 'shop' }
      case 'market':
        return { type: 'openMode', mode: 'market' }
      case 'aquarium':
        return { type: 'openMode', mode: 'aquarium' }
      case 'wardrobe':
        return { type: 'openMode', mode: 'wardrobe' }
      case 'bench':
        return { type: 'openMode', mode: 'rest' }
      case 'zoneGate':
        return { type: 'openMode', mode: 'unlock' }
    }
  }
  return { type: 'none' }
}
