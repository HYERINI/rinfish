import { DISH_POTENCY } from '../data/balance'
import type { DishDef } from '../data/dishes'
import type { Buff, Rarity } from '../data/types'
import { addBuff, healStamina, type Survival } from './stamina'

export type DishEffect = { heal: number; buff: Buff | null }

/** 희귀도 배율을 회복량과 버프 지속시간에 곱한다 */
export function dishEffect(dish: DishDef, rarity: Rarity): DishEffect {
  const potency = DISH_POTENCY[rarity]
  return {
    heal: Math.round(dish.heal * potency),
    buff: dish.buff ? { kind: dish.buff.kind, mul: dish.buff.mul, remaining: dish.buff.duration * potency } : null,
  }
}

export type CookResult = { ok: true; coins: number; survival: Survival } | { ok: false; reason: 'coins' }

/** 물고기를 쓰는 일(보관함에서 빼기)은 스토어가 한다. 여기서는 코인과 체력만 계산한다 */
export function cook(coins: number, survival: Survival, dish: DishDef, rarity: Rarity): CookResult {
  if (coins < dish.cookFee) return { ok: false, reason: 'coins' }
  const effect = dishEffect(dish, rarity)
  let next = healStamina(survival, effect.heal)
  if (effect.buff) next = { ...next, buffs: addBuff(next.buffs, effect.buff) }
  return { ok: true, coins: coins - dish.cookFee, survival: next }
}
