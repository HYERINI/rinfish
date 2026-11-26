import { describe, expect, it } from 'vitest'
import { clampToLand, landAt } from './land'

describe('landAt', () => {
  it('섬 원(29m)·초원·초원 선착장은 땅, 그 밖은 바다', () => {
    expect(landAt(0, 0)).toBe('island')
    expect(landAt(0, 28.9)).toBe('island')
    expect(landAt(0, 29.5)).toBeNull()
    expect(landAt(150, 0)).toBe('meadow')
    expect(landAt(87, -2)).toBe('meadow')
    expect(landAt(87, 5)).toBeNull()
    expect(landAt(60, 0)).toBeNull()
    expect(landAt(290, 0)).toBeNull()
    expect(landAt(200, 0)).toBeNull()
  })
  it('경계 부동소수점 오차는 땅으로 본다', () => {
    expect(landAt(91 - 1e-9, 0)).toBe('meadow')
    expect(landAt(0, 29 + 1e-9)).toBe('island')
  })
})

describe('clampToLand', () => {
  it('땅 안이면 그대로', () => {
    expect(clampToLand({ x: 0, z: 0 }, { x: 1, z: 1 })).toEqual({ x: 1, z: 1 })
  })
  it('섬 가장자리에서 붙잡는다 (지금 원 경계와 같다)', () => {
    const p = clampToLand({ x: 0, z: 28 }, { x: 0, z: 31 })
    expect(p.x).toBeCloseTo(0)
    expect(p.z).toBeCloseTo(29)
  })
  it('초원 가장자리에서 붙잡는다', () => {
    expect(clampToLand({ x: 100, z: 0 }, { x: 89, z: 0 })).toEqual({ x: 91, z: 0 })
    expect(clampToLand({ x: 150, z: 31 }, { x: 150, z: 40 })).toEqual({ x: 150, z: 32 })
  })
  it('선착장 끝에서 붙잡고, 선착장과 초원 사이는 오간다', () => {
    expect(clampToLand({ x: 85, z: -2 }, { x: 83, z: -2 })).toEqual({ x: 84.5, z: -2 })
    expect(clampToLand({ x: 90, z: -2 }, { x: 92, z: -2 })).toEqual({ x: 92, z: -2 })
    expect(clampToLand({ x: 92, z: -2 }, { x: 89.5, z: -2 })).toEqual({ x: 89.5, z: -2 })
  })
  it('이전 자리도 땅 밖이면 가장 가까운 땅으로', () => {
    const p = clampToLand({ x: 60, z: 0 }, { x: 61, z: 0 })
    expect(landAt(p.x, p.z)).not.toBeNull()
  })
  it('섬 가장자리로 붙잡은 점은 계속 땅이다 (반올림 오차로 29 를 살짝 넘어도)', () => {
    const p = clampToLand({ x: 0, z: 0 }, { x: 10.500579143934814, z: 33.387689911731854 })
    expect(Math.hypot(p.x, p.z)).toBeGreaterThan(29)
    expect(landAt(p.x, p.z)).toBe('island')
  })
})
