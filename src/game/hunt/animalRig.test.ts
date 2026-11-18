import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NET } from '../data/net'
import type { AnimalView } from '../logic/animalSim'
import { animalViews, forgetRoomAnimals, lootList, receiveAnimals, receiveHurt, resetAnimalRig, setHurtHandler, soloHerd, spawnLoot, takeLoot } from './animalRig'

const cow = (x: number): AnimalView => ({ id: 1, sp: 'cow', x, z: -40, h: 0, pose: 'walk', hp: 3 })

beforeEach(() => resetAnimalRig())

describe('animalRig', () => {
  it('혼자: 처음 쓸 때 무리 12마리를 만들고 그 값을 그린다', () => {
    expect(animalViews(false, 0)).toEqual([])
    soloHerd()
    expect(animalViews(false, 0)).toHaveLength(12)
  })
  it('같이: 받은 목록을 NET.interpDelay 늦게 이어 그리고, 방을 나오면 지운다', () => {
    receiveAnimals([cow(180)], 10)
    receiveAnimals([cow(181)], 10.2)
    expect(animalViews(true, 10.1 + NET.interpDelay)[0].x).toBeCloseTo(180.5)
    forgetRoomAnimals()
    expect(animalViews(true, 11)).toEqual([])
  })
  it('전리품은 번호를 붙여 쌓고, 주우면 빠진다 (두 번 주울 수 없다)', () => {
    spawnLoot(['beef', 'bone'], 180, -40, 5)
    spawnLoot(['egg'], 170, -30, 6)
    expect(lootList().map((l) => [l.key, l.item])).toEqual([[1, 'beef'], [2, 'bone'], [3, 'egg']])
    expect(takeLoot(2)?.item).toBe('bone')
    expect(takeLoot(2)).toBeNull()
    expect(lootList().map((l) => l.key)).toEqual([1, 3])
  })
  it('hurt 는 붙여 둔 처리기로 간다 (없으면 아무 일도 없다)', () => {
    receiveHurt(5)
    const f = vi.fn()
    setHurtHandler(f)
    receiveHurt(15)
    expect(f).toHaveBeenCalledWith(15)
  })
})
