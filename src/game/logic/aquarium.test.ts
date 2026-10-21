import { describe, expect, it } from 'vitest'
import { AQUARIUM } from '../data/balance'
import type { FishInstance } from '../data/types'
import {
  EMPTY_AQUARIUM,
  buyExpansion,
  buyTankType,
  claimIncome,
  displayFish,
  feedAquarium,
  incomePerSecond,
  isHungry,
  removeFromDisplay,
  selectTankType,
  tickAquarium,
  type AquariumState,
} from './aquarium'

const fish = (id: string, speciesId = 'sleepy-sardine'): FishInstance => ({ id, speciesId, weight: 0.2, caughtAtPlayTime: 0 })
/** 일반 해변 물고기 1마리 = 분당 1코인 */
const withSardine = (patch: Partial<AquariumState> = {}): AquariumState => ({ ...EMPTY_AQUARIUM, displayed: [fish('a')], ...patch })
const HUNGRY_AT = AQUARIUM.hungerAfter
const RELEASE_AT = AQUARIUM.hungerAfter + AQUARIUM.releaseAfter

describe('incomePerSecond', () => {
  it('희귀도별 분당 수입을 초 단위로 바꾼다', () => {
    expect(incomePerSecond(withSardine())).toBeCloseTo(1 / 60)
    expect(incomePerSecond({ ...EMPTY_AQUARIUM, displayed: [fish('t', 'pirate-tuna')] })).toBeCloseTo(8 / 60)
  })

  it('어항 종류 보너스와 확장 배율이 곱해진다', () => {
    const sea = withSardine({ ownedTypes: ['basic', 'sea'], activeType: 'sea', level: 2 })
    expect(incomePerSecond(sea)).toBeCloseTo((1 * AQUARIUM.typeBonus * 1.5) / 60)
  })

  it('잡어와 저장본에만 남은 없는 물고기는 수입이 없다', () => {
    expect(incomePerSecond({ ...EMPTY_AQUARIUM, displayed: [fish('j', 'lost-anchovy'), fish('x', 'deleted-fish')] })).toBe(0)
  })
})

describe('tickAquarium', () => {
  it('배부른 동안 입장료가 쌓인다', () => {
    const { aquarium, events } = tickAquarium(withSardine(), 60, 60)
    expect(aquarium.pendingIncome).toBeCloseTo(1)
    expect(events).toEqual([])
  })

  it('배고파지는 순간 알림이 오고, 그 뒤 시간만큼은 벌지 않는다', () => {
    const { aquarium, events } = tickAquarium(withSardine(), HUNGRY_AT + 30, 60)
    expect(events).toEqual(['hungry'])
    expect(aquarium.pendingIncome).toBeCloseTo(30 / 60)
    expect(isHungry(aquarium, HUNGRY_AT + 30)).toBe(true)
  })

  it('방생 2분 전에 알림이 온다', () => {
    const warnAt = RELEASE_AT - AQUARIUM.releaseWarningBefore
    expect(tickAquarium(withSardine(), warnAt, 1).events).toEqual(['releaseWarning'])
  })

  it('방생 시각이 지나면 전시 물고기가 모두 사라진다. 한 틱이 배고픔·방생을 동시에 넘어도 같다', () => {
    const { aquarium, events } = tickAquarium(withSardine({ pendingIncome: 3 }), RELEASE_AT + 10, RELEASE_AT + 10)
    expect(events).toEqual(['released'])
    expect(aquarium.displayed).toEqual([])
    expect(aquarium.pendingIncome).toBe(3)
  })

  it('빈 어항은 시간이 흘러도 아무 일도 없다', () => {
    expect(tickAquarium(EMPTY_AQUARIUM, RELEASE_AT + 10, 5)).toEqual({ aquarium: EMPTY_AQUARIUM, events: [] })
  })
})

describe('전시', () => {
  it('빈 어항에 처음 넣으면 막 밥을 먹은 상태로 시작한다', () => {
    const result = displayFish(EMPTY_AQUARIUM, fish('a'), 500)
    expect(result.ok && result.aquarium.lastFedAt).toBe(500)
    const second = result.ok ? displayFish(result.aquarium, fish('b'), 900) : result
    expect(second.ok && second.aquarium.lastFedAt).toBe(500)
  })

  it('칸이 꽉 차면 넣을 수 없다', () => {
    const full = { ...EMPTY_AQUARIUM, displayed: ['1', '2', '3', '4', '5', '6'].map((id) => fish(id)) }
    expect(displayFish(full, fish('7'), 0)).toEqual({ ok: false, reason: 'full' })
  })

  it('전시를 해제하면 그 물고기를 돌려준다. 없는 id면 null', () => {
    const { aquarium, fish: back } = removeFromDisplay(withSardine(), 'a')
    expect(back?.id).toBe('a')
    expect(aquarium.displayed).toEqual([])
    expect(removeFromDisplay(withSardine(), 'zz').fish).toBeNull()
  })

  it('먹이를 주면 배고픔이 풀린다', () => {
    const fed = feedAquarium(withSardine(), HUNGRY_AT + 5)
    expect(isHungry(fed, HUNGRY_AT + 5)).toBe(false)
  })

  it('입장료는 정수만 받고 소수점은 남겨 둔다', () => {
    const { aquarium, coins } = claimIncome(withSardine({ pendingIncome: 4.75 }))
    expect(coins).toBe(4)
    expect(aquarium.pendingIncome).toBeCloseTo(0.75)
  })
})

describe('구매', () => {
  it('확장: 코인이 딱 맞으면 성공, 최고 단계면 실패', () => {
    expect(buyExpansion(399, EMPTY_AQUARIUM)).toEqual({ ok: false, reason: 'coins' })
    const r = buyExpansion(400, EMPTY_AQUARIUM)
    expect(r.ok && [r.coins, r.aquarium.level]).toEqual([0, 1])
    expect(buyExpansion(99999, { ...EMPTY_AQUARIUM, level: 2 })).toEqual({ ok: false, reason: 'max' })
  })

  it('종류를 사면 보유 목록에 들어가고 바로 바뀐다. 이미 있으면 실패', () => {
    const r = buyTankType(300, EMPTY_AQUARIUM, 'sea')
    expect(r.ok && [r.coins, r.aquarium.ownedTypes, r.aquarium.activeType]).toEqual([0, ['basic', 'sea'], 'sea'])
    expect(buyTankType(999, EMPTY_AQUARIUM, 'basic')).toEqual({ ok: false, reason: 'owned' })
  })

  it('가진 종류로만 바꿀 수 있다', () => {
    expect(selectTankType(EMPTY_AQUARIUM, 'cave')).toBe(EMPTY_AQUARIUM)
    const owned = { ...EMPTY_AQUARIUM, ownedTypes: ['basic', 'cave'] as AquariumState['ownedTypes'], activeType: 'cave' as const }
    expect(selectTankType(owned, 'basic').activeType).toBe('basic')
  })
})
