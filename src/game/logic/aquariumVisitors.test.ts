import { describe, expect, it } from 'vitest'
import { TANK_LEVELS } from '../data/aquarium'
import { ISLAND_VISITOR, VISITOR_HUB, VISITOR_ROUTES } from '../data/aquariumVisitors'
import type { Vec2 } from '../data/decor'
import { FACILITY_RECTS } from '../data/decor'
import { FACILITY } from '../data/zones'
import { groundY, hash01, lanePeriod, pointAlong, routeLength, viewingSlots, visitPlan, visitorCount, visitorPose } from './aquariumVisitors'

const CENTER = FACILITY.aquarium
const SIZES = TANK_LEVELS.map((l) => l.size)
const SEED = 7

describe('visitorCount', () => {
  it('입장료 3코인마다 1명, 최대 6명', () => {
    expect(visitorCount(3)).toBe(1)
    expect(visitorCount(7)).toBe(3)
    expect(visitorCount(100)).toBe(ISLAND_VISITOR.max)
  })
  it('입장료가 없어도 한 명은 가끔 들른다', () => {
    expect(visitorCount(0)).toBe(ISLAND_VISITOR.minVisitors)
  })
})

describe('hash01', () => {
  it('같은 입력이면 같은 값, 0~1 사이', () => {
    expect(hash01(1, 2, 3, 4)).toBe(hash01(1, 2, 3, 4))
    expect(hash01(1, 2, 3, 4)).not.toBe(hash01(1, 2, 3, 5))
    for (let i = 0; i < 200; i++) {
      const v = hash01(SEED, i, i * 3)
      expect(v).toBeGreaterThanOrEqual(0)
      expect(v).toBeLessThan(1)
    }
  })
})

describe('pointAlong', () => {
  const path: Vec2[] = [[0, 0], [0, 2], [3, 2]]
  it('길이와 중간 자리, 방향', () => {
    expect(routeLength(path)).toBe(5)
    expect(pointAlong(path, 1)).toMatchObject({ x: 0, z: 1, heading: 0 })
    const p = pointAlong(path, 3.5)
    expect(p.x).toBeCloseTo(1.5)
    expect(p.z).toBeCloseTo(2)
    expect(p.heading).toBeCloseTo(Math.PI / 2)
  })
  it('끝을 넘으면 끝점', () => {
    expect(pointAlong(path, 99)).toMatchObject({ x: 3, z: 2 })
  })
})

describe('viewingSlots', () => {
  it('6자리 모두 받침대 밖, 앞 한가운데는 비운다', () => {
    for (const [w, h, d] of SIZES) {
      const slots = viewingSlots([w, h, d])
      expect(slots).toHaveLength(6)
      for (const s of slots) {
        const inside = Math.abs(s.at[0]) < w / 2 + 0.15 + 0.3 && Math.abs(s.at[1]) < d / 2 + 0.15 + 0.3
        expect(inside).toBe(false)
        // 앞 한가운데(플레이어가 서는 곳)는 비운다
        expect(Math.abs(s.at[0])).toBeGreaterThan(0.6)
      }
    }
  })
})

/** 선분이 사각형 안을 지나는지 (촘촘히 찍어 본다) */
function crossesRect(a: Vec2, b: Vec2, r: { x0: number; x1: number; z0: number; z1: number }, pad: number) {
  for (let k = 0; k <= 40; k++) {
    const x = a[0] + ((b[0] - a[0]) * k) / 40
    const z = a[1] + ((b[1] - a[1]) * k) / 40
    if (x > r.x0 + pad && x < r.x1 - pad && z > r.z0 + pad && z < r.z1 - pad) return true
  }
  return false
}

