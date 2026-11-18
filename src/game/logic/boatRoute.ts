import { CatmullRomCurve3, Vector3 } from 'three'

export type BoatDir = 'toIsland' | 'toMeadow'

/** 배 타는 시간(초)과 출발·도착 때 천천히 가속·감속하는 시간(초) */
export const BOAT_RIDE_SECONDS = 12
export const BOAT_EASE_SECONDS = 1

/** 뱃길 경유점 [x, z]: 초원 선착장 끝 → 바다 → 섬 선착장 끝 */
export const BOAT_WAYPOINTS: [number, number][] = [
  [82, -2],
  [55, 18],
  [25, 40],
  [0, 32],
]

// 경유점을 부드럽게 잇는 곡선 (centripetal: 경유점 사이에서 고리·뾰족한 곳이 생기지 않는다)
const curve = new CatmullRomCurve3(BOAT_WAYPOINTS.map(([x, z]) => new Vector3(x, 0, z)), false, 'centripetal')
const pt = new Vector3()
const tan = new Vector3()

const clamp01 = (v: number) => Math.min(1, Math.max(0, v))

/** 뱃길 위 점. t: 0 = 초원 선착장, 1 = 섬 선착장 (길이 비율). heading: 초원 → 섬으로 갈 때 바라보는 각도 (0 = +z) */
export function routePoint(t: number): { x: number; z: number; heading: number } {
  const u = clamp01(t)
  curve.getPointAt(u, pt)
  curve.getTangentAt(u, tan)
  return { x: pt.x, z: pt.z, heading: Math.atan2(tan.x, tan.z) }
}

export const routeLength = () => curve.getLength()

/** 탄 지 elapsed 초 → 진행도 0..1. 처음·끝 BOAT_EASE_SECONDS 동안 가속·감속하고 가운데는 일정한 속도 */
export function boatProgress(elapsed: number): number {
  const d = BOAT_RIDE_SECONDS
  const e = BOAT_EASE_SECONDS
  const t = Math.min(d, Math.max(0, elapsed))
  const v = 1 / (d - e)
  if (t < e) return (0.5 * v * t * t) / e
  if (t > d - e) return 1 - (0.5 * v * (d - t) * (d - t)) / e
  return v * (t - e / 2)
}

/** 가는 방향과 진행도로 배 자리·바라보는 각도 */
export function boatPose(dir: BoatDir, progress: number): { x: number; z: number; heading: number } {
  if (dir === 'toIsland') return routePoint(progress)
  const p = routePoint(1 - progress)
  return { x: p.x, z: p.z, heading: p.heading + Math.PI }
}

export const boatDestination = (dir: BoatDir): 'island' | 'meadow' => (dir === 'toIsland' ? 'island' : 'meadow')
