import { describe, expect, it } from 'vitest'
import { NEW_WINDOW, allowEvery, allowPerSecond } from './rateLimit'

describe('rateLimit', () => {
  it('allowEvery: 간격이 지나야 다시 된다', () => {
    expect(allowEvery(-Infinity, 0, 1)).toBe(true)
    expect(allowEvery(10, 10.5, 1)).toBe(false)
    expect(allowEvery(10, 11, 1)).toBe(true)
  })
  it('allowPerSecond: 1초 창 안에서 max 번까지', () => {
    let w = NEW_WINDOW
    for (let i = 0; i < 3; i++) {
      const r = allowPerSecond(w, 5 + i * 0.1, 3)
      expect(r.ok).toBe(true)
      w = r.w
    }
    expect(allowPerSecond(w, 5.5, 3).ok).toBe(false)
    expect(allowPerSecond(w, 6.01, 3)).toEqual({ ok: true, w: { start: 6.01, count: 1 } })
  })
})
