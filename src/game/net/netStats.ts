import { NET } from '../data/net'

/**
 * 통신 지연 재기 (매 프레임 읽는 값이라 모듈 객체에 둔다).
 * rtt: 서버까지 왕복 시간(초, 고르게 한 값. 아직 못 쟀으면 null), fast: 서버가 ping 에 답했다 = 새 서버라 모습을 더 자주 보내도 된다
 */
export const netStats: { rtt: number | null; fast: boolean } = { rtt: null, fast: false }

export function resetNetStats() {
  netStats.rtt = null
  netStats.fast = false
}

/** pong 을 받았다. sentAt·now: ping 을 보낸 때와 지금 (같은 시계, 초) */
export function receivePong(sentAt: number, now: number) {
  const rtt = now - sentAt
  // 시계가 뒤로 갔거나 터무니없이 늦은 답은 버린다
  if (!(rtt >= 0) || rtt > 10) return
  netStats.rtt = netStats.rtt === null ? rtt : netStats.rtt + (rtt - netStats.rtt) * 0.3
  netStats.fast = true
}

/** 지금 내 모습을 보내는 빠르기 (초당) */
export const sendRate = () => (netStats.fast ? NET.fastSendHz : NET.sendHz)

/**
 * 다른 사람 움직임이 내 화면에 보이기까지 걸리는 시간 어림(초): 보내기를 기다린 시간(평균 반 간격) + 통신(왕복 시간으로 어림) + 늦게 그리는 시간.
 * 상대도 나와 같은 빠르기로 보내고 통신도 비슷하다고 친다. 왕복 시간을 모르면 null
 */
export function moveLatency(drawDelay: number): number | null {
  return netStats.rtt === null ? null : 0.5 / sendRate() + netStats.rtt + drawDelay
}
