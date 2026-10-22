import { CAVE_WALL, FACILITY, FENCE_Z, FISHING_SPOTS, INLAND_WATERS, ISLAND_RADIUS, ZONES } from './zones'

/** 섬 바닥 꾸미기(풀·꽃·바위·나무·조개) 숫자들. 꾸미기는 걷기·낚시를 막지 않게 길·시설 앞·낚시 자리·문 근처를 비운다 */

/** [x, z] */
export type Vec2 = [number, number]
/** 축에 맞춘 사각형 */
export type Rect = { x0: number; x1: number; z0: number; z1: number }
/** 흙길: 꺾은선과 반폭(m) */
export type DecorPath = { points: Vec2[]; halfWidth: number }

/** 같은 섬이 매번 같은 모양이 되도록 쓰는 씨앗 */
export const DECOR_SEED = 20261022

/** 바닥 메시 격자 간격(m). 작을수록 길·모래 경계가 또렷해진다 */
export const GROUND_CELL = 0.3
/** 바닥 메시 높이. 섬 윗면(0)·북쪽 풀밭(0.01) 위, 연못 물(0.02) 바로 아래 */
export const GROUND_Y = 0.015

/** 섬 위 물웅덩이 (zones.ts 의 연못·동굴 호수). 바닥은 여기서 구멍이 난다 */
export const WATER_POOLS: { center: Vec2; radius: number }[] = INLAND_WATERS.map((w) => ({ center: w.center, radius: w.radius }))

/** 동굴 바위 덩어리 (zones.ts CAVE_WALL) 바닥 자리. 가장자리를 0.2m 넉넉히 */
export const CAVE_ROCK: Rect = { x0: CAVE_WALL.x0 - 0.2, x1: CAVE_WALL.x1 + 0.2, z0: CAVE_WALL.z0 - 0.2, z1: CAVE_WALL.z1 + 0.2 }

/** 모래사장: 남쪽(해변)은 넓게, 나머지는 가장자리만 */
export const SAND = {
  /** 남쪽 끝(z ≥ southZ)에서 모래가 시작되는 반지름 */
  southStart: 20.5,
  /** 북쪽에서 모래가 시작되는 반지름 */
  northStart: 26.5,
  /** 이 z 사이에서 남쪽 값과 북쪽 값을 섞는다 */
  blendZ: [4, 16] as Vec2,
  /** 풀밭 → 모래로 바뀌는 폭(m) */
  edge: 1.4,
  /** 경계가 들쭉날쭉한 정도(m) */
  wobble: 1.3,
}

/** 흙길. 시설 앞과 잠긴 구역 문, 낚시 자리를 잇는다 (보기용, 충돌 없음) */
export const PATHS: DecorPath[] = [
  // 선착장 → 출발점 → 동굴 문
  { points: [[0, 21], [0, 15], [0, FENCE_Z + 0.6]], halfWidth: 1.05 },
  // 진료소 앞 ↔ 어시장 앞 가로길
  { points: [[-14, 12.8], [-9, 12], [-3, 11.7], [3, 11.8], [8, 12], [10.6, 12]], halfWidth: 0.85 },
  // 숲속 연못 문으로
  { points: [[-9, 12], [-11.3, 7.6], [-14, FENCE_Z + 0.6]], halfWidth: 0.8 },
  // 암초 앞바다 문으로
  { points: [[8, 12], [11, 8], [14, FENCE_Z + 0.6]], halfWidth: 0.8 },
  // 어항 앞
  { points: [[10.6, 12], [10.8, 16.5], [12.6, 21.4], [15.5, 21.6]], halfWidth: 0.8 },
  // 옷장·벤치 쪽
  { points: [[0, 19.2], [3.2, 21.2], [5.8, 22]], halfWidth: 0.7 },
  { points: [[0, 19.2], [-3.4, 20]], halfWidth: 0.7 },
  // 진료소에서 바위 낚시터로
  { points: [[-14, 12.8], [-16.8, 16.2], [-18.6, 19.8]], halfWidth: 0.75 },
  // 울타리 너머: 문 → 낚시 자리
  { points: [[-14, FENCE_Z - 0.6], [-14.6, -0.5], [-15, -5.8]], halfWidth: 0.8 },
  { points: [[0, FENCE_Z - 0.6], [0, -18.4]], halfWidth: 0.9 },
  { points: [[14, FENCE_Z - 0.6], [16.6, -6], [21.4, -16.4]], halfWidth: 0.8 },
]

