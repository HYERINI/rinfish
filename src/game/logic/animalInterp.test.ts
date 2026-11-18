import { describe, expect, it } from 'vitest'
import type { AnimalView } from './animalSim'
import { herdAt, pushHerd, type HerdSample } from './animalInterp'

const cow = (x: number, over: Partial<AnimalView> = {}): AnimalView => ({ id: 1, sp: 'cow', x, z: -40, h: 0, pose: 'walk', hp: 3, ...over })

describe('pushHerd', () => {
  it('뒤에 붙이고 max 개만 남긴다. 늦게 도착한 옛 목록은 버린다', () => {
    let buf: HerdSample[] = []
    for (let i = 0; i < 5; i++) buf = pushHerd(buf, { at: i, list: [cow(i)] }, 3)
    expect(buf.map((b) => b.at)).toEqual([2, 3, 4])
    expect(pushHerd(buf, { at: 3.5, list: [] }, 3)).toBe(buf)
  })
})

describe('herdAt', () => {
  const buf: HerdSample[] = [
    { at: 0, list: [cow(180, { h: 3 }), { ...cow(170), id: 2 }] },
    { at: 0.2, list: [cow(181, { h: -3, pose: 'dead', hp: 0 })] },
  ]
  it('비어 있으면 빈 목록, 범위 밖은 끝 목록', () => {
    expect(herdAt([], 1)).toEqual([])
    expect(herdAt(buf, -1)).toBe(buf[0].list)
    expect(herdAt(buf, 9)).toBe(buf[1].list)
  })
  it('두 목록 사이 위치는 선형, 방향은 짧은 쪽으로 돌고, 동작·체력은 앞 값', () => {
    const [a] = herdAt(buf, 0.1)
    expect(a.x).toBeCloseTo(180.5)
    expect(Math.abs(a.h)).toBeGreaterThan(3)
    expect([a.pose, a.hp]).toEqual(['walk', 3])
  })
  it('뒤 목록에 없는 동물(사라짐)은 앞 값 그대로, 너무 멀리 뛴 것도 잇지 않는다', () => {
    expect(herdAt(buf, 0.1)[1]).toEqual({ ...cow(170), id: 2 })
    const jump: HerdSample[] = [{ at: 0, list: [cow(180)] }, { at: 0.2, list: [cow(190)] }]
    expect(herdAt(jump, 0.1)[0].x).toBe(180)
  })
})
