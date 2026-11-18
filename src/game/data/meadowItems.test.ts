import { describe, expect, it } from 'vitest'
import * as eunji from '../../meadow/vendor/items.js'
import { DROPS, ITEMS, ITEM_IDS, MEADOW_DISH_IDS, RAW_ITEM_IDS, RECIPES, rollDrops } from './meadowItems'

describe('은지 아이템 TS 복사본', () => {
  it('25종 물건(재료 12 + 요리 13)의 이름·아이콘·태그·포만감이 은지 items.js 와 같다 (순서까지)', () => {
    expect(ITEM_IDS).toEqual(Object.keys(eunji.ITEMS))
    expect(ITEM_IDS).toHaveLength(25)
    for (const id of ITEM_IDS) expect(ITEMS[id]).toEqual(eunji.ITEMS[id])
  })
  it('배합법 13가지가 같다', () => {
    expect(RECIPES).toEqual(eunji.RECIPES)
    expect(MEADOW_DISH_IDS).toHaveLength(13)
    expect(RECIPES.map((r) => r.result).sort()).toEqual([...MEADOW_DISH_IDS].sort())
  })
})

describe('전리품 (은지 DROPS)', () => {
  it('동물 7종의 전리품 표가 은지 items.js 와 같다', () => {
    expect(DROPS).toEqual(eunji.DROPS)
  })
  it('확률 없는 것은 늘, 확률 있는 것은 굴려서 (rng 가 p 보다 작을 때만)', () => {
    expect(rollDrops('cow', () => 0.99)).toEqual(['beef', 'beef', 'bone'])
    expect(rollDrops('hog', () => 0.99)).toEqual(['boar', 'boar'])
    expect(rollDrops('hog', () => 0)).toEqual(['boar', 'boar', 'fat', 'bone'])
    expect(rollDrops('chick', () => 0.4)).toEqual(['chicken', 'egg'])
  })
})

describe('RAW_ITEM_IDS', () => {
  it('요리가 아닌 재료 전부 (사전 순서). 전리품 DROPS 는 모두 그 안에 있다', () => {
    expect(RAW_ITEM_IDS).toEqual(['beef', 'pork', 'boar', 'venison', 'rabbit', 'foxmeat', 'chicken', 'egg', 'bone', 'fat', 'pumpkin', 'mushroom'])
    for (const list of Object.values(DROPS)) for (const d of list) expect(RAW_ITEM_IDS).toContain(d.id)
  })
})
