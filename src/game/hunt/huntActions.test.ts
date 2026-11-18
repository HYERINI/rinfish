// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest'
import { INITIAL_PROGRESS, useProgressStore } from '../stores/progressStore'
import { useSessionStore } from '../stores/sessionStore'
import { lootList, resetAnimalRig, soloHerd, spawnLoot } from './animalRig'
import { pickLoot, shootAnimal } from './huntActions'

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

describe('총으로 사냥 (혼자)', () => {
  it('알마다 은지 피해: 산탄 3알이 소(체력 3)를 쓰러뜨리고 전리품, 권총 한 알은 1', () => {
    // 새 무리는 1번 소(체력 3), 2번 돼지(체력 2)
    shootAnimal(2, 'pistol', 1)
    expect(soloHerd().animals.find((a) => a.id === 2)?.hp).toBe(1)
    shootAnimal(1, 'shotgun', 3)
    expect(soloHerd().animals.find((a) => a.id === 1)?.state).toBe('dead')
    expect(useSessionStore.getState().notice?.text).toContain('사냥 성공')
  })
})
