import { describe, expect, it } from 'vitest'
import { clampDelta } from './time'

describe('clampDelta', () => {
  it('보통 프레임 시간은 그대로', () => {
    expect(clampDelta(0.016)).toBe(0.016)
  })

  it('탭을 오래 비웠다 돌아와도 0.1초까지만 인정한다', () => {
    expect(clampDelta(30)).toBe(0.1)
  })

  it('음수나 NaN은 0으로 본다', () => {
    expect(clampDelta(-1)).toBe(0)
    expect(clampDelta(Number.NaN)).toBe(0)
  })
})
