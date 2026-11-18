import { describe, expect, it } from 'vitest'
import type { AnimalView } from './animalSim'
import { MELEE_IDLE, canSwing, hitDue, meleePeer, meleeTarget, startSwing, swingProgress } from './melee'
import { IDLE_ACTION } from './playerMotion'

const at = (id: number, x: number, z: number, over: Partial<AnimalView> = {}): AnimalView => ({ id, sp: 'cow', x, z, h: 0, pose: 'idle', hp: 3, ...over })

describe('휘두르기 시간', () => {
  it('은지 간격: 칼 베기 뒤 60/110초 안엔 또 휘두를 수 없다', () => {
    const s = startSwing(MELEE_IDLE, 'knife', 10)!
    expect(s.swing).toEqual({ kind: 'knife', startedAt: 10, hitDone: false })
    expect(startSwing(s, 'knife', 10.5)).toBeNull()
    expect(startSwing(s, 'stab', 10 + 60 / 110)).not.toBeNull()
  })
  it('맞는 순간(동작 시간 × hitAt) 이 지나야 판정, 한 번만', () => {
    const sw = startSwing(MELEE_IDLE, 'stab', 0)!.swing!
    expect(hitDue(sw, 0.28)).toBe(false)
    expect(hitDue(sw, 0.29)).toBe(true)
    expect(hitDue({ ...sw, hitDone: true }, 0.3)).toBe(false)
    expect(hitDue(null, 1)).toBe(false)
  })
  it('진행도는 0..1, 끝나면 -1', () => {
    const sw = startSwing(MELEE_IDLE, 'fists', 0)!.swing!
    expect(swingProgress(sw, 0.19)).toBeCloseTo(0.5)
    expect(swingProgress(sw, 0.38)).toBe(-1)
    expect(swingProgress(null, 0)).toBe(-1)
  })
})

describe('meleeTarget', () => {
  it('앞쪽 사거리 안 판정 원에 닿는 가장 가까운 동물', () => {
    // +z 쪽을 본다. 소 판정 원 0.52
    expect(meleeTarget(0, 0, 0, 1, 1.8, [at(1, 0, 2), at(2, 0.3, 1.5)])).toEqual({ id: 2, dist: expect.closeTo(1.5 - Math.sqrt(0.52 ** 2 - 0.09), 5) })
  })
  it('사거리 + 반지름보다 멀거나, 옆으로 비껴가거나, 뒤에 있거나, 쓰러진 동물은 안 맞는다', () => {
    expect(meleeTarget(0, 0, 0, 1, 1.3, [at(1, 0, 1.9)])).toBeNull()
    expect(meleeTarget(0, 0, 0, 1, 1.8, [at(1, 0.6, 1)])).toBeNull()
    expect(meleeTarget(0, 0, 0, 1, 1.8, [at(1, 0, -1)])).toBeNull()
    expect(meleeTarget(0, 0, 0, 1, 1.8, [at(1, 0, 1, { pose: 'dead', hp: 0 })])).toBeNull()
  })
  it('원 안에 서 있으면 거리 0, 병아리도 0.35 원으로 맞는다', () => {
    expect(meleeTarget(0, 0, 1, 0, 1.3, [at(1, 0.2, 0)])).toEqual({ id: 1, dist: 0 })
    expect(meleeTarget(0, 0, 1, 0, 1.3, [at(5, 1.4, 0.3, { sp: 'chick' })])?.id).toBe(5)
  })
})

describe('canSwing', () => {
  it('탐험 중 땅에 서 있을 때만: 먹기·감정 표현·점프 중이나 공중이면 휘두르지 않는다', () => {
    expect(canSwing('explore', IDLE_ACTION, true)).toBe(true)
    expect(canSwing('fishing', IDLE_ACTION, true)).toBe(false)
    expect(canSwing('explore', { ...IDLE_ACTION, eat: 'apple' as never }, true)).toBe(false)
    expect(canSwing('explore', { ...IDLE_ACTION, emote: 'wave' as never }, true)).toBe(false)
    expect(canSwing('explore', { ...IDLE_ACTION, airborne: true }, true)).toBe(false)
    expect(canSwing('explore', IDLE_ACTION, false)).toBe(false)
  })
})

describe('다른 사람 근접 판정 (3-4 PvP)', () => {
  it('바닥 선분이 몸 원(반지름 0.32)에 처음 닿는 사람. 사거리 밖·뒤쪽은 아니다', () => {
    const peers = [
      { id: 'far', x: 0, y: 1, z: -3 },
      { id: 'near', x: 0.2, y: 1, z: -1.5 },
      { id: 'behind', x: 0, y: 1, z: 1 },
    ]
    expect(meleePeer(0, 0, 0, -1, 1.8, peers)).toEqual({ id: 'near', dist: expect.closeTo(1.5 - Math.sqrt(0.32 ** 2 - 0.04)) })
    expect(meleePeer(0, 0, 0, -1, 1.0, peers)).toBeNull()
    expect(meleePeer(0, 0, 0, 1, 1.0, peers)).toEqual({ id: 'behind', dist: expect.closeTo(0.68) })
  })
})
