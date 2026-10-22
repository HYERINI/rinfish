import { describe, expect, it } from 'vitest'
import { CAMERA_ZOOM } from '../data/balance'
import { normalizePlace, placeMoved, START_PLACE } from './place'

describe('normalizePlace', () => {
  it('정상 저장본은 그대로 쓴다', () => {
    const p = { x: 5, z: 12, facing: 1, yaw: 2, pitch: 0.2, zoom: 6, resting: true }
    expect(normalizePlace(p, [])).toEqual(p)
  })
  it('깨졌거나 비었으면 처음 자리', () => {
    expect(normalizePlace(null, [])).toEqual(START_PLACE)
    expect(normalizePlace('x', [])).toEqual(START_PLACE)
    expect(normalizePlace({ x: Number.NaN, z: 1 }, [])).toEqual(START_PLACE)
  })
  it('섬 밖이면 처음 자리', () => {
    expect(normalizePlace({ x: 40, z: 0 }, [])).toEqual(START_PLACE)
  })
  it('울타리 북쪽은 구역을 하나라도 열었을 때만', () => {
    expect(normalizePlace({ x: -15, z: -2 }, [])).toEqual(START_PLACE)
    expect(normalizePlace({ x: -15, z: -2 }, ['pond']).x).toBe(-15)
  })
  it('줌은 범위 안으로, 빠진 값은 기본값', () => {
    const p = normalizePlace({ x: 0, z: 10, zoom: 999 }, [])
    expect(p.zoom).toBe(CAMERA_ZOOM.max)
    expect(p.facing).toBe(START_PLACE.facing)
    expect(p.resting).toBe(false)
  })
})

describe('placeMoved', () => {
  it('조금 움직인 건 저장하지 않고, 걸어가거나 앉으면 저장한다', () => {
    expect(placeMoved(START_PLACE, { ...START_PLACE, x: 0.1 })).toBe(false)
    expect(placeMoved(START_PLACE, { ...START_PLACE, x: 1 })).toBe(true)
    expect(placeMoved(START_PLACE, { ...START_PLACE, resting: true })).toBe(true)
  })
})
