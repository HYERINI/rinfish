import { describe, expect, it } from 'vitest'
import { CAST } from '../data/balance'
import type { ZoneId } from '../data/types'
import { CAVE_WALL, FISHING_SPOTS, INLAND_WATERS, INLAND_WATER_Y, ISLAND_RADIUS, WATER_Y } from '../data/zones'
import { clampToWater, findFishingEdge, landingDistance, seaZoneAt, shouldRefreshPlace, type FishingPlace } from './fishingEdge'

const ALL: ZoneId[] = ['pond', 'cave', 'reef']
const pond = INLAND_WATERS.find((w) => w.id === 'pond')!
const lake = INLAND_WATERS.find((w) => w.id === 'caveLake')!

/** 바다인가 (섬 밖) */
const inSea = (x: number, z: number) => Math.hypot(x, z) > ISLAND_RADIUS
/** 섬 위 물인가 (동굴 바위 아래는 빼고) */
const inPool = (x: number, z: number) =>
  INLAND_WATERS.some((w) => {
    const c = w.cover
    const covered = c !== null && x >= c.x0 && x <= c.x1 && z >= c.z0 && z <= c.z1
    return Math.hypot(x - w.center[0], z - w.center[1]) < w.radius && !covered
  })

/** 던지는 모든 힘에서 찌가 물 위에 떨어지는지 */
function landsOnWater(place: FishingPlace): boolean {
  for (let p = 0; p <= 1; p += 0.05) {
    const d = landingDistance(place, p)
    const x = place.position[0] + place.facing[0] * d
    const z = place.position[1] + place.facing[1] * d
    const wet = place.surfaceY === WATER_Y ? inSea(x, z) : inPool(x, z)
    if (!wet) return false
  }
  return true
}

describe('findFishingEdge: 바다', () => {
  it('섬 가장자리 어디서나 바다 쪽을 보고 낚시한다', () => {
    for (let a = 0; a < Math.PI * 2; a += Math.PI / 12) {
      const r = ISLAND_RADIUS - 1.5
      const place = findFishingEdge(Math.sin(a) * r, Math.cos(a) * r, ALL)
      expect(place, `각도 ${a}`).not.toBeNull()
      expect(place!.surfaceY).toBe(WATER_Y)
      // 바깥(섬 중심에서 멀어지는 쪽)을 본다
      expect(place!.facing[0] * Math.sin(a) + place!.facing[1] * Math.cos(a)).toBeCloseTo(1)
      expect(landsOnWater(place!)).toBe(true)
    }
  })

  it('섬 안쪽(가운데·선착장 중간)에선 낚시할 수 없다', () => {
    expect(findFishingEdge(0, 0, ALL)).toBeNull()
    expect(findFishingEdge(0, 15, ALL)).toBeNull()
    expect(findFishingEdge(0, 24, ALL)).toBeNull()
    expect(findFishingEdge(10, 18, ALL)).toBeNull()
  })

  it('선착장 끝에선 바다(남쪽)를 본다', () => {
    const place = findFishingEdge(0, 29, [])
    expect(place?.zone).toBe('beach')
    expect(place?.facing[1]).toBeCloseTo(1)
  })

  it('울타리 북쪽 동쪽 바다는 암초 앞바다다. 잠겨 있으면 낚시할 수 없다', () => {
    expect(seaZoneAt(22, -17)).toBe('reef')
    expect(seaZoneAt(22, 17)).toBe('beach')
    expect(seaZoneAt(-22, -17)).toBe('beach')
    expect(findFishingEdge(22, -18, ['reef'])?.zone).toBe('reef')
    expect(findFishingEdge(22, -18, ['pond'])).toBeNull()
  })
})

