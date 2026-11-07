/** 마지막으로 허락한 시각(last)에서 every 초가 지났나. 시각은 초 */
export function allowEvery(last: number, now: number, every: number): boolean {
  return now - last >= every
}

/** 1초 창: 창을 연 시각과 그 안에서 허락한 횟수 */
export type RateWindow = { start: number; count: number }
export const NEW_WINDOW: RateWindow = { start: -Infinity, count: 0 }

/** 1초 창 안에서 max 번까지 허락한다. 창이 지나면 새 창을 연다 */
export function allowPerSecond(w: RateWindow, now: number, max: number): { ok: boolean; w: RateWindow } {
  if (now - w.start >= 1) return { ok: true, w: { start: now, count: 1 } }
  if (w.count >= max) return { ok: false, w }
  return { ok: true, w: { start: w.start, count: w.count + 1 } }
}
