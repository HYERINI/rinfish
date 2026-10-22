import {
  BoxGeometry,
  DoubleSide,
  Group,
  Matrix4,
  Mesh,
  MeshStandardMaterial,
  TorusGeometry,
  Vector3,
  type BufferGeometry,
  type Material,
} from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import type { FishShape } from './fishShape'

/** 소품을 만드는 기본 도구: 재질·부품·숫자 모양 */

export type Vec3 = [number, number, number]

export const HALF_PI = Math.PI / 2
export const SIDES = [-1, 1] as const

/** bake 로 굳힐 부품에 잠깐 쓰는 재질 (굳힌 뒤 진짜 재질을 단다) */
export const STUB = new MeshStandardMaterial()

type MatOptions = { metal?: number; rough?: number; glow?: string; opacity?: number }

export function mat(color: string, { metal = 0, rough = 0.6, glow, opacity }: MatOptions = {}) {
  const m = new MeshStandardMaterial({ color, metalness: metal, roughness: rough })
  if (glow) {
    m.emissive.set(glow)
    m.emissiveIntensity = 1.2
  }
  if (opacity !== undefined) {
    m.transparent = true
    m.opacity = opacity
    m.depthWrite = false
    m.side = DoubleSide
  }
  return m
}

export function part(geometry: BufferGeometry, material: Material, position: Vec3 = [0, 0, 0], rotation: Vec3 = [0, 0, 0], scale: Vec3 = [1, 1, 1]) {
  const mesh = new Mesh(geometry, material)
  mesh.position.set(...position)
  mesh.rotation.set(...rotation)
  mesh.scale.set(...scale)
  return mesh
}

/** 두 점을 잇는 막대 (굵기 w) */
export function bar(geometryWidth: number, from: [number, number], to: [number, number], z = 0): Mesh {
  const dx = to[0] - from[0]
  const dy = to[1] - from[1]
  const length = Math.hypot(dx, dy)
  return part(new BoxGeometry(geometryWidth, length + geometryWidth, geometryWidth), STUB, [(from[0] + to[0]) / 2, (from[1] + to[1]) / 2, z], [0, 0, Math.atan2(-dx, dy)])
}

/** 양옆 눈을 덮는 안경 (선글라스·동그란 안경·돋보기 공용). 렌즈는 눈 바깥에, 코걸이는 얼굴 앞을 가로지른다 */
export function glasses(shape: FishShape, frame: Material, lens: (x: number, r: number) => Mesh[], r = shape.eye.r): Group {
  const lx = shape.eye.x + 0.012
  const g = new Group()
  for (const side of SIDES) {
    g.add(...lens(side * lx, r))
    // 다리: 렌즈에서 뒤로
    g.add(part(new BoxGeometry(0.014, 0.018, 0.22), frame, [side * (lx - 0.01), r * 0.3, -r - 0.1]))
  }
  // 코걸이: 렌즈 앞쪽 끝을 잇는다
  g.add(part(new BoxGeometry(lx * 2, 0.022, 0.022), frame, [0, r * 0.3, r * 0.9]))
  return g
}

/** 부품 여러 개를 지오메트리 하나로 굳힌다 (털처럼 많은 부품을 한 번에 그리려고) */
export function bake(parts: Mesh[]): BufferGeometry {
  const geometries = parts.map((p) => {
    p.updateMatrix()
    return p.geometry.applyMatrix4(p.matrix)
  })
  const merged = mergeGeometries(geometries)
  for (const g of geometries) g.dispose()
  return merged
}

/**
 * 굵은 숫자 모양 ('1'·'3'). xy 평면에 서 있고 +z 에서 보면 바로 읽힌다. h: 높이, tube: 획 굵기(반지름).
 * lift: 글자를 +z 로 띄우는 거리 (몸 옆면·꼬리표 앞면에 붙일 때)
 */
export function digitGeometry(text: string, h: number, tube: number, lift = 0): BufferGeometry {
  const r = (h - tube * 2) / 4
  const width = r * 2 + tube * 2
  const gap = tube * 1.6
  const pieces: Mesh[] = []
  let x = -((width + gap) * text.length - gap) / 2 + width / 2
  for (const ch of text) {
    if (ch === '3') {
      // 위·아래 두 고리를 왼쪽이 트이게 (240°씩)
      pieces.push(part(new TorusGeometry(r, tube, 8, 20, (Math.PI * 4) / 3), STUB, [x, r, lift], [0, 0, -HALF_PI]))
      pieces.push(part(new TorusGeometry(r, tube, 8, 20, (Math.PI * 4) / 3), STUB, [x, -r, lift], [0, 0, (-Math.PI * 5) / 6]))
    } else if (ch === '₩') {
      // W 에 가로줄 둘
      const w = width / 2
      const top = h / 2
      const t = tube * 1.8
      const pts: [number, number][] = [[-w, top], [-w * 0.5, -top], [0, top * 0.4], [w * 0.5, -top], [w, top]]
      for (let i = 0; i < 4; i++) pieces.push(bar(t, [x + pts[i][0], pts[i][1]], [x + pts[i + 1][0], pts[i + 1][1]], lift))
      for (const y of [h * 0.08, -h * 0.16]) pieces.push(bar(t, [x - w * 1.1, y], [x + w * 1.1, y], lift))
    } else if (ch === '1') {
      pieces.push(part(new BoxGeometry(tube * 2.2, h, tube * 2.2), STUB, [x + r * 0.2, 0, lift]))
      pieces.push(part(new BoxGeometry(tube * 2, h * 0.3, tube * 2), STUB, [x - r * 0.25, h * 0.36, lift], [0, 0, -Math.PI / 4]))
    }
    x += width + gap
  }
  return bake(pieces)
}

const base = new Matrix4()
const inverse = new Matrix4()
const turn = new Matrix4().makeRotationY(Math.PI)
const eye = new Vector3()

/**
 * 글자 메시가 늘 보는 쪽에서 바로 읽히게 한다: 카메라가 글자 뒤(-z)에 있으면 그릴 때만 세로축으로 반 바퀴 돌린다.
 * 글자를 lift 만큼 띄워 두면 돌릴 때 반대쪽 면으로 옮겨 간다 (몸 양옆·꼬리표 양면)
 */
export function readableFromBothSides(mesh: Mesh): Mesh {
  mesh.onBeforeRender = (_renderer, _scene, camera) => {
    if (!mesh.parent) return
    base.multiplyMatrices(mesh.parent.matrixWorld, mesh.matrix)
    eye.setFromMatrixPosition(camera.matrixWorld).applyMatrix4(inverse.copy(base).invert())
    mesh.matrixWorld.copy(eye.z < 0 ? base.multiply(turn) : base)
  }
  return mesh
}
