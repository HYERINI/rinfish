import { CAMERA_ZOOM } from '../data/balance'
import type { Mode } from './interaction'

/** 휠 한 번 → 새 카메라 거리. 곱셈으로 바꿔서 가까울수록 섬세하게 움직인다 */
export function nextZoom(distance: number, wheelDeltaY: number): number {
  if (!Number.isFinite(wheelDeltaY)) return distance
  const next = distance * Math.exp(wheelDeltaY * CAMERA_ZOOM.sensitivity)
  return Math.min(CAMERA_ZOOM.max, Math.max(CAMERA_ZOOM.min, next))
}

/**
 * 두 손가락 벌리기·오므리기 → 새 카메라 거리. 손가락 사이가 두 배로 벌어지면 거리는 절반 (가까이).
 * prevSpan·span 은 손가락 사이 거리(px). 이상한 값이면 그대로 둔다
 */
export function pinchZoom(distance: number, prevSpan: number, span: number): number {
  if (!(prevSpan > 0) || !(span > 0) || !Number.isFinite(prevSpan) || !Number.isFinite(span)) return distance
  const next = distance * (prevSpan / span)
  return Math.min(CAMERA_ZOOM.max, Math.max(CAMERA_ZOOM.min, next))
}

const ZOOM_MODES: Mode[] = ['explore', 'fishing', 'rest']

export function canZoom(mode: Mode): boolean {
  return ZOOM_MODES.includes(mode)
}
