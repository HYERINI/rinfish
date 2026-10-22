import type { Vec2 } from '../data/decor'
import { DOCK_DECK, ISLAND_VISITOR, VISITOR_ACT_WEIGHTS, VISITOR_HUB, VISITOR_ROUTES } from '../data/aquariumVisitors'
import { lerpRange } from './rng'
import { phaseAt, type Segment } from './timeline'

/**
 * 섬 어항 구경꾼 일정·움직임 (순수 계산).
 * 구경꾼 자리(lane) i 는 늘 i 번째 구경 자리를 쓰고, period 초마다 손님 한 명이 [오기 → 구경 → 나가기 → 빈 시간] 을 돈다.
 * 몇 번째 손님인지(visit)와 seed 로 길·빠르기·동작을 정하므로 같은 시각이면 늘 같은 모습이다 (Math.random 없음)
 */

export type VisitorPhase = 'away' | 'arrive' | 'watch' | 'leave'
export type VisitorAct = 'look' | 'nod' | 'point' | 'photo'

export type VisitorPose = {
  /** 보이는가 (빈 시간에는 숨긴다) */
  visible: boolean
  phase: VisitorPhase
  /** 세계 좌표 */
  x: number
  y: number
  z: number
  /** 바라보는 방향 (0 = +z, three 의 rotation.y) */
  heading: number
  /** 구경 중 동작 (걸을 때는 look) */
  act: VisitorAct
  /** 지금 동작이 시작되고 지난 초 */
  actAt: number
  /** 사진 찍을 때 번쩍이는 하얀 빛 세기 0~1 */
  flash: number
  /** 걷는 빠르기(m/s). 서 있으면 0 */
  speed: number
  /** 몇 번째 손님인지 (바뀌면 새 손님) */
  visit: number
}

/** 어항 앞 구경 자리 (어항 가운데 기준 좌표). via 가 있으면 모이는 곳에서 via 를 거쳐 들어간다 (어항 모서리를 돌아간다) */
export type ViewingSlot = { at: Vec2; facing: number; via?: Vec2 }

/** 0 이상 1 미만의 고정된 값. 같은 (seed, a, b, c) 면 늘 같다 (정수 해시) */
export function hash01(seed: number, a: number, b = 0, c = 0): number {
  let h = Math.imul(seed | 0, 0x9e3779b1) ^ Math.imul(a + 1, 0x85ebca6b) ^ Math.imul(b + 7, 0xc2b2ae35) ^ Math.imul(c + 13, 0x27d4eb2f)
  h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d)
  h = Math.imul(h ^ (h >>> 12), 0x297a2d39)
  return ((h ^ (h >>> 15)) >>> 0) / 4294967296
}

/** 분당 입장료로 정한 동시에 있을 구경꾼 수. 입장료가 없어도 minVisitors 명은 가끔 들른다 */
export function visitorCount(perMinute: number): number {
  const byIncome = Math.ceil(Math.max(0, perMinute) / ISLAND_VISITOR.incomePerVisitor)
  return Math.min(ISLAND_VISITOR.max, Math.max(ISLAND_VISITOR.minVisitors, byIncome))
}

/** (x, z) 에서 (tx, tz) 를 바라보는 방향 */
const headingTo = (x: number, z: number, tx: number, tz: number) => Math.atan2(tx - x, tz - z)

/**
 * 어항 크기 [가로, 높이, 세로] 에 맞춘 구경 자리 6개 (어항 가운데 기준, 앞 = +z).
 * 0·1: 앞 안쪽, 2·3: 앞 모서리, 4·5: 옆. 상호작용하러 오는 플레이어 자리(앞 한가운데)는 비운다
 */
