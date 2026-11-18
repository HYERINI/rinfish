// @vitest-environment jsdom
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { NO_ITEMS } from '../game/logic/inventory'
import { INITIAL_PROGRESS, useProgressStore } from '../game/stores/progressStore'
import { useSessionStore } from '../game/stores/sessionStore'
import { startStoveCook, stepStoveCook, stoveCookLeft } from './meadowActions'

beforeAll(() => vi.stubGlobal('fetch', () => Promise.reject(new Error('offline'))))
afterAll(() => vi.unstubAllGlobals())

beforeEach(() => {
  localStorage.clear()
  useProgressStore.setState({ ...INITIAL_PROGRESS })
  useSessionStore.getState().resetSession()
})

describe('가스레인지 요리', () => {
  it('가스레인지 앞에서만, 재료를 빼고 창을 닫고 요리 시간 뒤 가방에 넣는다', () => {
    useProgressStore.setState({ items: { ...NO_ITEMS, egg: 1 } })
    useSessionStore.setState({ mode: 'bag' })
    expect(startStoveCook('friedegg', 10)).toBe(false)
    useSessionStore.getState().setNearby({ kind: 'stove' })
    expect(startStoveCook('friedegg', 10)).toBe(true)
    expect(useProgressStore.getState().items.egg).toBe(0)
    expect(useSessionStore.getState().mode).toBe('explore')
    expect(stoveCookLeft(11)).toBe(1)
    stepStoveCook(11.9)
    expect(useProgressStore.getState().items.friedegg).toBe(0)
    stepStoveCook(12)
    expect(useProgressStore.getState().items.friedegg).toBe(1)
    expect(useSessionStore.getState().stoveCook).toBeNull()
    expect(useSessionStore.getState().notice?.text).toContain('달걀 프라이 완성')
  })
  it('요리 중엔 또 시작하지 않고, 재료가 모자라면 시작하지 않는다', () => {
    useProgressStore.setState({ items: { ...NO_ITEMS, egg: 2 } })
    useSessionStore.getState().setNearby({ kind: 'stove' })
    expect(startStoveCook('omelet', 0)).toBe(false)
    expect(startStoveCook('friedegg', 0)).toBe(true)
    expect(startStoveCook('friedegg', 0.5)).toBe(false)
    expect(useProgressStore.getState().items.egg).toBe(1)
  })
  it('요리하는 동안 가스레인지를 떠나거나 다른 창을 열어도 시간이 되면 가방에 들어온다', () => {
    useProgressStore.setState({ items: { ...NO_ITEMS, bone: 2 } })
    useSessionStore.getState().setNearby({ kind: 'stove' })
    expect(startStoveCook('bonebroth', 0)).toBe(true)
    useSessionStore.getState().clearNearby({ kind: 'stove' })
    useSessionStore.getState().setMode('menu')
    stepStoveCook(6)
    expect(useProgressStore.getState().items.bonebroth).toBe(1)
  })
})
