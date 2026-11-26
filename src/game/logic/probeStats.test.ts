import { describe, expect, it } from 'vitest'
import { frameStats } from './probeStats'

describe('frameStats (측정 창의 FPS·느린 프레임)', () => {
  it('평균 간격으로 FPS, 95% 자리 간격을 느린 프레임으로', () => {
    const d = [...Array(19).fill(16), 50]
    expect(frameStats(d)).toEqual({ fps: Math.round(1000 / ((16 * 19 + 50) / 20)), p95: 50 })
  })
  it('일정하면 FPS 와 느린 프레임이 그 간격 그대로', () => {
    expect(frameStats(Array(60).fill(1000 / 60))).toEqual({ fps: 60, p95: 16.7 })
  })
  it('모은 게 없으면 0', () => {
    expect(frameStats([])).toEqual({ fps: 0, p95: 0 })
  })
})
