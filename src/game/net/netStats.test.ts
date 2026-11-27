import { beforeEach, describe, expect, it } from 'vitest'
import { NET } from '../data/net'
import { moveLatency, netStats, receivePong, resetNetStats, sendRate } from './netStats'
import { nextDelay } from './remoteRig'

beforeEach(() => resetNetStats())

describe('왕복 시간 재기', () => {
  it('pong 을 받기 전엔 모르고 느린 빠르기로 보낸다 (옛 서버는 답하지 않는다)', () => {
    expect(netStats.rtt).toBeNull()
    expect(sendRate()).toBe(NET.sendHz)
    expect(moveLatency(0.1)).toBeNull()
  })
  it('pong 을 받으면 왕복 시간을 알고 빠르게 보낸다. 값은 고르게 따라간다', () => {
    receivePong(10, 10.04)
    expect(netStats.rtt).toBeCloseTo(0.04)
    expect(sendRate()).toBe(NET.fastSendHz)
    receivePong(12, 12.14)
    // 0.04 에서 0.14 쪽으로 30% 만
    expect(netStats.rtt).toBeCloseTo(0.07)
  })
  it('터무니없는 답(시계가 뒤로, 10초 넘게)은 버린다', () => {
    receivePong(10, 9)
    receivePong(10, 25)
    expect(netStats.rtt).toBeNull()
    expect(sendRate()).toBe(NET.sendHz)
  })
  it('움직임 지연 어림 = 보내기 반 간격 + 왕복 시간 + 늦게 그리는 시간', () => {
    receivePong(0, 0.04)
    expect(moveLatency(0.07)).toBeCloseTo(0.5 / NET.fastSendHz + 0.04 + 0.07)
  })
})

describe('늦게 그리는 시간 (nextDelay)', () => {
  /** 같은 간격으로 n 번 받은 뒤 */
  const after = (dt: number, n: number, from = { gap: null as number | null, delay: NET.interpDelay }) => {
    let e = from
    for (let i = 0; i < n; i++) e = nextDelay(e, dt)
    return e
  }
  it('처음엔 가장 늦게(0.25초) 그린다', () => {
    expect(after(0.05, 0).delay).toBe(NET.interpDelay)
  })
  it('자주 오면(0.05초) 간격 + 여유까지 천천히 줄인다. 한 번에 튀지 않는다', () => {
    const one = nextDelay({ gap: null, delay: NET.interpDelay }, 0.05)
    expect(NET.interpDelay - one.delay).toBeCloseTo(NET.interpShift * 0.05)
    expect(after(0.05, 400).delay).toBeCloseTo(0.05 + NET.interpPad)
  })
  it('아무리 자주 와도 interpMin 보다 덜 늦게 그리지 않는다', () => {
    expect(after(0.01, 2000).delay).toBeCloseTo(NET.interpMin)
  })
  it('옛 화면(0.2초 간격)은 예전처럼 0.22초쯤, 그보다 느리면 0.25초까지', () => {
    expect(after(0.2, 200).delay).toBeCloseTo(0.22)
    expect(after(0.4, 200).delay).toBeCloseTo(NET.interpDelay)
  })
  it('멈춰 있다 온 것(2초마다)은 간격으로 치지 않는다', () => {
    const fast = after(0.05, 400)
    expect(nextDelay(fast, 2)).toEqual(fast)
    expect(nextDelay(fast, 0)).toEqual(fast)
  })
})
