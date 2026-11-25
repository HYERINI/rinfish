import type { OreId } from './meadowItems'

/**
 * 광산. 지상에는 입구(바위 더미 + 빛나는 자리)만 있고, 안은 입구 아래 땅속(y = MINE.floorY)에 따로 있다.
 * 입구의 빛나는 자리에서 E → 안으로 순간이동, 안의 빛나는 자리에서 E → 밖으로. 좌표는 모두 세계 좌표.
 * 입구는 초원 서쪽 해안(선착장 북쪽)에 둔다: 은지 숲은 가장자리 8m 안쪽부터라 나무·바위와 겹치지 않는다
 */
export const MINE_ENTRANCE = {
  /** 바위 더미 가운데 (문은 남쪽 +z 를 본다) */
  mound: [95.5, -13.4] as [number, number],
  /** 빛나는 자리 (E "광산 들어가기") */
  spot: [95.5, -10.2] as [number, number],
  /** 광산에서 나왔을 때 서는 자리 */
  out: [95.5, -8.2] as [number, number],
}

/** 광산 안 (바닥 사각형과 바닥 높이·천장 높이) */
export const MINE = { x0: 96, x1: 124, z0: -40, z1: -16, floorY: -30, height: 4.5 }

/** 광산 안에서 E "밖으로 나가기" 빛나는 자리와, 들어왔을 때 서는 자리 */
export const MINE_EXIT = { spot: [98.5, -18.5] as [number, number], arrive: [101.2, -21.2] as [number, number] }

/** 몸 가운데가 이보다 낮으면 땅속(광산 안)이다. 지상은 y ≈ 1, 광산은 y ≈ -29 */
export const UNDERGROUND_Y = -10

export const isUnderground = (y: number): boolean => y < UNDERGROUND_Y

/** 순간이동 높이: 바닥 위 1m 에 놓으면 살짝 떨어져 선다 (지상 y = 1 과 같은 방식) */
export const MINE_ARRIVE_Y = MINE.floorY + 1

/**
 * 광석마다: 캐는 데 필요한 곡괭이질 수(hits), 다 캔 뒤 다시 생기는 시간(respawn, 초), 한 번에 나오는 개수(n), 결정 색.
 * 귀할수록 오래 캐고 늦게 다시 생긴다
 */
export const ORES: Record<OreId, { hits: number; respawn: number; n: number; color: string }> = {
  stone: { hits: 2, respawn: 45, n: 2, color: '#8d8f96' },
  copper: { hits: 3, respawn: 75, n: 1, color: '#e07a3a' },
  iron: { hits: 4, respawn: 100, n: 1, color: '#9fb0c2' },
  silver: { hits: 5, respawn: 150, n: 1, color: '#eef3fa' },
  gold: { hits: 6, respawn: 210, n: 1, color: '#ffd23f' },
}

/** 광맥 자리 (세계 x, z). 벽을 따라 둔다. 안쪽(북동쪽)으로 갈수록 귀한 광석 */
export const ORE_NODES: { ore: OreId; x: number; z: number }[] = [
  { ore: 'stone', x: 104, z: -17.6 },
  { ore: 'stone', x: 111, z: -17.6 },
  { ore: 'stone', x: 97.6, z: -27 },
  { ore: 'stone', x: 112, z: -25.6 },
  { ore: 'copper', x: 118, z: -17.6 },
  { ore: 'copper', x: 97.6, z: -34 },
  { ore: 'copper', x: 108, z: -38.4 },
  { ore: 'iron', x: 122.4, z: -23 },
  { ore: 'iron', x: 115, z: -38.4 },
  { ore: 'iron', x: 119, z: -33.6 },
  { ore: 'silver', x: 122.4, z: -31 },
  { ore: 'gold', x: 122.4, z: -38 },
]

/** 광맥 바위의 충돌 반지름(m). 바위는 사람 키만 하다 (scene/mine/Mine.tsx ORE_HEIGHT) */
export const ORE_RADIUS = 1

/** 광산 가운데 바위 기둥 (가운데 x, z, 반지름) */
export const MINE_PILLARS: [number, number, number][] = [
  [109, -28, 1.3],
  [116, -32, 1.3],
]

/**
 * 곡괭이질 (칼 베기와 같은 팔 동작을 조금 느리게). dur: 동작 시간(초), hitAt: 맞는 순간(진행도), cool: 다음 곡괭이질까지(초),
 * reach: 광맥 가운데까지 닿는 거리(m)
 */
export const PICK = { dur: 0.5, hitAt: 0.45, cool: 0.62, reach: 3 }
