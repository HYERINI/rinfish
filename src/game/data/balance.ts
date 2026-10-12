import type { BasicPattern, Rarity } from './types'

type Range = [number, number]

/** 텐션 줄다리기 */
export const FIGHT = {
  startDistance: 60,
  /** 이 거리까지 멀어지면 물고기가 도망간다 */
  escapeDistance: 100,
  startTension: 30,
  /** 감는 동안 초당 오르는 텐션 */
  reelTensionRate: 30,
  /** 손을 뗀 동안 초당 내려가는 텐션 */
  relaxRate: 40,
  /** 텐션이 이보다 낮은 상태가 slackEscapeTime 초 이어지면 바늘이 빠진다 */
  slackThreshold: 5,
  slackEscapeTime: 2.5,
  /** 당김 중 초당 텐션 상승 = strength × 이 값 × 당김 세기 × 낚싯대 */
  pullTensionPerStrength: 8,
  /** 당김 중 손을 떼고 있을 때 초당 멀어지는 거리 = strength × 이 값 × 당김 세기 */
  pullDistancePerStrength: 1.5,
  /** 당김이 없을 때 손을 떼고 있으면 초당 멀어지는 거리 */
  driftSpeed: 1,
  /** 당김 중에 감으면 감기 속도에 곱하는 값 */
  reelDuringPullFactor: 0.3,
  /** 한 번의 스텝에서 처리하는 최대 시간(초) */
  maxDt: 0.1,
  /** 전설(mixed) 패턴 전환 기준: 남은 거리 비율이 첫 값보다 크면 돌진, 둘째 값보다 크면 지구전, 그 아래는 변덕 */
  mixedPhaseThresholds: [0.66, 0.33] as const,
}

export type PatternConfig = {
  /** 당김과 당김 사이 쉬는 시간(초) */
  interval: Range
  /** 당김 지속 시간(초) */
  duration: Range
  /** 당김 세기 */
  intensity: Range
}

export const PATTERNS: Record<BasicPattern, PatternConfig> = {
  dasher: { interval: [3, 5], duration: [0.6, 0.6], intensity: [1.6, 1.6] },
  endurance: { interval: [1.5, 2.5], duration: [2, 2], intensity: [0.6, 0.6] },
  erratic: { interval: [0.5, 3], duration: [0.3, 1.2], intensity: [0.5, 1.5] },
}

/** 입질 */
export const BITE = {
  waitMin: 2,
  waitMax: 5,
  /** 진짜 입질 전 페이크(톡톡) 횟수 */
  nibbleMin: 1,
  nibbleMax: 3,
  nibbleDuration: 0.3,
  gapMin: 0.5,
  gapMax: 1.2,
  /** 찌가 크게 잠긴 뒤 챔질할 수 있는 시간 */
  biteWindow: 0.8,
}

/** 캐스팅 */
export const CAST = {
  /** 이만큼 누르고 있으면 최대 파워 */
  fullPowerHoldSeconds: 1.5,
  minDistance: 4,
  extraDistance: 8,
}

/** 물고기 추첨 가중치 */
export const RARITY_WEIGHTS: Record<Rarity, number> = {
  junk: 8,
  common: 60,
  rare: 24,
  epic: 8,
  legendary: 1,
}

/** 최대 파워로 던졌을 때 가중치 증가 배율 (rare ×2, epic ×3) */
export const CAST_RARITY_BONUS = { rare: 1, epic: 2 }

/** 한 프레임에서 진행시킬 최대 시간(초). 탭 전환 후 큰 delta 방지 */
export const MAX_FRAME_DELTA = 0.1
