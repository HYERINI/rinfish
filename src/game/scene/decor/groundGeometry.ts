import { BufferAttribute, BufferGeometry, Color } from 'three'
import { GROUND_CELL, GROUND_COLORS, WATER_POOLS } from '../../data/decor'
import { ISLAND_RADIUS } from '../../data/zones'
import { groundMix, smoothstep, type GroundMix } from '../../logic/decor'

const C = Object.fromEntries(Object.entries(GROUND_COLORS).map(([k, v]) => [k, new Color(v)])) as Record<keyof typeof GROUND_COLORS, Color>

/** 한 점의 바닥 색: 풀(얼룩) → 숲 → 바위땅 → 모래(물가는 젖은 모래) → 흙길 순으로 덮는다 */
export function groundColor(x: number, z: number, mix: GroundMix, out: Color): Color {
  out.copy(C.grassDark).lerp(C.grassLight, mix.tint)
  out.lerp(C.forest, mix.forest * 0.75)
  out.lerp(C.rocky, mix.rocky * 0.85)
  const wet = smoothstep(ISLAND_RADIUS - 2.2, ISLAND_RADIUS - 0.3, Math.hypot(x, z))
  const sand = tmp.copy(C.sand).lerp(C.wetSand, wet)
  out.lerp(sand, mix.sand)
  // 길 가장자리는 조금 진하게
  const path = tmp.copy(C.pathEdge).lerp(C.path, smoothstep(0.4, 1, mix.path))
  return out.lerp(path, mix.path * 0.95)
}
const tmp = new Color()

/**
 * 섬 윗면을 덮는 바닥 메시. 격자 꼭짓점마다 색을 넣고(vertex color), 섬 밖·물웅덩이 안 꼭짓점은
 * 가장자리 원 위로 밀어서 둥근 테두리와 연못 구멍을 만든다
 */
export function buildGroundGeometry(): BufferGeometry {
  const R = ISLAND_RADIUS - 0.05
  const n = Math.ceil((R * 2) / GROUND_CELL) + 1
  const step = (R * 2) / (n - 1)
  const positions = new Float32Array(n * n * 3)
  const colors = new Float32Array(n * n * 3)
  const normals = new Float32Array(n * n * 3)
  /** 원래 자리가 바닥 밖(섬 밖·물속)이었나 */
  const outside = new Uint8Array(n * n)
  const color = new Color()

  for (let j = 0; j < n; j++) {
    for (let i = 0; i < n; i++) {
      const k = j * n + i
      let x = -R + i * step
      let z = -R + j * step
      const r = Math.hypot(x, z)
      if (r > R) {
        x = (x / r) * R
        z = (z / r) * R
        outside[k] = 1
      }
      for (const pool of WATER_POOLS) {
        const dx = x - pool.center[0]
        const dz = z - pool.center[1]
        const d = Math.hypot(dx, dz)
        if (d < pool.radius) {
          const s = d > 1e-6 ? pool.radius / d : 0
          x = pool.center[0] + dx * s
          z = pool.center[1] + (d > 1e-6 ? dz * s : pool.radius)
          outside[k] = 1
        }
      }
      positions.set([x, 0, z], k * 3)
      normals.set([0, 1, 0], k * 3)
      groundColor(x, z, groundMix(x, z), color)
      colors.set([color.r, color.g, color.b], k * 3)
    }
  }

  const index: number[] = []
  const tri = (a: number, b: number, c: number) => {
    // 세 꼭짓점이 모두 밖으로 밀린 삼각형은 납작해서 버린다
    if (outside[a] && outside[b] && outside[c]) return
    index.push(a, b, c)
  }
  for (let j = 0; j + 1 < n; j++) {
    for (let i = 0; i + 1 < n; i++) {
      const a = j * n + i
      const b = a + 1
      const c = a + n
      const d = c + 1
      // 위에서 볼 때 반시계 방향 (법선이 +y)
      tri(a, c, b)
      tri(b, c, d)
    }
  }

  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new BufferAttribute(positions, 3))
  geometry.setAttribute('normal', new BufferAttribute(normals, 3))
  geometry.setAttribute('color', new BufferAttribute(colors, 3))
  geometry.setIndex(index)
  geometry.computeBoundingSphere()
  return geometry
}
