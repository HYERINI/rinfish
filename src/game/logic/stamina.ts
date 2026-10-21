import { FAINT_COIN_PENALTY, STAMINA } from '../data/balance'
import type { Buff } from '../data/types'
import type { FightMods } from './fight'

/** 체력, 약화 유예 시간, 요리 버프. 저장되는 상태다 */
export type Survival = {
  stamina: number
  /** 체력 0 이후 쓰러지기까지 남은 시간(초). 약화 상태가 아니면 null */
  graceLeft: number | null
  buffs: Buff[]
}

export const FRESH_SURVIVAL: Survival = { stamina: STAMINA.max, graceLeft: null, buffs: [] }

export function isWeak(s: Survival): boolean {
  return s.graceLeft !== null
}

/** 체력을 쓴다. 0이 되는 순간 유예 시간이 시작되고, 이미 약화 중이면 유예 시간은 그대로 */
export function spendStamina(s: Survival, amount: number): Survival {
  const stamina = Math.max(0, s.stamina - amount)
  const graceLeft = s.graceLeft ?? (stamina === 0 ? STAMINA.graceSeconds : null)
  return { ...s, stamina, graceLeft }
}

/** 체력을 회복한다. 약화 중이어도 조금이라도 회복하면 정상으로 돌아온다 */
export function healStamina(s: Survival, amount: number): Survival {
  if (amount <= 0) return s
  return { ...s, stamina: Math.min(STAMINA.max, s.stamina + amount), graceLeft: null }
}

/** 같은 종류 버프는 겹치지 않고 새 것으로 바꾼다(지속시간 갱신) */
export function addBuff(buffs: Buff[], buff: Buff): Buff[] {
  return [...buffs.filter((b) => b.kind !== buff.kind), buff]
}

export type SurvivalTickContext = { fighting: boolean; resting: boolean }

/** dt초만큼 시간을 진행한다. 유예 시간이 다 되면 fainted */
export function tickSurvival(s: Survival, dt: number, ctx: SurvivalTickContext): { survival: Survival; fainted: boolean } {
  const buffs = s.buffs.map((b) => ({ ...b, remaining: b.remaining - dt })).filter((b) => b.remaining > 0)
  let next: Survival = { ...s, buffs }
  if (ctx.fighting) next = spendStamina(next, STAMINA.fightCostPerSecond * dt)
  if (ctx.resting) next = healStamina(next, STAMINA.benchRegenPerSecond * dt)
  if (next.graceLeft === null) return { survival: next, fainted: false }

  const graceLeft = next.graceLeft - dt
  if (graceLeft <= 0) return { survival: { ...next, graceLeft: 0 }, fainted: true }
  return { survival: { ...next, graceLeft }, fainted: false }
}

/** 버프와 약화를 줄다리기 보정값으로 바꾼다 */
export function fightMods(s: Survival): FightMods {
  let reelSpeedMul = 1
  let tensionMul = 1
  for (const buff of s.buffs) {
    if (buff.kind === 'reel') reelSpeedMul *= buff.mul
    else tensionMul *= buff.mul
  }
  if (isWeak(s)) {
    reelSpeedMul *= STAMINA.weakReelMul
    tensionMul *= STAMINA.weakTensionMul
  }
  return { reelSpeedMul, tensionMul }
}

/** 쓰러졌을 때 내는 진료비 */
export function faintPenalty(coins: number): number {
  return Math.floor(coins * FAINT_COIN_PENALTY)
}
