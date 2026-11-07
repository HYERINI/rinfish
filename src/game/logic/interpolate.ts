import { NET } from '../data/net'
import { shortestAngleDelta } from './cameraYaw'
import type { NetState } from './netProtocol'

/** 받은 state 와 받은 시각(초, 받은 쪽 시계) */
export type Sample = { at: number; s: NetState }
/** 그릴 자리: 위치·각도·속도는 이어 그린 값, 나머지(켜고 끄는 값)는 앞 state 그대로 */
export type Sampled = { x: number; y: number; z: number; f: number; v: number; s: NetState }

/** 버퍼 뒤에 붙인다. 이미 있는 것보다 옛것이면 그대로 두고, max 개만 남긴다 */
export function pushSample(buf: Sample[], sample: Sample, max: number): Sample[] {
  const last = buf[buf.length - 1]
  if (last && sample.at <= last.at) return buf
  const next = [...buf, sample]
  return next.length > max ? next.slice(next.length - max) : next
}

const at = (s: Sample): Sampled => ({ x: s.s.p[0], y: s.s.p[1], z: s.s.p[2], f: s.s.f, v: s.s.v, s: s.s })

/** 시각 t 의 모습. 버퍼 앞보다 이르면 첫 값, 뒤보다 늦으면 마지막 값 (앞질러 짐작하지 않는다) */
export function sampleAt(buf: Sample[], t: number): Sampled | null {
  if (buf.length === 0) return null
  if (t <= buf[0].at) return at(buf[0])
  const last = buf[buf.length - 1]
  if (t >= last.at) return at(last)
  let i = 0
  while (buf[i + 1].at <= t) i++
  const a = buf[i]
  const b = buf[i + 1]
  const [ax, ay, az] = a.s.p
  const [bx, by, bz] = b.s.p
  // 멀리 순간이동했으면(쓰러져 진료소로 등) 섬을 가로질러 미끄러지지 않게 잇지 않는다
  if (Math.hypot(bx - ax, by - ay, bz - az) > NET.snapDistance) return at(a)
  const k = (t - a.at) / (b.at - a.at)
  return {
    x: ax + (bx - ax) * k,
    y: ay + (by - ay) * k,
    z: az + (bz - az) * k,
    f: a.s.f + shortestAngleDelta(a.s.f, b.s.f) * k,
    v: a.s.v + (b.s.v - a.s.v) * k,
    s: a.s,
  }
}
