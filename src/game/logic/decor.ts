import {
  CAVE_ROCK,
  CLEARANCE,
  DECOR_MAX_RADIUS,
  FACILITY_RECTS,
  FOREST_AREA,
  GATE_RECTS,
  PATHS,
  ROCKY_AREA,
  SAND,
  SPAWN_AT,
  SPOT_CLEARANCE,
  WATER_POOLS,
  type Rect,
  type Vec2,
} from '../data/decor'
import { FENCE_Z } from '../data/zones'
import type { Rng } from './rng'

/** 씨앗이 같으면 늘 같은 수열을 주는 난수 (mulberry32) */
export function seededRng(seed: number): Rng {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** 격자 꼭짓점마다 정해진 0~1 값 */
function hash2(ix: number, iz: number): number {
  let h = Math.imul(ix, 374761393) + Math.imul(iz, 668265263)
  h = Math.imul(h ^ (h >>> 13), 1274126177)
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296
}

/** 부드러운 값 노이즈 (0~1). scale 이 클수록 무늬가 크다 */
export function valueNoise(x: number, z: number, scale: number): number {
  const fx = x / scale
  const fz = z / scale
  const ix = Math.floor(fx)
  const iz = Math.floor(fz)
  const tx = smooth(fx - ix)
  const tz = smooth(fz - iz)
  const a = hash2(ix, iz)
  const b = hash2(ix + 1, iz)
  const c = hash2(ix, iz + 1)
  const d = hash2(ix + 1, iz + 1)
  return a + (b - a) * tx + (c - a) * tz + (a - b - c + d) * tx * tz
}

function smooth(t: number): number {
  return t * t * (3 - 2 * t)
}

export function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)))
  return smooth(t)
}

/** 점에서 선분까지 거리 */
function segmentDistance(px: number, pz: number, [ax, az]: Vec2, [bx, bz]: Vec2): number {
  const dx = bx - ax
  const dz = bz - az
  const len2 = dx * dx + dz * dz
  const t = len2 > 0 ? Math.min(1, Math.max(0, ((px - ax) * dx + (pz - az) * dz) / len2)) : 0
  return Math.hypot(px - (ax + dx * t), pz - (az + dz * t))
}

/** 가장 가까운 흙길 가장자리까지 거리 (길 안이면 음수) */
export function pathEdgeDistance(x: number, z: number): number {
  let best = Infinity
  for (const path of PATHS) {
    for (let i = 0; i + 1 < path.points.length; i++) {
      best = Math.min(best, segmentDistance(x, z, path.points[i], path.points[i + 1]) - path.halfWidth)
    }
  }
  return best
}

function inRect(x: number, z: number, r: Rect, margin: number): boolean {
  return x >= r.x0 - margin && x <= r.x1 + margin && z >= r.z0 - margin && z <= r.z1 + margin
}

/** 가장 가까운 물웅덩이 가장자리까지 거리 (물 안이면 음수) */
export function waterEdgeDistance(x: number, z: number): number {
  let best = Infinity
  for (const pool of WATER_POOLS) best = Math.min(best, Math.hypot(x - pool.center[0], z - pool.center[1]) - pool.radius)
  return best
}

/** 바닥 종류 비율. 바닥 색과 풀·꽃을 놓을 자리를 정할 때 함께 쓴다 */
export type GroundMix = {
  /** 모래 정도 0~1 */
  sand: number
  /** 흙길 정도 0~1 */
  path: number
  /** 숲(짙은 풀) 정도 0~1 */
  forest: number
  /** 바위땅 정도 0~1 */
  rocky: number
  /** 풀빛 얼룩용 노이즈 0~1 */
  tint: number
}

export function groundMix(x: number, z: number): GroundMix {
  const r = Math.hypot(x, z)
  // 남쪽 해변은 모래가 넓고, 북쪽은 가장자리만 모래
  const south = smoothstep(SAND.blendZ[0], SAND.blendZ[1], z)
  const start = SAND.northStart + (SAND.southStart - SAND.northStart) * south
  const wobble = (valueNoise(x, z, 4.5) - 0.5) * 2 * SAND.wobble
  const sand = smoothstep(start - SAND.edge / 2, start + SAND.edge / 2, r + wobble)

  const edge = pathEdgeDistance(x, z) + (valueNoise(x, z, 1.2) - 0.5) * 0.35
  const path = 1 - smoothstep(-0.15, 0.12, edge)

  const forest = (1 - smoothstep(FOREST_AREA.radius * 0.5, FOREST_AREA.radius, Math.hypot(x - FOREST_AREA.center[0], z - FOREST_AREA.center[1]))) * (z < FENCE_Z ? 1 : 0)
  const rocky = 1 - smoothstep(ROCKY_AREA.radius * 0.45, ROCKY_AREA.radius + (valueNoise(x, z, 2.5) - 0.5) * 3, Math.hypot(x - ROCKY_AREA.center[0], z - ROCKY_AREA.center[1]))
  const tint = valueNoise(x + 100, z, 3.2) * 0.65 + valueNoise(x, z - 50, 1.1) * 0.35
  return { sand, path, forest, rocky, tint }
}

