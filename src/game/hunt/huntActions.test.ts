// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest'
import { INITIAL_PROGRESS, useProgressStore } from '../stores/progressStore'
import { useSessionStore } from '../stores/sessionStore'
import { lootList, resetAnimalRig, spawnLoot } from './animalRig'
import { pickLoot } from './huntActions'

beforeEach(() => {
  localStorage.clear()
  resetAnimalRig()
  useProgressStore.setState({ ...INITIAL_PROGRESS })
  useSessionStore.getState().resetSession()
})

describe('전리품 줍기', () => {
  it('가방에 넣고 "획득 (n개)" 알림, 바닥에서 빠지고 E 대상도 지운다', () => {
    spawnLoot(['beef', 'beef'], 180, -40, 0)
    useSessionStore.getState().setNearby({ kind: 'loot', key: 1, item: 'beef' })
    pickLoot(1)
    pickLoot(2)
    expect(useProgressStore.getState().items.beef).toBe(2)
    expect(useSessionStore.getState().notice?.text).toBe('🥩 소고기 획득 (2개)')
    expect(lootList()).toEqual([])
    expect(useSessionStore.getState().nearby).toBeNull()
  })
  it('이미 주운 번호는 아무 일도 없다', () => {
    pickLoot(9)
    expect(useProgressStore.getState().items.beef).toBe(0)
  })
})
