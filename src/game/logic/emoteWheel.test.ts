import { describe, expect, it } from 'vitest'
import { WHEEL_REACH, addAim, wheelPick, wheelSlot } from './emoteWheel'

describe('감정 표현 바퀴', () => {
  it('위가 0번, 시계 방향으로 칸이 이어진다 (5칸)', () => {
    expect(wheelPick(0, -100, 5)).toBe(0)
    expect(wheelPick(100, -30, 5)).toBe(1)
    expect(wheelPick(60, 100, 5)).toBe(2)
    expect(wheelPick(-60, 100, 5)).toBe(3)
    expect(wheelPick(-100, -30, 5)).toBe(4)
  })
  it('가운데 근처는 아무것도 고르지 않는다', () => {
    expect(wheelPick(5, 5, 5)).toBeNull()
    expect(wheelPick(0, 0, 5)).toBeNull()
  })
  it('칸 자리와 고르기가 맞는다', () => {
    for (let i = 0; i < 5; i++) {
      const p = wheelSlot(i, 5, 100)
      expect(wheelPick(p.x, p.y, 5)).toBe(i)
    }
  })
  it('마우스 잠금 중 움직임은 모으되 길이는 WHEEL_REACH 까지', () => {
    expect(addAim({ x: 0, y: 0 }, 10, -5)).toEqual({ x: 10, y: -5 })
    const far = addAim({ x: 100, y: 0 }, 500, 0)
    expect(far.x).toBeCloseTo(WHEEL_REACH)
    expect(far.y).toBe(0)
  })
})
