import { beforeEach, describe, expect, it } from 'vitest'
import { useSessionStore } from './sessionStore'

describe('배 타는 중 모드', () => {
  beforeEach(() => useSessionStore.getState().resetSession())

  it('배 타는 중엔 탐험으로 돌려도 배 모드를 지킨다 (로비를 닫아도 조작이 풀리지 않는다)', () => {
    const s = useSessionStore.getState()
    s.startBoat('toIsland')
    s.setMode('lobby')
    s.setMode('explore')
    expect(useSessionStore.getState().mode).toBe('boat')
    expect(useSessionStore.getState().boat).not.toBeNull()
  })

  it('순간이동(쓰러져 진료소로)하면 배에서 내리고 탐험으로 돌아간다', () => {
    const s = useSessionStore.getState()
    s.startBoat('toMeadow')
    s.setMode('explore')
    s.requestTeleport([5, 5])
    const after = useSessionStore.getState()
    expect(after.boat).toBeNull()
    expect(after.mode).toBe('explore')
    expect(after.teleport).toEqual([5, 5])
  })

  it('배를 안 탈 땐 모드를 그대로 바꾼다', () => {
    const s = useSessionStore.getState()
    s.setMode('rest')
    s.setMode('explore')
    expect(useSessionStore.getState().mode).toBe('explore')
  })
})

describe('큰 지도', () => {
  beforeEach(() => useSessionStore.getState().resetSession())

  it('탐험 중에 열면 지도 모드가 되고(이동·키 막힘), 닫으면 탐험으로 돌아간다', () => {
    const s = useSessionStore.getState()
    s.openMap()
    expect(useSessionStore.getState().mode).toBe('map')
    s.closeMap()
    expect(useSessionStore.getState().mode).toBe('explore')
  })

  it('메뉴에서 열 수 있다', () => {
    const s = useSessionStore.getState()
    s.setMode('menu')
    s.openMap()
    expect(useSessionStore.getState().mode).toBe('map')
  })

  it('배 타는 중에 열고 닫으면 배 모드로 돌아간다', () => {
    const s = useSessionStore.getState()
    s.startBoat('toMeadow')
    s.openMap()
    expect(useSessionStore.getState().mode).toBe('map')
    s.closeMap()
    expect(useSessionStore.getState().mode).toBe('boat')
  })

  it('지도를 보는 중 배가 도착하면 지도는 남고, 닫으면 탐험', () => {
    const s = useSessionStore.getState()
    s.startBoat('toIsland')
    s.openMap()
    s.endBoat()
    expect(useSessionStore.getState().mode).toBe('map')
    s.closeMap()
    expect(useSessionStore.getState().mode).toBe('explore')
  })

  it('낚시·패널·연출 중엔 열지 않는다', () => {
    const s = useSessionStore.getState()
    for (const m of ['fishing', 'sell', 'rest', 'cutscene', 'lobby'] as const) {
      s.setMode(m)
      s.openMap()
      expect(useSessionStore.getState().mode).toBe(m)
    }
  })

  it('지도가 아닐 때 닫기는 아무 일도 하지 않는다', () => {
    const s = useSessionStore.getState()
    s.setMode('fishing')
    s.closeMap()
    expect(useSessionStore.getState().mode).toBe('fishing')
  })
})

describe('도구 칸', () => {
  beforeEach(() => useSessionStore.getState().resetSession())

  it('처음엔 낚싯대, 바꾸고 넣을 수 있고, 판을 새로 시작하면 다시 낚싯대', () => {
    expect(useSessionStore.getState().tool).toBe('rod')
    useSessionStore.getState().equip('knife')
    expect(useSessionStore.getState().tool).toBe('knife')
    useSessionStore.getState().equip(null)
    expect(useSessionStore.getState().tool).toBeNull()
    useSessionStore.getState().resetSession()
    expect(useSessionStore.getState().tool).toBe('rod')
  })

  it('총을 들면 마지막에 든 총으로 기억한다 (폰 도구 칸의 총 한 칸). 다른 도구를 들어도 그대로', () => {
    expect(useSessionStore.getState().lastGun).toBe('pistol')
    useSessionStore.getState().equip('sniper')
    useSessionStore.getState().equip('knife')
    expect(useSessionStore.getState().lastGun).toBe('sniper')
    useSessionStore.getState().resetSession()
    expect(useSessionStore.getState().lastGun).toBe('pistol')
  })
})

describe('시점 (V)', () => {
  beforeEach(() => useSessionStore.getState().resetSession())

  it('1인칭과 3인칭을 오가고, 판을 새로 시작하면 3인칭', () => {
    expect(useSessionStore.getState().view).toBe('third')
    useSessionStore.getState().toggleView()
    expect(useSessionStore.getState().view).toBe('first')
    useSessionStore.getState().resetSession()
    expect(useSessionStore.getState().view).toBe('third')
  })
})

describe('마을 상인 창', () => {
  beforeEach(() => useSessionStore.getState().resetSession())

  it('창을 닫거나 다른 모드로 가면 연 상인을 지운다', () => {
    useSessionStore.getState().openVendor('grocer')
    expect(useSessionStore.getState().vendor).toBe('grocer')
    useSessionStore.getState().setMode('vendor')
    expect(useSessionStore.getState().vendor).toBe('grocer')
    useSessionStore.getState().setMode('explore')
    expect(useSessionStore.getState().vendor).toBeNull()
    useSessionStore.getState().openVendor('butcher')
    useSessionStore.getState().setMode('menu')
    expect(useSessionStore.getState().vendor).toBeNull()
  })
})
