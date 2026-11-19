import { CAMERA_ZOOM, NEAR_VIEW } from '../data/balance'
import type { Mode } from './interaction'

/** 줌 범위 (m) */
export type ZoomRange = { min: number; max: number }
/** 섬 줌 범위 */
export const ISLAND_ZOOM: ZoomRange = { min: CAMERA_ZOOM.min, max: CAMERA_ZOOM.max }
/** 초원 줌 범위 (은지 집·마을은 가까이서 본다) */
export const MEADOW_ZOOM: ZoomRange = { min: NEAR_VIEW.meadowMin, max: NEAR_VIEW.meadowMax }

const clampZoom = (d: number, r: ZoomRange) => Math.min(r.max, Math.max(r.min, d))

/** 휠 한 번 → 새 카메라 거리. 곱셈으로 바꿔서 가까울수록 섬세하게 움직인다 */
export function nextZoom(distance: number, wheelDeltaY: number, range: ZoomRange = ISLAND_ZOOM): number {
  if (!Number.isFinite(wheelDeltaY)) return distance
  return clampZoom(distance * Math.exp(wheelDeltaY * CAMERA_ZOOM.sensitivity), range)
}

/**
 * 두 손가락 벌리기·오므리기 → 새 카메라 거리. 손가락 사이가 두 배로 벌어지면 거리는 절반 (가까이).
 * prevSpan·span 은 손가락 사이 거리(px). 이상한 값이면 그대로 둔다
 */
export function pinchZoom(distance: number, prevSpan: number, span: number, range: ZoomRange = ISLAND_ZOOM): number {
  if (!(prevSpan > 0) || !(span > 0) || !Number.isFinite(prevSpan) || !Number.isFinite(span)) return distance
  return clampZoom(distance * (prevSpan / span), range)
}

const ZOOM_MODES: Mode[] = ['explore', 'fishing', 'rest', 'boat']

export function canZoom(mode: Mode): boolean {
  return ZOOM_MODES.includes(mode)
}
