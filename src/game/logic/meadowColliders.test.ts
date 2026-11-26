import { describe, expect, it } from 'vitest'
import { MEADOW_LAND, MEADOW_RECT, START_SPOT, areaToWorld, toMeadowLocal, toWorld } from '../data/meadow'
import { DOOR_THICK, boxesToCuboids, doorBox } from './meadowColliders'

const box = (min: [number, number, number], max: [number, number, number]) => ({ min: { x: min[0], y: min[1], z: min[2] }, max: { x: max[0], y: max[1], z: max[2] } })

describe('초원 좌표', () => {
  it('은지 좌표를 180° 돌리고 동쪽으로 172m', () => {
    expect(toWorld(0, 0)).toEqual([172, 0])
    expect(toWorld(12, 12)).toEqual([160, -12])
    expect(toWorld(82, -33)).toEqual([90, 33])
  })
  it('세계 → 은지 좌표는 반대 변환', () => {
    expect(toMeadowLocal(160, -12)).toEqual([12, 12])
    expect(toMeadowLocal(...toWorld(37, -5))).toEqual([37, -5])
  })
  it('은지 영역 → 세계 사각형 (최소·최대가 뒤집힌다)', () => {
    expect(areaToWorld({ minX: 39, maxX: 67, minZ: -15, maxZ: 17 })).toEqual({ x0: 105, x1: 133, z0: -17, z1: 15 })
    expect(MEADOW_RECT).toEqual({ x0: 90, x1: 197, z0: -67, z1: 33 })
    expect(MEADOW_LAND).toEqual({ x0: 91, x1: 196, z0: -66, z1: 32 })
  })
  it('시작 자리는 은지 집 마당 (12, 12)', () => {
    expect(START_SPOT).toEqual([160, -12])
  })
})

describe('boxesToCuboids', () => {
  it('가운데를 세계로 옮기고 반폭은 그대로 둔다', () => {
    expect(boxesToCuboids([box([0, 0, 0], [2, 1, 4])])).toEqual([{ center: [171, 0.5, -2], half: [1, 0.5, 2] }])
  })
  it('얇거나 깨진 상자는 버린다', () => {
    const empty = box([Infinity, Infinity, Infinity], [-Infinity, -Infinity, -Infinity])
    const flat = box([0, 0, 0], [2, 0.005, 2])
    const nan = box([Number.NaN, 0, 0], [1, 1, 1])
    expect(boxesToCuboids([empty, flat, nan])).toEqual([])
  })
})

describe('doorBox', () => {
  it('닫힌 문(z 로 뻗음)은 경첩에서 +z 로 폭만큼, 두께는 x 로', () => {
    const b = doorBox({ x: 5, z: -0.5, yaw: 0, width: 1, height: 2.1 })
    expect(b.min).toEqual({ x: 5 - DOOR_THICK / 2, y: 0, z: -0.5 })
    expect(b.max).toEqual({ x: 5 + DOOR_THICK / 2, y: 2.1, z: 0.5 })
  })
  it('90° 열면 +x 로 뻗는다', () => {
    const b = doorBox({ x: 5, z: -0.5, yaw: Math.PI / 2, width: 1, height: 2.1 })
    expect(b.min.x).toBeCloseTo(5)
    expect(b.max.x).toBeCloseTo(6)
    expect(b.min.z).toBeCloseTo(-0.5 - DOOR_THICK / 2)
    expect(b.max.z).toBeCloseTo(-0.5 + DOOR_THICK / 2)
  })
})