export function viewingSlots(size: [number, number, number]): ViewingSlot[] {
  const [w, , d] = size
  // 받침대는 수조보다 0.15 씩 넓다
  const halfW = w / 2 + 0.15
  const halfD = d / 2 + 0.15
  const frontZ = halfD + ISLAND_VISITOR.frontGap
  const cornerX = halfW + 0.55
  const sideX = halfW + ISLAND_VISITOR.sideGap
  const front = (x: number, z: number): ViewingSlot => ({ at: [x, z], facing: headingTo(x, z, x * 0.4, 0) })
  return [
    front(-w * 0.28, frontZ),
    front(w * 0.28, frontZ),
    front(-cornerX, frontZ - 0.15),
    front(cornerX, frontZ - 0.15),
    { at: [-sideX, 0], facing: Math.PI / 2, via: [-sideX, frontZ] },
    { at: [sideX, -0.1], facing: -Math.PI / 2, via: [sideX, frontZ] },
  ]
}

/** 꺾은선 길이 */
export function routeLength(points: Vec2[]): number {
  let sum = 0
  for (let i = 1; i < points.length; i++) sum += Math.hypot(points[i][0] - points[i - 1][0], points[i][1] - points[i - 1][1])
  return sum
}

/** 꺾은선을 따라 dist 만큼 간 자리와 그때 향하는 방향. 길이를 넘으면 끝점 (방향은 마지막 구간) */
export function pointAlong(points: Vec2[], dist: number): { x: number; z: number; heading: number } {
  let left = Math.max(0, dist)
  for (let i = 1; i < points.length; i++) {
    const [ax, az] = points[i - 1]
    const [bx, bz] = points[i]
    const len = Math.hypot(bx - ax, bz - az)
    if (len === 0) continue
    const heading = Math.atan2(bx - ax, bz - az)
    if (left <= len || i === points.length - 1) {
      const k = Math.min(1, left / len)
      return { x: ax + (bx - ax) * k, z: az + (bz - az) * k, heading }
    }
    left -= len
  }
  const [x, z] = points[points.length - 1] ?? [0, 0]
  return { x, z, heading: 0 }
}

/** 한 손님의 계획: 들어오는 길·나가는 길(세계 좌표)·빠르기·구경 시간·동작 */
export type VisitPlan = {
  inPath: Vec2[]
  outPath: Vec2[]
  speed: number
  walkIn: number
  watch: number
  walkOut: number
  gap: number
  acts: Segment<VisitorAct>[]
}

/** lane 의 한 바퀴 길이(초) */
export const lanePeriod = (lane: number) => ISLAND_VISITOR.period + lane * ISLAND_VISITOR.periodStep

/** 무게대로 하나 고른다 (r: 0~1) */
function pickAct(r: number, allowPhoto: boolean): VisitorAct {
  const entries = (Object.entries(VISITOR_ACT_WEIGHTS) as [VisitorAct, number][]).filter(([a]) => allowPhoto || a !== 'photo')
  const total = entries.reduce((s, [, w]) => s + w, 0)
  let acc = 0
  for (const [act, w] of entries) {
    acc += w / total
    if (r < acc) return act
  }
  return entries[entries.length - 1][0]
}

/**
 * lane 의 visit 번째 손님 계획. center: 어항 가운데(세계 좌표), size: 어항 크기.
 * 들어오는 길과 나가는 길은 서로 다른 길을 고른다
 */
