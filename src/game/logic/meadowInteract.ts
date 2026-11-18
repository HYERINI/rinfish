import { isSameInteractable, type Interactable } from './interaction'

/** E 가 닿는 거리 (은지 값, 바닥 거리 m) */
export const MEADOW_REACH = { pickup: 1.6, stove: 1.6, door: 2.5, vendor: 2.8 }

/** 초원(은지 좌표)의 E 대상 하나 */
export type MeadowSpot = { target: Interactable; x: number; z: number; reach: number }

/**
 * 가장 가까운 대상 (은지 consider: 높이는 보지 않고 바닥 거리, 각자 거리보다 가까워야 한다). 없으면 null.
 * usable 이 false 인 것(따서 숨긴 버섯 등)은 건너뛴다
 */
export function nearestSpot(px: number, pz: number, spots: readonly MeadowSpot[], usable: (s: MeadowSpot) => boolean = () => true): Interactable | null {
  let best: MeadowSpot | null = null
  let bestD = Infinity
  for (const s of spots) {
    const d = Math.hypot(s.x - px, s.z - pz)
    if (d < s.reach && d < bestD && usable(s)) {
      best = s
      bestD = d
    }
  }
  return best?.target ?? null
}

/** 초원 감시자(MeadowInteractions)가 정하는 E 대상 종류. 그 밖(침대 감지 상자·물가 낚시 등)은 건드리지 않는다 */
const MEADOW_KINDS: ReadonlySet<string> = new Set(['pickup', 'stove', 'door', 'vendor'])

/**
 * 이번 프레임에 찾은 초원 대상(found)으로 nearby 를 어떻게 할까: 'keep' 그대로, 'clear' 지우기, 아니면 그 대상으로 바꾸기.
 * 감지 상자·물가 낚시가 이미 잡은 건 그쪽이 먼저라 늘 'keep'. 내가 잡은 것만 바꾸거나 지운다
 */
export function meadowNearbyUpdate(current: Interactable | null, found: Interactable | null): Interactable | 'clear' | 'keep' {
  if (current && !MEADOW_KINDS.has(current.kind)) return 'keep'
  if (found) return isSameInteractable(current, found) ? 'keep' : found
  return current ? 'clear' : 'keep'
}
