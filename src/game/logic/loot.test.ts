import { describe, expect, it } from 'vitest'
import { dropLoot, nearestLoot } from './loot'

describe('전리품', () => {
  it('쓰러뜨린 자리 둘레 ±0.5m 에 번호를 붙여 떨어뜨리고, 1.4초 뒤에 보인다', () => {
    const list = dropLoot(['beef', 'bone'], 180, -40, 10, 7, () => 0.75)
    expect(list).toEqual([
      { key: 7, item: 'beef', x: 180.25, z: -39.75, showAt: 11.4, phase: 0.75 * Math.PI * 2 },
      { key: 8, item: 'bone', x: 180.25, z: -39.75, showAt: 11.4, phase: 0.75 * Math.PI * 2 },
    ])
  })
  it('E 로 줍는 것: 보이는 것 중 1.6m 안의 가장 가까운 것', () => {
    const list = dropLoot(['beef', 'pork'], 180, -40, 0, 1, () => 0.5)
    const far = { ...list[1], key: 2, x: 181.2 }
    expect(nearestLoot([list[0], far], 181, -40, 0.5)).toBeNull()
    expect(nearestLoot([list[0], far], 181, -40, 2)?.key).toBe(2)
    expect(nearestLoot([list[0]], 181.7, -40, 2)).toBeNull()
  })
})
