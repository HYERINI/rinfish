// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest'
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
})
