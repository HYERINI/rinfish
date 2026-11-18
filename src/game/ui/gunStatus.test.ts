import { describe, expect, it } from 'vitest'
import { gunStatus } from './gunStatus'

describe('총 상태 한 줄', () => {
  it('장전 중이 먼저, 빈 탄창은 예비가 있으면 R 장전 · 없으면 잡화점', () => {
    expect(gunStatus('pistol', 0, 0, true)).toBe('장전 중…')
    expect(gunStatus('pistol', 0, 12, false)).toBe('R 장전')
    expect(gunStatus('pistol', 0, 0, false)).toBe('탄약 없음 · 마을 잡화점에서 사요')
    expect(gunStatus('rifle', 30, 120, false)).toBe('누르고 있으면 연사')
    expect(gunStatus('pistol', 5, 0, false)).toBe('')
  })
})
