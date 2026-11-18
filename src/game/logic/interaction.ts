import { BAITS, NO_BAIT_KEY, type BaitId } from '../data/bait'
import type { RawItemId } from '../data/meadowItems'
import type { VendorId } from '../data/meadowPrices'
import { HOTBAR, hotbarSlot, type ToolId } from '../data/tools'
import type { ZoneId } from '../data/types'
import type { BoatDir } from './boatRoute'
import type { FishingPlace } from './fishingEdge'

/**
 * 지금 플레이어가 무엇을 하고 있는지 (어떤 화면이 열려 있는지). rest = 벤치에 앉아 쉬는 중,
 * unlock = 잠긴 구역 문 앞에서 여는 창, cutscene = 수리기사님 연출 (조작 없음), boat = 배 타고 건너는 중 (조작 없음),
 * map = 큰 지도 (이동·E 막힘, ESC·Tab 으로 닫는다), sleep = 잠·죽음으로 화면이 어두워지는 중이거나 같이 하기에서 침대에 누워 아침을 기다리는 중 (이동 막힘),
 * emote = T 를 누르고 있는 동안 감정 표현 바퀴 (이동·E 막힘, 떼면 고른 것을 한다. ui/EmoteWheel), bag = 가방 (I, 가스레인지에선 요리법),
 * vendor = 마을 상인 사고팔기 (어느 상인인지는 sessionStore.vendor), rack = 사격장 무기 선반에서 무기 고르기
 */
export type Mode =
  | 'explore'
  | 'fishing'
  | 'sell'
  | 'shop'
  | 'dex'
  | 'menu'
  | 'market'
  | 'aquarium'
  | 'rest'
  | 'wardrobe'
  | 'aquariumView'
  | 'unlock'
  | 'cutscene'
  | 'lobby'
  | 'boat'
  | 'map'
  | 'sleep'
  | 'emote'
  | 'bag'
  | 'vendor'
  | 'rack'

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
  | { kind: 'dock'; dir: BoatDir }
  | { kind: 'bed' }
  /** 초원 버섯·호박 (index: 은지 outdoor.pickups 순서) */
  | { kind: 'pickup'; index: number; item: 'mushroom' | 'pumpkin' }
  /** 초원 부엌 가스레인지 */
  | { kind: 'stove' }
  /** 은지 집 문 (index: MEADOW_DOORS 순서) */
  | { kind: 'door'; index: number }
  /** 마을 상인 */
  | { kind: 'vendor'; id: VendorId }
  /** 바닥에 떨어진 사냥 전리품 (key: hunt/animalRig 번호) */
  | { kind: 'loot'; key: number; item: RawItemId }
  /** 사격장 무기 선반 */
  | { kind: 'rack' }

export function isSameInteractable(a: Interactable | null, b: Interactable): boolean {
  if (!a || a.kind !== b.kind) return false
  if (a.kind === 'fishingSpot' && b.kind === 'fishingSpot') return a.spot.id === b.spot.id
  if (a.kind === 'zoneGate' && b.kind === 'zoneGate') return a.zoneId === b.zoneId
  if (a.kind === 'dock' && b.kind === 'dock') return a.dir === b.dir
  if (a.kind === 'pickup' && b.kind === 'pickup') return a.index === b.index
  if (a.kind === 'door' && b.kind === 'door') return a.index === b.index
  if (a.kind === 'vendor' && b.kind === 'vendor') return a.id === b.id
  if (a.kind === 'loot' && b.kind === 'loot') return a.key === b.key
  return true
}

export type KeyAction =
  | { type: 'none' }
  | { type: 'startFishing'; spot: FishingPlace }
  | { type: 'openMode'; mode: Mode }
  | { type: 'stopFishing' }
  | { type: 'closePanel' }
  | { type: 'selectBait'; bait: BaitId | null }
  | { type: 'boardBoat'; dir: BoatDir }
  /** 침대에서 잠자기 (혼자: 다음 날 아침 / 같이: 잠 투표) */
  | { type: 'sleep' }
  /** 같이 하기 잠 투표 그만두고 일어나기 */
  | { type: 'wake' }
  /** Tab: 큰 지도 열기/닫기 */
  | { type: 'toggleMap' }
  /** 도구 칸 고르기 (1~9) 또는 손에 든 것 넣기 (X, tool null) */
  | { type: 'equip'; tool: ToolId | null }
  /** F: 가방에서 배고픔을 가장 많이 채우는 것을 먹는다 */
  | { type: 'eatBest' }
  /** R: 든 총 장전 */
  | { type: 'reload' }
  /** V: 1인칭 / 3인칭 */
  | { type: 'toggleView' }
  /** G: 사격장 연습 게임 시작·그만 */
  | { type: 'rangeGame' }
  /** 버섯·호박 따기 */
  | { type: 'harvest'; index: number }
  /** 문 열기/닫기 */
  | { type: 'toggleDoor'; index: number }
  /** 상인 사고팔기 창 */
  | { type: 'openVendor'; id: VendorId }
  /** 전리품 줍기 */
  | { type: 'pickLoot'; key: number }