const [mx, mz] = FACILITY.market
const [ax, az] = FACILITY.aquarium
const [cx, cz] = FACILITY.clinic
const [bx, bz] = FACILITY.bench
const [wx, wz] = FACILITY.wardrobe

/** 시설이 차지하는 바닥 (풀도 안 자란다). 장비 상점(-6, 14)·판매함(5, 16)은 각 컴포넌트 안 좌표 */
export const FACILITY_RECTS: Rect[] = [
  { x0: -7.9, x1: -4.3, z0: 12.7, z1: 15.4 }, // 장비 상점
  { x0: 3.6, x1: 6.5, z0: 15.1, z1: 17.1 }, // 판매함
  { x0: mx - 1.5, x1: mx + 1.6, z0: mz - 2.4, z1: mz + 2.4 }, // 어시장
  { x0: ax - 2.8, x1: ax + 2.8, z0: az - 1.2, z1: az + 1.2 }, // 어항 (가장 큰 수조 기준)
  { x0: cx - 1.9, x1: cx + 1.9, z0: cz - 1.4, z1: cz + 2.5 }, // 진료소 + 침대
  { x0: bx - 1.1, x1: bx + 2.8, z0: bz - 1.1, z1: bz + 1.1 }, // 벤치 + 파라솔
  { x0: wx - 0.8, x1: wx + 0.8, z0: wz - 1.2, z1: wz + 1.2 }, // 옷장
  { x0: -1.7, x1: 1.7, z0: 20.8, z1: ISLAND_RADIUS }, // 선착장
]

/** 잠긴 구역 문 앞뒤. 다리·보트·바위 같은 해금 소품이 들어올 수 있게 넓게 비운다 */
export const GATE_RECTS: Rect[] = ZONES.flatMap((z) =>
  z.gate ? [{ x0: z.gate.xFrom - 3, x1: z.gate.xTo + 3, z0: FENCE_Z - 7, z1: FENCE_Z + 3.5 }] : [],
)

/** 비워 둘 곳 여유(m). 풀·꽃은 작아서 적게, 덤불·바위·나무는 넉넉히 */
export const CLEARANCE = {
  /** 풀: 시설 바닥에서 */
  grassFacility: 0.1,
  /** 풀: 물가에서 */
  grassWater: 0.35,
  /** 꽃·덤불·바위: 시설 바닥에서 (시설 앞 상호작용 자리까지 비운다) */
  propFacility: 1.4,
  /** 꽃·덤불·바위: 길 가장자리에서 */
  propPath: 0.6,
  /** 꽃·덤불·바위: 물가에서 */
  propWater: 0.9,
  /** 낚시 자리 둘레 반지름 */
  spot: 4.5,
  /** 낚시 자리에서 물 쪽으로 던지는 방향을 비우는 길이 */
  castReach: 12,
  /** 출발점(0, 15) 둘레 */
  spawn: 2,
  /** 나무: 길 가장자리에서 */
  treePath: 2,
}

/** 출발점 [x, z] (Player.tsx 처음 자리) */
export const SPAWN_AT: Vec2 = [0, 15]

/** 낚시 자리 [x, z]와 물 쪽 방향 */
export const SPOT_CLEARANCE = FISHING_SPOTS.map((s) => ({ at: s.position, facing: s.facing }))

/** 꾸미기가 놓일 수 있는 최대 반지름 (바다로 삐져나가지 않게) */
export const DECOR_MAX_RADIUS = ISLAND_RADIUS - 1.2
/** 조개·불가사리는 물가까지 */
export const SHORE_MAX_RADIUS = ISLAND_RADIUS - 0.5

/** 바닥 색 (sRGB) */
export const GROUND_COLORS = {
  grassLight: '#9fd468',
  grassDark: '#78b84c',
  forest: '#5f9e45',
  sand: '#f0dca6',
  wetSand: '#dcc189',
  path: '#d2ab73',
  pathEdge: '#bf9862',
  rocky: '#a99d88',
}

