import type { EunjiArea } from '../data/meadow'

/** 3인칭 카메라가 벽·천장을 뚫지 않게 (m) */
export const CAMERA_FIT = {
  /** 실내 천장 아래 여유 */
  ceilingGap: 0.3,
  /** 시선점에서 카메라 쪽으로 쏜 광선이 벽에 닿으면 이만큼 앞에서 멈춘다 */
  wallGap: 0.2,
  /** 벽이 아주 가까워도 시선점에서 이만큼은 떨어진다 */
  minDistance: 0.3,
}

/** 은지 좌표 (x, z) 가 실내 방이면 천장 높이, 아니면 null. 은지 roomAt 처럼 maxX 는 빼고 maxZ 는 넣는다 */
export function indoorCeiling(rooms: readonly EunjiArea[], x: number, z: number, height: number): number | null {
  return rooms.some((r) => x >= r.minX && x < r.maxX && z >= r.minZ && z <= r.maxZ) ? height : null
}

/** 카메라 높이를 천장 아래 여유까지로 낮춘다 (밖이면 그대로) */
export function underCeiling(y: number, ceiling: number | null): number {
  return ceiling === null ? y : Math.min(y, ceiling - CAMERA_FIT.ceilingGap)
}

/**
 * 시선점에서 카메라까지 거리 distance 를 벽에 닿은 거리 hit(없으면 null) 앞으로 줄인다.
 * hit 0 은 시선점이 상자 안에서 시작한 것이라 벽으로 보지 않는다
 */
export function fitDistance(distance: number, hit: number | null): number {
  if (hit === null || hit <= 1e-4 || hit >= distance) return distance
  return Math.min(distance, Math.max(CAMERA_FIT.minDistance, hit - CAMERA_FIT.wallGap))
}
