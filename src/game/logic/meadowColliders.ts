import { MEADOW_OFFSET_X } from '../data/meadow'

type XYZ = { x: number; y: number; z: number }
export type BoxLike = { min: XYZ; max: XYZ }
/** Rapier 고정 상자: 가운데와 반폭 (세계 좌표) */
export type Cuboid = { center: [number, number, number]; half: [number, number, number] }

/** 이보다 얇은 상자는 충돌체로 만들지 않는다 (m) */
const MIN_THICKNESS = 0.01

/**
 * 은지 좌표의 축 정렬 상자 → 세계 좌표 Rapier 상자. 180° 돌리기는 축 정렬을 유지해서 반폭은 그대로다.
 * 비었거나(무한) 깨졌거나(NaN) 얇은 상자는 버린다
 */
export function boxesToCuboids(boxes: readonly BoxLike[]): Cuboid[] {
  const out: Cuboid[] = []
  for (const b of boxes) {
    const v = [b.min.x, b.min.y, b.min.z, b.max.x, b.max.y, b.max.z]
    if (!v.every(Number.isFinite)) continue
    const hx = (b.max.x - b.min.x) / 2
    const hy = (b.max.y - b.min.y) / 2
    const hz = (b.max.z - b.min.z) / 2
    if (Math.min(hx, hy, hz) * 2 < MIN_THICKNESS) continue
    const cx = (b.min.x + b.max.x) / 2
    const cy = (b.min.y + b.max.y) / 2
    const cz = (b.min.z + b.max.z) / 2
    out.push({ center: [MEADOW_OFFSET_X - cx + 0, cy, -cz + 0], half: [hx, hy, hz] })
  }
  return out
}
