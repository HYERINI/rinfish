import { describe, expect, it } from 'vitest'
import { MEADOW_LAND, MEADOW_RECT, START_SPOT, areaToWorld, toMeadowLocal, toWorld } from '../data/meadow'
import { boxesToCuboids } from './meadowColliders'

const box = (min: [number, number, number], max: [number, number, number]) => ({ min: { x: min[0], y: min[1], z: min[2] }, max: { x: max[0], y: max[1], z: max[2] } })

describe('초원 좌표', () => {
  it('은지 좌표를 180° 돌리고 동쪽으로 200m', () => {
    expect(toWorld(0, 0)).toEqual([200, 0])
    expect(toWorld(12, 12)).toEqual([188, -12])
    expect(toWorld(110, -90)).toEqual([90, 90])
  })
  it('세계 → 은지 좌표는 반대 변환', () => {
    expect(toMeadowLocal(188, -12)).toEqual([12, 12])
    expect(toMeadowLocal(...toWorld(37, -5))).toEqual([37, -5])
  })
  it('은지 영역 → 세계 사각형 (최소·최대가 뒤집힌다)', () => {
    expect(areaToWorld({ minX: 39, maxX: 67, minZ: -15, maxZ: 17 })).toEqual({ x0: 133, x1: 161, z0: -17, z1: 15 })
    expect(MEADOW_RECT).toEqual({ x0: 90, x1: 290, z0: -110, z1: 90 })
    expect(MEADOW_LAND).toEqual({ x0: 91, x1: 289, z0: -109, z1: 89 })
  })
  it('시작 자리는 은지 집 마당 (12, 12)', () => {
    expect(START_SPOT).toEqual([188, -12])
  })
})

describe('boxesToCuboids', () => {
  it('가운데를 세계로 옮기고 반폭은 그대로 둔다', () => {
    expect(boxesToCuboids([box([0, 0, 0], [2, 1, 4])])).toEqual([{ center: [199, 0.5, -2], half: [1, 0.5, 2] }])
  })
  it('얇거나 깨진 상자는 버린다', () => {
    const empty = box([Infinity, Infinity, Infinity], [-Infinity, -Infinity, -Infinity])
    const flat = box([0, 0, 0], [2, 0.005, 2])
    const nan = box([Number.NaN, 0, 0], [1, 1, 1])
    expect(boxesToCuboids([empty, flat, nan])).toEqual([])
  })
})