/** 풀이 자랄 수 있는 자리인가 (모래·길·물·시설 바닥·문 자리·동굴 바위 밖의 풀밭) */
export function isGrassSpot(x: number, z: number, mix: GroundMix = groundMix(x, z)): boolean {
  if (Math.hypot(x, z) > DECOR_MAX_RADIUS) return false
  if (mix.sand > 0.35 || mix.path > 0.05 || mix.rocky > 0.6) return false
  if (waterEdgeDistance(x, z) < CLEARANCE.grassWater) return false
  if (inRect(x, z, CAVE_ROCK, 0.2)) return false
  if (FACILITY_RECTS.some((r) => inRect(x, z, r, CLEARANCE.grassFacility))) return false
  // 문 자리는 해금 소품이 들어올 수 있어서 비워 둔다 (울타리 바로 앞뒤만)
  if (GATE_RECTS.some((r) => x >= r.x0 + 2 && x <= r.x1 - 2 && Math.abs(z - FENCE_Z) < 2)) return false
  return true
}

/** 낚시 자리 둘레와 물 쪽으로 던지는 방향 위인가 */
function nearFishing(x: number, z: number, margin: number): boolean {
  return SPOT_CLEARANCE.some(({ at: [sx, sz], facing: [fx, fz] }) => {
    if (Math.hypot(x - sx, z - sz) < CLEARANCE.spot + margin) return true
    // 던지는 방향으로 뻗은 띠 (폭 ±3m)
    const along = (x - sx) * fx + (z - sz) * fz
    const side = Math.abs((x - sx) * fz - (z - sz) * fx)
    return along > 0 && along < CLEARANCE.castReach && side < 3 + margin
  })
}

/**
 * 꽃·덤불·바위·나무 같은 소품을 놓아도 되는 자리인가.
 * 길·시설 앞·낚시 자리·문·물·출발점을 피한다. extra = 물건 반지름만큼 더 띄울 거리
 */
export function isPropSpot(x: number, z: number, extra = 0, maxRadius = DECOR_MAX_RADIUS): boolean {
  if (Math.hypot(x, z) > maxRadius) return false
  if (pathEdgeDistance(x, z) < CLEARANCE.propPath + extra) return false
  if (waterEdgeDistance(x, z) < CLEARANCE.propWater + extra) return false
  if (inRect(x, z, CAVE_ROCK, 0.6 + extra)) return false
  if (FACILITY_RECTS.some((r) => inRect(x, z, r, CLEARANCE.propFacility + extra))) return false
  if (GATE_RECTS.some((r) => inRect(x, z, r, extra))) return false
  if (Math.hypot(x - SPAWN_AT[0], z - SPAWN_AT[1]) < CLEARANCE.spawn + extra) return false
  // 울타리와 겹치지 않게
  if (Math.abs(z - FENCE_Z) < 0.5 + extra) return false
  return !nearFishing(x, z, extra)
}

/** 바닥에 놓을 한 개: 자리·돌림·키(m) */
export type Placement = { x: number; z: number; rotY: number; height: number; variant: number }

/**
 * 섬 위에 무작위로 뿌린다. accept 가 받아들인 자리만 쓰고, 최대 count 개.
 * 같은 seed 면 늘 같은 결과 (렌더할 때 Math.random 을 쓰지 않는다)
 */
export function scatter(
  seed: number,
  count: number,
  height: Vec2,
  variants: number,
  accept: (x: number, z: number, rng: Rng) => boolean,
  maxRadius = DECOR_MAX_RADIUS,
  tries = count * 12,
): Placement[] {
  const rng = seededRng(seed)
  const out: Placement[] = []
  for (let i = 0; i < tries && out.length < count; i++) {
    // 원 안에 고르게: 반지름은 제곱근으로
    const r = Math.sqrt(rng()) * maxRadius
    const a = rng() * Math.PI * 2
    const x = Math.cos(a) * r
    const z = Math.sin(a) * r
    const rotY = rng() * Math.PI * 2
    const h = height[0] + (height[1] - height[0]) * rng()
    const variant = Math.floor(rng() * variants)
    if (accept(x, z, rng)) out.push({ x, z, rotY, height: h, variant })
  }
  return out
}

/** 몇 군데 중심 둘레에 뭉쳐서 뿌린다 (꽃밭) */
export function scatterPatches(
  seed: number,
  patches: number,
  perPatch: Vec2,
  spread: number,
  height: Vec2,
  variants: number,
  acceptCenter: (x: number, z: number) => boolean,
  accept: (x: number, z: number) => boolean,
): Placement[] {
  const rng = seededRng(seed)
  const centers = scatter(seed + 1, patches, [0, 0], variants, acceptCenter)
  const out: Placement[] = []
  for (const c of centers) {
    const n = Math.round(perPatch[0] + (perPatch[1] - perPatch[0]) * rng())
    // 한 꽃밭은 한두 가지 색
    const second = Math.floor(rng() * variants)
    for (let i = 0; i < n; i++) {
      const r = Math.sqrt(rng()) * spread
      const a = rng() * Math.PI * 2
      const x = c.x + Math.cos(a) * r
      const z = c.z + Math.sin(a) * r
      const rotY = rng() * Math.PI * 2
      const h = height[0] + (height[1] - height[0]) * rng()
      const variant = rng() < 0.7 ? c.variant : second
      if (accept(x, z)) out.push({ x, z, rotY, height: h, variant })
    }
  }
  return out
}
