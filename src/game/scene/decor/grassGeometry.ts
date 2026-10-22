import { BufferAttribute, BufferGeometry } from 'three'
import { seededRng } from '../../logic/decor'

/**
 * 풀 다발 하나 (키 1). 가는 삼각형 잎 몇 장을 빙 둘러 바깥으로 살짝 눕힌다.
 * 법선은 모두 위(+y)로 둬서 어느 쪽에서 봐도 땅처럼 고르게 밝다. 색은 밑동이 어둡고 끝이 밝다
 */
export function buildTuftGeometry(blades: number, seed = 5): BufferGeometry {
  const rng = seededRng(seed)
  const positions: number[] = []
  const colors: number[] = []
  for (let b = 0; b < blades; b++) {
    const a = (b / blades) * Math.PI * 2 + rng() * 0.8
    const h = 0.65 + rng() * 0.35
    const lean = 0.15 + rng() * 0.25
    const width = 0.16 + rng() * 0.08
    // 잎 밑동 중심과 잎이 펼쳐진 방향(옆)
    const ox = Math.cos(a) * 0.07
    const oz = Math.sin(a) * 0.07
    const sx = -Math.sin(a) * width * 0.5
    const sz = Math.cos(a) * width * 0.5
    positions.push(ox - sx, 0, oz - sz, ox + sx, 0, oz + sz, ox + Math.cos(a) * lean, h, oz + Math.sin(a) * lean)
    colors.push(0.9, 0.9, 0.9, 0.9, 0.9, 0.9, 1.25, 1.28, 1.08)
  }
  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new BufferAttribute(new Float32Array(positions), 3))
  geometry.setAttribute('color', new BufferAttribute(new Float32Array(colors), 3))
  const normals = new Float32Array(positions.length)
  for (let i = 1; i < normals.length; i += 3) normals[i] = 1
  geometry.setAttribute('normal', new BufferAttribute(normals, 3))
  geometry.computeBoundingSphere()
  return geometry
}
