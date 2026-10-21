// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest'
import { AQUARIUM, STAMINA } from '../data/balance'
import { EMPTY_AQUARIUM } from '../logic/aquarium'
import { INITIAL_PROGRESS, SAVE_KEY, useProgressStore } from './progressStore'

const store = () => useProgressStore.getState()

beforeEach(() => {
  localStorage.clear()
  useProgressStore.setState({ ...INITIAL_PROGRESS })
})

describe('progressStore', () => {
  it('물고기를 잡으면 보관함과 도감에 들어간다', () => {
    store().addCatch('sleepy-sardine', 0.2)
    store().addCatch('sleepy-sardine', 0.25)
    expect(store().inventory).toHaveLength(2)
    expect(store().dex['sleepy-sardine']).toEqual({ count: 2, maxWeight: 0.25 })
  })

  it('팔면 보관함에서 빠지고 코인이 오른다', () => {
    const fish = store().addCatch('pirate-tuna', 20)
    const earned = store().sellFish([fish.id])
    expect(earned).toBe(200)
    expect(store().coins).toBe(200)
    expect(store().inventory).toHaveLength(0)
    expect(store().dex['pirate-tuna'].count).toBe(1)
  })

  it('빈 보관함이나 없는 id를 팔면 아무 일도 없다', () => {
    expect(store().sellFish([])).toBe(0)
    expect(store().sellFish(['no-such-id'])).toBe(0)
    expect(store().coins).toBe(0)
  })

  it('코인이 있으면 장비를 사고, 없으면 실패한다', () => {
    expect(store().buyGear('line')).toBe(false)
    useProgressStore.setState({ coins: 150 })
    expect(store().buyGear('line')).toBe(true)
    expect(store().gear.line).toBe(1)
    expect(store().coins).toBe(0)
  })

  it('저장 데이터가 깨져 있어도 초기 상태로 시작한다', async () => {
    localStorage.setItem(SAVE_KEY, '{망가진 json')
    await useProgressStore.persist.rehydrate()
    expect(store().coins).toBe(0)
    expect(store().inventory).toEqual([])
  })

  it('지금은 없는 물고기가 저장돼 있으면 불러올 때 걸러낸다', async () => {
    localStorage.setItem(
      SAVE_KEY,
      JSON.stringify({
        state: {
          coins: 5,
          inventory: [
            { id: 'a', speciesId: 'deleted-fish', weight: 1, caughtAtPlayTime: 0 },
            { id: 'b', speciesId: 'sleepy-sardine', weight: 0.2, caughtAtPlayTime: 0 },
          ],
        },
        version: 1,
      }),
    )
    await useProgressStore.persist.rehydrate()
    expect(store().coins).toBe(5)
    expect(store().inventory.map((f) => f.id)).toEqual(['b'])
    expect(store().gear).toEqual({ line: 0, reel: 0, rod: 0 })
  })

  it('저장 데이터의 타입이 틀린 필드는 초기값으로 되돌리고 멀쩡한 필드는 살린다', async () => {
    localStorage.setItem(
      SAVE_KEY,
      JSON.stringify({
        state: {
          coins: -3,
          playTime: 'x',
          gear: { line: 99, reel: 1, rod: 'x' },
          inventory: [
            { id: 1, speciesId: 'sleepy-sardine', weight: 0.2, caughtAtPlayTime: 0 },
            { id: 'w', speciesId: 'sleepy-sardine', weight: null, caughtAtPlayTime: 0 },
            { id: 'p', speciesId: 'sleepy-sardine', weight: 0.2, caughtAtPlayTime: 'x' },
            null,
            { id: 'ok', speciesId: 'sleepy-sardine', weight: 0.2, caughtAtPlayTime: 4 },
          ],
          dex: {
            'sleepy-sardine': { count: 2, maxWeight: 0.3 },
            'pirate-tuna': { count: 'many', maxWeight: 1 },
            'deleted-fish': { count: 1, maxWeight: 1 },
          },
        },
        version: 1,
      }),
    )
    await useProgressStore.persist.rehydrate()
    expect(store().coins).toBe(0)
    expect(store().playTime).toBe(0)
    expect(store().gear).toEqual({ line: 0, reel: 1, rod: 0 })
    expect(store().inventory.map((f) => f.id)).toEqual(['ok'])
    expect(store().dex).toEqual({ 'sleepy-sardine': { count: 2, maxWeight: 0.3 } })

    for (const bad of [{ coins: 5, gear: -1, inventory: 'x', dex: [] }, { coins: 5, gear: 'x', inventory: {}, dex: null }]) {
      useProgressStore.setState({ ...INITIAL_PROGRESS })
      localStorage.setItem(SAVE_KEY, JSON.stringify({ state: bad, version: 1 }))
      await useProgressStore.persist.rehydrate()
      expect(store().coins).toBe(5)
      expect(store().gear).toEqual({ line: 0, reel: 0, rod: 0 })
      expect(store().inventory).toEqual([])
      expect(store().dex).toEqual({})
    }
  })

  it('요리하면 물고기 1마리와 조리비를 쓰고 체력이 오른다', () => {
    const fish = store().addCatch('sleepy-sardine', 0.2)
    useProgressStore.setState({ coins: 10, survival: { stamina: 30, graceLeft: null, buffs: [] } })
    expect(store().cookDish('sashimi', fish.id)).toBe(true)
    expect(store().coins).toBe(5)
    expect(store().survival.stamina).toBe(50)
    expect(store().inventory).toEqual([])
  })

  it('조리비가 없거나 없는 물고기면 요리되지 않고 물고기도 남는다', () => {
    const fish = store().addCatch('sleepy-sardine', 0.2)
    expect(store().cookDish('stew', fish.id)).toBe(false)
    expect(store().cookDish('sashimi', 'no-such-id')).toBe(false)
    expect(store().inventory).toHaveLength(1)
  })

  it('캐스팅하면 체력이 준다', () => {
    store().spendCastStamina()
    expect(store().survival.stamina).toBe(STAMINA.max - STAMINA.castCost)
  })

  it('쓰러지면 보관함을 잃고 진료비를 내지만, 어항 물고기는 남고 체력은 가득 찬다', () => {
    const displayed = store().addCatch('pirate-tuna', 20)
    store().displayFish(displayed.id)
    store().addCatch('sleepy-sardine', 0.2)
    useProgressStore.setState({ coins: 9, survival: { stamina: 0, graceLeft: 0.5, buffs: [] } })
    const events = store().tick(1, { fighting: false, resting: false })
    expect(events.fainted).toBe(true)
    expect(store().coins).toBe(8)
    expect(store().inventory).toEqual([])
    expect(store().aquarium.displayed.map((f) => f.id)).toEqual([displayed.id])
    expect(store().survival.stamina).toBe(STAMINA.max)
  })

  it('tick은 플레이 시간을 늘리고 어항 입장료를 쌓는다', () => {
    const fish = store().addCatch('sleepy-sardine', 0.2)
    store().displayFish(fish.id)
    store().tick(60, { fighting: false, resting: false })
    expect(store().playTime).toBe(60)
    expect(store().aquarium.pendingIncome).toBeCloseTo(1)
    expect(store().claimAquariumIncome()).toBe(1)
    expect(store().coins).toBe(1)
  })

  it('전시하면 보관함에서 빠지고, 해제하면 돌아온다. 꽉 차면 보관함에 남는다', () => {
    const ids = Array.from({ length: 7 }, () => store().addCatch('sleepy-sardine', 0.2).id)
    for (const id of ids.slice(0, 6)) expect(store().displayFish(id)).toBe(true)
    expect(store().displayFish(ids[6])).toBe(false)
    expect(store().inventory.map((f) => f.id)).toEqual([ids[6]])
    expect(store().undisplayFish(ids[0])).toBe(true)
    expect(store().inventory).toHaveLength(2)
  })

  it('먹이: 빈 어항이나 잡어가 아닌 물고기로는 줄 수 없고, 사료·물고기가 줄지 않는다', () => {
    useProgressStore.setState({ feed: 1 })
    expect(store().feedWithPellet()).toBe(false)
    const sardine = store().addCatch('sleepy-sardine', 0.2)
    const shown = store().addCatch('sleepy-sardine', 0.2)
    store().displayFish(shown.id)
    expect(store().feedWithJunk(sardine.id)).toBe(false)
    expect(store().inventory).toHaveLength(1)
    expect(store().feed).toBe(1)

    const anchovy = store().addCatch('lost-anchovy', 0.02)
    useProgressStore.setState({ playTime: AQUARIUM.hungerAfter + 5 })
    expect(store().feedWithJunk(anchovy.id)).toBe(true)
    expect(store().aquarium.lastFedAt).toBe(AQUARIUM.hungerAfter + 5)
    expect(store().feedWithPellet()).toBe(true)
    expect(store().feed).toBe(0)
  })

  it('사료는 코인으로 산다', () => {
    expect(store().buyFeed()).toBe(false)
    useProgressStore.setState({ coins: AQUARIUM.feedPrice })
    expect(store().buyFeed()).toBe(true)
    expect([store().coins, store().feed]).toEqual([0, 1])
  })

  it('어항 확장과 종류 구매', () => {
    useProgressStore.setState({ coins: 700 })
    expect(store().buyAquariumExpansion()).toBe(true)
    expect(store().coins).toBe(300)
    expect(store().buyTankType('cave')).toBe(false)
    expect(store().buyTankType('sea')).toBe(true)
    store().selectTankType('basic')
    expect(store().aquarium).toMatchObject({ level: 1, ownedTypes: ['basic', 'sea'], activeType: 'basic' })
  })

  it('체력·어항 필드가 없는 예전 저장본은 초기값으로 채운다', async () => {
    localStorage.setItem(SAVE_KEY, JSON.stringify({ state: { coins: 7 }, version: 1 }))
    await useProgressStore.persist.rehydrate()
    expect(store().coins).toBe(7)
    expect(store().survival).toEqual(INITIAL_PROGRESS.survival)
    expect(store().aquarium).toEqual(EMPTY_AQUARIUM)
    expect(store().feed).toBe(0)
  })

  it('깨진 체력·어항 필드는 걸러 내고, 칸 수보다 많은 전시 물고기는 잘라 낸다', async () => {
    const shown = Array.from({ length: 8 }, (_, i) => ({ id: `f${i}`, speciesId: 'sleepy-sardine', weight: 0.2, caughtAtPlayTime: 0 }))
    localStorage.setItem(
      SAVE_KEY,
      JSON.stringify({
        state: {
          feed: 2.5,
          survival: { stamina: 500, graceLeft: 'x', buffs: [{ kind: 'reel', mul: 1.3, remaining: 10 }, { kind: 'fly', mul: 2, remaining: 10 }] },
          aquarium: { level: 9, ownedTypes: ['sea', 'gold'], activeType: 'cave', displayed: [...shown, { id: 'bad' }], lastFedAt: -1, pendingIncome: 3 },
        },
        version: 1,
      }),
    )
    await useProgressStore.persist.rehydrate()
    expect(store().feed).toBe(0)
    expect(store().survival).toEqual({ stamina: STAMINA.max, graceLeft: null, buffs: [{ kind: 'reel', mul: 1.3, remaining: 10 }] })
    expect(store().aquarium).toEqual({
      level: 0,
      ownedTypes: ['basic', 'sea'],
      activeType: 'basic',
      displayed: shown.slice(0, 6),
      lastFedAt: -1,
      pendingIncome: 3,
    })
  })
})
