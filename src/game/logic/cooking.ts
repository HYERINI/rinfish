import { DISH_POTENCY } from '../data/balance'
import type { DishDef } from '../data/dishes'
import type { Buff, Rarity } from '../data/types'
import { addBuff, healStamina, type Survival } from './stamina'

export type DishEffect = { heal: number; buff: Buff | null }

/** 희귀도 배율을 회복량과 버프 지속시간에 곱한다. 재료가 여러 마리면 배율 평균 */
export function dishEffect(dish: DishDef, rarity: Rarity | Rarity[]): DishEffect {
  const rarities = Array.isArray(rarity) ? rarity : [rarity]
  const potency = rarities.length === 0 ? 1 : rarities.reduce((s, r) => s + DISH_POTENCY[r], 0) / rarities.length
  return {
    heal: Math.round(dish.heal * potency),
    buff: dish.buff ? { kind: dish.buff.kind, mul: dish.buff.mul, remaining: dish.buff.duration * potency } : null,
  }
}

/** 재료 후보 한 마리 */
export type Ingredient = { id: string; speciesId: string; rarity: Rarity }

/** 이 요리에 쓸 수 있는 물고기인가 */
export function fitsDish(dish: DishDef, fish: Ingredient): boolean {
  const { rarities, speciesId } = dish.needs
  if (speciesId && fish.speciesId !== speciesId) return false
  return !rarities || rarities.includes(fish.rarity)
}

/** 보관함에서 이 요리에 쓸 수 있는 물고기들 */
export function eligibleFish<T extends Ingredient>(dish: DishDef, fishes: T[]): T[] {
  return fishes.filter((f) => fitsDish(dish, f))
}

/** 고른 재료가 딱 맞나 (마리 수, 조건, 같은 물고기 두 번 금지) */
export function ingredientsOk(dish: DishDef, picked: Ingredient[]): boolean {
  return picked.length === dish.needs.count && new Set(picked.map((f) => f.id)).size === picked.length && picked.every((f) => fitsDish(dish, f))
}

/** 비밀 메뉴는 재료가 보관함에 있을 때만 보인다. 나머지는 늘 보인다 */
export function menuVisible(dish: DishDef, fishes: Ingredient[]): boolean {
  return dish.category !== 'secret' || eligibleFish(dish, fishes).length >= dish.needs.count
}

export type CookResult = { ok: true; coins: number; survival: Survival } | { ok: false; reason: 'coins' }

/** 물고기를 쓰는 일(보관함에서 빼기)은 스토어가 한다. 여기서는 코인과 체력만 계산한다 */
export function cook(coins: number, survival: Survival, dish: DishDef, rarity: Rarity | Rarity[]): CookResult {
  if (coins < dish.cookFee) return { ok: false, reason: 'coins' }
  const effect = dishEffect(dish, rarity)
  let next = healStamina(survival, effect.heal)
  if (effect.buff) next = { ...next, buffs: addBuff(next.buffs, effect.buff) }
  return { ok: true, coins: coins - dish.cookFee, survival: next }
}
