import { Vector3 } from 'three'
import { GUN_IDS, type GunId, type ZoomStep } from '../data/guns'
import { GUN_IDLE, type GunState } from '../logic/gun'
import type { V3 } from '../logic/hitscan'

/** 마지막으로 쏜 한 발: 광선 시작(카메라)·방향(가운데 알), 무엇에 맞았나 (헤드리스 점검·같이 하기 shot 이 쓴다) */
export type LastShot = { o: V3; d: V3; hit: 'animal' | 'peer' | 'target' | 'wall' | null }

/**
 * 내 총 (scene/guns/GunController 가 매 프레임 고치고 Player·HUD 가 읽는다). 매 프레임 바뀌는 값이라 React 상태가 아닌 모듈 객체에 둔다.
 * 시각은 performance.now() 초 (게임을 다시 열어도 R3F 시계처럼 0 으로 돌아가지 않는다).
 * - gun: 손에 든 총 (없으면 null), aiming: 조준 중
 * - kick: Player 가 카메라 기울기에서 가져갈 반동 (rad), muzzle: 총구 자리 (Player 가 손의 총에서 적는다, 없으면 null)
 * - hitAt·hitText: 명중 표시 (조준선에 잠깐), lastShot: 마지막 한 발
 * - zoomStep: 총마다 고른 조준경 배율 단계 (휠), optic: 지금 조준경으로 보는 단계 (조준 중인 소총·저격총), viewKick: 1인칭 총이 뒤로 밀린 거리
 */
export const gunRig: GunState & {
  gun: GunId | null
  aiming: boolean
  kick: number
  muzzle: Vector3 | null
  hitAt: number
  hitText: string
  lastShot: LastShot | null
  zoomStep: Record<GunId, number>
  optic: ZoomStep | null
  viewKick: number
} = {
  ...GUN_IDLE,
  gun: null,
  aiming: false,
  kick: 0,
  muzzle: null,
  hitAt: -Infinity,
  hitText: '',
  lastShot: null,
  zoomStep: noSteps(),
  optic: null,
  viewKick: 0,
}

function noSteps(): Record<GunId, number> {
  return Object.fromEntries(GUN_IDS.map((id) => [id, 0])) as Record<GunId, number>
}

/** 판을 새로 시작할 때 (Game 을 다시 열면 모듈 값이 남아 있다) */
export function resetGunRig() {
  Object.assign(gunRig, GUN_IDLE, { gun: null, aiming: false, kick: 0, muzzle: null, hitAt: -Infinity, hitText: '', lastShot: null, zoomStep: noSteps(), optic: null, viewKick: 0 })
}

/** Player 가 반동을 가져간다 */
export function takeKick(): number {
  const k = gunRig.kick
  gunRig.kick = 0
  return k
}

/** 명중 표시 (조준선 둘레 ✕, 사격장 점수) */
export function markHit(now: number, text = '') {
  gunRig.hitAt = now
  gunRig.hitText = text
}
