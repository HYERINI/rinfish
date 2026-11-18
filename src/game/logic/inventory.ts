import { ITEMS, ITEM_IDS, MEADOW_DISH_IDS, hasTag, type Ingredient, type ItemId, type ItemTag, type MeadowDishId, type Recipe } from '../data/meadowItems'
import { SNACKS, type SnackId } from '../data/snacks'
import type { SnackCounts } from './snacks'
import type { Survival } from './stamina'
import { eatFood } from './survival'

/** 은지 물건별 가방 속 개수 (은지 Inventory 를 순수 함수로). 칸 수 제한은 없다 */
export type ItemCounts = Record<ItemId, number>

export const NO_ITEMS: ItemCounts = Object.fromEntries(ITEM_IDS.map((id) => [id, 0])) as ItemCounts

export function addItems(items: ItemCounts, id: ItemId, n = 1): ItemCounts {
  if (!Number.isInteger(n) || n < 1) return items
  return { ...items, [id]: items[id] + n }
}

/** n 개를 뺀다. 모자라면 null */
export function removeItems(items: ItemCounts, id: ItemId, n = 1): ItemCounts | null {
  if (!Number.isInteger(n) || n < 1 || items[id] < n) return null
  return { ...items, [id]: items[id] - n }
}

/** 태그(아무 고기 등)가 붙은 물건 개수 합 */
export function tagCount(items: ItemCounts, tag: ItemTag): number {
  return ITEM_IDS.reduce((sum, id) => sum + (hasTag(id, tag) ? items[id] : 0), 0)
}

/** 재료 한 줄을 가진 수 (태그면 그 태그 물건 합) */
export const ingredientHave = (items: ItemCounts, s: Ingredient): number => ('tag' in s ? tagCount(items, s.tag) : items[s.id])

export const canCook = (items: ItemCounts, recipe: Recipe): boolean => recipe.ingredients.every((s) => ingredientHave(items, s) >= s.n)

/** 재료를 뺀 가방. 태그 재료는 가장 많이 가진 것부터 쓴다 (같으면 사전 순서). 모자라면 null */
export function consumeRecipe(items: ItemCounts, recipe: Recipe): ItemCounts | null {
  if (!canCook(items, recipe)) return null
  const next = { ...items }
  for (const s of recipe.ingredients) {
    if ('id' in s) {
      next[s.id] -= s.n
      continue
    }
    let left = s.n
    const pool = ITEM_IDS.filter((id) => hasTag(id, s.tag) && next[id] > 0).sort((a, b) => next[b] - next[a])
    for (const id of pool) {
      const take = Math.min(left, next[id])
      next[id] -= take
      left -= take
      if (left === 0) break
    }
  }
  return next
}

/** 은지 요리를 먹으면: 체력 sate × 2, 배고픔 sate × 8 (은지 그대로) */
export function dishFill(id: MeadowDishId): { heal: number; hunger: number } {
  const sate = ITEMS[id].sate ?? 0
  return { heal: sate * 2, hunger: sate * 8 }
}

/** 가방에서 먹을 수 있는 것: 은지 요리 또는 낚시섬 간식 */
export type BagFood = MeadowDishId | SnackId

/** 먹으면 차는 체력·배고픔 */
export function bagFoodFill(id: BagFood): { heal: number; hunger: number } {
  const snack = SNACKS.find((s) => s.id === id)
  return snack ? { heal: snack.heal, hunger: snack.hunger } : dishFill(id as MeadowDishId)
}

/**
 * F 키: 배고픔을 가장 많이 채우는 것부터 (은지 eatBest). 같으면 은지 요리가 먼저(사전 순서), 그다음 간식. 먹을 게 없으면 null
 */
export function bestFood(items: ItemCounts, snacks: SnackCounts): BagFood | null {
  const owned: BagFood[] = [...MEADOW_DISH_IDS.filter((id) => items[id] > 0), ...SNACKS.filter((s) => snacks[s.id] > 0).map((s) => s.id)]
  let best: BagFood | null = null
  for (const id of owned) if (best === null || bagFoodFill(id).hunger > bagFoodFill(best).hunger) best = id
  return best
}

export type BagMeal = { items: ItemCounts; snacks: SnackCounts; survival: Survival }

/** 가방에서 하나 꺼내 먹는다 (체력·배고픔이 찬다). 없으면 null */
export function eatBagFood(bag: BagMeal, id: BagFood): BagMeal | null {
  const isSnack = SNACKS.some((s) => s.id === id)
  if (isSnack ? bag.snacks[id as SnackId] <= 0 : bag.items[id as MeadowDishId] <= 0) return null
  const { heal, hunger } = bagFoodFill(id)
  const survival = eatFood(bag.survival, heal, hunger)
  return isSnack
    ? { ...bag, snacks: { ...bag.snacks, [id]: bag.snacks[id as SnackId] - 1 }, survival }
    : { ...bag, items: { ...bag.items, [id]: bag.items[id as MeadowDishId] - 1 }, survival }
}
