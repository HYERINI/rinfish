import type { ZoneId } from '../data/types'
import { FENCE_Z, FISHING_EDGE, INLAND_WATERS, INLAND_WATER_Y, ISLAND_RADIUS, REEF_SEA_MIN_X, WATER_Y, type FishingSpot, type InlandWater } from '../data/zones'
import { castDistance } from './cast'
import { isZoneOpen } from './zoneUnlock'

/**
 * 낚시하는 자리. 정해진 낚시 포인트가 아니라 물가에 선 자리에서 그때그때 만든다.
 * reach: 바라보는 쪽으로 물이 시작되는 거리(near)와 끝나는 거리(far, 바다는 Infinity). 찌는 이 사이에 떨어진다
 */
export type FishingPlace = FishingSpot & { reach: { near: number; far: number } }

/** 바다(섬 밖) 또는 섬 위 물 */
type Water = { kind: 'sea' } | { kind: 'inland'; water: InlandWater }

function inCover(x: number, z: number, w: InlandWater): boolean {
  const c = w.cover
  return c !== null && x >= c.x0 && x <= c.x1 && z >= c.z0 && z <= c.z1
}

function isWater(water: Water, x: number, z: number): boolean {
  if (water.kind === 'sea') return Math.hypot(x, z) > ISLAND_RADIUS
  const w = water.water
  return Math.hypot(x - w.center[0], z - w.center[1]) < w.radius && !inCover(x, z, w)
}

/**
 * (x, z)에서 facing 쪽으로 걸어 나가며 물이 처음 시작되는 거리와 이어지다 끝나는 거리.
 * 살펴본 끝까지 물이면 바다는 Infinity. 물이 없으면 null
 */
export function waterReach(x: number, z: number, facing: [number, number], water: Water): { near: number; far: number } | null {
  const { probeStep, probeReach } = FISHING_EDGE
  let near = -1
  for (let t = 0; t <= probeReach; t += probeStep) {
    const wet = isWater(water, x + facing[0] * t, z + facing[1] * t)
    if (near < 0) {
      if (wet) near = t
    } else if (!wet) {
      return { near, far: t }
    }
  }
  if (near < 0) return null
  return { near, far: water.kind === 'sea' ? Infinity : probeReach }
}

/** 바다 낚시의 구역: 울타리 북쪽 동쪽 바다는 암초 앞바다, 나머지는 해변 바다 */
export function seaZoneAt(x: number, z: number): ZoneId {
  return z < FENCE_Z && x >= REEF_SEA_MIN_X ? 'reef' : 'beach'
}

type Candidate = { water: Water; zone: ZoneId; facing: [number, number]; surfaceY: number; edge: number; id: string }

/** 서 있는 자리 둘레의 물가 후보들 (바다 가장자리, 연못·호수 가장자리). edge = 물가까지 거리 */
function candidates(x: number, z: number): Candidate[] {
  const out: Candidate[] = []
  const dist = Math.hypot(x, z)
  if (dist >= ISLAND_RADIUS - FISHING_EDGE.seaBand && dist > 0) {
    // 섬 중심에서 바깥으로 = 바다 쪽
    out.push({ water: { kind: 'sea' }, zone: seaZoneAt(x, z), facing: [x / dist, z / dist], surfaceY: WATER_Y, edge: ISLAND_RADIUS - dist, id: 'shore:sea' })
  }
  for (const w of INLAND_WATERS) {
    const dx = w.center[0] - x
    const dz = w.center[1] - z
    const d = Math.hypot(dx, dz)
    if (d < 1e-6 || d < w.radius - FISHING_EDGE.wadeIn || d > w.radius + FISHING_EDGE.shoreBand) continue
    if (inCover(x, z, w)) continue
    // 서 있는 자리에서 물 가운데 쪽으로
    out.push({ water: { kind: 'inland', water: w }, zone: w.zone, facing: [dx / d, dz / d], surfaceY: INLAND_WATER_Y, edge: Math.abs(d - w.radius), id: `shore:${w.id}` })
  }
  return out.sort((a, b) => a.edge - b.edge)
}

/**
 * (x, z)에 서서 낚시할 수 있는 물가 자리. 바라보는 방향은 가장 가까운 물 쪽(물가의 바깥 방향)이고,
 * 그쪽으로 가까이(maxNear 안)에 물이 시작돼 넉넉히(minWater) 이어져야 한다. 잠긴 구역이면 null
 */
export function findFishingEdge(x: number, z: number, unlocked: readonly ZoneId[]): FishingPlace | null {
  for (const c of candidates(x, z)) {
    if (!isZoneOpen(c.zone, unlocked)) continue
    const reach = waterReach(x, z, c.facing, c.water)
    if (!reach) continue
    if (reach.near > FISHING_EDGE.maxNear[c.water.kind]) continue
    if (reach.far - reach.near < FISHING_EDGE.minWater) continue
    return { id: c.id, zone: c.zone, position: [x, z], facing: c.facing, surfaceY: c.surfaceY, reach }
  }
  return null
}

/** 찌가 있을 수 있는 거리로 맞춘다: 물 가장자리에서 조금 안쪽(landingMargin)을 벗어나지 않게 */
export function clampToWater(place: FishingPlace, distance: number): number {
  const lo = place.reach.near + FISHING_EDGE.landingMargin
  const hi = Math.max(lo, place.reach.far - FISHING_EDGE.landingMargin)
  return Math.min(hi, Math.max(lo, distance))
}

/** 던진 힘(0~1)으로 찌가 떨어질 거리. 늘 물 위 */
export function landingDistance(place: FishingPlace, power: number): number {
  return clampToWater(place, castDistance(power))
}

/** 걸어 다니는 동안 낚시 자리를 새로 잡아야 하나 (조금씩 움직일 때마다 화면 안내를 다시 그리지 않게) */
export function shouldRefreshPlace(current: FishingPlace, next: FishingPlace): boolean {
  if (current.id !== next.id || current.zone !== next.zone) return true
  const moved = Math.hypot(current.position[0] - next.position[0], current.position[1] - next.position[1])
  if (moved > FISHING_EDGE.refreshMove) return true
  const dot = current.facing[0] * next.facing[0] + current.facing[1] * next.facing[1]
  return dot < Math.cos(FISHING_EDGE.refreshTurn)
}
