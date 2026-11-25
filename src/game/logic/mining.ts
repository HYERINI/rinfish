import type { OreId } from '../data/meadowItems'
import { ORES, PICK } from '../data/mine'

/** 광맥 하나의 상태. left: 다 캐기까지 남은 곡괭이질 수 (0 = 다 캤다), respawnAt: 다시 생기는 때 (초. 캘 수 있으면 null) */
export type OreNodeState = { left: number; respawnAt: number | null }
/** 광맥 자리 (data/mine ORE_NODES) */
export type OreSpot = { ore: OreId; x: number; z: number }

/** 처음 상태: 모두 가득 */
export function freshNodes(spots: readonly OreSpot[]): OreNodeState[] {
  return spots.map((s) => ({ left: ORES[s.ore].hits, respawnAt: null }))
}

/**
 * (x, z) 에서 닿는(reach, 광맥 가운데까지) 캘 수 있는 광맥 중 가장 가까운 것의 번호. 없으면 null.
 * facing(단위 벡터)을 주면 그 앞쪽 반원에 있는 것만 (마우스로 휘두를 때: 등 뒤 광맥은 안 맞는다)
 */
export function nearestOre(x: number, z: number, spots: readonly OreSpot[], states: readonly OreNodeState[], reach: number, facing?: { dx: number; dz: number }): number | null {
  let best: number | null = null
  let bestD = Infinity
  spots.forEach((s, i) => {
    if (!states[i] || states[i].left <= 0) return
    const ox = s.x - x
    const oz = s.z - z
    const d = Math.hypot(ox, oz)
    if (d > reach || d >= bestD) return
    if (facing && d > 1e-6 && (ox * facing.dx + oz * facing.dz) / d < 0) return
    best = i
    bestD = d
  })
  return best
}

/**
 * 곡괭이로 한 번 내려쳤다. 다 캤으면 mined (광석을 주고 respawn 초 뒤 다시 생긴다).
 * 이미 다 캔 광맥이면 그대로
 */
export function hitOre(state: OreNodeState, ore: OreId, now: number): { state: OreNodeState; mined: boolean } {
  if (state.left <= 0) return { state, mined: false }
  const left = state.left - 1
  return left > 0 ? { state: { left, respawnAt: null }, mined: false } : { state: { left: 0, respawnAt: now + ORES[ore].respawn }, mined: true }
}

/** 시간이 된 광맥을 다시 채운다. 바뀐 게 없으면 받은 배열을 그대로 돌려준다 */
export function regrowOres(states: readonly OreNodeState[], spots: readonly OreSpot[], now: number): readonly OreNodeState[] {
  if (!states.some((s) => s.respawnAt !== null && now >= s.respawnAt)) return states
  return states.map((s, i) => (s.respawnAt !== null && now >= s.respawnAt ? { left: ORES[spots[i].ore].hits, respawnAt: null } : s))
}

/** 곡괭이질: 시작한 때(초), 노린 광맥(없으면 헛손질), 맞는 순간 판정을 했나 */
export type PickSwing = { startedAt: number; target: number | null; hitDone: boolean }
export type PickState = { swing: PickSwing | null; readyAt: number }
export const PICK_IDLE: PickState = { swing: null, readyAt: -Infinity }

/** 곡괭이질 시작. 아직 다음 것을 할 수 없으면 null */
export function startPick(s: PickState, target: number | null, now: number): PickState | null {
  if (now < s.readyAt) return null
  return { swing: { startedAt: now, target, hitDone: false }, readyAt: now + PICK.cool }
}

/** 동작 진행도 0..1 (끝났거나 휘두르는 중이 아니면 -1) */
export function pickProgress(swing: PickSwing | null, now: number): number {
  if (!swing) return -1
  const p = (now - swing.startedAt) / PICK.dur
  return p >= 0 && p < 1 ? p : -1
}

/** 곡괭이가 내려꽂히는 순간이 지났는데 아직 판정 안 했나 */
export function pickHitDue(swing: PickSwing | null, now: number): boolean {
  return !!swing && !swing.hitDone && now - swing.startedAt >= PICK.dur * PICK.hitAt
}
