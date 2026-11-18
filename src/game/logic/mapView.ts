import type { Rect } from '../data/meadow'

/** 지도에 그리는 세계 범위: 섬(-30..30)과 초원(x 90..290, z -110..90) + 여유 */
export const MAP_BOUNDS: Rect = { x0: -40, x1: 300, z0: -120, z1: 100 }
/** 정적 지도 그림의 해상도 (픽셀/m) */
export const MAP_PX_PER_M = 2

/** 세계 (x, z) → 정적 지도 그림 픽셀. 위 = 북(-z), 오른쪽 = 동(+x) */
export function mapPixel(x: number, z: number): [number, number] {
  return [(x - MAP_BOUNDS.x0) * MAP_PX_PER_M, (z - MAP_BOUNDS.z0) * MAP_PX_PER_M]
}

/**
 * 미니맵: 내 자리에서 (dx, dz) 떨어진 곳 → 미니맵 가운데 기준 화면 좌표. 화면 위 = 카메라가 보는 쪽.
 * 카메라 앞 = (-sin yaw, -cos yaw), 오른쪽 = (cos yaw, -sin yaw) 라서 캔버스 rotate(yaw) 와 같다
 */
export function miniMapPoint(dx: number, dz: number, yaw: number, scale: number): [number, number] {
  const c = Math.cos(yaw)
  const s = Math.sin(yaw)
  return [(dx * c - dz * s) * scale, (dx * s + dz * c) * scale]
}

/** 큰 지도: 지도 범위(m)를 width×height 화면에 맞추는 배율(px/m)과 왼쪽 위 여백 */
export function fitBigMap(width: number, height: number): { scale: number; ox: number; oy: number } {
  const w = MAP_BOUNDS.x1 - MAP_BOUNDS.x0
  const h = MAP_BOUNDS.z1 - MAP_BOUNDS.z0
  const scale = Math.min(width / w, height / h)
  return { scale, ox: (width - w * scale) / 2, oy: (height - h * scale) / 2 }
}
