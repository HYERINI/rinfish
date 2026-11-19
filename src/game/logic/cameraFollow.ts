import { NEAR_VIEW } from '../data/balance'
import { AIM_VIEW, isGun } from '../data/guns'
import { MEADOW_RECT } from '../data/meadow'
import type { ToolId } from '../data/tools'
import { ISLAND_RADIUS } from '../data/zones'
import type { Mode } from './interaction'
import { pitchedOffset } from './mouseLook'
import { cameraRig } from './playerMotion'

/** 이 x 보다 동쪽이면 초원 카메라 (섬 가장자리와 초원 사이 바다 한가운데. 배로 건너는 동안 부드럽게 바뀐다) */
export const MEADOW_VIEW_X = (ISLAND_RADIUS + MEADOW_RECT.x0) / 2

/** 카메라가 초원 쪽인가 (초원 선착장·건너는 배 뒤쪽 절반 포함) */
export function inMeadowView(x: number): boolean {
  return x > MEADOW_VIEW_X
}

/** 무기(주먹·칼·총)를 들고 돌아다니나: 싸울 땐 가까이서 본다 */
export function isArmed(mode: Mode, tool: ToolId | null | undefined): boolean {
  return mode === 'explore' && (tool === 'fists' || tool === 'knife' || isGun(tool))
}

export type CameraViewInput = { inMeadow: boolean; mode: Mode; tool: ToolId | null | undefined; zoom: number; meadowZoom: number; aiming: boolean }

/**
 * 3인칭 카메라가 가려는 거리(m)와 낮춤 정도(low 0~1, cameraRig 참고).
 * 초원은 초원 줌(기본 4m), 섬은 섬 줌. 무기를 들면 그 줌을 NEAR_VIEW.armedMax 까지만 두고, 총으로 조준하면 AIM_VIEW.aimDistance 까지 당긴다.
 * 초원이거나 무기를 들면 낮게 (은지 어깨 높이). 섬에서 무기 없이는 예전 그대로 (낚시섬 내려다보기)
 */
export function cameraView(v: CameraViewInput): { distance: number; low: number } {
  const armed = isArmed(v.mode, v.tool)
  let distance = v.inMeadow ? v.meadowZoom : v.zoom
  if (armed) distance = Math.min(distance, NEAR_VIEW.armedMax)
  if (armed && v.aiming && isGun(v.tool)) distance = Math.min(distance, AIM_VIEW.aimDistance)
  return { distance, low: v.inMeadow || armed ? 1 : 0 }
}

/** 부드럽게 따라가는 카메라 값: 거리·낮춤(줌·초원/무기 전환), 발 높이(점프), 어깨 너머 비킴 */
export type CameraFollow = { distance: number; low: number; feetY: number; shoulder: number }

/**
 * 한 프레임 따라가기 (지수 감쇠). prev 가 없으면(첫 프레임) 바로 목표.
 * 방향(yaw·pitch)은 여기 없다: 마우스로 돌린 만큼 그 프레임에 바로 돌아야 늦게 따라오지 않고, 빨리 돌려도 카메라가 몸 쪽으로 파고들지 않는다
 */
export function followCamera(prev: CameraFollow | null, target: CameraFollow, delta: number, speed = NEAR_VIEW.smooth): CameraFollow {
  if (!prev) return { ...target }
  const k = 1 - Math.exp(-Math.max(0, delta) * speed)
  return {
    distance: prev.distance + (target.distance - prev.distance) * k,
    low: prev.low + (target.low - prev.low) * k,
    feetY: prev.feetY + (target.feetY - prev.feetY) * k,
    shoulder: prev.shoulder + (target.shoulder - prev.shoulder) * k,
  }
}

/**
 * 플레이어(발) 기준 카메라 자리와 시선 높이. yaw·pitch 는 지금 값 그대로 쓰므로 회전은 늦지 않고, 거리는 늘 distance 그대로다
 * (오프셋 벡터를 통째로 보간하면 빨리 돌릴 때 원의 현을 따라가 카메라가 몸 쪽으로 다가온다)
 */
export function orbitOffset(yaw: number, pitch: number, distance: number, low: number, characterHeight: number): { x: number; y: number; z: number; lookAtY: number } {
  const rig = cameraRig(distance, characterHeight, low)
  const orbit = pitchedOffset(distance, rig.height, rig.lookAtY, pitch)
  return { x: Math.sin(yaw) * orbit.horizontal, y: orbit.height, z: Math.cos(yaw) * orbit.horizontal, lookAtY: rig.lookAtY }
}
