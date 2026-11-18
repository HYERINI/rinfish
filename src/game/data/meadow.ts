import { ISLAND_RADIUS } from './zones'

/** 바닥의 축 정렬 사각형 (세계 좌표, x0 < x1, z0 < z1) */
export type Rect = { x0: number; x1: number; z0: number; z1: number }
/** 은지 코드가 쓰는 영역 모양 (은지 좌표) */
export type EunjiArea = { minX: number; maxX: number; minZ: number; maxZ: number }

/**
 * 초원(은지 맵)을 놓는 자리. 은지 좌표를 180° 돌리고 동쪽으로 200m 옮긴다:
 * 세계 (x, z) = (200 - x_은지, -z_은지). 그러면 은지 지도에서 보던 방향(위 = 동물 들판, 왼쪽 = 마을) 그대로다
 */
export const MEADOW_OFFSET_X = 200
export const MEADOW_POS: [number, number, number] = [MEADOW_OFFSET_X, 0, 0]
export const MEADOW_YAW = Math.PI

// + 0: -0 을 0 으로
export const toWorld = (ex: number, ez: number): [number, number] => [MEADOW_OFFSET_X - ex + 0, -ez + 0]
export const toMeadowLocal = (x: number, z: number): [number, number] => [MEADOW_OFFSET_X - x + 0, -z + 0]

/** 은지 영역 → 세계 사각형. 180° 돌려서 최소·최대가 뒤집힌다 */
export function areaToWorld(a: EunjiArea): Rect {
  return { x0: MEADOW_OFFSET_X - a.maxX, x1: MEADOW_OFFSET_X - a.minX, z0: -a.maxZ + 0, z1: -a.minZ + 0 }
}

const inset = (r: Rect, d: number): Rect => ({ x0: r.x0 + d, x1: r.x1 - d, z0: r.z0 + d, z1: r.z1 - d })

/** 초원 땅 전체 (은지 GROUND x -90..110, z -90..110) */
export const MEADOW_RECT: Rect = areaToWorld({ minX: -90, maxX: 110, minZ: -90, maxZ: 110 })
/** 걸을 수 있는 초원 (가장자리 1m 안쪽, 섬의 29m 원과 같은 여유) */
export const MEADOW_LAND: Rect = inset(MEADOW_RECT, 1)
/** 섬에서 걸을 수 있는 원의 반지름 */
export const ISLAND_LAND_RADIUS = ISLAND_RADIUS - 1

/** 초원 선착장 판자 (마을 쪽 해안에서 서쪽 바다로 6m, 은지 GATE_E 와 같은 줄) */
export const MEADOW_DOCK: Rect = { x0: 84, x1: 90, z0: -3.5, z1: -0.5 }
/** 선착장 판자 윗면 높이 */
export const MEADOW_DOCK_TOP = 0.1
/** 선착장 위 걸을 수 있는 곳. 초원 땅(x 91)과 겹치게 x 91.5 까지 */
export const MEADOW_DOCK_LAND: Rect = { x0: 84.5, x1: 91.5, z0: -3.2, z1: -0.8 }

/** 처음 시작하는 자리: 은지 집 마당 (은지 좌표 12, 12) */
export const START_SPOT: [number, number] = toWorld(12, 12)

/** 초원 가장자리 모래 띠 폭 (m, 사각형 안쪽) */
export const SHORE_SAND = 4

/** 낮 하늘색 (은지 daynight.js DAY). 바다가 먼 곳에서 이 색으로 흐려진다 */
export const SKY_DAY = '#a9d4f5'