/** 숲(연못 쪽)·바위땅(동굴 쪽) 영역: 중심·반지름 */
export const FOREST_AREA = { center: [-17, -10] as Vec2, radius: 13 }
export const ROCKY_AREA = { center: [0, -22] as Vec2, radius: 9 }

/** 풀 다발 */
export const GRASS = {
  /** 놓을 다발 수 (최대) */
  count: 7000,
  /** 다발 하나의 잎 수 */
  blades: 7,
  /** 키 범위(m) */
  height: [0.2, 0.42] as Vec2,
  /** 얼마나 뭉쳐 자라나 (0 = 고르게, 1 = 덩어리만) */
  clump: 0.6,
}

/** 모래밭 갈대 다발 (해변 경계에 드문드문) */
export const DUNE_GRASS = { count: 140, height: [0.35, 0.6] as Vec2 }

/** 꽃밭: 몇 군데에 몇 송이씩 */
export const FLOWERS = { patches: 34, perPatch: [5, 11] as Vec2, spread: 1.3, height: [0.28, 0.45] as Vec2 }

/** 덤불·바위·버섯 개수와 크기(m) */
export const BUSHES = { count: 46, height: [0.45, 0.9] as Vec2 }
export const ROCKS = { count: 38, height: [0.15, 0.4] as Vec2 }
export const MUSHROOMS = { count: 26, height: [0.18, 0.32] as Vec2 }
/** 조개·불가사리·조약돌 (해변 모래 위) */
export const SHELLS = { count: 34, starfish: 16, pebbles: 60 }

/** 울타리 남쪽에 늘어선 덤불 (문 자리는 비운다) */
export const FENCE_HEDGE = { z: FENCE_Z + 0.9, step: 1.6, height: [0.55, 0.85] as Vec2 }

export type TreeKind = 'palm' | 'palmBend' | 'palmShort' | 'oak' | 'round' | 'fat' | 'pine'
/** 나무 자리 [x, z, 종류, 키(m)]. 밑동에는 작은 원기둥 콜라이더가 있어서 길·시설에서 떨어뜨렸다 */
export const TREES: [number, number, TreeKind, number][] = [
  // 해변 야자수 (선착장 앞 카메라 쪽은 비운다)
  [-26, 9, 'palm', 5.2],
  [-24.3, 13.2, 'palmBend', 4.6],
  [-27.2, 6.4, 'palmShort', 3.4],
  [-12.6, 25.4, 'palmBend', 4.8],
  [-9.2, 26.6, 'palmShort', 3.2],
  [24.4, 9.6, 'palm', 5.4],
  [19.6, 17.6, 'palmBend', 4.6],
  [26.2, 6.6, 'palmShort', 3.4],
  [11.8, 25.6, 'palm', 5],
  // 숲속 연못 숲
  [-24, -4, 'oak', 4.2],
  [-26, -10.5, 'round', 4.8],
  [-21, -17.5, 'pine', 5.2],
  [-17, -21.5, 'oak', 4.4],
  [-9.5, -19.5, 'fat', 3.8],
  [-8.2, -12.5, 'round', 4.6],
  [-22.8, 0.6, 'fat', 3.6],
  [-27.4, -2.5, 'pine', 4.6],
  [-12, -25.2, 'pine', 4.8],
  [-5.6, -6.5, 'oak', 3.8],
  // 암초 쪽
  [9.2, -8.5, 'oak', 4],
  [7.6, -17.5, 'fat', 3.6],
  [11.2, -24.6, 'pine', 4.6],
  [23, -3.6, 'palm', 5],
  [26.8, -6.4, 'palmShort', 3.4],
]

/** 연못 위 연잎 [x, z, 돌림] */
export const LILY_PADS: [number, number, number][] = [
  [-18.2, -13.6, 0.4],
  [-17.4, -15.2, 2.1],
  [-12.2, -14.6, 4],
  [-11.4, -12.8, 1.2],
  [-16.6, -9.6, 5.1],
]

/** 바람: 풀·꽃이 흔들리는 세기(높이 1m 당 옆으로 밀리는 m)와 빠르기 */
export const WIND = { sway: 0.14, speed: 1.6 }
