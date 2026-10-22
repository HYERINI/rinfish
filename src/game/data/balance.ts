import type { BasicPattern, Rarity, ZoneId } from './types'

type Range = [number, number]

/** 텐션 줄다리기 */
export const FIGHT = {
  startDistance: 25,
  /** 이 거리까지 멀어지면 물고기가 도망간다 */
  escapeDistance: 45,
  startTension: 30,
  /** 감는 동안 초당 오르는 텐션 */
  reelTensionRate: 18,
  /** 손을 뗀 동안 초당 내려가는 텐션 */
  relaxRate: 55,
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

/** 구역별 희귀도 가중치 덮어쓰기. 동굴은 전설을 노리는 곳이라 같이 사는 에픽보다 전설이 잘 나온다 */
export const ZONE_RARITY_WEIGHTS: Partial<Record<ZoneId, Partial<Record<Rarity, number>>>> = {
  cave: { legendary: 16 },
}

/** 최대 파워로 던졌을 때 가중치 증가 배율 (rare ×2, epic ×3) */
export const CAST_RARITY_BONUS = { rare: 1, epic: 2 }

/** 한 프레임에서 진행시킬 최대 시간(초). 탭 전환 후 큰 delta 방지 */
export const MAX_FRAME_DELTA = 0.1

/** 체력 */
export const STAMINA = {
  max: 100,
  /** 한 번 던질 때 드는 체력 */
  castCost: 2,
  /** 줄다리기 중 초당 드는 체력 */
  fightCostPerSecond: 0.6,
  /** 체력 0이 된 뒤 쓰러지기까지 유예 시간(초) */
  graceSeconds: 180,
  /** 약화 상태에서 릴 속도에 곱하는 값 */
  weakReelMul: 0.6,
  /** 약화 상태에서 텐션 상승에 곱하는 값 */
  weakTensionMul: 1.3,
  /** 벤치에 앉아 있을 때 초당 회복량 */
  benchRegenPerSecond: 6,
  /** 낚시하지 않고 돌아다니는 동안(탐험 모드) 초당 저절로 회복하는 양. 약화(체력 0) 중엔 회복하지 않는다 — 음식이나 벤치가 필요하다 */
  passiveRegenPerSecond: 0.3,
  /** 체력이 이보다 낮으면 HUD 에 "음식을 사 먹거나 벤치에서 쉬세요" 안내를 띄운다 */
  lowHint: 30,
}

/** 쓰러졌을 때 보유 코인에서 진료비로 빠지는 비율 */
export const FAINT_COIN_PENALTY = 0.2

/** 요리 효과 배율. 희귀한 물고기로 만들수록 회복량과 버프 지속시간이 커진다 */
export const DISH_POTENCY: Record<Rarity, number> = {
  junk: 0.5,
  common: 1,
  rare: 1.5,
  epic: 2,
  legendary: 3,
}

/** 어항 */
export const AQUARIUM = {
  /** 마지막 급식 후 이 시간(초)이 지나면 배고픔 */
  hungerAfter: 600,
  /** 배고픈 상태로 이 시간(초)이 더 지나면 방생 */
  releaseAfter: 600,
  /** 방생 몇 초 전에 알림을 띄울지 */
  releaseWarningBefore: 120,
  /** 어항 종류와 맞는 구역 물고기의 수입 배율 */
  typeBonus: 1.5,
  /** 사료 1개 가격 */
  feedPrice: 5,
}

/** 전시 물고기 한 마리가 1분에 버는 입장료 */
export const VISITOR_INCOME_PER_MINUTE: Record<Rarity, number> = {
  junk: 0,
  common: 1,
  rare: 3,
  epic: 8,
  legendary: 20,
}

/** 중력 가속도 (m/s², 아래로). Physics 에 그대로 넘긴다 */
export const GRAVITY = 9.81

/** 플레이어 캡슐 콜라이더. 전체 키 = 2 × (halfHeight + radius) */
export const PLAYER_BODY = { halfHeight: 0.5, radius: 0.4 }

/** 플레이어 이동 (m/s). 점프는 위로 차고 오르는 세로 속도 */
export const MOVE = {
  walkSpeed: 8,
  /** Shift 를 누르고 있는 동안 */
  sprintSpeed: 13,
  jumpSpeed: 6.5,
  /** 구르기 동안 앞으로 나아가는 속도. 클립이 제자리에서 굴러서 몸(리지드바디)을 대신 밀어 준다 */
  rollSpeed: 1.6,
}

/**
 * 마우스 휠 줌. 멀 땐 카메라 높이 = 시선 높이 + 거리 × heightRatio.
 * closeFrom 보다 가까워질수록 높이 비율은 closeHeightRatio 로, 시선은 얼굴 높이(closeLookAt)로 옮겨 가서 가장 가까이 당기면 얼굴이 보인다
 */
export const CAMERA_ZOOM = {
  min: 1.5,
  max: 18,
  initial: 10,
  heightRatio: 0.7,
  /** 휠 deltaY 1당 거리 배율 변화 (지수) */
  sensitivity: 0.0015,
  /** 가장 가까울 때 카메라 높이 비율과 시선 높이(캐릭터 키 대비) */
  closeHeightRatio: 0.12,
  closeLookAt: 0.88,
  farLookAt: 0.55,
  /** 이 거리부터 가까워지는 만큼 얼굴 쪽으로 옮겨 간다 */
  closeFrom: 6,
  /** 이 거리보다 가깝고 faceTurnDelay 초 넘게 멈춰 있으면 캐릭터가 카메라 쪽으로 천천히 돌아선다(카메라는 돌리지 않는다) */
  faceTurnBelow: 3,
  faceTurnDelay: 0.4,
  /** 돌아서는 빠르기 (클수록 빨리) */
  faceTurnSpeed: 3,
  /** 이 거리보다 가까우면 낚시 중이 아닐 때 낚싯대를 숨긴다 (화면을 가린다) */
  hideRodBelow: 3,
}

/**
 * 음식 먹는 동작(초). duration 동안 오른손에 든 음식을 입으로 가져가 냠냠 먹는다.
 * raiseTime: 손을 올리고 내리는 시간, biteEvery: 한 입 베어 무는 간격
 */
export const EAT = { duration: 2.4, raiseTime: 0.3, biteEvery: 0.45 }

/** 한 입 베어 물 때마다 머리 위에 차례로 뜨는 소리 (넘치면 처음부터 다시) */
export const CHEW_WORDS = ['아구작', '아구작', '냠냠', '쩝쩝']
