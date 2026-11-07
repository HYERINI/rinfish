import { describe, expect, it } from 'vitest'
import type { NetState } from './netProtocol'
import { pushSample, sampleAt, type Sample } from './interpolate'

const st = (x: number, f = 0, rest = false): NetState => ({
  p: [x, 1, 0], f, v: 2, rest, fish: null, rod: 0.5, rodOn: true, bob: null,
  act: { emote: null, emoteAge: 30, airAge: null, landedAge: 30, eat: null, eatAge: 30 },
})

describe('pushSample', () => {
  it('뒤에 붙이고 max 개만 남긴다. 늦게 도착한 옛 값은 버린다', () => {
    let buf: Sample[] = []
    for (let i = 0; i < 5; i++) buf = pushSample(buf, { at: i, s: st(i) }, 3)
    expect(buf.map((b) => b.at)).toEqual([2, 3, 4])
    expect(pushSample(buf, { at: 3.5, s: st(9) }, 3)).toBe(buf)
  })
})

describe('sampleAt', () => {
  const buf: Sample[] = [{ at: 0, s: st(0, 0) }, { at: 1, s: st(2, 3) }, { at: 2, s: st(4, -3, true) }]

  it('비어 있으면 null, 범위 밖은 끝 값', () => {
    expect(sampleAt([], 1)).toBeNull()
    expect(sampleAt(buf, -5)!.x).toBe(0)
    expect(sampleAt(buf, 99)!.x).toBe(4)
  })

  it('두 값 사이를 선형으로 잇고, 켜고 끄는 값은 앞 값을 쓴다', () => {
    const a = sampleAt(buf, 1.5)!
    expect(a.x).toBeCloseTo(3)
    expect(a.s.rest).toBe(false)
  })

  it('각도는 짧은 쪽으로 돈다 (3 → -3 은 반 바퀴를 거꾸로 돌지 않는다)', () => {
    const a = sampleAt(buf, 1.5)!
    expect(Math.abs(a.f)).toBeGreaterThan(3)
  })

  it('6m 넘게 떨어진 두 값은 잇지 않는다 (순간이동)', () => {
    const jump: Sample[] = [{ at: 0, s: st(0) }, { at: 1, s: st(20) }]
    expect(sampleAt(jump, 0.5)!.x).toBe(0)
    expect(sampleAt(jump, 1)!.x).toBe(20)
  })
})
