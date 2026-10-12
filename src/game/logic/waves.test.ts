import { describe, expect, it } from 'vitest'
import { WAVES, waveHeight } from './waves'

describe('waveHeight', () => {
  it('높이는 진폭 합을 넘지 않는다', () => {
    const max = WAVES.reduce((s, w) => s + w.amp, 0)
    for (let i = 0; i < 200; i++) {
      expect(Math.abs(waveHeight(i * 1.7, i * -2.3, i * 0.37))).toBeLessThanOrEqual(max + 1e-9)
    }
  })

  it('시간이 흐르면 같은 자리의 높이가 바뀐다', () => {
    expect(waveHeight(3, 4, 0)).not.toBeCloseTo(waveHeight(3, 4, 1))
  })
})
