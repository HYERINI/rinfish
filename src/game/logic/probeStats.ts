/** 측정 창(ProbeOverlay)의 숫자 (순수) */

/** 프레임 간격들(ms)로 평균 FPS 와 느린 프레임(95% 자리 간격, 소수 첫째 자리) */
export function frameStats(deltas: number[]): { fps: number; p95: number } {
  if (deltas.length === 0) return { fps: 0, p95: 0 }
  const avg = deltas.reduce((a, b) => a + b, 0) / deltas.length
  const sorted = [...deltas].sort((a, b) => a - b)
  const p95 = sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95))]
  return { fps: Math.round(1000 / avg), p95: Math.round(p95 * 10) / 10 }
}
