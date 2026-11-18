import { hitRadius } from '../data/animals'
import { MELEE, hitDelay, type MeleeId } from '../data/melee'
import type { AnimalView } from './animalSim'
import type { Mode } from './interaction'
import type { PlayerAction } from './playerMotion'

/** 휘두르는 중: 종류, 시작한 때(초), 이번 휘두르기의 명중 판정을 했나 */
export type Swing = { kind: MeleeId; startedAt: number; hitDone: boolean }
/** 지금 휘두르기와 다음에 휘두를 수 있는 때 (은지 cool) */
export type MeleeState = { swing: Swing | null; readyAt: number }

export const MELEE_IDLE: MeleeState = { swing: null, readyAt: -Infinity }

/** 휘두를 수 있나: 탐험 중 땅에 서 있고, 먹기·감정 표현·점프 중이 아니다 (grounded: 물리 판정) */
export function canSwing(mode: Mode, action: PlayerAction, grounded: boolean): boolean {
  return mode === 'explore' && !action.eat && !action.emote && !action.airborne && grounded
}

/** 휘두르기 시작. 아직 다음 공격을 할 수 없으면 null */
export function startSwing(s: MeleeState, kind: MeleeId, now: number): MeleeState | null {
  if (now < s.readyAt) return null
  return { swing: { kind, startedAt: now, hitDone: false }, readyAt: now + MELEE[kind].cool }
}

/** 동작 진행도 0..1 (끝났거나 휘두르는 중이 아니면 -1) */
export function swingProgress(swing: Swing | null, now: number): number {
  if (!swing) return -1
  const p = (now - swing.startedAt) / MELEE[swing.kind].dur
  return p >= 0 && p < 1 ? p : -1
}

/** 칼이 뻗는 순간이 지났는데 아직 판정 안 했나 (은지: 휘두르기 시작이 아니라 hitAt 에 판정) */
export function hitDue(swing: Swing | null, now: number): boolean {
  return !!swing && !swing.hitDone && now - swing.startedAt >= hitDelay(swing.kind)
}

/**
 * 근접 판정: 내 자리 (x, z) 에서 바닥 방향 (dx, dz, 단위 벡터) 으로 reach 만큼 그은 선분이 처음 닿는 살아 있는 동물 (판정 원).
 * dist 는 원에 닿는 거리 (원 안에 서 있으면 0). 없으면 null
 */
export function meleeTarget(x: number, z: number, dx: number, dz: number, reach: number, animals: readonly AnimalView[]): { id: number; dist: number } | null {
  let best: { id: number; dist: number } | null = null
  for (const a of animals) {
    if (a.pose === 'dead') continue
    const r = hitRadius(a.sp)
    const cx = a.x - x
    const cz = a.z - z
    const t = cx * dx + cz * dz
    const perp2 = cx * cx + cz * cz - t * t
    if (perp2 > r * r) continue
    const enter = Math.max(0, t - Math.sqrt(r * r - perp2))
    if (t + r < 0 || enter > reach) continue
    if (!best || enter < best.dist) best = { id: a.id, dist: enter }
  }
  return best
}
