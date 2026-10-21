import { describe, expect, it } from 'vitest'
import { DISH_POTENCY, STAMINA } from '../data/balance'
import { getDish } from '../data/dishes'
import { cook, dishEffect } from './cooking'
import { FRESH_SURVIVAL, type Survival } from './stamina'

const hungry: Survival = { stamina: 10, graceLeft: null, buffs: [] }

describe('dishEffect', () => {
  it('희귀할수록 회복량과 버프 지속시간이 커진다', () => {
    const bowl = getDish('bowl')
    const common = dishEffect(bowl, 'common')
    const epic = dishEffect(bowl, 'epic')
    expect(common).toEqual({ heal: 15, buff: { kind: 'reel', mul: 1.3, remaining: 90 } })
    expect(epic.heal).toBe(Math.round(15 * DISH_POTENCY.epic))
    expect(epic.buff?.remaining).toBe(90 * DISH_POTENCY.epic)
  })

  it('회는 버프가 없다', () => {
    expect(dishEffect(getDish('sashimi'), 'common').buff).toBeNull()
  })
})

describe('cook', () => {
  it('조리비를 내고 회복과 버프를 얻는다', () => {
    const result = cook(30, hungry, getDish('stew'), 'common')
    expect(result).toEqual({
      ok: true,
      coins: 5,
      survival: { stamina: 50, graceLeft: null, buffs: [{ kind: 'tension', mul: 0.75, remaining: 90 }] },
    })
  })

  it('코인이 조리비보다 적으면 실패한다 (같으면 성공)', () => {
    expect(cook(24, hungry, getDish('stew'), 'common')).toEqual({ ok: false, reason: 'coins' })
    expect(cook(25, hungry, getDish('stew'), 'common').ok).toBe(true)
  })

  it('같은 버프 요리를 또 먹으면 지속시간만 갱신된다', () => {
    const first = cook(100, FRESH_SURVIVAL, getDish('bowl'), 'common')
    if (!first.ok) throw new Error('첫 요리는 성공해야 한다')
    const worn: Survival = { ...first.survival, buffs: [{ kind: 'reel', mul: 1.3, remaining: 3 }] }
    const second = cook(100, worn, getDish('bowl'), 'common')
    if (!second.ok) throw new Error('두 번째 요리도 성공해야 한다')
    expect(second.survival.buffs).toEqual([{ kind: 'reel', mul: 1.3, remaining: 90 }])
    expect(second.survival.stamina).toBe(STAMINA.max)
  })

  it('약화 상태에서 먹으면 정상으로 돌아온다', () => {
    const result = cook(10, { stamina: 0, graceLeft: 20, buffs: [] }, getDish('sashimi'), 'junk')
    expect(result.ok && result.survival.graceLeft).toBeNull()
  })
})
