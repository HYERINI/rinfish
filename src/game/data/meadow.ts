import type { VendorId } from './meadowPrices'
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

/** 은지 집 실내 방 4개 (은지 world.js ROOMS: 침실·거실·주방·사격장, 은지 좌표. 같은지 테스트) */
export const MEADOW_ROOMS: EunjiArea[] = [
  { minX: -5, maxX: 5, minZ: -5, maxZ: 5 },
  { minX: 5, maxX: 15, minZ: -5, maxZ: 5 },
  { minX: 5, maxX: 13, minZ: -13, maxZ: -5 },
  { minX: 15, maxX: 27, minZ: -5, maxZ: 5 },
]

/** 세계 (x, z) 가 은지 집 안인가. 은지 roomAt 처럼 maxX 는 빼고 maxZ 는 넣는다 (동물이 쫓기를 포기한다) */
export function isIndoor(x: number, z: number): boolean {
  const [lx, lz] = toMeadowLocal(x, z)
  return MEADOW_ROOMS.some((r) => lx >= r.minX && lx < r.maxX && lz >= r.minZ && lz <= r.maxZ)
}

/** 세계 (x, z) 가 사격장 방 안인가 (은지 roomAt 'range': 은지 x 15..27, z -5..5 → 세계 x 173..185). G 연습 게임은 여기서만 */
export function inRangeRoom(x: number, z: number): boolean {
  const [lx, lz] = toMeadowLocal(x, z)
  const r = MEADOW_ROOMS[3]
  return lx >= r.minX && lx < r.maxX && lz >= r.minZ && lz <= r.maxZ
}

/** 은지 침실 침대 (은지 world.bedSpot 3.5, 3.6) */
export const BED_SPOT: [number, number] = toWorld(3.5, 3.6)
/** E "잠자기" 감지 상자: 침대와 그 앞을 덮고 침실 벽(은지 x 5, z 5) 밖으로 나가지 않는다 (은지 2m 와 비슷) */
export const BED_ZONE = { center: toWorld(3, 3), half: [1.9, 1.2, 1.9] as [number, number, number] }
/** 죽은 뒤 깨어나는 침대 옆 (은지 2.2, 2.4) */
export const BED_WAKE: [number, number] = toWorld(2.2, 2.4)

/** 처음 시작하는 자리: 은지 집 마당 (은지 좌표 12, 12) */
export const START_SPOT: [number, number] = toWorld(12, 12)

/** 초원 가장자리 모래 띠 폭 (m, 사각형 안쪽) */
export const SHORE_SAND = 4

/** 낮 하늘색 (은지 daynight.js DAY). 바다가 먼 곳에서 이 색으로 흐려진다 */
export const SKY_DAY = '#a9d4f5'

/** 은지 집 문 4개 (은지 world.js 가 만드는 순서). 문 상태는 저장한다 (progressStore.doors) */
export const MEADOW_DOORS = ['거실 문', '사격장 문', '주방 문', '현관문']

/**
 * 마을 상인 3곳 (은지 town.js VENDORS). at: 노점 가운데 (은지 좌표, E 거리는 여기서 2.8m), npc: 노점 뒤 상인이 서는 자리 (은지 좌표).
 * 상인 모습은 은지 모델(21MB) 대신 낚시섬 캐릭터 프리셋 (LOOK_PRESETS id). 분수(은지 z 2) 쪽을 본다
 */
export const MEADOW_VENDORS: { id: VendorId; name: string; greet: string; at: [number, number]; npc: [number, number]; look: string }[] = [
  { id: 'butcher', name: '정육점', greet: '고기와 요리를 삽니다', at: [46, 11.5], npc: [46, 12.4], look: 'grandpa' },
  { id: 'general', name: '잡화점', greet: '탄약을 팝니다 · 뼈·비계·광석은 삽니다', at: [52, 11.5], npc: [52, 12.4], look: 'lady' },
  { id: 'grocer', name: '농산물 가게', greet: '달걀·호박·버섯을 사고팝니다', at: [58, 11.5], npc: [58, 12.4], look: 'rangerMale' },
]
