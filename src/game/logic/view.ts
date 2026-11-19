import { AIM_VIEW, GUNS, type GunId, type ZoomStep } from '../data/guns'
import type { Mode } from './interaction'

/** 카메라 시점: 3인칭(지금처럼) / 1인칭 (V) */
export type ViewMode = 'third' | 'first'

/**
 * 1인칭으로 볼 수 있는 화면. 낚시·벤치·배·연출·잠·꾸미기·어항 크게 보기·로비는 늘 3인칭 (몸이 보여야 하거나 카메라가 따로 움직인다).
 * 새 Mode 를 더하면 여기서도 정해야 한다 (Record 라 빠뜨리면 타입 오류)
 */
const FIRST_PERSON_OK: Record<Mode, boolean> = {
  explore: true,
  map: true,
  menu: true,
  bag: true,
  vendor: true,
  emote: true,
  sell: true,
  shop: true,
  dex: true,
  market: true,
  aquarium: true,
  unlock: true,
  rack: true,
  fishing: false,
  rest: false,
  boat: false,
  cutscene: false,
  sleep: false,
  wardrobe: false,
  aquariumView: false,
  lobby: false,
}

/** 지금 1인칭으로 그리나: V 로 1인칭을 골랐거나, 조준경 총(소총·저격총)으로 조준하는 동안 (은지: 3인칭에서 조준하면 그동안 1인칭) */
export function isFirstPerson(view: ViewMode, mode: Mode, scopeAim: boolean): boolean {
  return FIRST_PERSON_OK[mode] && (view === 'first' || scopeAim)
}

/** 배율 mag 조준경의 FOV (도): 화면 가운데가 mag 배로 커 보인다 */
export function scopeFov(baseFov: number, mag: number): number {
  return (2 * Math.atan(Math.tan((baseFov * Math.PI) / 360) / mag) * 180) / Math.PI
}

/** 조준할 때 FOV (도): 배율 조준경(2.5x·4x·8x)이면 그만큼, 아니면 은지 aimFov 를 우리 FOV 비율로 (지금은 둘 다 60 이라 그대로: 권총 50) */
export function aimFov(gun: GunId, optic: ZoomStep | null, baseFov = AIM_VIEW.baseFov): number {
  if (optic && optic.mag > 1) return scopeFov(baseFov, optic.mag)
  return (baseFov * GUNS[gun].aimFov) / AIM_VIEW.eunjiBaseFov
}

/**
 * 폰 조준 버튼을 한 번 누르면: 조준 안 하는 중이면 조준(첫 배율), 조준경 총은 다음 배율, 마지막 배율이면 조준을 끈다 (폰엔 휠이 없다)
 */
export function nextTouchAim(aiming: boolean, step: number, steps: number): { aiming: boolean; step: number } {
  if (!aiming) return { aiming: true, step: 0 }
  if (step + 1 < steps) return { aiming: true, step: step + 1 }
  return { aiming: false, step: 0 }
}

/** 휠로 배율 단계 바꾸기: 위로(deltaY < 0) 굴리면 다음(더 크게), 아래로 굴리면 이전. 끝에서 멈춘다 */
export function stepZoom(index: number, steps: number, deltaY: number): number {
  if (!(steps > 0) || !Number.isFinite(deltaY) || deltaY === 0) return index
  return Math.min(steps - 1, Math.max(0, index + (deltaY < 0 ? 1 : -1)))
}
