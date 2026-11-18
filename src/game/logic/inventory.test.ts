import { describe, expect, it } from 'vitest'
import { getRecipe } from '../data/meadowItems'
import { NO_SNACKS } from './snacks'
import { FRESH_SURVIVAL } from './stamina'
import { NO_ITEMS, addItems, bagFoodFill, bestFood, canCook, consumeRecipe, dishFill, eatBagFood, ingredientHave, removeItems, tagCount } from './inventory'

describe('가방 (은지 Inventory)', () => {
  it('넣고 빼기. 모자라거나 이상한 개수면 빼지 않는다', () => {
    const a = addItems(NO_ITEMS, 'egg', 2)
    expect(a.egg).toBe(2)
    expect(removeItems(a, 'egg', 1)?.egg).toBe(1)
    expect(removeItems(a, 'egg', 3)).toBeNull()
    expect(removeItems(a, 'egg', 0)).toBeNull()
    expect(addItems(a, 'egg', 0)).toBe(a)
    expect(addItems(a, 'egg', 1.5)).toBe(a)
  })
  it('태그 개수는 고기를 모두 더한다', () => {
    const items = { ...NO_ITEMS, beef: 2, rabbit: 1, egg: 5 }
    expect(tagCount(items, 'meat')).toBe(3)
    expect(ingredientHave(items, { tag: 'meat', n: 1 })).toBe(3)
    expect(ingredientHave(items, { id: 'egg', n: 1 })).toBe(5)
  })
  it('재료가 다 있어야 요리할 수 있다', () => {
    const steak = getRecipe('steak')
    expect(canCook({ ...NO_ITEMS, beef: 1 }, steak)).toBe(false)
    expect(canCook({ ...NO_ITEMS, beef: 1, fat: 1 }, steak)).toBe(true)
    expect(consumeRecipe({ ...NO_ITEMS, beef: 1 }, steak)).toBeNull()
  })
  it('태그 재료(아무 고기)는 가장 많이 가진 고기부터 쓴다', () => {
    const items = { ...NO_ITEMS, beef: 1, pork: 3, mushroom: 1 }
    const after = consumeRecipe(items, getRecipe('skewer'))!
    expect(after.pork).toBe(1)
    expect(after.beef).toBe(1)
    expect(after.mushroom).toBe(0)
  })
  it('가장 많은 고기가 모자라면 다음 고기로 채운다 (같은 수면 사전 순서)', () => {
    const after = consumeRecipe({ ...NO_ITEMS, beef: 1, pork: 1, mushroom: 1 }, getRecipe('skewer'))!
    expect([after.beef, after.pork]).toEqual([0, 0])
    const one = consumeRecipe({ ...NO_ITEMS, beef: 1, pork: 1 }, getRecipe('roast'))!
    expect([one.beef, one.pork]).toEqual([0, 1])
  })
  it('은지 요리: 체력 sate×2, 배고픔 sate×8', () => {
    expect(dishFill('steak')).toEqual({ heal: 10, hunger: 40 })
    expect(bagFoodFill('ramen')).toEqual({ heal: 45, hunger: 50 })
  })
  it('F: 배고픔을 가장 많이 채우는 것부터. 간식도 같이 본다', () => {
    expect(bestFood(NO_ITEMS, NO_SNACKS)).toBeNull()
    expect(bestFood({ ...NO_ITEMS, roast: 1, steak: 1 }, NO_SNACKS)).toBe('steak')
    // 컵라면 50 > 스테이크 40
    expect(bestFood({ ...NO_ITEMS, steak: 1 }, { ...NO_SNACKS, ramen: 1 })).toBe('ramen')
    // 닭고기 수프 48 = 멧돼지 스튜 48 → 사전 순서(멧돼지 스튜 먼저)
    expect(bestFood({ ...NO_ITEMS, chickensoup: 1, boarstew: 1 }, NO_SNACKS)).toBe('boarstew')
    // 재료(고기)는 먹지 않는다
    expect(bestFood({ ...NO_ITEMS, beef: 3 }, NO_SNACKS)).toBeNull()
  })
  it('꺼내 먹으면 하나 줄고 배고픔이 찬다 (없으면 null)', () => {
    const hungry = { ...FRESH_SURVIVAL, stamina: 30, hunger: 20 }
    const meal = eatBagFood({ items: { ...NO_ITEMS, omelet: 1 }, snacks: NO_SNACKS, survival: hungry }, 'omelet')!
    expect(meal.items.omelet).toBe(0)
    expect(meal.survival).toMatchObject({ stamina: 40, hunger: 60 })
    expect(eatBagFood(meal, 'omelet')).toBeNull()
    const snack = eatBagFood({ items: NO_ITEMS, snacks: { ...NO_SNACKS, gimbap: 2 }, survival: hungry }, 'gimbap')!
    expect(snack.snacks.gimbap).toBe(1)
    expect(snack.survival.hunger).toBe(50)
  })
})
