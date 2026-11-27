import { NET } from '../data/net'
import type { PeerBody } from '../logic/hitscan'
import { pushSample, sampleAt, type Sample } from '../logic/interpolate'
import { resetNetStats } from './netStats'
import { fromNetAct, type NetState } from '../logic/netProtocol'
import { IDLE_ACTION, type PlayerAction } from '../logic/playerMotion'

/**
 * 다른 사람마다 받은 state 버퍼·동작 상태·말풍선. 매 프레임 읽는 값이라 React 상태가 아닌 모듈 객체에 둔다.
 * gap: 그 사람 state 가 오는 평균 간격(초, 움직이는 동안. 아직 모르면 null), delay: 그 사람을 지금 얼마나 늦게 그리나(초)
 */
export type RemoteEntry = { buf: Sample[]; action: PlayerAction; bubble: { text: string; at: number } | null; gap: number | null; delay: number }
export const remoteRig = new Map<string, RemoteEntry>()

/** 다른 사람 모습·동작 시각에 쓰는 시계(초). 받은 시각과 그리는 시각이 같은 시계여야 한다 */
export const netNow = () => performance.now() / 1000

const entry = (id: string): RemoteEntry => {
  let e = remoteRig.get(id)
  if (!e) {
    e = { buf: [], action: IDLE_ACTION, bubble: null, gap: null, delay: NET.interpDelay }
    remoteRig.set(id, e)
  }
  return e
}

/**
 * 늦게 그리는 시간 고치기: state 가 오는 간격 + 여유(NET.interpPad)를 향해 천천히(NET.interpShift) 옮긴다.
 * 자주 보내는 사람일수록 덜 늦게 그린다 (옛 화면은 0.2초, 새 화면은 0.05~0.13초 간격으로 보낸다). dt: 앞 state 뒤 지난 시간
 */
export function nextDelay(e: Pick<RemoteEntry, 'gap' | 'delay'>, dt: number): { gap: number | null; delay: number } {
  // 멈춰 있다 온 것(2초마다)이나 처음 것은 간격으로 치지 않는다
  if (!(dt > 0) || dt > NET.interpGapMax) return { gap: e.gap, delay: e.delay }
  const gap = e.gap === null ? dt : e.gap + (dt - e.gap) * 0.2
  const want = Math.min(NET.interpDelay, Math.max(NET.interpMin, gap + NET.interpPad))
  const step = NET.interpShift * dt
  return { gap, delay: e.delay + Math.min(step, Math.max(-step, want - e.delay)) }
}

export function receiveState(id: string, s: NetState, now: number) {
  const e = entry(id)
  const last = e.buf[e.buf.length - 1]
  if (last) Object.assign(e, nextDelay(e, now - last.at))
  e.buf = pushSample(e.buf, { at: now, s }, NET.bufferSize)
  e.action = fromNetAct(s.act, now, e.action)
}

export function showBubble(id: string, text: string, now: number) {
  entry(id).bubble = { text, at: now }
}

/** 한 사람(또는 모두)을 지운다 */
export function forgetRemote(id?: string) {
  if (id === undefined) {
    remoteRig.clear()
    // 모두 지울 때는 연결이 끊겼거나 새로 붙은 때다: 왕복 시간도 새로 잰다
    resetNetStats()
  } else remoteRig.delete(id)
}

/** 한 사람을 지금 그릴 모습 (그 사람 몫만큼 늦게, 조금은 앞질러). 그리기와 판정이 같은 자리를 쓴다 */
export function remoteView(e: RemoteEntry, now: number) {
  return sampleAt(e.buf, now - e.delay, NET.extrapolateMax)
}

/** 다른 사람 몸 (총·주먹 판정): 내 화면에 그리는 그 시점 자리. now: netNow 초 */
export function peerBodies(now: number): PeerBody[] {
  const out: PeerBody[] = []
  for (const [id, e] of remoteRig) {
    const c = remoteView(e, now)
    if (c) out.push({ id, x: c.x, y: c.y, z: c.z })
  }
  return out
}

/** 내 말풍선 (내 머리 위) */
export const selfBubble = { text: '', at: -Infinity }
