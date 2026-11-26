// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AQUARIUM, HUNGER, STAMINA } from '../data/balance'
import { DEFAULT_LOOK, LOOK_PRESETS } from '../data/characterParts'
import { EMPTY_AQUARIUM } from '../logic/aquarium'
import { FIRST_MORNING } from '../logic/dayClock'
import { NO_ITEMS } from '../logic/inventory'
import { NO_SNACKS } from '../logic/snacks'
import { INITIAL_PROGRESS, SAVE_KEY, flushProgressSave, onProgressSaved, useProgressStore } from './progressStore'

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
    useProgressStore.setState({ coins: 70 })
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
        version: 2,
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
        version: 2,
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
      localStorage.setItem(SAVE_KEY, JSON.stringify({ state: bad, version: 2 }))
      await useProgressStore.persist.rehydrate()
      expect(store().coins).toBe(5)
      expect(store().gear).toEqual({ line: 0, reel: 0, rod: 0 })
      expect(store().inventory).toEqual([])
      expect(store().dex).toEqual({})
    }
  })

  it('요리하면 물고기 1마리와 조리비를 쓰고 체력이 오른다', () => {
    const fish = store().addCatch('sleepy-sardine', 0.2)
    useProgressStore.setState({ coins: 10, survival: { stamina: 30, hunger: 100, graceLeft: null, buffs: [] } })
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
    useProgressStore.setState({ coins: 9, survival: { stamina: 0, hunger: 50, graceLeft: 0.5, buffs: [] } })
    const events = store().tick(1, { fighting: false, resting: false })
    expect(events.fainted).toBe(true)
    expect(store().coins).toBe(8)
    expect(store().inventory).toEqual([])
    expect(store().aquarium.displayed.map((f) => f.id)).toEqual([displayed.id])
    expect(store().survival.stamina).toBe(STAMINA.max)
    expect(store().survival.hunger).toBeCloseTo(50 - HUNGER.perSecond)
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
    useProgressStore.setState({ coins: 500 })
    expect(store().buyAquariumExpansion()).toBe(true)
    expect(store().coins).toBe(300)
    expect(store().buyTankType('cave')).toBe(false)
    expect(store().buyTankType('sea')).toBe(true)
    store().selectTankType('basic')
    expect(store().aquarium).toMatchObject({ level: 1, ownedTypes: ['basic', 'sea'], activeType: 'basic' })
  })

  it('체력·어항 필드가 없는 예전 저장본은 초기값으로 채운다', async () => {
    localStorage.setItem(SAVE_KEY, JSON.stringify({ state: { coins: 7 }, version: 2 }))
    await useProgressStore.persist.rehydrate()
    expect(store().coins).toBe(7)
    expect(store().survival).toEqual(INITIAL_PROGRESS.survival)
    expect(store().aquarium).toEqual(EMPTY_AQUARIUM)
    expect(store().feed).toBe(0)
  })

  it('장비·어항 5단계 시절(version 1) 저장본은 같은 성능의 10단계 자리로 옮긴다', async () => {
    localStorage.setItem(SAVE_KEY, JSON.stringify({ state: { gear: { line: 2, reel: 1, rod: 4 }, aquarium: { level: 1 } }, version: 1 }))
    await useProgressStore.persist.rehydrate()
    expect(store().gear).toEqual({ line: 4, reel: 2, rod: 9 })
    expect(store().aquarium.level).toBe(2)
  })

  it('깨진 체력·어항 필드는 걸러 내고, 칸 수보다 많은 전시 물고기는 잘라 낸다', async () => {
    const shown = Array.from({ length: 8 }, (_, i) => ({ id: `f${i}`, speciesId: 'sleepy-sardine', weight: 0.2, caughtAtPlayTime: 0 }))
    localStorage.setItem(
      SAVE_KEY,
      JSON.stringify({
        state: {
          feed: 2.5,
          survival: { stamina: 500, graceLeft: 'x', buffs: [{ kind: 'reel', mul: 1.3, remaining: 10 }, { kind: 'fly', mul: 2, remaining: 10 }] },
          aquarium: { level: 99, ownedTypes: ['sea', 'gold'], activeType: 'cave', displayed: [...shown, { id: 'bad' }], lastFedAt: -1, pendingIncome: 3 },
        },
        version: 2,
      }),
    )
    await useProgressStore.persist.rehydrate()
    expect(store().feed).toBe(0)
    expect(store().survival).toEqual({ stamina: STAMINA.max, hunger: 100, graceLeft: null, buffs: [{ kind: 'reel', mul: 1.3, remaining: 10 }] })
    expect(store().aquarium).toEqual({
      level: 0,
      ownedTypes: ['basic', 'sea'],
      activeType: 'basic',
      displayed: shown.slice(0, 6),
      lastFedAt: -1,
      pendingIncome: 3,
    })
  })

  it('처음엔 모습이 없고, 정하면 저장된다', () => {
    expect(store().look).toBeNull()
    store().setLook(LOOK_PRESETS[1].look)
    expect(store().look).toEqual(LOOK_PRESETS[1].look)
  })

  it('정할 때도 범위 밖 값은 고쳐서 저장한다', () => {
    store().setLook({ ...DEFAULT_LOOK, height: 99 })
    expect(store().look?.height).toBe(1.3)
  })

  it('모습이 없는 예전 저장본은 null, 깨진 모습은 고쳐서 불러온다', async () => {
    localStorage.setItem(SAVE_KEY, JSON.stringify({ state: { coins: 3 }, version: 2 }))
    await useProgressStore.persist.rehydrate()
    expect(store().look).toBeNull()

    localStorage.setItem(SAVE_KEY, JSON.stringify({ state: { look: { ...DEFAULT_LOOK, gender: 'female', beard: true, hair: 'x' } }, version: 2 }))
    await useProgressStore.persist.rehydrate()
    expect(store().look).toMatchObject({ gender: 'female', beard: false, hair: DEFAULT_LOOK.hair })
  })

  it('미끼를 사고, 고르고, 던질 때 1개씩 쓴다', () => {
    expect(store().buyBait('lure', 1)).toBe(false)
    useProgressStore.setState({ coins: 100 })
    expect(store().buyBait('shrimp', 3)).toBe(true)
    expect(store().coins).toBe(40)
    expect(store().bait.shrimp).toBe(3)
    store().selectBait('shrimp')
    store().spendBait('shrimp')
    expect(store().bait.shrimp).toBe(2)
    expect(store().selectedBait).toBe('shrimp')
  })

  it('미끼가 없는 예전 저장본은 0개·미끼 없이, 깨진 값은 걸러 낸다', async () => {
    localStorage.setItem(SAVE_KEY, JSON.stringify({ state: { coins: 3 }, version: 2 }))
    await useProgressStore.persist.rehydrate()
    expect(store().bait).toEqual({ worm: 0, shrimp: 0, lure: 0 })
    expect(store().selectedBait).toBeNull()

    localStorage.setItem(SAVE_KEY, JSON.stringify({ state: { bait: { worm: 4, shrimp: -2, lure: 'x', gold: 9 }, selectedBait: 'gold' }, version: 2 }))
    await useProgressStore.persist.rehydrate()
    expect(store().bait).toEqual({ worm: 4, shrimp: 0, lure: 0 })
    expect(store().selectedBait).toBeNull()
  })

  it('다리는 코인을 내고 열고, 동굴은 도감·낚싯줄 조건이 맞아야 열린다', () => {
    expect(store().unlockZone('pond')).toBe(false)
    useProgressStore.setState({ coins: 320 })
    expect(store().unlockZone('pond')).toBe(true)
    expect(store().coins).toBe(20)
    expect(store().unlockedZones).toEqual(['pond'])
    expect(store().unlockZone('pond')).toBe(false)

    expect(store().unlockZone('cave')).toBe(false)
    const ids = ['sleepy-sardine', 'chatty-mackerel', 'bubble-puffer', 'sunglasses-mackerel', 'selfie-flyingfish', 'lifeguard-flounder', 'firefly-minnow', 'ribbit-catfish']
    for (const id of ids) store().addCatch(id, 1)
    useProgressStore.setState({ gear: { line: 4, reel: 0, rod: 0 } })
    expect(store().unlockZone('cave')).toBe(true)
    expect(store().coins).toBe(20)
    expect(store().unlockedZones).toEqual(['pond', 'cave'])
  })

  it('연 구역이 없는 예전 저장본은 모두 잠김, 모르는 구역·해변은 버린다', async () => {
    localStorage.setItem(SAVE_KEY, JSON.stringify({ state: { coins: 3 }, version: 2 }))
    await useProgressStore.persist.rehydrate()
    expect(store().unlockedZones).toEqual([])

    localStorage.setItem(SAVE_KEY, JSON.stringify({ state: { unlockedZones: ['reef', 'beach', 'moon', 'reef', 3] }, version: 2 }))
    await useProgressStore.persist.rehydrate()
    expect(store().unlockedZones).toEqual(['reef'])
  })

  it('간식은 사서 바로 먹거나 가방에 넣었다가 꺼내 먹는다', () => {
    useProgressStore.setState({ coins: 60, survival: { stamina: 10, hunger: 100, graceLeft: null, buffs: [] } })
    expect(store().buyAndEatSnack('gimbap')).toBe(true)
    expect(store().coins).toBe(50)
    expect(store().survival.stamina).toBe(35)
    expect(store().buySnacks('ramen', 2)).toBe(true)
    expect(store().snacks.ramen).toBe(2)
    expect(store().eatSnack('ramen')).toBe(true)
    expect(store().snacks.ramen).toBe(1)
    expect(store().survival.stamina).toBe(80)
    expect(store().eatSnack('energy')).toBe(false)
  })

  it('간식이 없는 예전 저장본은 빈 가방, 깨진 값은 걸러 낸다', async () => {
    localStorage.setItem(SAVE_KEY, JSON.stringify({ state: { coins: 3 }, version: 2 }))
    await useProgressStore.persist.rehydrate()
    expect(store().snacks).toEqual({ gimbap: 0, ramen: 0, energy: 0 })
    localStorage.setItem(SAVE_KEY, JSON.stringify({ state: { snacks: { gimbap: 2, ramen: -1, energy: 'x', cake: 3 } }, version: 2 }))
    await useProgressStore.persist.rehydrate()
    expect(store().snacks).toEqual({ gimbap: 2, ramen: 0, energy: 0 })
  })

  it('찜: 매콤 해물찜은 두 마리, 대왕찜은 희귀 이상, 물고기찜은 일반만', () => {
    useProgressStore.setState({ coins: 200, survival: { stamina: 10, hunger: 100, graceLeft: null, buffs: [] } })
    const a = store().addCatch('sleepy-sardine', 0.2)
    const b = store().addCatch('chatty-mackerel', 0.4)
    const rare = store().addCatch('sunglasses-mackerel', 1)
    expect(store().cookDish('spicySteam', [a.id])).toBe(false)
    expect(store().cookDish('spicySteam', [a.id, a.id])).toBe(false)
    expect(store().cookDish('bossSteam', a.id)).toBe(false)
    expect(store().cookDish('fishSteam', rare.id)).toBe(false)
    expect(store().cookDish('spicySteam', [a.id, b.id])).toBe(true)
    expect(store().inventory.map((f) => f.id)).toEqual([rare.id])
    expect(store().coins).toBe(175)
    expect(store().cookDish('bossSteam', rare.id)).toBe(true)
    expect(store().inventory).toEqual([])
  })
  it('배고픔 0 인 채로 체력이 다 떨어지면 died (가방·코인·물고기는 그대로, 깨우는 건 reviveAtBed)', () => {
    store().addCatch('sleepy-sardine', 0.2)
    useProgressStore.setState({ coins: 50, survival: { stamina: 1, hunger: 0, graceLeft: null, buffs: [] } })
    const events = store().tick(1, { fighting: false, resting: false })
    expect(events).toMatchObject({ fainted: false, died: true })
    expect(store().coins).toBe(50)
    expect(store().inventory).toHaveLength(1)
    store().reviveAtBed({ t: 0, day: 4 })
    expect(store().survival).toEqual({ stamina: STAMINA.max, hunger: 60, graceLeft: null, buffs: [] })
    expect(store().clock).toEqual({ t: 0, day: 4 })
    expect(store().inventory).toHaveLength(1)
  })

  it('동물에게 맞으면 체력이 줄고, 0 이 되면 true (가방·코인은 그대로). 피해 0 은 아무 일도 없다', () => {
    useProgressStore.setState({ coins: 50, survival: { stamina: 20, hunger: 80, graceLeft: null, buffs: [] } })
    expect(store().hurt(15)).toBe(false)
    expect(store().survival.stamina).toBe(5)
    expect(store().hurt(0)).toBe(false)
    expect(store().survival.stamina).toBe(5)
    expect(store().hurt(15)).toBe(true)
    expect(store().survival).toMatchObject({ stamina: 0, graceLeft: null })
    expect(store().coins).toBe(50)
  })

  it('같이 하는 중(시계 null)엔 저장된 혼자 시계를 건드리지 않는다', () => {
    useProgressStore.setState({ clock: { t: 0.3, day: 2 } })
    store().tick(1, { fighting: false, resting: false }, null)
    store().reviveAtBed(null)
    store().sleepWell(null)
    expect(store().clock).toEqual({ t: 0.3, day: 2 })
    store().tick(1, { fighting: false, resting: false }, { t: 0.4, day: 2 })
    expect(store().clock).toEqual({ t: 0.4, day: 2 })
  })

  it('자고 나면 체력 가득, 배고픔 −15 (최소 10), 혼자면 시계도', () => {
    useProgressStore.setState({ survival: { stamina: 20, hunger: 50, graceLeft: null, buffs: [] } })
    store().sleepWell({ t: 0, day: 3 })
    expect(store().survival).toMatchObject({ stamina: STAMINA.max, hunger: 35 })
    expect(store().clock).toEqual({ t: 0, day: 3 })
  })

  it('배고픔·시계가 없는 예전 저장본(version 2)은 배고픔 100, 1일차 06:00 로 연다', async () => {
    localStorage.setItem(SAVE_KEY, JSON.stringify({ state: { coins: 4, survival: { stamina: 40, graceLeft: null, buffs: [] } }, version: 2 }))
    await useProgressStore.persist.rehydrate()
    expect(store().coins).toBe(4)
    expect(store().survival).toEqual({ stamina: 40, hunger: 100, graceLeft: null, buffs: [] })
    expect(store().clock).toEqual(FIRST_MORNING)
  })

  it('깨진 배고픔·시계는 기본값으로, 맞는 값은 살린다', async () => {
    localStorage.setItem(SAVE_KEY, JSON.stringify({ state: { survival: { stamina: 40, hunger: 130 }, clock: { t: 1.5, day: 3 } }, version: 3 }))
    await useProgressStore.persist.rehydrate()
    expect(store().survival.hunger).toBe(100)
    expect(store().clock).toEqual(FIRST_MORNING)
    localStorage.setItem(SAVE_KEY, JSON.stringify({ state: { survival: { stamina: 40, hunger: 12.5 }, clock: { t: 0.6, day: 9 } }, version: 3 }))
    await useProgressStore.persist.rehydrate()
    expect(store().survival.hunger).toBe(12.5)
    expect(store().clock).toEqual({ t: 0.6, day: 9 })
  })

  it('가방(items)이 없는 예전 저장본(version 3)은 빈 가방, 모르는 물건·깨진 개수는 버린다', async () => {
    localStorage.setItem(SAVE_KEY, JSON.stringify({ state: { coins: 4 }, version: 3 }))
    await useProgressStore.persist.rehydrate()
    expect(store().items).toEqual(NO_ITEMS)
    localStorage.setItem(SAVE_KEY, JSON.stringify({ state: { items: { egg: 3, steak: 1.5, pizza: 9, beef: -1 } }, version: 4 }))
    await useProgressStore.persist.rehydrate()
    expect(store().items).toEqual({ ...NO_ITEMS, egg: 3 })
  })

  it('가스레인지 요리: 재료를 빼고 시작, 모자라면 아무것도 빼지 않는다', () => {
    store().addItem('egg', 1)
    expect(store().startRecipe('omelet')).toBe(false)
    expect(store().items.egg).toBe(1)
    expect(store().startRecipe('friedegg')).toBe(true)
    expect(store().items.egg).toBe(0)
  })

  it('F: 배고픔을 가장 많이 채우는 요리·간식을 먹는다. 없으면 null', () => {
    useProgressStore.setState({ survival: { stamina: 50, hunger: 10, graceLeft: null, buffs: [] }, items: { ...NO_ITEMS, roast: 1, steak: 1 }, snacks: { ...NO_SNACKS, energy: 1 } })
    expect(store().eatBest()).toBe('steak')
    expect(store().survival).toMatchObject({ stamina: 60, hunger: 50 })
    expect(store().items.steak).toBe(0)
    expect(store().eatBest()).toBe('roast')
    expect(store().eatBest()).toBe('energy')
    expect(store().snacks.energy).toBe(0)
    expect(store().eatBest()).toBeNull()
  })

  it('가방에서 골라 먹기: 은지 요리·간식, 없으면 false', () => {
    useProgressStore.setState({ survival: { stamina: 50, hunger: 10, graceLeft: 30, buffs: [] }, items: { ...NO_ITEMS, bonebroth: 1 } })
    expect(store().eatFromBag('bonebroth')).toBe(true)
    // 먹으면 약화도 풀린다
    expect(store().survival).toMatchObject({ stamina: 56, hunger: 34, graceLeft: null })
    expect(store().eatFromBag('bonebroth')).toBe(false)
    expect(store().eatFromBag('gimbap')).toBe(false)
  })

  it('문: 처음엔 모두 닫힘, 열고 닫은 상태를 저장한다. 깨진 값은 그 문만 닫힘', async () => {
    expect(store().doors).toEqual([false, false, false, false])
    store().setDoorOpen(3, true)
    store().setDoorOpen(9, true)
    expect(store().doors).toEqual([false, false, false, true])
    useProgressStore.setState({ ...INITIAL_PROGRESS })
    localStorage.setItem(SAVE_KEY, JSON.stringify({ state: { doors: [true, 'yes', true] }, version: 4 }))
    await useProgressStore.persist.rehydrate()
    expect(store().doors).toEqual([true, false, true, false])
  })

  it('마을 상인: 팔면 코인이 오르고 가방에서 빠진다. 사면 반대. 안 되면 그대로', () => {
    useProgressStore.setState({ coins: 10, items: { ...NO_ITEMS, beef: 2 } })
    expect(store().sellItem('butcher', 'beef', 2)).toBe(24)
    expect(store().coins).toBe(34)
    expect(store().items.beef).toBe(0)
    expect(store().sellItem('butcher', 'beef', 1)).toBe(0)
    expect(store().buyItem('grocer', 'mushroom', 2, 'solo', 1)).toBe(true)
    expect([store().coins, store().items.mushroom]).toEqual([18, 2])
    expect(store().buyItem('grocer', 'pumpkin', 2, 'solo', 1)).toBe(false)
    expect(store().coins).toBe(18)
  })

  it('농산물 가게 하루 수량을 저장한다 (없던 저장본은 가득)', async () => {
    useProgressStore.setState({ coins: 100 })
    expect(store().buyItem('grocer', 'egg', 3, 'solo', 2)).toBe(true)
    expect(store().buyItem('grocer', 'egg', 1, 'solo', 2)).toBe(false)
    expect(store().coins).toBe(76)
    expect(store().stock.solo).toEqual({ day: 2, bought: { egg: 3 } })
    expect(store().buyItem('grocer', 'egg', 1, 'solo', 3)).toBe(true)
    useProgressStore.setState({ ...INITIAL_PROGRESS })
    localStorage.setItem(SAVE_KEY, JSON.stringify({ state: { stock: { day: 4, bought: { pumpkin: 3 } } }, version: 4 }))
    await useProgressStore.persist.rehydrate()
    expect(store().stock).toEqual({ solo: { day: 4, bought: { pumpkin: 3 } }, room: { day: 4, bought: { pumpkin: 3 } } })
    localStorage.setItem(SAVE_KEY, JSON.stringify({ state: {}, version: 3 }))
    await useProgressStore.persist.rehydrate()
    expect(store().stock).toEqual(INITIAL_PROGRESS.stock)
  })

  it('쏠 때마다 바로 저장하지 않고 1초 안에 한 번 (연사 소총이 초당 11번 저장하지 않게). 다른 일은 바로 저장하며 그때 탄도 같이', () => {
    vi.useFakeTimers()
    try {
      const saved = () => JSON.parse(localStorage.getItem(SAVE_KEY) ?? '{"state":{}}').state
      store().addItem('beef')
      for (let i = 0; i < 5; i++) store().fireRound('rifle')
      expect(saved().ammo.rifle).toBe(30)
      vi.advanceTimersByTime(1000)
      expect(saved().ammo.rifle).toBe(25)
      store().fireRound('rifle')
      store().addItem('beef')
      expect(saved().ammo.rifle).toBe(24)
      store().fireRound('rifle')
      flushProgressSave()
      expect(saved().ammo.rifle).toBe(23)
    } finally {
      vi.useRealTimers()
    }
  })

  it('탭을 숨기거나 닫으면 미룬 탄을 바로 저장한다', () => {
    store().fireRound('pistol')
    window.dispatchEvent(new Event('pagehide'))
    expect(JSON.parse(localStorage.getItem(SAVE_KEY)!).state.ammo.pistol).toBe(11)
  })

  it('총: 쏘면 탄창이 줄고, 장전하면 예비에서 채운다. 탄약 묶음은 코인으로 산다', () => {
    expect(store().ammo.pistol).toBe(12)
    expect(store().fireRound('pistol')).toBe(true)
    expect(store().ammo.pistol).toBe(11)
    expect(store().reloadGun('pistol')).toBe(true)
    expect([store().ammo.pistol, store().reserve.pistol]).toEqual([12, 47])
    expect(store().buyAmmo('sniper', 1)).toBe(false)
    useProgressStore.setState({ coins: 300 })
    expect(store().buyAmmo('sniper', 1)).toBe(true)
    expect([store().coins, store().reserve.sniper]).toEqual([50, 25])
  })

  it('사격장 최고 점수는 더 높을 때만 바뀐다', () => {
    expect(store().recordRangeScore(30)).toBe(true)
    expect(store().recordRangeScore(12)).toBe(false)
    expect(store().rangeBest).toBe(30)
  })

  it('탄약이 없는 예전 저장본(version 4)은 탄창 가득·은지 기본 예비·최고 점수 0, 깨진 값은 그 총만 기본값', async () => {
    localStorage.setItem(SAVE_KEY, JSON.stringify({ state: { coins: 3 }, version: 4 }))
    await useProgressStore.persist.rehydrate()
    expect(store().ammo).toEqual({ pistol: 12, rifle: 30, shotgun: 6, sniper: 5 })
    expect(store().reserve).toEqual({ pistol: 48, rifle: 120, shotgun: 24, sniper: 20 })
    expect(store().rangeBest).toBe(0)
    localStorage.setItem(SAVE_KEY, JSON.stringify({ state: { ammo: { pistol: 13, rifle: 7 }, reserve: { sniper: 2, shotgun: 1.5 }, rangeBest: 88 }, version: 5 }))
    await useProgressStore.persist.rehydrate()
    expect(store().ammo).toEqual({ pistol: 12, rifle: 7, shotgun: 6, sniper: 5 })
    expect(store().reserve).toEqual({ pistol: 48, rifle: 120, shotgun: 24, sniper: 2 })
    expect(store().rangeBest).toBe(88)
  })
})

describe('onProgressSaved', () => {
  it('사본에 쓸 때마다 알린다', () => {
    const seen = vi.fn()
    const off = onProgressSaved(seen)
    useProgressStore.getState().addPlayTime(1)
    expect(seen).toHaveBeenCalled()
    off()
    seen.mockClear()
    useProgressStore.getState().addPlayTime(1)
    expect(seen).not.toHaveBeenCalled()
  })
})