describe('findFishingEdge: 연못·동굴 호수', () => {
  it('연못 둘레 어디서나 연못 가운데를 보고, 찌는 연못 안에 떨어진다', () => {
    for (let a = 0; a < Math.PI * 2; a += Math.PI / 8) {
      const r = pond.radius + 1
      const x = pond.center[0] + Math.sin(a) * r
      const z = pond.center[1] + Math.cos(a) * r
      const place = findFishingEdge(x, z, ALL)
      expect(place?.zone, `각도 ${a}`).toBe('pond')
      expect(place!.surfaceY).toBe(INLAND_WATER_Y)
      expect(place!.facing[0] * -Math.sin(a) + place!.facing[1] * -Math.cos(a)).toBeCloseTo(1)
      expect(landsOnWater(place!)).toBe(true)
    }
  })

  it('물가에서 너무 멀거나 구역이 잠겨 있으면 낚시할 수 없다', () => {
    expect(findFishingEdge(pond.center[0], pond.center[1] + pond.radius + 3, ALL)).toBeNull()
    expect(findFishingEdge(pond.center[0], pond.center[1] + pond.radius + 1, [])).toBeNull()
    // 연못 한가운데에 들어가 서 있어도 안 된다
    expect(findFishingEdge(pond.center[0], pond.center[1], ALL)).toBeNull()
  })

  it('동굴 호수: 바위 앞 물가에서 바위에 가리지 않은 물에 던진다', () => {
    const north = findFishingEdge(lake.center[0], lake.center[1] + lake.radius + 1, ALL)
    expect(north?.zone).toBe('cave')
    expect(landsOnWater(north!)).toBe(true)
    // 찌가 바위 아래로 들어가지 않는다
    expect(north!.position[1] - landingDistance(north!, 1)).toBeGreaterThan(CAVE_WALL.z1)
    const east = findFishingEdge(lake.center[0] + lake.radius + 0.5, lake.center[1] + 0.8, ALL)
    expect(east?.zone).toBe('cave')
    expect(landsOnWater(east!)).toBe(true)
  })
})

describe('정해진 낚시 명당', () => {
  it('명당 자리에 서도 물가 낚시가 된다 (같은 구역)', () => {
    for (const spot of FISHING_SPOTS) {
      const place = findFishingEdge(spot.position[0], spot.position[1], ALL)
      expect(place?.zone, spot.id).toBe(spot.zone)
      expect(landsOnWater(place!)).toBe(true)
    }
  })
})

describe('landingDistance', () => {
  const sea: FishingPlace = { id: 'shore:sea', zone: 'beach', position: [0, 28], facing: [0, 1], surfaceY: WATER_Y, reach: { near: 2, far: Infinity } }
  it('바다는 던진 힘 그대로 (최소 거리가 물가보다 멀다)', () => {
    expect(landingDistance(sea, 0)).toBe(CAST.minDistance)
    expect(landingDistance(sea, 1)).toBe(CAST.minDistance + CAST.extraDistance)
  })
  it('좁은 물에선 가장자리 안쪽으로 맞춘다', () => {
    const small = { ...sea, reach: { near: 0.5, far: 5 } }
    expect(landingDistance(small, 1)).toBeCloseTo(4.2)
    expect(clampToWater(small, 0)).toBeCloseTo(1.3)
  })
})

describe('shouldRefreshPlace', () => {
  const a: FishingPlace = { id: 'shore:sea', zone: 'beach', position: [0, 28], facing: [0, 1], surfaceY: WATER_Y, reach: { near: 2, far: Infinity } }
  it('조금 움직이면 그대로, 많이 움직이거나 돌거나 다른 물이면 새로', () => {
    expect(shouldRefreshPlace(a, { ...a, position: [0.2, 28] })).toBe(false)
    expect(shouldRefreshPlace(a, { ...a, position: [1, 28] })).toBe(true)
    expect(shouldRefreshPlace(a, { ...a, facing: [Math.sin(0.2), Math.cos(0.2)] })).toBe(true)
    expect(shouldRefreshPlace(a, { ...a, id: 'shore:pond' })).toBe(true)
  })
})
