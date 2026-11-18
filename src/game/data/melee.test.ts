import { describe, expect, it } from 'vitest'
import { MELEE, hitDelay, meleeFor } from './melee'

describe('근접 공격', () => {
  it('주먹은 왼쪽만, 칼은 왼쪽 베기·오른쪽 찌르기, 낚싯대·빈손은 없다', () => {
    expect(meleeFor('fists', false)).toBe('fists')
    expect(meleeFor('fists', true)).toBeNull()
    expect(meleeFor('knife', false)).toBe('knife')
    expect(meleeFor('knife', true)).toBe('stab')
    expect(meleeFor('rod', false)).toBeNull()
    expect(meleeFor(null, false)).toBeNull()
  })
  it('은지 시간표: 맞는 순간은 주먹 0.152초·베기 0.126초·찌르기 0.285초 뒤, 서버 간격은 내 화면 간격보다 짧다', () => {
    expect(hitDelay('fists')).toBeCloseTo(0.152)
    expect(hitDelay('knife')).toBeCloseTo(0.126)
    expect(hitDelay('stab')).toBeCloseTo(0.2852)
    for (const m of Object.values(MELEE)) expect(m.serverCool).toBeLessThan(m.cool)
  })
})
