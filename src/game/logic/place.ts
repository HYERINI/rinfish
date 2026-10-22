import { CAMERA_ZOOM } from '../data/balance'
import { MOUSE_LOOK } from '../data/settings'
import type { ZoneId } from '../data/types'
import { FENCE_Z, ISLAND_RADIUS } from '../data/zones'

/** 다시 들어왔을 때 이어서 시작할 자리: 서 있던 곳·바라보던 방향·카메라·벤치에 앉아 있었는지 */
export type Place = { x: number; z: number; facing: number; yaw: number; pitch: number; zoom: number; resting: boolean }

/** 처음 시작하는 자리 (선착장 해변) */
export const START_PLACE: Place = { x: 0, z: 15, facing: Math.PI, yaw: 0, pitch: 0, zoom: CAMERA_ZOOM.initial, resting: false }

/** 저장할 만큼 움직였나 (조금씩 움직일 때마다 저장하지 않게) */
export function placeMoved(a: Place, b: Place): boolean {
  return Math.hypot(a.x - b.x, a.z - b.z) > 0.3 || Math.abs(a.facing - b.facing) > 0.1 || Math.abs(a.yaw - b.yaw) > 0.05 || Math.abs(a.pitch - b.pitch) > 0.05 || Math.abs(a.zoom - b.zoom) > 0.2 || a.resting !== b.resting
}

const num = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)

/**
 * 저장본을 검증해서 쓸 수 있는 자리로. 깨졌거나 섬 밖이거나, 아직 아무 구역도 안 열었는데 울타리 북쪽이면
 * (저장본을 손대거나 예전 진행으로 돌아간 경우) 처음 자리로
 */
export function normalizePlace(raw: unknown, unlocked: readonly ZoneId[]): Place {
  if (!raw || typeof raw !== 'object') return START_PLACE
  const r = raw as Record<string, unknown>
  if (!num(r.x) || !num(r.z)) return START_PLACE
  if (Math.hypot(r.x, r.z) > ISLAND_RADIUS - 1) return START_PLACE
  // 울타리 북쪽(잠긴 구역 쪽)은 한 곳이라도 열려 있어야 갈 수 있다 (열린 문으로 북쪽이 다 이어진다)
  if (r.z < FENCE_Z && !unlocked.some((z) => z !== 'beach')) return START_PLACE
  const zoom = num(r.zoom) ? Math.min(CAMERA_ZOOM.max, Math.max(CAMERA_ZOOM.min, r.zoom)) : START_PLACE.zoom
  const pitch = num(r.pitch) ? Math.min(MOUSE_LOOK.maxPitch, Math.max(MOUSE_LOOK.minPitch, r.pitch)) : 0
  return {
    x: r.x,
    z: r.z,
    facing: num(r.facing) ? r.facing : START_PLACE.facing,
    yaw: num(r.yaw) ? r.yaw : 0,
    pitch,
    zoom,
    resting: r.resting === true,
  }
}
