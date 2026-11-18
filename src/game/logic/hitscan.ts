import { hitRadius, speciesOf } from '../data/animals'
import { ANIMAL_HIT_HEIGHT, PEER_HIT } from '../data/guns'
import type { AnimalView } from './animalSim'
import type { Rng } from './rng'

/** 3차원 점·방향 (x, y, z) */
export type V3 = { x: number; y: number; z: number }

const dot = (a: V3, b: V3) => a.x * b.x + a.y * b.y + a.z * b.z

/**
 * 산탄·퍼짐: 방향 dir(단위 벡터) 둘레 원뿔(반각 spread) 안에서 n 개 (은지 shoot: 각도 a·반지름 √u·spread, side = dir × 위)
 */
export function pelletDirs(dir: V3, spread: number, n: number, rand: Rng): V3[] {
  // side = dir × (0,1,0), up = side × dir
  let sx = -dir.z
  let sz = dir.x
  const sl = Math.hypot(sx, sz)
  if (sl < 1e-6) {
    sx = 1
    sz = 0
  } else {
    sx /= sl
    sz /= sl
  }
  const ux = -sz * dir.y
  const uy = sz * dir.x - sx * dir.z
  const uz = sx * dir.y
  const out: V3[] = []
  for (let i = 0; i < n; i++) {
    const a = rand() * Math.PI * 2
    const r = Math.sqrt(rand()) * spread
    const x = dir.x + sx * Math.cos(a) * r + ux * Math.sin(a) * r
    const y = dir.y + uy * Math.sin(a) * r
    const z = dir.z + sz * Math.cos(a) * r + uz * Math.sin(a) * r
    const l = Math.hypot(x, y, z)
    out.push({ x: x / l, y: y / l, z: z / l })
  }
  return out
}

/**
 * 광선(o + t·d, d 단위 벡터)이 세운 기둥(가운데 (cx, cz), 반지름 r, 높이 y0..y1)에 처음 닿는 t. near..far 밖이면 null.
 * 옆면과 위·아래 뚜껑을 다 본다
 */
export function rayCylinder(o: V3, d: V3, cx: number, cz: number, r: number, y0: number, y1: number, near: number, far: number): number | null {
  let best: number | null = null
  const consider = (t: number) => {
    if (t >= near && t <= far && (best === null || t < best)) best = t
  }
  const ox = o.x - cx
  const oz = o.z - cz
  const a = d.x * d.x + d.z * d.z
  if (a > 1e-12) {
    const b = ox * d.x + oz * d.z
    const c = ox * ox + oz * oz - r * r
    const disc = b * b - a * c
    if (disc >= 0) {
      const s = Math.sqrt(disc)
      for (const t of [(-b - s) / a, (-b + s) / a]) {
        const y = o.y + t * d.y
        if (y >= y0 && y <= y1) consider(t)
      }
    }
  }
  if (Math.abs(d.y) > 1e-12) {
    for (const yc of [y0, y1]) {
      const t = (yc - o.y) / d.y
      const x = ox + t * d.x
      const z = oz + t * d.z
      if (x * x + z * z <= r * r) consider(t)
    }
  }
  return best
}

/** 광선이 캡슐(선분 a..b 둘레 반지름 r)에 처음 닿는 t. near..far 밖이면 null */
export function rayCapsule(o: V3, d: V3, a: V3, b: V3, r: number, near: number, far: number): number | null {
  // 선분 위 가장 가까운 점까지 거리가 r 이 되는 첫 t 를 촘촘히 찾지 않고, 기둥 + 위아래 공으로 나눠 푼다 (세운 캡슐만 쓴다)
  let best: number | null = null
  const consider = (t: number | null) => {
    if (t !== null && t >= near && t <= far && (best === null || t < best)) best = t
  }
  consider(rayCylinder(o, d, a.x, a.z, r, Math.min(a.y, b.y), Math.max(a.y, b.y), near, far))
  for (const c of [a, b]) consider(raySphere(o, d, c, r, near, far))
  return best
}

/** 광선이 공(가운데 c, 반지름 r)에 처음 닿는 t */
export function raySphere(o: V3, d: V3, c: V3, r: number, near: number, far: number): number | null {
  const m = { x: o.x - c.x, y: o.y - c.y, z: o.z - c.z }
  const b = dot(m, d)
  const cc = dot(m, m) - r * r
  const disc = b * b - cc
  if (disc < 0) return null
  const s = Math.sqrt(disc)
  for (const t of [-b - s, -b + s]) if (t >= near && t <= far) return t
  return null
}

/** 동물 몸 기둥: 판정 원(hitRadius)과 높이 (배율 × 1.5, 최소 0.4). 바닥 y = 0 */
export function animalHeight(a: AnimalView): number {
  return Math.max(ANIMAL_HIT_HEIGHT.min, ANIMAL_HIT_HEIGHT.perScale * speciesOf(a.sp).scale)
}

/** 남의 몸 (p: 몸 가운데 = 캡슐 가운데, 은지 캡슐 반지름 0.32 · 가운데 기둥 1.3) */
export type PeerBody = { id: string; x: number; y: number; z: number }

export type ShotHit = { kind: 'animal'; id: number; t: number } | { kind: 'peer'; id: string; t: number }

/** 광선 하나가 처음 닿는 살아 있는 동물이나 다른 사람 (near..far). 벽·표적은 장면이 따로 본다 */
export function firstBodyHit(o: V3, d: V3, near: number, far: number, animals: readonly AnimalView[], peers: readonly PeerBody[]): ShotHit | null {
  let best: ShotHit | null = null
  for (const a of animals) {
    if (a.pose === 'dead') continue
    const t = rayCylinder(o, d, a.x, a.z, hitRadius(a.sp), 0, animalHeight(a), near, far)
    if (t !== null && (!best || t < best.t)) best = { kind: 'animal', id: a.id, t }
  }
  const half = PEER_HIT.length / 2
  for (const p of peers) {
    const t = rayCapsule(o, d, { x: p.x, y: p.y - half, z: p.z }, { x: p.x, y: p.y + half, z: p.z }, PEER_HIT.radius, near, far)
    if (t !== null && (!best || t < best.t)) best = { kind: 'peer', id: p.id, t }
  }
  return best
}

/** 알마다 맞은 것 → 대상별 맞은 알 수 (산탄총은 한 번에 보낸다: pvpHit n, animalHit n) */
export function countHits<K>(keys: readonly K[]): Map<K, number> {
  const m = new Map<K, number>()
  for (const k of keys) m.set(k, (m.get(k) ?? 0) + 1)
  return m
}
