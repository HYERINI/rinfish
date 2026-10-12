import { MAX_FRAME_DELTA } from '../data/balance'

/** 프레임 delta를 0 ~ MAX_FRAME_DELTA 로 제한 */
export function clampDelta(delta: number): number {
  if (!Number.isFinite(delta) || delta < 0) return 0
  return Math.min(delta, MAX_FRAME_DELTA)
}
