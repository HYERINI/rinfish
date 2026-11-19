import { describe, expect, it } from 'vitest'
import { CAMERA_ZOOM, NEAR_VIEW } from '../data/balance'
import { canSavePlace, normalizePlace, placeMoved, START_PLACE } from './place'

describe('normalizePlace', () => {
  it('정상 저장본은 그대로 쓴다', () => {
    const p = { x: 5, z: 12, facing: 1, yaw: 2, pitch: 0.2, zoom: 6, meadowZoom: 3, resting: true }
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
    expect(p.meadowZoom).toBe(NEAR_VIEW.meadowInitial)
    expect(normalizePlace({ x: 0, z: 10, meadowZoom: 999 }, []).meadowZoom).toBe(NEAR_VIEW.meadowMax)
    expect(p.facing).toBe(START_PLACE.facing)
    expect(p.resting).toBe(false)
  })
  it('처음 자리는 초원 은지 집 마당', () => {
    expect([START_PLACE.x, START_PLACE.z]).toEqual([188, -12])
  })
  it('초원 위 자리도 이어서 쓴다. 울타리 규칙은 섬에서만', () => {
    expect(normalizePlace({ x: 150, z: 0 }, []).x).toBe(150)
    expect(normalizePlace({ x: 150, z: -50 }, []).z).toBe(-50)
    expect(normalizePlace({ x: 60, z: 0 }, [])).toEqual(START_PLACE)
  })
  it('벤치에 앉아 있던 건 섬 위일 때만 이어서 앉는다', () => {
    expect(normalizePlace({ x: 150, z: 0, resting: true }, []).resting).toBe(false)
    expect(normalizePlace({ x: -5, z: 21, resting: true }, []).resting).toBe(true)
  })
})

describe('placeMoved', () => {
  it('조금 움직인 건 저장하지 않고, 걸어가거나 앉으면 저장한다', () => {
    expect(placeMoved(START_PLACE, { ...START_PLACE, x: START_PLACE.x + 0.1 })).toBe(false)
    expect(placeMoved(START_PLACE, { ...START_PLACE, x: START_PLACE.x + 1 })).toBe(true)
    expect(placeMoved(START_PLACE, { ...START_PLACE, resting: true })).toBe(true)
    expect(placeMoved(START_PLACE, { ...START_PLACE, meadowZoom: START_PLACE.meadowZoom + 1 })).toBe(true)
  })
})

describe('canSavePlace', () => {
  it('물리로 움직이는 몸이 땅 위에 있고 순간이동을 기다리지 않을 때만 저장한다', () => {
    expect(canSavePlace(88.5, -2, true, false)).toBe(true)
    expect(canSavePlace(0, 26.2, true, false)).toBe(true)
  })
  it('배 위(키네마틱)거나 바다 위면 저장하지 않는다', () => {
    expect(canSavePlace(88.5, -2, false, false)).toBe(false)
    expect(canSavePlace(50, 20, true, false)).toBe(false)
  })
  it('순간이동(쓰러져 진료소로)을 기다리는 동안엔 저장하지 않는다', () => {
    expect(canSavePlace(0, 15, true, true)).toBe(false)
  })
})
