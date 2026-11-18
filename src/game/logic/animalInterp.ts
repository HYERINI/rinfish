import { NET } from '../data/net'
import type { AnimalView } from './animalSim'
import { shortestAngleDelta } from './cameraYaw'

/** 받은 동물 목록과 받은 시각(초, 받은 쪽 시계) */
export type HerdSample = { at: number; list: AnimalView[] }

/** 버퍼 뒤에 붙인다. 이미 있는 것보다 옛것이면 그대로 두고, max 개만 남긴다 */
export function pushHerd(buf: HerdSample[], sample: HerdSample, max: number): HerdSample[] {
  const last = buf[buf.length - 1]
  if (last && sample.at <= last.at) return buf
  const next = [...buf, sample]
  return next.length > max ? next.slice(next.length - max) : next
}

/**
 * 시각 t 의 동물들 (다른 사람처럼 받은 두 목록 사이를 잇는다). 앞 목록에 있는 동물만 그린다:
 * 위치·방향은 뒤 목록의 같은 번호 쪽으로 잇고, 동작·체력은 앞 값. 뒤에 없거나(사라짐) 너무 멀면 앞 값 그대로.
 * 버퍼 앞보다 이르면 첫 목록, 뒤보다 늦으면 마지막 목록 (앞질러 짐작하지 않는다)
 */
export function herdAt(buf: readonly HerdSample[], t: number): AnimalView[] {
  if (buf.length === 0) return []
  if (t <= buf[0].at) return buf[0].list
  const last = buf[buf.length - 1]
  if (t >= last.at) return last.list
  let i = 0
  while (buf[i + 1].at <= t) i++
  const a = buf[i]
  const b = buf[i + 1]
  const k = (t - a.at) / (b.at - a.at)
  const next = new Map(b.list.map((v) => [v.id, v]))
  return a.list.map((v) => {
    const w = next.get(v.id)
    if (!w || Math.hypot(w.x - v.x, w.z - v.z) > NET.snapDistance) return v
    return { ...v, x: v.x + (w.x - v.x) * k, z: v.z + (w.z - v.z) * k, h: v.h + shortestAngleDelta(v.h, w.h) * k }
  })
}
