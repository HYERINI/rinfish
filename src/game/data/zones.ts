import type { ZoneId } from './types'

export const ISLAND_RADIUS = 30
/** 해변(z > FENCE_Z)과 나머지 구역을 나누는 울타리의 z 좌표 */
export const FENCE_Z = 5

/**
 * 울타리·잠긴 문 콜라이더 높이(m, 땅에서). 보이는 모양(울타리 1.2, 문 2)보다 훨씬 높은 보이지 않는 벽이라
 * 점프로 넘어 잠긴 구역에 들어갈 수 없다. 점프 최고 높이 + 캡슐 키보다 높아야 한다 (playerMotion 테스트로 확인)
 */
export const BARRIER_COLLIDER_HEIGHT = { fence: 5, gate: 5 }
/** 바다 수면 높이 (섬 윗면은 y = 0) */
export const WATER_Y = -0.3
/** 연못·동굴 호수처럼 섬 위에 있는 물의 수면 높이 */
export const INLAND_WATER_Y = 0.03

/**
 * 구역 여는 방법
 * - repair: 코인을 내고 수리기사님께 다리·보트 수리를 맡긴다
 * - clear: 도감 종 수와 낚싯줄 단계(화면 Lv, 1부터)를 채우면 수리기사님들이 바위를 치워 준다
 */
export type ZoneUnlock = { kind: 'repair'; target: 'bridge' | 'boat'; price: number } | { kind: 'clear'; minDex: number; minLineLevel: number }

export type ZoneDef = {
  id: ZoneId
  name: string
  color: string
  /** 잠겨 있을 때 문 위에 보여 줄 안내 */
  unlockLabel: string
  /** 울타리에서 이 구역으로 들어가는 문의 x 범위. 해변은 null */
  gate: { xFrom: number; xTo: number } | null
  /** 여는 방법. 해변은 처음부터 열려 있어 null */
  unlock: ZoneUnlock | null
}

export const ZONES: ZoneDef[] = [
  { id: 'beach', name: '선착장 해변', color: '#e9d8a6', unlockLabel: '', gate: null, unlock: null },
  { id: 'pond', name: '숲속 연못', color: '#81c784', unlockLabel: '무너진 다리를 고쳐야 해요', gate: { xFrom: -18, xTo: -10 }, unlock: { kind: 'repair', target: 'bridge', price: 300 } },
  { id: 'cave', name: '동굴 지하호수', color: '#5d4037', unlockLabel: '바위로 막혀 있어요', gate: { xFrom: -4, xTo: 4 }, unlock: { kind: 'clear', minDex: 8, minLineLevel: 3 } },
  { id: 'reef', name: '암초 앞바다', color: '#4fc3f7', unlockLabel: '부서진 보트를 고쳐야 해요', gate: { xFrom: 10, xTo: 18 }, unlock: { kind: 'repair', target: 'boat', price: 800 } },
]

export function getZone(id: ZoneId): ZoneDef {
  const zone = ZONES.find((z) => z.id === id)
  if (!zone) throw new Error(`알 수 없는 구역: ${id}`)
  return zone
}

export type FishingSpot = {
  id: string
  zone: ZoneId
  /** 서는 위치 [x, z] */
  position: [number, number]
  /** 물 쪽을 향하는 단위 방향 [dx, dz] */
  facing: [number, number]
  /** 찌가 떠 있을 수면 높이 */
  surfaceY: number
}

export const FISHING_SPOTS: FishingSpot[] = [
  { id: 'beach-dock', zone: 'beach', position: [0, 27], facing: [0, 1], surfaceY: WATER_Y },
  { id: 'beach-rocks', zone: 'beach', position: [-19, 21], facing: [-0.67, 0.74], surfaceY: WATER_Y },
  { id: 'pond-edge', zone: 'pond', position: [-15, -6.5], facing: [0, -1], surfaceY: INLAND_WATER_Y },
  { id: 'reef-cliff', zone: 'reef', position: [22, -17], facing: [0.79, -0.61], surfaceY: WATER_Y },
  { id: 'cave-lake', zone: 'cave', position: [0, -19], facing: [0, -1], surfaceY: INLAND_WATER_Y },
]

export function getSpot(id: string): FishingSpot {
  const spot = FISHING_SPOTS.find((s) => s.id === id)
  if (!spot) throw new Error(`알 수 없는 낚시 포인트: ${id}`)
  return spot
}

/** 선착장 해변 시설 위치 [x, z]. 바닥(y=0) 기준 */
export const FACILITY = {
  market: [12, 12] as [number, number],
  aquarium: [14, 19] as [number, number],
  clinic: [-14, 10] as [number, number],
  bench: [-5, 21] as [number, number],
  wardrobe: [7, 22] as [number, number],
}

/** 쓰러지면 깨어나는 곳 (진료소 앞) */
export const CLINIC_SPAWN: [number, number] = [FACILITY.clinic[0], FACILITY.clinic[1] + 2.5]

/** 벤치에 앉을 때 플레이어가 놓이는 자리와 바라보는 각도(0 = +z, 바다 쪽) */
export const BENCH_SEAT = { position: [FACILITY.bench[0], FACILITY.bench[1]] as [number, number], facing: 0 }
