import { MOUSE_LOOK } from '../data/settings'
import { pitchedOffset } from './mouseLook'
import { cameraRig } from './playerMotion'
import { shortestAngleDelta } from './cameraYaw'
import type { V3 } from './hitscan'

/**
 * 조준점 지키기. 조준하면 카메라가 바뀐다: 권총·산탄총은 3인칭 카메라가 가까이 당겨지고, 소총·저격총은 조준경을 보는 동안 1인칭이 된다.
 * 카메라 자리와 기울기가 바뀌면 화면 가운데(조준선)가 가리키는 곳도 딴 데로 옮겨 간다 (조준 전에 겨눈 곳과 조준한 뒤 보는 곳이 달랐다).
 * 그래서 바뀌기 전 화면 가운데가 닿던 점을 구하고(thirdAimRay·firstAimRay + 장면의 광선), 바뀐 카메라가 그 점을 보게 yaw·pitch 를 다시 푼다(solveThird·solveFirst).
 */

/** 3인칭 카메라 값 (logic/cameraFollow CameraFollow 가운데 방향에 쓰는 것) */
export type AimRig = { distance: number; low: number; shoulder: number }

/** 화면 가운데로 나가는 광선 (o 에서 d 쪽, d 는 길이 1) */
export type AimRay = { o: V3; d: V3 }

/** 3인칭 시선점: 카메라가 바라보는 점 (캐릭터 얼굴~가슴 높이, 총을 들면 오른쪽 어깨 쪽으로 비킨다) */
function lookPoint(x: number, feetY: number, z: number, yaw: number, rig: AimRig, characterHeight: number): V3 {
  const { lookAtY } = cameraRig(rig.distance, characterHeight, rig.low)
  return { x: x + Math.cos(yaw) * rig.shoulder, y: feetY + lookAtY, z: z - Math.sin(yaw) * rig.shoulder }
}

/** 3인칭 카메라가 시선점을 내려다보는 각도 (rad, 양수 = 아래). pitch 0 일 때 값에 pitch 를 더한다 (pitchedOffset 과 같은 식) */
function dipOf(rig: AimRig, characterHeight: number, pitch: number): number {
  const r = cameraRig(rig.distance, characterHeight, rig.low)
  const o = pitchedOffset(rig.distance, r.height, r.lookAtY, pitch)
  return Math.atan2(o.height - r.lookAtY, o.horizontal)
}

/**
 * 3인칭 화면 가운데 광선. 시선점에서 시작한다 (카메라는 그 뒤에 있다: 카메라와 시선점 사이의 내 몸·벽에 걸리지 않게).
 * x·z: 플레이어, feetY: 발 높이
 */
export function thirdAimRay(x: number, feetY: number, z: number, yaw: number, pitch: number, rig: AimRig, characterHeight: number): AimRay {
  const dip = dipOf(rig, characterHeight, pitch)
  const c = Math.cos(dip)
  return { o: lookPoint(x, feetY, z, yaw, rig, characterHeight), d: { x: -Math.sin(yaw) * c, y: -Math.sin(dip), z: -Math.cos(yaw) * c } }
}

/** 1인칭 화면 가운데 광선. eye: 눈 자리, tilt: 올려다보는 각도 (rad, 양수 = 위) */
export function firstAimRay(eye: V3, yaw: number, tilt: number): AimRay {
  const c = Math.cos(tilt)
  return { o: { x: eye.x, y: eye.y, z: eye.z }, d: { x: -Math.sin(yaw) * c, y: Math.sin(tilt), z: -Math.cos(yaw) * c } }
}

/** 광선 위 t 만큼 간 점 */
export function rayPoint(ray: AimRay, t: number): V3 {
  return { x: ray.o.x + ray.d.x * t, y: ray.o.y + ray.d.y * t, z: ray.o.z + ray.d.z * t }
}

/** from 과 같은 방향이면서 from 에 가장 가까운 각도 (yaw 가 한 바퀴씩 튀지 않게) */
const near = (from: number, to: number) => from + shortestAngleDelta(from, to)

/** 1인칭(눈)에서 점 p 를 화면 가운데에 두는 yaw 와 올려다보는 각도 */
export function solveFirst(eye: V3, p: V3, yawNow: number): { yaw: number; tilt: number } {
  const dx = p.x - eye.x
  const dz = p.z - eye.z
  const flat = Math.hypot(dx, dz)
  if (flat < 1e-6) return { yaw: yawNow, tilt: Math.sign(p.y - eye.y) * (Math.PI / 2) }
  return { yaw: near(yawNow, Math.atan2(dx, dz) - Math.PI), tilt: Math.atan2(p.y - eye.y, flat) }
}

/**
 * 3인칭 카메라가 점 p 를 화면 가운데에 두는 yaw·pitch. 어깨 너머로 비킨 만큼(shoulder) 옆에서 보므로 yaw 도 조금 달라진다.
 * 점이 어깨 비킴보다 가까우면 풀 수 없어 지금 yaw 를 둔다. pitch 는 마우스로 돌릴 수 있는 범위로 자른다
 */
export function solveThird(x: number, feetY: number, z: number, p: V3, yawNow: number, rig: AimRig, characterHeight: number): { yaw: number; pitch: number } {
  const dx = p.x - x
  const dz = p.z - z
  const flat = Math.hypot(dx, dz)
  const s = rig.shoulder
  // 시선점에서 p 까지 앞으로 간 거리 (옆으로는 s 만큼 비켜 있다)
  const ahead = Math.sqrt(Math.max(0, flat * flat - s * s))
  const yaw = flat > Math.abs(s) + 1e-6 ? near(yawNow, Math.atan2(dx, dz) + Math.atan2(s, ahead) - Math.PI) : yawNow
  const { lookAtY } = cameraRig(rig.distance, characterHeight, rig.low)
  const dip = Math.atan2(feetY + lookAtY - p.y, Math.max(ahead, 1e-6))
  return { yaw, pitch: pitchForDip(rig, characterHeight, dip) }
}

/**
 * 내려다보는 각도가 dip 이 되는 pitch. 올려다볼 땐 카메라가 땅 높이에 걸려(pitchedOffset minCameraHeight) 식으로 못 풀어서 반씩 좁혀 찾는다.
 * dip 은 pitch 를 따라 커지기만 한다. 돌릴 수 있는 범위 밖이면 그 끝
 */
function pitchForDip(rig: AimRig, characterHeight: number, dip: number): number {
  let lo = MOUSE_LOOK.minPitch
  let hi = MOUSE_LOOK.maxPitch
  if (dip <= dipOf(rig, characterHeight, lo)) return lo
  if (dip >= dipOf(rig, characterHeight, hi)) return hi
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2
    if (dipOf(rig, characterHeight, mid) < dip) lo = mid
    else hi = mid
  }
  return (lo + hi) / 2
}
