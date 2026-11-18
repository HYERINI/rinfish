import { ISLAND_LAND_RADIUS, MEADOW_DOCK_LAND, MEADOW_LAND, type Rect } from '../data/meadow'

export type Land = 'island' | 'meadow'
type Point = { x: number; z: number }
type Region = { land: Land; circle: number } | { land: Land; rect: Rect }

/** 걸을 수 있는 곳: 섬 원, 초원, 초원 선착장 (선착장은 초원으로 친다) */
const REGIONS: Region[] = [
  { land: 'island', circle: ISLAND_LAND_RADIUS },
  { land: 'meadow', rect: MEADOW_LAND },
  { land: 'meadow', rect: MEADOW_DOCK_LAND },
]

/** 경계로 붙잡은 점이 부동소수점 오차로 살짝 밖이 돼도 땅으로 본다 */
const EPS = 1e-6

function inside(r: Region, x: number, z: number): boolean {
  if ('circle' in r) return Math.hypot(x, z) <= r.circle + EPS
  return x >= r.rect.x0 - EPS && x <= r.rect.x1 + EPS && z >= r.rect.z0 - EPS && z <= r.rect.z1 + EPS
}

/** 영역 안에서 (x, z) 에 가장 가까운 점 */
function project(r: Region, x: number, z: number): Point {
  if ('circle' in r) {
    const d = Math.hypot(x, z)
    return d <= r.circle || d === 0 ? { x, z } : { x: (x * r.circle) / d, z: (z * r.circle) / d }
  }
  return { x: Math.min(r.rect.x1, Math.max(r.rect.x0, x)), z: Math.min(r.rect.z1, Math.max(r.rect.z0, z)) }
}

/** (x, z) 가 어느 땅 위인가. 바다면 null */
export function landAt(x: number, z: number): Land | null {
  return REGIONS.find((r) => inside(r, x, z))?.land ?? null
}

/**
 * 다음 자리가 땅 밖이면 이전 자리가 있던 땅의 경계로 붙인다 (섬은 원 경계, 초원·선착장은 사각형 경계).
 * 이전 자리도 땅 밖이면(처음·순간이동 직후) 가장 가까운 땅으로
 */
export function clampToLand(prev: Point, next: Point): Point {
  if (landAt(next.x, next.z)) return next
  const home = REGIONS.filter((r) => inside(r, prev.x, prev.z))
  let best: Point | null = null
  let bestD = Infinity
  for (const r of home.length ? home : REGIONS) {
    const p = project(r, next.x, next.z)
    const d = Math.hypot(p.x - next.x, p.z - next.z)
    if (d < bestD) {
      best = p
      bestD = d
    }
  }
  return best ?? next
}
