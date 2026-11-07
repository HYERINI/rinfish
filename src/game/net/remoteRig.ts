import { NET } from '../data/net'
import { pushSample, type Sample } from '../logic/interpolate'
import { fromNetAct, type NetState } from '../logic/netProtocol'
import { IDLE_ACTION, type PlayerAction } from '../logic/playerMotion'

/** 다른 사람마다 받은 state 버퍼·동작 상태·말풍선. 매 프레임 읽는 값이라 React 상태가 아닌 모듈 객체에 둔다 */
export type RemoteEntry = { buf: Sample[]; action: PlayerAction; bubble: { text: string; at: number } | null }
export const remoteRig = new Map<string, RemoteEntry>()

/** 다른 사람 모습·동작 시각에 쓰는 시계(초). 받은 시각과 그리는 시각이 같은 시계여야 한다 */
export const netNow = () => performance.now() / 1000

const entry = (id: string): RemoteEntry => {
  let e = remoteRig.get(id)
  if (!e) {
    e = { buf: [], action: IDLE_ACTION, bubble: null }
    remoteRig.set(id, e)
  }
  return e
}

export function receiveState(id: string, s: NetState, now: number) {
  const e = entry(id)
  e.buf = pushSample(e.buf, { at: now, s }, NET.bufferSize)
  e.action = fromNetAct(s.act, now, e.action)
}

export function showBubble(id: string, text: string, now: number) {
  entry(id).bubble = { text, at: now }
}

/** 한 사람(또는 모두)을 지운다 */
export function forgetRemote(id?: string) {
  if (id === undefined) remoteRig.clear()
  else remoteRig.delete(id)
}

/** 내 말풍선 (내 머리 위) */
export const selfBubble = { text: '', at: -Infinity }
