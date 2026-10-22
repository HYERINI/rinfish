import { DEFAULT_SETTINGS, MOUSE_LOOK } from '../data/settings'

/** 저장하는 설정 (음악·마우스) */
export type Settings = {
  /** 0~1 */
  musicVolume: number
  musicMuted: boolean
  /** 마우스 1px 당 회전 (라디안) */
  lookSensitivity: number
  /** 마우스를 위로 올리면 카메라가 아래를 보게 (비행기식) */
  invertY: boolean
}

function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v))
}

export function clampVolume(v: unknown): number {
  return typeof v === 'number' && Number.isFinite(v) ? clamp(v, 0, 1) : DEFAULT_SETTINGS.musicVolume
}

export function clampSensitivity(v: unknown): number {
  return typeof v === 'number' && Number.isFinite(v) ? clamp(v, MOUSE_LOOK.minSensitivity, MOUSE_LOOK.maxSensitivity) : DEFAULT_SETTINGS.lookSensitivity
}

/** 저장본(무엇이든)을 검증해서 쓸 수 있는 설정으로. 틀린 값은 기본값 */
export function normalizeSettings(saved: unknown): Settings {
  const s = typeof saved === 'object' && saved !== null ? (saved as Record<string, unknown>) : {}
  return {
    musicVolume: clampVolume(s.musicVolume),
    musicMuted: typeof s.musicMuted === 'boolean' ? s.musicMuted : DEFAULT_SETTINGS.musicMuted,
    lookSensitivity: clampSensitivity(s.lookSensitivity),
    invertY: typeof s.invertY === 'boolean' ? s.invertY : DEFAULT_SETTINGS.invertY,
  }
}

/** 감도 슬라이더(0~100)와 실제 감도 사이 변환. 범위가 넓어서 로그 눈금을 쓴다 */
export function sensitivityToSlider(sensitivity: number): number {
  const { minSensitivity: lo, maxSensitivity: hi } = MOUSE_LOOK
  return (Math.log(clampSensitivity(sensitivity) / lo) / Math.log(hi / lo)) * 100
}

export function sliderToSensitivity(slider: number): number {
  const { minSensitivity: lo, maxSensitivity: hi } = MOUSE_LOOK
  const t = clamp(Number.isFinite(slider) ? slider : 0, 0, 100) / 100
  return lo * (hi / lo) ** t
}
