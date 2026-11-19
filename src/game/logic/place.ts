import { CAMERA_ZOOM, NEAR_VIEW } from '../data/balance'
import { MEADOW_OFFSET_X, START_SPOT } from '../data/meadow'
import { MOUSE_LOOK } from '../data/settings'
import type { ZoneId } from '../data/types'
import { FENCE_Z } from '../data/zones'
import { landAt } from './land'

/** 다시 들어왔을 때 이어서 시작할 자리: 서 있던 곳·바라보던 방향·카메라(섬·초원 줌 따로)·벤치에 앉아 있었는지 */
export type Place = { x: number; z: number; facing: number; yaw: number; pitch: number; zoom: number; meadowZoom: number; resting: boolean }

/** 처음 시작하는 자리 (초원 은지 집 마당) */
export const START_PLACE: Place = { x: START_SPOT[0], z: START_SPOT[1], facing: Math.PI, yaw: 0, pitch: 0, zoom: CAMERA_ZOOM.initial, meadowZoom: NEAR_VIEW.meadowInitial, resting: false }

/** 저장할 만큼 움직였나 (조금씩 움직일 때마다 저장하지 않게) */
export function placeMoved(a: Place, b: Place): boolean {
  return Math.hypot(a.x - b.x, a.z - b.z) > 0.3 || Math.abs(a.facing - b.facing) > 0.1 || Math.abs(a.yaw - b.yaw) > 0.05 || Math.abs(a.pitch - b.pitch) > 0.05 || Math.abs(a.zoom - b.zoom) > 0.2 || Math.abs(a.meadowZoom - b.meadowZoom) > 0.2 || a.resting !== b.resting
}

/**
 * 지금 자리를 저장해도 되나: 몸이 물리로 움직이고(배 위 키네마틱이 아님), 순간이동을 기다리지 않고, 땅 위다.
 * 배 타는 중·쓰러져 진료소로 옮기기 직전엔 바다 자리를 저장하지 않는다
 */
export function canSavePlace(x: number, z: number, physical: boolean, teleportPending: boolean): boolean {
  return physical && !teleportPending && landAt(x, z) !== null
}

const num = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)

/**
 * 저장본을 검증해서 쓸 수 있는 자리로. 깨졌거나 땅(섬·초원) 밖이거나, 섬에서 아직 아무 구역도 안 열었는데 울타리 북쪽이면
 * (저장본을 손대거나 예전 진행으로 돌아간 경우) 처음 자리로
 */
export function normalizePlace(raw: unknown, unlocked: readonly ZoneId[]): Place {
  if (!raw || typeof raw !== 'object') return START_PLACE
  const r = raw as Record<string, unknown>
  if (!num(r.x) || !num(r.z)) return START_PLACE
  const land = landAt(r.x, r.z)
  if (!land) return START_PLACE
  // 섬 울타리 북쪽(잠긴 구역 쪽)은 한 곳이라도 열려 있어야 갈 수 있다 (열린 문으로 북쪽이 다 이어진다)
  if (land === 'island' && r.z < FENCE_Z && !unlocked.some((z) => z !== 'beach')) return START_PLACE
  const zoom = num(r.zoom) ? Math.min(CAMERA_ZOOM.max, Math.max(CAMERA_ZOOM.min, r.zoom)) : START_PLACE.zoom
  const meadowZoom = num(r.meadowZoom) ? Math.min(NEAR_VIEW.meadowMax, Math.max(NEAR_VIEW.meadowMin, r.meadowZoom)) : START_PLACE.meadowZoom
  const pitch = num(r.pitch) ? Math.min(MOUSE_LOOK.maxPitch, Math.max(MOUSE_LOOK.minPitch, r.pitch)) : 0
  return {
    x: r.x,
    z: r.z,
    facing: num(r.facing) ? r.facing : START_PLACE.facing,
    yaw: num(r.yaw) ? r.yaw : 0,
    pitch,
    zoom,
    meadowZoom,
    // 벤치는 섬에만 있다
    resting: land === 'island' && r.resting === true,
  }
}

/** 저장본 v1 의 초원 자리 기준 (그때 초원은 은지 좌표를 동쪽으로 200m 옮겼다. 지금은 MEADOW_OFFSET_X) */
const V1_MEADOW_OFFSET_X = 200
/** v1 에서 이 x 보다 동쪽이면 초원 자리였다 (섬 x ≤ 30, 초원 x ≥ 84) */
const V1_MEADOW_FROM_X = 60

/** 저장본 v1 → v2: 초원을 줄이며 섬 쪽으로 당긴 만큼 초원 자리를 같이 옮긴다. 검증은 normalizePlace 가 한다 */
export function migratePlaceV1(raw: unknown): unknown {
  if (!raw || typeof raw !== 'object') return raw
  const r = raw as Record<string, unknown>
  if (!num(r.x) || r.x <= V1_MEADOW_FROM_X) return raw
  return { ...r, x: r.x - (V1_MEADOW_OFFSET_X - MEADOW_OFFSET_X) }
}
