import { describe, expect, it } from 'vitest'
import { CLEARANCE, FACILITY_RECTS, GATE_RECTS, GRASS, SPAWN_AT, WATER_POOLS } from '../data/decor'
import { FISHING_SPOTS, ISLAND_RADIUS } from '../data/zones'
import { groundMix, isPropSpot, pathEdgeDistance, seededRng, valueNoise } from './decor'
import { TRUNK_RADIUS_PER_HEIGHT, buildDecorLayout } from './decorLayout'

const layout = buildDecorLayout()

describe('seededRng / valueNoise', () => {
  it('같은 씨앗이면 같은 수열', () => {
    const a = seededRng(7)
    const b = seededRng(7)
    for (let i = 0; i < 20; i++) expect(a()).toBe(b())
  })

  it('0 이상 1 미만', () => {
    const rng = seededRng(1)
    for (let i = 0; i < 1000; i++) {
      const v = rng()
      expect(v).toBeGreaterThanOrEqual(0)
      expect(v).toBeLessThan(1)
    }
    for (let i = 0; i < 200; i++) {
      const n = valueNoise(i * 0.37, i * -1.3, 2)
      expect(n).toBeGreaterThanOrEqual(0)
      expect(n).toBeLessThanOrEqual(1)
    }
  })
})

describe('groundMix', () => {
  it('길 한가운데는 흙길, 남쪽 가장자리는 모래, 북쪽 안쪽은 풀', () => {
    expect(groundMix(0, 13).path).toBeGreaterThan(0.9)
    expect(groundMix(-20, 22).sand).toBeGreaterThan(0.9)
    const north = groundMix(-20, -5)
    expect(north.sand).toBeLessThan(0.1)
    expect(north.path).toBeLessThan(0.1)
  })
})

describe('buildDecorLayout', () => {
  it('씨앗이 같으면 같은 배치', () => {
    expect(buildDecorLayout()).toEqual(layout)
  })

  it('풀 다발은 수천 개 이하로 넉넉히 깔린다', () => {
    expect(layout.grass.length).toBeGreaterThan(GRASS.count * 0.6)
    expect(layout.grass.length).toBeLessThanOrEqual(GRASS.count)
  })

  it('풀은 시설 바닥·물 안·섬 밖에 없다', () => {
    for (const g of layout.grass) {
      expect(Math.hypot(g.x, g.z)).toBeLessThan(ISLAND_RADIUS)
      expect(FACILITY_RECTS.some((r) => g.x > r.x0 && g.x < r.x1 && g.z > r.z0 && g.z < r.z1)).toBe(false)
      for (const p of WATER_POOLS) expect(Math.hypot(g.x - p.center[0], g.z - p.center[1])).toBeGreaterThan(p.radius)
    }
  })

  it('꽃·덤불·바위·버섯은 길과 낚시 자리, 출발점을 막지 않는다', () => {
    const props = [...layout.flowers, ...layout.bushes, ...layout.rocks, ...layout.mushrooms]
    expect(props.length).toBeGreaterThan(200)
    for (const p of props) {
      expect(pathEdgeDistance(p.x, p.z)).toBeGreaterThanOrEqual(CLEARANCE.propPath - 1e-9)
      expect(Math.hypot(p.x - SPAWN_AT[0], p.z - SPAWN_AT[1])).toBeGreaterThan(CLEARANCE.spawn)
      for (const s of FISHING_SPOTS) expect(Math.hypot(p.x - s.position[0], p.z - s.position[1])).toBeGreaterThan(CLEARANCE.spot)
    }
  })

  it('나무(콜라이더 있음)는 모두 비워 둘 곳 밖이고 길에서 넉넉히 떨어져 있다', () => {
    for (const t of layout.trees) {
      const trunk = t.height * TRUNK_RADIUS_PER_HEIGHT
      expect(isPropSpot(t.x, t.z, trunk), `나무 (${t.x}, ${t.z})`).toBe(true)
      expect(pathEdgeDistance(t.x, t.z), `나무 (${t.x}, ${t.z})`).toBeGreaterThan(CLEARANCE.treePath)
      for (const g of GATE_RECTS) expect(t.x > g.x0 && t.x < g.x1 && t.z > g.z0 && t.z < g.z1).toBe(false)
    }
  })

  it('조개·불가사리는 모래 위', () => {
    for (const s of [...layout.shells, ...layout.starfish, ...layout.pebbles]) expect(groundMix(s.x, s.z).sand).toBeGreaterThan(0.79)
    expect(layout.shells.length + layout.starfish.length).toBeGreaterThan(20)
  })
})
