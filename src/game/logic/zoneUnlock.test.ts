import { describe, expect, it } from 'vitest'
import { getZone } from '../data/zones'
import { clearProgress, isZoneOpen, openFishingSpots, unlockStatus, unlockZone, type UnlockContext } from './zoneUnlock'

const ctx = (p: Partial<UnlockContext> = {}): UnlockContext => ({ coins: 0, dexCount: 0, lineLevel: 0, unlocked: [], ...p })

describe('isZoneOpen', () => {
  it('해변은 늘 열려 있고, 나머지는 열린 목록에 있어야 열려 있다', () => {
    expect(isZoneOpen('beach', [])).toBe(true)
    expect(isZoneOpen('pond', [])).toBe(false)
    expect(isZoneOpen('pond', ['pond'])).toBe(true)
    expect(isZoneOpen('cave', ['pond', 'reef'])).toBe(false)
  })
})

describe('openFishingSpots', () => {
  it('잠긴 구역의 낚시 포인트는 빠진다', () => {
    const zones = (unlocked: Parameters<typeof openFishingSpots>[0]) => [...new Set(openFishingSpots(unlocked).map((s) => s.zone))]
    expect(zones([])).toEqual(['beach'])
    expect(zones(['pond']).sort()).toEqual(['beach', 'pond'])
    expect(zones(['pond', 'reef', 'cave']).sort()).toEqual(['beach', 'cave', 'pond', 'reef'])
  })
})

describe('unlockStatus', () => {
  it('다리(300)·보트(800)는 코인이 있으면 바로 열 수 있다', () => {
    expect(unlockStatus(getZone('pond'), ctx({ coins: 300 }))).toEqual({ state: 'ready', cost: 300 })
    expect(unlockStatus(getZone('reef'), ctx({ coins: 799 }))).toEqual({ state: 'short', reason: 'coins', cost: 800, missing: 1 })
  })

  it('동굴은 도감 8종과 낚싯줄 Lv3(단계 2)을 모두 채워야 열린다. 코인은 들지 않는다', () => {
    expect(unlockStatus(getZone('cave'), ctx({ dexCount: 8, lineLevel: 2 }))).toEqual({ state: 'ready', cost: 0 })
    expect(unlockStatus(getZone('cave'), ctx({ dexCount: 5, lineLevel: 1, coins: 9999 }))).toEqual({ state: 'short', reason: 'conditions', progress: '도감 5/8 · 낚싯줄 Lv2/3' })
    expect(unlockStatus(getZone('cave'), ctx({ dexCount: 12, lineLevel: 1 }))).toMatchObject({ state: 'short', progress: '도감 8/8 · 낚싯줄 Lv2/3' })
  })

  it('이미 열렸거나 해변이면 open', () => {
    expect(unlockStatus(getZone('pond'), ctx({ unlocked: ['pond'] }))).toEqual({ state: 'open' })
    expect(unlockStatus(getZone('beach'), ctx())).toEqual({ state: 'open' })
  })
})

describe('unlockZone', () => {
  it('열면 코인을 내고 열린 목록에 넣는다', () => {
    expect(unlockZone(getZone('pond'), ctx({ coins: 350, unlocked: ['reef'] }))).toEqual({ ok: true, coins: 50, unlocked: ['reef', 'pond'] })
  })

  it('못 열면 아무것도 바뀌지 않고 이유를 돌려준다', () => {
    const r = unlockZone(getZone('cave'), ctx({ dexCount: 3 }))
    expect(r).toEqual({ ok: false, status: { state: 'short', reason: 'conditions', progress: '도감 3/8 · 낚싯줄 Lv1/3' } })
    expect(unlockZone(getZone('pond'), ctx({ coins: 1000, unlocked: ['pond'] }))).toEqual({ ok: false, status: { state: 'open' } })
  })
})

describe('clearProgress', () => {
  it('넘친 값은 목표에서 멈춘다', () => {
    expect(clearProgress(8, 3, 20, 5)).toBe('도감 8/8 · 낚싯줄 Lv3/3')
  })
})
