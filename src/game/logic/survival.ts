import { HUNGER, STAMINA } from '../data/balance'
import { healStamina, spendStamina, type Survival } from './stamina'

/**
 * fighting: 줄다리기 중, resting: 벤치에 앉아 쉬는 중, exploring: 낚시·패널 없이 돌아다니는 중 (배부르면 저절로 회복),
 * sleeping: 같이 하기에서 침대에 누워 아침을 기다리는 중
 */
export type SurvivalTickContext = { fighting: boolean; resting: boolean; exploring?: boolean; sleeping?: boolean }

/** fainted: 약화 유예가 끝나 쓰러짐 (진료소), died: 굶어 죽음 (침대) */
export type SurvivalTick = { survival: Survival; fainted: boolean; died: boolean }

/** 배고픔 0 으로 체력이 준다. 낚시와 달리 약화 유예를 시작하지 않는다 (굶주림은 이미 경고가 떠 있다) */
function starve(s: Survival, amount: number): Survival {
  return { ...s, stamina: Math.max(0, s.stamina - amount) }
}

/**
 * dt초만큼 시간을 진행한다. 배고픔이 줄고, 0 이면 체력이 준다.
 * 체력이 0 인데 배고픔도 0 이면 죽음(침대). 배가 차 있는데 약화 유예가 끝나면 쓰러짐(진료소)
 */
export function tickSurvival(s: Survival, dt: number, ctx: SurvivalTickContext): SurvivalTick {
  const buffs = s.buffs.map((b) => ({ ...b, remaining: b.remaining - dt })).filter((b) => b.remaining > 0)
  let next: Survival = { ...s, buffs, hunger: Math.max(0, s.hunger - HUNGER.perSecond * dt) }
  if (ctx.fighting) next = spendStamina(next, STAMINA.fightCostPerSecond * dt)
  if (ctx.resting) next = healStamina(next, STAMINA.benchRegenPerSecond * dt)
  if (ctx.sleeping) next = healStamina(next, STAMINA.sleepRegenPerSecond * dt)
  // 저절로 회복은 배가 부를 때만, 약화를 풀지 않는다 (체력 0 이 되면 음식이나 벤치로 회복해야 한다)
  if (ctx.exploring && next.graceLeft === null && next.hunger > HUNGER.regenAbove) next = healStamina(next, STAMINA.fedRegenPerSecond * dt)
  if (next.hunger <= 0) next = starve(next, HUNGER.starvePerSecond * dt)
  if (next.stamina <= 0 && next.hunger <= 0) return { survival: { ...next, stamina: 0, graceLeft: null }, fainted: false, died: true }
  if (next.graceLeft === null) return { survival: next, fainted: false, died: false }

  const graceLeft = next.graceLeft - dt
  if (graceLeft <= 0) return { survival: { ...next, graceLeft: 0 }, fainted: true, died: false }
  return { survival: { ...next, graceLeft }, fainted: false, died: false }
}

/** 동물·PvP 피해 (3-3·3-4 에서 쓴다). 체력이 0 이 되면 약화 없이 바로 죽음 */
export function takeDamage(s: Survival, amount: number): { survival: Survival; died: boolean } {
  const stamina = Math.max(0, s.stamina - Math.max(0, amount))
  return { survival: { ...s, stamina }, died: stamina === 0 }
}

/** 먹기: 체력(약화도 풀린다)과 배고픔이 찬다 */
export function eatFood(s: Survival, heal: number, hunger: number): Survival {
  const healed = healStamina(s, heal)
  return { ...healed, hunger: Math.min(HUNGER.max, healed.hunger + Math.max(0, hunger)) }
}

/** 배고픔 0: "배고파요" 경고를 띄운다 */
export function isStarving(s: Survival): boolean {
  return s.hunger <= 0
}

/** 자고 일어나면: 체력 가득, 배고픔 15 줄고 (10 아래로는 안 내려간다) */
export function afterSleep(s: Survival): Survival {
  return { ...s, stamina: STAMINA.max, hunger: Math.max(HUNGER.sleepFloor, s.hunger - HUNGER.sleepCost), graceLeft: null }
}

/** 죽었다 침대에서 깨어나면: 체력 가득, 배고픔 60, 약화·버프 없음 */
export function afterDeath(): Survival {
  return { stamina: STAMINA.max, hunger: HUNGER.afterDeath, graceLeft: null, buffs: [] }
}
