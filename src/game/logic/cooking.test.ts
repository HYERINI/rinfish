import { describe, expect, it } from 'vitest'
import { DISH_POTENCY, STAMINA } from '../data/balance'
import { getDish } from '../data/dishes'
import { cook, dishEffect, eligibleFish, ingredientsOk, menuVisible, type Ingredient } from './cooking'
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

describe('찜 메뉴와 재료', () => {
  const f = (id: string, speciesId: string, rarity: Ingredient['rarity']): Ingredient => ({ id, speciesId, rarity })
  const sardine = f('a', 'sleepy-sardine', 'common')
  const mackerel = f('b', 'chatty-mackerel', 'common')
  const rare = f('c', 'sunglasses-mackerel', 'rare')
  const xxl = f('d', 'eelgas-baejeongbin', 'rare')

  it('물고기찜은 일반만, 대왕찜은 희귀 이상, 매콤 해물찜은 아무거나 두 마리', () => {
    expect(eligibleFish(getDish('fishSteam'), [sardine, rare]).map((x) => x.id)).toEqual(['a'])
    expect(eligibleFish(getDish('bossSteam'), [sardine, rare]).map((x) => x.id)).toEqual(['c'])
    expect(ingredientsOk(getDish('spicySteam'), [sardine, rare])).toBe(true)
    expect(ingredientsOk(getDish('spicySteam'), [sardine])).toBe(false)
    expect(ingredientsOk(getDish('spicySteam'), [sardine, sardine])).toBe(false)
  })

  it('여러 마리면 희귀도 배율을 평균한다', () => {
    const e = dishEffect(getDish('spicySteam'), ['common', 'rare'])
    expect(e.heal).toBe(Math.round(50 * (DISH_POTENCY.common + DISH_POTENCY.rare) / 2))
  })

  it('비밀 메뉴 XXL배정빈찜은 XXL배정빈이 있을 때만 보이고, 사장님 반응이 따로 있다', () => {
    const secret = getDish('xxlSteam')
    expect(menuVisible(secret, [sardine, mackerel, rare])).toBe(false)
    expect(menuVisible(secret, [sardine, xxl])).toBe(true)
    expect(ingredientsOk(secret, [rare])).toBe(false)
    expect(ingredientsOk(secret, [xxl])).toBe(true)
    expect(secret.chefLine).toContain('양심')
    expect(menuVisible(getDish('fishSteam'), [])).toBe(true)
  })

  it('메뉴: 물고기찜 10/30, 매콤 해물찜 25/50+텐션, 대왕찜 40/80+릴', () => {
    expect([getDish('fishSteam'), getDish('spicySteam'), getDish('bossSteam')].map((d) => [d.cookFee, d.heal, d.buff?.kind ?? null])).toEqual([
      [10, 30, null],
      [25, 50, 'tension'],
      [40, 80, 'reel'],
    ])
  })
})