export function visitPlan(seed: number, lane: number, visit: number, center: Vec2, size: [number, number, number]): VisitPlan {
  const slots = viewingSlots(size)
  const slot = slots[lane % slots.length]
  const [cx, cz] = center
  const toWorld = ([x, z]: Vec2): Vec2 => [cx + x, cz + z]
  const n = VISITOR_ROUTES.length
  const inIndex = Math.floor(hash01(seed, lane, visit, 1) * n)
  const outIndex = (inIndex + 1 + Math.floor(hash01(seed, lane, visit, 2) * (n - 1))) % n
  const near = [VISITOR_HUB, ...(slot.via ? [toWorld(slot.via)] : []), toWorld(slot.at)]
  const inPath = [...VISITOR_ROUTES[inIndex].points, ...near]
  const outPath = [...near.slice().reverse(), ...VISITOR_ROUTES[outIndex].points.slice().reverse()]
  const speed = lerpRange(ISLAND_VISITOR.walkSpeed, hash01(seed, lane, visit, 3))
  const walkIn = routeLength(inPath) / speed
  const walkOut = routeLength(outPath) / speed
  const rest = lanePeriod(lane) - walkIn - walkOut
  const watch = Math.max(ISLAND_VISITOR.minWatch, rest * lerpRange(ISLAND_VISITOR.watchShare, hash01(seed, lane, visit, 4)))
  const gap = Math.max(0, rest - watch)
  // 구경 동작: 처음엔 가만히 보고, 그다음부터 무게대로 고른다. 사진은 한 번만
  const count = Math.max(1, Math.floor(watch / ISLAND_VISITOR.actSeconds))
  const each = watch / count
  const acts: Segment<VisitorAct>[] = []
  let tookPhoto = false
  for (let j = 0; j < count; j++) {
    const act = j === 0 ? 'look' : pickAct(hash01(seed, lane, visit, 10 + j), !tookPhoto)
    if (act === 'photo') tookPhoto = true
    acts.push([act, each])
  }
  return { inPath, outPath, speed, walkIn, watch, walkOut, gap, acts }
}

/** 바닥 높이 (선착장 위면 나무 바닥만큼 올라선다) */
export function groundY(x: number, z: number): number {
  const d = DOCK_DECK
  return x >= d.x0 && x <= d.x1 && z >= d.z0 && z <= d.z1 ? d.y : 0
}

/**
 * 시각 time 에 lane 구경꾼의 모습. 손님마다 lane 의 한 바퀴를 [오기, 구경, 나가기, 빈 시간] 순서로 쓴다.
 * lane 마다 시작 시점을 seed 로 어긋나게 해서 한꺼번에 몰려오지 않는다
 */
export function visitorPose(seed: number, lane: number, time: number, center: Vec2, size: [number, number, number]): VisitorPose {
  const period = lanePeriod(lane)
  const shifted = time + hash01(seed, lane) * period
  const visit = Math.floor(shifted / period)
  const t = shifted - visit * period
  const plan = visitPlan(seed, lane, visit, center, size)
  const slots = viewingSlots(size)
  const slot = slots[lane % slots.length]
  const base = { act: 'look' as VisitorAct, actAt: 0, flash: 0, speed: 0, visit }

  const at = (p: { x: number; z: number; heading: number }, phase: VisitorPhase): VisitorPose => ({
    ...base,
    visible: true,
    phase,
    x: p.x,
    y: groundY(p.x, p.z),
    z: p.z,
    heading: p.heading,
    speed: plan.speed,
  })

  if (t < plan.walkIn) return at(pointAlong(plan.inPath, t * plan.speed), 'arrive')
  if (t < plan.walkIn + plan.watch) {
    const { phase, at: actAt } = phaseAt(plan.acts, t - plan.walkIn)
    const act = phase === 'end' ? 'look' : phase
    const x = center[0] + slot.at[0]
    const z = center[1] + slot.at[1]
    const since = actAt - ISLAND_VISITOR.flashAt
    const flash = act === 'photo' && since >= 0 && since < ISLAND_VISITOR.flashSeconds ? 1 - since / ISLAND_VISITOR.flashSeconds : 0
    return { ...base, visible: true, phase: 'watch', x, y: groundY(x, z), z, heading: slot.facing, act, actAt, flash }
  }
  const out = t - plan.walkIn - plan.watch
  if (out < plan.walkOut) return at(pointAlong(plan.outPath, out * plan.speed), 'leave')
  const [ex, ez] = plan.outPath[plan.outPath.length - 1]
  return { ...base, visible: false, phase: 'away', x: ex, y: groundY(ex, ez), z: ez, heading: 0 }
}
