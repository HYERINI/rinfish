import { describe, expect, it } from 'vitest'
import { MEADOW_REACH, meadowNearbyUpdate, nearestSpot, type MeadowSpot } from './meadowInteract'

const stove: MeadowSpot = { target: { kind: 'stove' }, x: 9, z: -12, reach: MEADOW_REACH.stove }
const mushroom = (index: number, x: number, z: number): MeadowSpot => ({ target: { kind: 'pickup', index, item: 'mushroom' }, x, z, reach: MEADOW_REACH.pickup })

describe('초원 E 대상 고르기', () => {
  it('거리 안에서 가장 가까운 것', () => {
    const spots = [stove, mushroom(0, 10, -12), mushroom(1, 9.5, -12)]
    expect(nearestSpot(9.6, -12, spots)).toEqual({ kind: 'pickup', index: 1, item: 'mushroom' })
    expect(nearestSpot(8.9, -12, spots)).toEqual({ kind: 'stove' })
  })
  it('각자 거리보다 멀거나 딱 그 거리면 없다', () => {
    const at0 = { ...stove, x: 0, z: 0 }
    expect(nearestSpot(MEADOW_REACH.stove, 0, [at0])).toBeNull()
    expect(nearestSpot(MEADOW_REACH.stove - 0.01, 0, [at0])).toEqual({ kind: 'stove' })
  })
  it('쓸 수 없는 것(숨긴 버섯)은 건너뛰고 다음으로 가까운 것', () => {
    const spots = [mushroom(0, 0, 0), mushroom(1, 1, 0)]
    expect(nearestSpot(0.1, 0, spots, (s) => s.target.kind !== 'pickup' || s.target.index !== 0)).toEqual({ kind: 'pickup', index: 1, item: 'mushroom' })
  })
})

describe('초원 감시자가 nearby 를 바꾸는 규칙', () => {
  const shroom = { kind: 'pickup' as const, index: 1, item: 'mushroom' as const }
  it('침대 감지 상자·물가 낚시가 잡은 건 건드리지 않는다 (찾은 게 있어도, 없어도)', () => {
    expect(meadowNearbyUpdate({ kind: 'bed' }, { kind: 'stove' })).toBe('keep')
    expect(meadowNearbyUpdate({ kind: 'bed' }, null)).toBe('keep')
    expect(meadowNearbyUpdate({ kind: 'dock', dir: 'toIsland' }, null)).toBe('keep')
  })
  it('비었거나 내가 잡은 거면 찾은 것으로 바꾸고, 같으면 그대로', () => {
    expect(meadowNearbyUpdate(null, shroom)).toEqual(shroom)
    expect(meadowNearbyUpdate({ kind: 'stove' }, shroom)).toEqual(shroom)
    expect(meadowNearbyUpdate(shroom, { ...shroom })).toBe('keep')
  })
  it('전리품도 감시자 몫: 번호가 다르면 바꾸고, 주워서 없어지면 지운다', () => {
    const beef = { kind: 'loot', key: 3, item: 'beef' } as const
    expect(meadowNearbyUpdate(shroom, beef)).toEqual(beef)
    expect(meadowNearbyUpdate(beef, { ...beef, key: 4 })).toEqual({ ...beef, key: 4 })
    expect(meadowNearbyUpdate(beef, null)).toBe('clear')
    expect(meadowNearbyUpdate({ kind: 'bed' }, beef)).toBe('keep')
  })
  it('못 찾으면 내가 잡은 것만 지운다', () => {
    expect(meadowNearbyUpdate(shroom, null)).toBe('clear')
    expect(meadowNearbyUpdate(null, null)).toBe('keep')
  })
})
