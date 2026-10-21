import { CAMERA_ZOOM } from '../data/balance'
import type { Mode } from './interaction'

/** 휠 한 번 → 새 카메라 거리. 곱셈으로 바꿔서 가까울수록 섬세하게 움직인다 */
export function nextZoom(distance: number, wheelDeltaY: number): number {
  if (!Number.isFinite(wheelDeltaY)) return distance
  const next = distance * Math.exp(wheelDeltaY * CAMERA_ZOOM.sensitivity)
  return Math.min(CAMERA_ZOOM.max, Math.max(CAMERA_ZOOM.min, next))
}

const ZOOM_MODES: Mode[] = ['explore', 'fishing', 'rest']

export function canZoom(mode: Mode): boolean {
  return ZOOM_MODES.includes(mode)
}
