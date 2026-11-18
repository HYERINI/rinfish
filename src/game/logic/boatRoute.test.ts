import { describe, expect, it } from 'vitest'
import { MEADOW_RECT } from '../data/meadow'
import { ISLAND_RADIUS } from '../data/zones'
import { BOAT_RIDE_SECONDS, boatDestination, boatPose, boatProgress, routeLength, routePoint } from './boatRoute'

/** 사각형 바깥까지의 거리 (안이면 0) */
const rectDist = (x: number, z: number) => Math.hypot(Math.max(MEADOW_RECT.x0 - x, 0, x - MEADOW_RECT.x1), Math.max(MEADOW_RECT.z0 - z, 0, z - MEADOW_RECT.z1))

describe('뱃길', () => {
  it('초원 선착장 끝에서 섬 선착장 끝까지', () => {
    const a = routePoint(0)
    const b = routePoint(1)
    expect(a.x).toBeCloseTo(82)
    expect(a.z).toBeCloseTo(-2)
    expect(b.x).toBeCloseTo(0)
    expect(b.z).toBeCloseTo(32)
  })
  it('길이는 대략 100m', () => {
    expect(routeLength()).toBeGreaterThan(90)
    expect(routeLength()).toBeLessThan(115)
  })
  it('모든 점이 섬(30m)과 초원 사각형에서 1m 넘게 떨어진 바다 위 (양 끝 1m 제외)', () => {
    const len = routeLength()
    for (let i = 0; i <= 400; i++) {
      const t = i / 400
      if (t * len < 1 || (1 - t) * len < 1) continue
      const p = routePoint(t)
      expect(Math.hypot(p.x, p.z)).toBeGreaterThan(ISLAND_RADIUS + 1)
      expect(rectDist(p.x, p.z)).toBeGreaterThan(1)
    }
  })
  it('출발할 때 서쪽(섬 쪽)을 본다', () => {
    expect(Math.sin(routePoint(0).heading)).toBeLessThan(0)
  })
})

describe('boatProgress', () => {
  it('0 에서 시작해 BOAT_RIDE_SECONDS 에 1, 그 뒤로도 1', () => {
    expect(boatProgress(0)).toBe(0)
    expect(boatProgress(BOAT_RIDE_SECONDS)).toBeCloseTo(1)
    expect(boatProgress(BOAT_RIDE_SECONDS + 5)).toBe(1)
    expect(boatProgress(-1)).toBe(0)
  })
  it('늘 앞으로만 가고, 처음·끝 1초는 천천히', () => {
    let prev = 0
    for (let s = 0; s <= BOAT_RIDE_SECONDS; s += 0.1) {
      const p = boatProgress(s)
      expect(p).toBeGreaterThanOrEqual(prev)
      prev = p
    }
    const mid = boatProgress(6.1) - boatProgress(6)
    expect(boatProgress(0.1) - boatProgress(0)).toBeLessThan(mid / 5)
    expect(boatProgress(BOAT_RIDE_SECONDS) - boatProgress(BOAT_RIDE_SECONDS - 0.1)).toBeLessThan(mid / 5)
  })
})

describe('boatPose', () => {
  it('섬으로 가면 초원 → 섬, 초원으로 가면 거꾸로이고 반대쪽을 본다', () => {
    expect(boatPose('toIsland', 0).x).toBeCloseTo(82)
    expect(boatPose('toMeadow', 0).x).toBeCloseTo(0)
    expect(boatPose('toMeadow', 1).x).toBeCloseTo(82)
    const a = boatPose('toIsland', 0.5)
    const b = boatPose('toMeadow', 0.5)
    expect(a.x).toBeCloseTo(b.x)
    expect(Math.cos(a.heading - b.heading)).toBeCloseTo(-1)
  })
  it('도착하는 땅', () => {
    expect(boatDestination('toIsland')).toBe('island')
    expect(boatDestination('toMeadow')).toBe('meadow')
  })
})