describe('visitPlan', () => {
  it('가장 느린 걸음·가장 큰 어항에서도 한 바퀴 안에 오고·구경하고·나간다', () => {
    for (const size of SIZES) {
      for (let lane = 0; lane < ISLAND_VISITOR.max; lane++) {
        for (let visit = 0; visit < 40; visit++) {
          const p = visitPlan(SEED, lane, visit, CENTER, size)
          const slow = (routeLength(p.inPath) + routeLength(p.outPath)) / ISLAND_VISITOR.walkSpeed[0]
          const rest = lanePeriod(lane) - slow
          expect(rest * ISLAND_VISITOR.watchShare[0]).toBeGreaterThanOrEqual(ISLAND_VISITOR.minWatch)
          expect(p.gap).toBeGreaterThanOrEqual(ISLAND_VISITOR.minGap)
          expect(p.walkIn + p.watch + p.walkOut + p.gap).toBeCloseTo(lanePeriod(lane))
        }
      }
    }
  })

  it('들어오는 길과 나가는 길이 다르고, 사진은 한 번까지', () => {
    for (let visit = 0; visit < 60; visit++) {
      const p = visitPlan(SEED, 1, visit, CENTER, SIZES[2])
      expect(p.inPath[0]).not.toEqual(p.outPath[p.outPath.length - 1])
      expect(p.acts[0][0]).toBe('look')
      expect(p.acts.filter(([a]) => a === 'photo').length).toBeLessThanOrEqual(1)
    }
  })

  it('길이 시설(어항 포함) 바닥을 가로지르지 않는다', () => {
    // 시설 바닥 사각형은 여유를 두고 잡았으므로 0.3m 안쪽만 검사한다
    for (const size of SIZES) {
      for (let lane = 0; lane < ISLAND_VISITOR.max; lane++) {
        for (let visit = 0; visit < VISITOR_ROUTES.length * 4; visit++) {
          const { inPath, outPath } = visitPlan(SEED, lane, visit, CENTER, size)
          for (const path of [inPath, outPath]) {
            for (let i = 1; i < path.length; i++) {
              for (const rect of FACILITY_RECTS.slice(0, 7)) {
                const isAquarium = rect === FACILITY_RECTS[3]
                // 어항 바닥 사각형은 가장 큰 어항 기준이라 지금 크기의 받침대로 다시 잰다
                const r = isAquarium
                  ? { x0: CENTER[0] - size[0] / 2 - 0.15, x1: CENTER[0] + size[0] / 2 + 0.15, z0: CENTER[1] - size[2] / 2 - 0.15, z1: CENTER[1] + size[2] / 2 + 0.15 }
                  : rect
                expect(crossesRect(path[i - 1], path[i], r, isAquarium ? -0.1 : 0.3)).toBe(false)
              }
            }
          }
        }
      }
    }
  })
})

describe('오가는 길과 구경 자리', () => {
  it('섬에서 모이는 곳까지 오는 길은 서 있는 구경꾼을 뚫고 지나가지 않는다 (0.8m 이상 떨어진다)', () => {
    for (const size of SIZES) {
      const slots = viewingSlots(size).map(({ at }): Vec2 => [CENTER[0] + at[0], CENTER[1] + at[1]])
      for (const route of VISITOR_ROUTES) {
        const path: Vec2[] = [...route.points, VISITOR_HUB]
        for (let i = 1; i < path.length; i++) {
          for (let k = 0; k <= 40; k++) {
            const x = path[i - 1][0] + ((path[i][0] - path[i - 1][0]) * k) / 40
            const z = path[i - 1][1] + ((path[i][1] - path[i - 1][1]) * k) / 40
            for (const [sx, sz] of slots) expect(Math.hypot(x - sx, z - sz)).toBeGreaterThan(0.8)
          }
        }
      }
    }
  })
})

describe('visitorPose', () => {
  it('같은 시각이면 같은 모습 (결정적)', () => {
    expect(visitorPose(SEED, 2, 123.4, CENTER, SIZES[0])).toEqual(visitorPose(SEED, 2, 123.4, CENTER, SIZES[0]))
  })

  it('한 바퀴 동안 오기 → 구경 → 나가기 → 빈 시간 순서로 지나간다', () => {
    const lane = 0
    const order: string[] = []
    for (let t = 0; t < lanePeriod(lane) * 3; t += 0.25) {
      const p = visitorPose(SEED, lane, t, CENTER, SIZES[1])
      if (order[order.length - 1] !== p.phase) order.push(p.phase)
    }
    const text = order.join(' ')
    expect(text).toContain('arrive watch leave away arrive')
  })

  it('구경할 때는 자리에 서서 어항을 본다. 걷는 동안은 한 걸음씩 움직인다', () => {
    let last: { x: number; z: number; phase: string } | null = null
    let sawPhoto = false
    for (let t = 0; t < 2000; t += 0.1) {
      const p = visitorPose(SEED, 3, t, CENTER, SIZES[0])
      if (p.phase === 'watch') {
        const slot = viewingSlots(SIZES[0])[3]
        expect(p.x).toBeCloseTo(CENTER[0] + slot.at[0])
        expect(p.z).toBeCloseTo(CENTER[1] + slot.at[1])
        if (p.act === 'photo' && p.flash > 0) sawPhoto = true
      }
      if (last && last.phase === p.phase && (p.phase === 'arrive' || p.phase === 'leave')) {
        // 0.1초에 1.25m/s 를 넘게 움직이지 않는다 (순간이동 없음)
        expect(Math.hypot(p.x - last.x, p.z - last.z)).toBeLessThan(0.14)
      }
      last = p
    }
    expect(sawPhoto).toBe(true)
  })

  it('빈 시간에는 숨는다', () => {
    let hidden = 0
    for (let t = 0; t < 400; t += 0.5) if (!visitorPose(SEED, 0, t, CENTER, SIZES[0]).visible) hidden++
    expect(hidden).toBeGreaterThan(0)
  })
})

describe('groundY', () => {
  it('선착장 위에서는 나무 바닥 높이', () => {
    expect(groundY(0, 26)).toBeGreaterThan(0)
    expect(groundY(5, 20)).toBe(0)
  })
})
