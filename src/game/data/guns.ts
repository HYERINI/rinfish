/** 총 4종 (은지 weapons.js WEAPONS 값 그대로). 도구 칸 4~7 */
export type GunId = 'pistol' | 'rifle' | 'shotgun' | 'sniper'
export const GUN_IDS: GunId[] = ['pistol', 'rifle', 'shotgun', 'sniper']

/** 조준경 배율 한 단계 (mag 1 = 확대 없는 홀로그램 조준기) */
export type ZoomStep = { label: string; mag: number }

/**
 * auto: 누르고 있으면 계속 쏜다, rpm: 분당 발사 수, mag: 탄창, reload: 장전 시간(초), pellets: 한 번에 나가는 알 수,
 * dmg: 동물 피해 (알 하나), spread·aimSpread: 퍼짐(rad, 조준하면 aimSpread), recoil: 반동(rad), aimFov: 은지 조준 FOV(은지 기본 60 기준),
 * zoom: 조준경 배율 단계 (소총·저격총), sound: 은지 audio.js 총소리
 */
export type Gun = {
  id: GunId
  name: string
  auto: boolean
  rpm: number
  mag: number
  reload: number
  pellets: number
  dmg: number
  spread: number
  aimSpread: number
  recoil: number
  aimFov: number
  zoom?: ZoomStep[]
}

export const GUNS: Record<GunId, Gun> = {
  pistol: { id: 'pistol', name: '권총', auto: false, rpm: 320, mag: 12, reload: 1.3, pellets: 1, dmg: 1, spread: 0.012, aimSpread: 0.003, recoil: 0.018, aimFov: 50 },
  rifle: { id: 'rifle', name: '소총', auto: true, rpm: 650, mag: 30, reload: 2.0, pellets: 1, dmg: 1, spread: 0.02, aimSpread: 0.006, recoil: 0.01, aimFov: 45, zoom: [{ label: '홀로', mag: 1 }, { label: '2.5x', mag: 2.5 }] },
  shotgun: { id: 'shotgun', name: '산탄총', auto: false, rpm: 70, mag: 6, reload: 2.4, pellets: 8, dmg: 1, spread: 0.05, aimSpread: 0.035, recoil: 0.05, aimFov: 55 },
  sniper: { id: 'sniper', name: '저격총', auto: false, rpm: 40, mag: 5, reload: 2.6, pellets: 1, dmg: 3, spread: 0.04, aimSpread: 0, recoil: 0.06, aimFov: 40, zoom: [{ label: '4x', mag: 4 }, { label: '8x', mag: 8 }] },
}

export const isGun = (v: unknown): v is GunId => GUN_IDS.includes(v as GunId)

/** 총알이 날아가는 거리 (은지 MAX_RANGE, m) */
export const GUN_RANGE = 80
/** 은지 기본 예비 탄약 (탄창은 가득 찬 채로 시작) */
export const START_RESERVE: Record<GunId, number> = { pistol: 48, rifle: 120, shotgun: 24, sniper: 20 }
/** 예비 탄약 상한 (저장본 검사. 묶음을 아주 많이 사도 이만큼) */
export const MAX_RESERVE = 9999

/** 총 바꾸는 시간(초, 은지 cool 0.25), 빈 탄창 딸깍 뒤 쉬는 시간(초, 은지 0.3) */
export const GUN_SWAP = 0.25
export const DRY_FIRE_PAUSE = 0.3
/** 연사 열기: 연사 총은 한 발마다 +0.15 (최대 1), 초당 2 씩 식는다. 퍼짐에 열기 × 0.01 을 더한다 (은지 heat) */
export const HEAT = { perShot: 0.15, cool: 2, spread: 0.01 }
/** 반동 배율: 조준하면 0.6, 조준경으로 보면 0.5 를 더 곱한다 (은지 rig.kick) */
export const RECOIL = { aim: 0.6, scope: 0.5 }

/**
 * PvP (은지 server PVP_DMG·HIT_COOL). 체력 100 기준 피해, 산탄총은 맞은 알 수(최대 8)만큼 곱한다.
 * cool: 서버가 같은 무기로 다시 받는 최소 간격(초. 클라이언트 연사 간격보다 조금 느슨하게)
 */
export type PvpWeapon = GunId | 'knife' | 'stab' | 'fists'
export const PVP_WEAPONS: PvpWeapon[] = [...GUN_IDS, 'knife', 'stab', 'fists']
export const PVP: Record<PvpWeapon, { dmg: number; cool: number }> = {
  pistol: { dmg: 20, cool: 0.15 },
  rifle: { dmg: 14, cool: 0.07 },
  shotgun: { dmg: 9, cool: 0.6 },
  sniper: { dmg: 70, cool: 1.2 },
  knife: { dmg: 15, cool: 0.4 },
  stab: { dmg: 30, cool: 0.7 },
  fists: { dmg: 5, cool: 0.3 },
}

/** 다른 사람 몸 판정 캡슐 (은지 remote.js: 반지름 0.32, 가운데 기둥 1.3 → 발밑~머리 위 1.94) */
export const PEER_HIT = { radius: 0.32, length: 1.3 }

/** 동물 몸 판정 기둥 높이 (m) = 모델 배율 × 1.5, 아주 작은 동물도 0.4 (반지름은 data/animals hitRadius) */
export const ANIMAL_HIT_HEIGHT = { perScale: 1.5, min: 0.4 }

/**
 * 조준·1인칭 카메라 (은지 cameraRig·weapons.js). baseFov: 우리 카메라 FOV (은지는 60 이라 은지 aimFov 는 이 비율로 줄인다),
 * aimDistance·shoulder: 3인칭 조준 때 카메라 거리 상한과 오른쪽 어깨 너머로 비키는 거리, fovSpeed: FOV 가 따라가는 빠르기,
 * firstPitch: 1인칭에서 위아래로 볼 수 있는 한계 (rad)
 */
export const AIM_VIEW = { baseFov: 50, eunjiBaseFov: 60, aimDistance: 1.9, shoulder: 0.65, fovSpeed: 14, firstPitch: 1.3 }

/**
 * 1인칭 무기 자리 (카메라 기준, 은지 _hip·_knifePos·_fistsPos). 조준하면 가늠쇠(sight)가 화면 가운데 오도록 옮긴다.
 * kick: 쏠 때 뒤로 밀리는 거리, kickDecay: 되돌아오는 빠르기, follow: 자리를 따라가는 빠르기
 */
export const VIEW_MODEL = {
  hip: [0.2, -0.17, -0.42] as [number, number, number],
  knife: [0.18, -0.16, -0.3] as [number, number, number],
  fists: [0, -0.2, -0.38] as [number, number, number],
  kick: 0.04,
  kickDecay: 14,
  follow: 12,
}
