import { describe, expect, it } from 'vitest'
import { ANIMAL_ZONE } from '../../meadow/vendor/outdoor.js'
import { ROOMS } from '../../meadow/vendor/world.js'
import { ANIMAL_CHASE, ANIMAL_FIELD, EUNJI_ANIMAL_ZONE, SPECIES, hitRadius } from './animals'
import { MEADOW_ROOMS, isIndoor, toWorld } from './meadow'

describe('들판 동물 수치', () => {
  it('7종, 은지 animals.js 순서와 값', () => {
    expect(SPECIES.map((s) => s.id)).toEqual(['cow', 'pig', 'deer', 'hog', 'bunny', 'fox', 'chick'])
    expect(SPECIES.find((s) => s.id === 'cow')).toEqual({ id: 'cow', name: '소', scale: 0.8, hp: 3, speed: 1.0, run: 3.0, meat: 3, dmg: 15 })
    expect(SPECIES.filter((s) => s.dmg === 0).map((s) => s.id)).toEqual(['bunny', 'chick'])
  })
  it('들판은 은지 ANIMAL_ZONE 을 세계 좌표로 (x 166..206, z -52..-26), 쫓기는 그보다 넓게', () => {
    expect(EUNJI_ANIMAL_ZONE).toEqual({ minX: ANIMAL_ZONE.minX, maxX: ANIMAL_ZONE.maxX, minZ: ANIMAL_ZONE.minZ, maxZ: ANIMAL_ZONE.maxZ })
    expect(ANIMAL_FIELD).toEqual({ x0: 166, x1: 206, z0: -52, z1: -26 })
    expect(ANIMAL_CHASE).toEqual({ x0: 156, x1: 216, z0: -58, z1: -24 })
  })
  it('판정 원: 소 0.52, 병아리처럼 작아도 0.35', () => {
    expect(hitRadius('cow')).toBeCloseTo(0.52)
    expect(hitRadius('chick')).toBe(0.35)
  })
})

describe('은지 집 실내', () => {
  it('방 4개가 은지 world.js ROOMS 와 같다', () => {
    expect(MEADOW_ROOMS).toEqual(ROOMS.map((r) => ({ minX: r.minX, maxX: r.maxX, minZ: r.minZ, maxZ: r.maxZ })))
  })
  it('침실·주방·사격장은 실내, 마당·들판은 밖', () => {
    expect(isIndoor(...toWorld(3.5, 3.6))).toBe(true)
    expect(isIndoor(...toWorld(9, -9))).toBe(true)
    expect(isIndoor(...toWorld(20, 0))).toBe(true)
    expect(isIndoor(...toWorld(12, 12))).toBe(false)
    expect(isIndoor(...toWorld(14, 40))).toBe(false)
  })
})