/** 요리 연출을 건너뛰는 키 (E·Space·Enter·ESC). 수리 연출은 건너뛰지 않는다 */
export function isCookingSkipKey(code: string): boolean {
  return code === 'KeyE' || code === 'Space' || code === 'Enter' || code === 'Escape'
}

/** panelLocked: 지금 패널을 닫으면 안 된다 (처음 캐릭터를 만드는 중) */
export function resolveKeyAction(code: string, mode: Mode, nearby: Interactable | null, panelLocked = false): KeyAction {
  // Tab: 큰 지도 (배 타는 중에도 열고, 메뉴에서도 연다 — 메뉴의 지도 버튼과 같다)
  if (code === 'Tab') return mode === 'explore' || mode === 'boat' || mode === 'menu' || mode === 'map' ? { type: 'toggleMap' } : { type: 'none' }
  // 연출 중에도, 배 타는 중에도 아무 키도 받지 않는다 (끝나면 저절로 탐험으로 돌아온다). 로비는 혼자/같이를 골라야 닫힌다
  if (mode === 'cutscene' || mode === 'lobby' || mode === 'boat') return { type: 'none' }
  // 침대에 누워 있는 동안 E·ESC 는 일어나기 (화면이 어두워지는 중이면 dayActions.wake 가 무시한다)
  if (mode === 'sleep') return code === 'KeyE' || code === 'Escape' ? { type: 'wake' } : { type: 'none' }
  if (code === 'Escape') {
    if (panelLocked) return { type: 'none' }
    if (mode === 'aquariumView') return { type: 'openMode', mode: 'aquarium' }
    if (mode === 'explore') return { type: 'openMode', mode: 'menu' }
    if (mode === 'fishing') return { type: 'stopFishing' }
    return { type: 'closePanel' }
  }
  // 낚시 중 숫자 키는 미끼 고르기
  if (mode === 'fishing') {
    if (code === NO_BAIT_KEY) return { type: 'selectBait', bait: null }
    const bait = BAITS.find((b) => b.key === code)
    if (bait) return { type: 'selectBait', bait: bait.id }
  }
  // 탐험 중 숫자 키는 도구 칸 (빈 칸은 무시), X 는 손에 든 것 넣기
  if (mode === 'explore') {
    const slot = hotbarSlot(code)
    if (slot !== null) return HOTBAR[slot] ? { type: 'equip', tool: HOTBAR[slot] } : { type: 'none' }
    if (code === 'KeyX') return { type: 'equip', tool: null }
    if (code === 'KeyF') return { type: 'eatBest' }
    if (code === 'KeyR') return { type: 'reload' }
    if (code === 'KeyV') return { type: 'toggleView' }
    if (code === 'KeyG') return { type: 'rangeGame' }
    if (code === 'KeyI') return { type: 'openMode', mode: 'bag' }
  }
  // 가방은 I 로도 닫는다
  if (code === 'KeyI' && mode === 'bag') return { type: 'closePanel' }
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
      case 'dock':
        return { type: 'boardBoat', dir: nearby.dir }
      case 'bed':
        return { type: 'sleep' }
      case 'pickup':
        return { type: 'harvest', index: nearby.index }
      case 'door':
        return { type: 'toggleDoor', index: nearby.index }
      case 'vendor':
        return { type: 'openVendor', id: nearby.id }
      case 'loot':
        return { type: 'pickLoot', key: nearby.key }
      case 'rack':
        return { type: 'openMode', mode: 'rack' }
      case 'stove':
        // 가방의 요리법 탭이 열린다 (BagPanel 이 가스레인지 앞인지 본다)
        return { type: 'openMode', mode: 'bag' }
    }
  }
  return { type: 'none' }
}
