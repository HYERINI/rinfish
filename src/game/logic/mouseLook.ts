import { MOUSE_LOOK } from '../data/settings'
import type { Mode } from './interaction'

/**
 * 마우스 움직임 → 카메라 회전. yaw 는 cameraYaw.ts 와 같은 뜻(카메라가 플레이어 주위를 도는 각도)이다.
 * 마우스를 오른쪽으로 움직이면 시선이 오른쪽으로 돌고(yaw 감소), 위로 움직이면 고개를 든다(카메라가 내려온다 = pitch 감소).
 * invertY 면 위아래만 반대
 */
export function applyMouseLook(
  view: { yaw: number; pitch: number },
  movementX: number,
  movementY: number,
  sensitivity: number,
  invertY: boolean,
): { yaw: number; pitch: number } {
  const dx = Number.isFinite(movementX) ? movementX : 0
  const dy = Number.isFinite(movementY) ? movementY : 0
  return {
    yaw: view.yaw - dx * sensitivity,
    pitch: clampPitch(view.pitch + (invertY ? -dy : dy) * sensitivity),
  }
}

export function clampPitch(pitch: number): number {
  return Math.min(MOUSE_LOOK.maxPitch, Math.max(MOUSE_LOOK.minPitch, pitch))
}

/**
 * 줌 리그(cameraRig)가 정한 카메라 자리를 시선 높이를 축으로 pitch 만큼 위아래로 더 돌린다.
 * distance·height 는 플레이어(발) 기준 수평 거리와 높이, lookAtY 는 시선 높이. 시선까지 거리는 그대로 두고 각도만 바꾼다.
 * 결과 높이는 minCameraHeight 아래로 내려가지 않는다 (땅을 뚫지 않게)
 */
export function pitchedOffset(distance: number, height: number, lookAtY: number, pitch: number): { horizontal: number; height: number } {
  if (pitch === 0) return { horizontal: distance, height }
  const dy = height - lookAtY
  const radius = Math.hypot(distance, dy)
  // 머리 위로 넘어가지 않게 (수평 거리가 음수가 되면 화면이 뒤집힌다)
  const angle = Math.min(Math.atan2(dy, distance) + clampPitch(pitch), Math.PI / 2 - 0.05)
  return {
    horizontal: radius * Math.cos(angle),
    height: Math.max(MOUSE_LOOK.minCameraHeight, lookAtY + radius * Math.sin(angle)),
  }
}

/** 마우스를 잠가 둘 수 있는 화면. 낚시·패널·꾸미기 등 그 밖의 화면은 커서가 필요해서 풀어 준다 */
export function canLockPointer(mode: Mode): boolean {
  return mode === 'explore'
}

/**
 * 마우스 잠금이 풀렸을 때 메뉴를 열까. 잠긴 동안 ESC 는 브라우저가 먼저 가져가 잠금만 풀고 키 입력은 오지 않는다.
 * 그래서 게임이 직접 풀지 않았는데(ESC·창 전환) 탐험 중에 풀리면 메뉴를 연다: ESC 한 번 = 메뉴, 다른 게임과 같은 느낌
 */
export function shouldOpenMenuOnUnlock(mode: Mode, releasedByGame: boolean): boolean {
  return !releasedByGame && mode === 'explore'
}
