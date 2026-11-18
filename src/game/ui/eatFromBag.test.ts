// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest'
import { takeActionPresses } from '../input/usePlayerActionKeys'
import { NO_ITEMS } from '../logic/inventory'
import { IDLE_ACTION } from '../logic/playerMotion'
import { playerGround } from '../scene/playerGround'
import { INITIAL_PROGRESS, useProgressStore } from '../stores/progressStore'
import { useSessionStore } from '../stores/sessionStore'
import { eatBestNow, eatFromBagNow } from './eatFromBag'

const items = () => useProgressStore.getState().items

describe('F·가방 먹기: 먹는 모습이 시작될 때만 먹는다', () => {
  beforeEach(() => {
    localStorage.clear()
    useProgressStore.setState({ ...INITIAL_PROGRESS, items: { ...NO_ITEMS, roast: 2 } })
    useSessionStore.getState().resetSession()
    playerGround.grounded = true
    takeActionPresses()
  })

  it('서 있으면 먹는다', () => {
    eatBestNow()
    expect(items().roast).toBe(1)
    expect(takeActionPresses().eatPressed).toBe('roast')
  })

  it('이미 먹는 중이면 F 를 무시한다 (음식이 사라지지 않는다)', () => {
    useSessionStore.getState().setPlayerAction({ ...IDLE_ACTION, eat: 'roast', eatAt: 1 })
    eatBestNow()
    expect(eatFromBagNow('roast')).toBe(false)
    expect(items().roast).toBe(2)
    expect(takeActionPresses().eatPressed).toBeNull()
  })

  it('점프 중이거나 땅에 발이 안 닿으면 무시한다', () => {
    useSessionStore.getState().setPlayerAction({ ...IDLE_ACTION, airborne: true, jumpAt: 1 })
    eatBestNow()
    expect(items().roast).toBe(2)
    useSessionStore.getState().setPlayerAction(IDLE_ACTION)
    playerGround.grounded = false
    expect(eatFromBagNow('roast')).toBe(false)
    expect(items().roast).toBe(2)
  })
})
