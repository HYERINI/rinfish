import { describe, expect, it } from 'vitest'
import { CAMERA_FIT, fitDistance, indoorCeiling, underCeiling } from './cameraFit'

const rooms = [{ minX: 0, maxX: 5, minZ: 0, maxZ: 4 }]

describe('indoorCeiling', () => {
  it('실내 방 안이면 천장 높이, 밖이면 null (은지 roomAt 처럼 maxX 는 빼고 maxZ 는 넣는다)', () => {
    expect(indoorCeiling(rooms, 2, 2, 3)).toBe(3)
    expect(indoorCeiling(rooms, 0, 4, 3)).toBe(3)
    expect(indoorCeiling(rooms, 5, 2, 3)).toBeNull()
    expect(indoorCeiling(rooms, -1, 2, 3)).toBeNull()
  })
})

describe('underCeiling', () => {
  it('천장 아래 여유(0.3m)까지로 낮춘다. 밖이면 그대로', () => {
    expect(underCeiling(8.5, 3)).toBeCloseTo(3 - CAMERA_FIT.ceilingGap)
    expect(underCeiling(2, 3)).toBe(2)
    expect(underCeiling(8.5, null)).toBe(8.5)
  })
})

describe('fitDistance', () => {
  it('벽에 닿으면 0.2m 앞에서 멈춘다. 안 닿으면 그대로', () => {
    expect(fitDistance(10, null)).toBe(10)
    expect(fitDistance(10, 12)).toBe(10)
    expect(fitDistance(10, 2)).toBeCloseTo(2 - CAMERA_FIT.wallGap)
  })
  it('벽이 아주 가까워도 시선점에 붙지 않는다 (최소 거리)', () => {
    expect(fitDistance(10, 0.25)).toBe(CAMERA_FIT.minDistance)
  })
  it('시선점이 상자 안에서 시작해 바로 닿은 것(0)은 벽으로 보지 않는다', () => {
    expect(fitDistance(10, 0)).toBe(10)
  })
  it('원래 거리가 최소보다 짧으면 늘리지 않는다', () => {
    expect(fitDistance(0.2, 0.1)).toBe(0.2)
  })
})
