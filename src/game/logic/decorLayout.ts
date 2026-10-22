import {
  BUSHES,
  CLEARANCE,
  DECOR_SEED,
  DUNE_GRASS,
  FACILITY_RECTS,
  FENCE_HEDGE,
  FLOWERS,
  GATE_RECTS,
  GRASS,
  LILY_PADS,
  MUSHROOMS,
  ROCKS,
  SHELLS,
  SHORE_MAX_RADIUS,
  TREES,
  type TreeKind,
} from '../data/decor'
import { ISLAND_RADIUS } from '../data/zones'
import { groundMix, isGrassSpot, isPropSpot, pathEdgeDistance, scatter, scatterPatches, seededRng, smoothstep, valueNoise, type Placement } from './decor'

/** 종류 수 (scene 쪽 모델 목록 길이와 맞춘다) */
export const DECOR_VARIANTS = { flower: 4, bush: 4, rock: 2, mushroom: 2, shell: 3, starfish: 3 }

/** 나무 밑동 반지름(m). 키에 비례 */
export const TRUNK_RADIUS_PER_HEIGHT = 0.06

export type DecorLayout = {
  grass: Placement[]
  dune: Placement[]
  flowers: Placement[]
  bushes: Placement[]
  rocks: Placement[]
  mushrooms: Placement[]
  shells: Placement[]
  starfish: Placement[]
  pebbles: Placement[]
  lilies: Placement[]
  trees: (Placement & { kind: TreeKind })[]
}

function onBeachSand(x: number, z: number): boolean {
  const r = Math.hypot(x, z)
  if (r > SHORE_MAX_RADIUS || r < 20) return false
  const mix = groundMix(x, z)
  if (mix.sand < 0.8 || mix.path > 0.02) return false
  return !FACILITY_RECTS.some((f) => x >= f.x0 - 0.3 && x <= f.x1 + 0.3 && z >= f.z0 - 0.3 && z <= f.z1 + 0.3)
}

/** 섬 꾸미기 전체 배치. 씨앗이 같으면 늘 같은 섬이 된다 */
export function buildDecorLayout(seed = DECOR_SEED): DecorLayout {
  // 풀: 노이즈로 뭉치게 해서 풀밭에 짙고 옅은 덩어리가 생기게
  const grass = scatter(
    seed + 11,
    GRASS.count,
    GRASS.height,
    1,
    (x, z, rng) => {
      const mix = groundMix(x, z)
      if (!isGrassSpot(x, z, mix)) return false
      const clump = smoothstep(0.3, 0.7, valueNoise(x - 40, z + 17, 2.4))
      return rng() < 1 - GRASS.clump + GRASS.clump * clump
    },
    ISLAND_RADIUS,
    GRASS.count * 6,
  )

  // 모래 경계의 갈대
  const dune = scatter(seed + 23, DUNE_GRASS.count, DUNE_GRASS.height, 1, (x, z) => {
    const mix = groundMix(x, z)
    return mix.sand > 0.25 && mix.sand < 0.85 && mix.path < 0.02 && isPropSpot(x, z, 0)
  })

  const flowers = scatterPatches(
    seed + 37,
    FLOWERS.patches,
    FLOWERS.perPatch,
    FLOWERS.spread,
    FLOWERS.height,
    DECOR_VARIANTS.flower,
    (x, z) => isGrassSpot(x, z) && isPropSpot(x, z, 1),
    (x, z) => isGrassSpot(x, z) && isPropSpot(x, z, 0),
  )

  // 덤불: 가장자리·울타리 너머에 더 많이
  const scattered = scatter(seed + 41, BUSHES.count, BUSHES.height, DECOR_VARIANTS.bush, (x, z, rng) => {
    if (!isPropSpot(x, z, 0.4) || groundMix(x, z).sand > 0.5) return false
    return rng() < 0.3 + 0.7 * smoothstep(13, 24, Math.hypot(x, z))
  })
  const bushes = [...scattered, ...fenceHedge(seed + 43)]

  const rocks = scatter(seed + 53, ROCKS.count, ROCKS.height, DECOR_VARIANTS.rock, (x, z, rng) => {
    if (!isPropSpot(x, z, 0.3)) return false
    const mix = groundMix(x, z)
    // 바위땅·모래 경계에 더 많이
    return rng() < 0.25 + 0.75 * Math.max(mix.rocky, 1 - Math.abs(mix.sand - 0.5) * 2)
  })

  const mushrooms = scatter(seed + 59, MUSHROOMS.count, MUSHROOMS.height, DECOR_VARIANTS.mushroom, (x, z) => groundMix(x, z).forest > 0.35 && isGrassSpot(x, z) && isPropSpot(x, z, 0.2))

  const shells = scatter(seed + 61, SHELLS.count, [0.07, 0.12], DECOR_VARIANTS.shell, onBeachSand, SHORE_MAX_RADIUS)
  const starfish = scatter(seed + 67, SHELLS.starfish, [0.2, 0.3], DECOR_VARIANTS.starfish, onBeachSand, SHORE_MAX_RADIUS)
  const pebbles = scatter(seed + 71, SHELLS.pebbles, [0.05, 0.12], 2, onBeachSand, SHORE_MAX_RADIUS)

  const lilies = LILY_PADS.map(([x, z, rotY], i) => ({ x, z, rotY, height: 0.03, variant: i % 2 }))

  const rng = seededRng(seed + 79)
  const trees = TREES.map(([x, z, kind, height]) => ({ x, z, kind, height, rotY: rng() * Math.PI * 2, variant: 0 }))

  return { grass, dune, flowers, bushes, rocks, mushrooms, shells, starfish, pebbles, lilies, trees }
}

/** 울타리 남쪽에 줄지어 심은 덤불. 문 자리·길은 비운다 */
function fenceHedge(seed: number): Placement[] {
  const rng = seededRng(seed)
  const out: Placement[] = []
  for (let x = -ISLAND_RADIUS; x <= ISLAND_RADIUS; x += FENCE_HEDGE.step) {
    const px = x + (rng() - 0.5) * 0.6
    const pz = FENCE_HEDGE.z + (rng() - 0.5) * 0.4
    const height = FENCE_HEDGE.height[0] + (FENCE_HEDGE.height[1] - FENCE_HEDGE.height[0]) * rng()
    const rotY = rng() * Math.PI * 2
    const variant = Math.floor(rng() * DECOR_VARIANTS.bush)
    if (Math.hypot(px, pz) > ISLAND_RADIUS - 1.5) continue
    if (GATE_RECTS.some((g) => px > g.x0 && px < g.x1)) continue
    if (pathEdgeDistance(px, pz) < CLEARANCE.propPath) continue
    out.push({ x: px, z: pz, rotY, height, variant })
  }
  return out
}
