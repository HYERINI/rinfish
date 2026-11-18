import { describe, expect, it } from 'vitest'
import * as eunji from '../../meadow/vendor/items.js'
import { ITEMS, ITEM_IDS, MEADOW_DISH_IDS, RECIPES } from './meadowItems'

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
