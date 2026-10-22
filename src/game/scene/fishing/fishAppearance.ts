import {
  BoxGeometry,
  Color,
  ConeGeometry,
  CylinderGeometry,
  DoubleSide,
  Group,
  Matrix4,
  Mesh,
  OctahedronGeometry,
  Quaternion,
  Source,
  SphereGeometry,
  TorusGeometry,
  Vector3,
  type Bone,
  type Material,
  type MeshStandardMaterial,
  type Object3D,
  type Texture,
} from 'three'
import type { FishAccessoryKind, FishLook, FishModelId } from '../../data/fishLooks'
import { restBox } from '../modelBounds'
import { glasses, HALF_PI, mat, part, SIDES, type Vec3 } from './accessoryKit'
import { anchorPoint, BODY_Z, sectionAt, type Anchor, type FishShape, type Section } from './fishShape'
import { HIDES_PART, STUDY_ACCESSORIES, type StudyAccessoryKind } from './studyAccessories'

export type { FishShape } from './fishShape'

// ─── 색·발광 ────────────────────────────────────────────────

/** 발광 세기 (look.glow) */
const GLOW_INTENSITY = 0.6
/** 물들일 때 가장 어두운 부위도 물들인 색의 이만큼은 밝게 둔다 (원래 밝기 차이는 남긴다) */
const TINT_FLOOR = 0.35

const luminance = (c: Color) => 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b
const materialName = (mesh: Mesh) => (Array.isArray(mesh.material) ? mesh.material[0] : mesh.material).name
const isEye = (name: string) => /eye/i.test(name)
/** 지느러미는 머리 모양을 잴 때 뺀다 (등지느러미·가시가 머리 위로 높이 솟은 모델이 있다) */
const isFin = (name: string) => /fin/i.test(name)

const grayCache = new WeakMap<Texture, Texture>()

/**
 * 텍스처의 흑백 사본 (밝기 차이만 남기고, 가장 밝은 곳이 1·가장 어두운 곳도 TINT_FLOOR 이상). 모델 텍스처마다 한 번 만든다.
 * 그림을 그릴 수 없는 곳(테스트)이나 그림이 아직 없으면 원래 텍스처를 쓴다
 */
function grayTexture(texture: Texture): Texture {
  const cached = grayCache.get(texture)
  if (cached) return cached
  const image = texture.image as CanvasImageSource & { width: number; height: number }
  if (typeof document === 'undefined' || !image?.width) return texture
  const canvas = document.createElement('canvas')
  canvas.width = image.width
  canvas.height = image.height
  const ctx = canvas.getContext('2d')
  if (!ctx) return texture
  ctx.drawImage(image, 0, 0)
  const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height)
  const d = pixels.data
  let max = 1
  for (let i = 0; i < d.length; i += 4) max = Math.max(max, 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2])
  for (let i = 0; i < d.length; i += 4) {
    const l = (0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2]) / max
    d[i] = d[i + 1] = d[i + 2] = 255 * (TINT_FLOOR + (1 - TINT_FLOOR) * l)
  }
  ctx.putImageData(pixels, 0, 0)
  // clone 은 그림(source)을 원본과 같이 쓰므로 새 source 를 단다
  const gray = texture.clone()
  gray.source = new Source(canvas)
  gray.needsUpdate = true
  grayCache.set(texture, gray)
  return gray
}

/**
 * 물고기 모델에 생김새(색·발광)를 입힌다. 같은 모델을 쓰는 다른 어종과 색이 섞이지 않도록 재질을 인스턴스마다 복제한다.
 * 색은 원래 색에 그냥 곱하면 어두운 모델(메기 등)이 새까매지므로, 부위별 밝기 차이만 남기고 색을 tint 로 바꾼다.
 * 텍스처 재질(고등어·오징어의 색 아틀라스)은 텍스처를 흑백으로 바꾼 사본에 tint 를 곱한다 (원래 텍스처 색이 섞이지 않게). 눈은 그대로 둔다
 */
export function applyFishLook(object: Object3D, look: FishLook): void {
  const clones = new Map<Material, MeshStandardMaterial>()
  const swap = (m: Material) => {
    let c = clones.get(m)
    if (!c) {
      c = m.clone() as MeshStandardMaterial
      clones.set(m, c)
    }
    return c
  }
  object.traverse((o) => {
    const mesh = o as Mesh
    if (mesh.isMesh) mesh.material = Array.isArray(mesh.material) ? mesh.material.map(swap) : swap(mesh.material)
  })

  const materials = [...clones.values()].filter((m) => m.color && !isEye(m.name))
  if (look.tint) {
    const tint = new Color(look.tint)
    const brightest = Math.max(1e-4, ...materials.filter((m) => !m.map).map((m) => luminance(m.color)))
    for (const m of materials) {
      if (m.map) {
        m.map = grayTexture(m.map)
        m.color.copy(tint)
      } else m.color.copy(tint).multiplyScalar(TINT_FLOOR + (1 - TINT_FLOOR) * (luminance(m.color) / brightest))
    }
  }
  if (look.glow) {
    for (const m of materials) {
      if (!m.emissive) continue
      m.emissive.set(look.glow)
      m.emissiveIntensity = GLOW_INTENSITY
    }
  }
}

// ─── 크기 맞추기와 머리 모양 재기 ───────────────────────────

/** 물고기 몸길이. 모델마다 크기가 달라 이 길이로 맞춘다 (기존 도형 물고기와 같은 크기) */
export const FISH_LENGTH = 1.2

/** 머리가 +z 가 아닌 모델을 돌리는 각도(y축). 고등어 모델만 머리가 -x 쪽이다 */
const MODEL_YAW: Partial<Record<FishModelId, number>> = { mackerel: Math.PI / 2 }

/** 단면을 재는 간격 */
const SECTION_STEP = 0.05

/** 눈이 따로 없는 모델(송어·고등어·가오리·오징어)은 머리 앞쪽 이 자리(z)에 이 크기(r)의 눈이 있다고 본다. 가오리는 납작해서 작게 */
const FALLBACK_EYE = { z: 0.4, r: 0.06 }
const MODEL_FALLBACK_EYE: Partial<Record<FishModelId, { z: number; r: number }>> = {
  manta: { z: 0.42, r: 0.035 },
  // 오징어는 몸통(머리 +z)이 앞이고 눈은 다리 바로 앞에 있다
  squid: { z: -0.2, r: 0.065 },
}

function measureShape(object: Object3D, model: FishModelId, scale: Vector3, offset: Vector3): FishShape {
  const eyeMin = new Vector3(Infinity, Infinity, Infinity)
  const eyeMax = new Vector3(-Infinity, -Infinity, -Infinity)
  const bins = new Map<number, Section>()
  const v = new Vector3()
  object.traverse((o) => {
    const mesh = o as Mesh
    if (!mesh.isMesh) return
    const name = materialName(mesh)
    const eye = isEye(name)
    if (isFin(name)) return
    const pos = mesh.geometry.attributes.position
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i).applyMatrix4(mesh.matrixWorld).multiply(scale).add(offset)
      if (eye) {
        eyeMin.min(v)
        eyeMax.max(v)
        continue
      }
      const k = Math.round(v.z / SECTION_STEP)
      const s = bins.get(k)
      if (!s) bins.set(k, { top: v.y, bottom: v.y, half: Math.abs(v.x) })
      else {
        s.top = Math.max(s.top, v.y)
        s.bottom = Math.min(s.bottom, v.y)
        s.half = Math.max(s.half, Math.abs(v.x))
      }
    }
  })
  const sections = [...bins].sort((a, b) => a[0] - b[0]).map(([k, s]) => ({ z: k * SECTION_STEP, s }))
  const fallback = MODEL_FALLBACK_EYE[model] ?? FALLBACK_EYE
  const shape: FishShape = { eye: { x: 0, y: 0, ...fallback }, sections }
  if (eyeMin.x <= eyeMax.x) {
    shape.eye = {
      x: eyeMax.x,
      y: (eyeMin.y + eyeMax.y) / 2,
      z: (eyeMin.z + eyeMax.z) / 2,
      r: (eyeMax.y - eyeMin.y) / 2,
    }
  } else {
    const s = sectionAt(shape, fallback.z)
    shape.eye.x = s.half
    shape.eye.y = (s.top + s.bottom) / 2
  }
  return shape
}

/**
 * 모델을 머리 +z 로 돌리고(look.rotate), 몸 비율(look.stretch)을 곱한 뒤 가장 긴 쪽을 FISH_LENGTH 로 맞추고 가운데를 원점에 두는
 * 축별 배율·이동과 그때의 몸 모양을 돌려준다. 돌림은 object 자신에 넣는다 (부모가 배율·이동을 맡는다)
 */
export function fitFish(object: Object3D, look: Pick<FishLook, 'model' | 'stretch' | 'rotate'>): { scale: Vector3; offset: Vector3; shape: FishShape } {
  const [rx, ry, rz] = look.rotate ?? [0, 0, 0]
  object.rotation.set(rx, ry + (MODEL_YAW[look.model] ?? 0), rz)
  const box = restBox(object)
  const stretch = new Vector3(...(look.stretch ?? [1, 1, 1]))
  const size = box.getSize(new Vector3()).multiply(stretch)
  const scale = stretch.multiplyScalar(FISH_LENGTH / Math.max(size.x, size.y, size.z))
  const offset = box.getCenter(new Vector3()).multiply(scale).negate()
  return { scale, offset, shape: measureShape(object, look.model, scale, offset) }
}

// ─── 소품 ───────────────────────────────────────────────────

/** 예전부터 있던 소품을 붙이는 자리 */
const ANCHOR: Record<Exclude<FishAccessoryKind, StudyAccessoryKind>, Anchor> = {
  sunglasses: 'eye',
  roundGlasses: 'eye',
  eyepatch: 'eye',
  crystal: 'eye',
  ninjaMask: 'eye',
  spaceHelmet: 'eye',
  headband: 'eye',
  crown: 'top',
  frogCrown: 'top',
  nightcap: 'top',
  dreadlocks: 'top',
  lifebuoy: 'body',
  selfieStick: 'body',
}

/** 소품을 붙이는 자리 */
const anchorOf = (kind: FishAccessoryKind): Anchor => (kind in STUDY_ACCESSORIES ? STUDY_ACCESSORIES[kind as StudyAccessoryKind].anchor : ANCHOR[kind as keyof typeof ANCHOR])

/** 소품 기본 위치(몸길이 1.2 물고기, 가운데가 원점, 머리 +z). 모델의 눈·머리 위치에서 정한다 */
export function accessoryPosition(kind: FishAccessoryKind, shape: FishShape): Vec3 {
  return anchorPoint(anchorOf(kind), shape)
}

/** 소품을 붙이는 자리 기준 단면 (머리 둘레 소품의 크기용) */
function headSection(shape: FishShape): Section {
  return sectionAt(shape, shape.eye.z)
}

function crownRing(radius: number): Group {
  const gold = mat('#ffc61a', { metal: 0.85, rough: 0.25 })
  gold.side = DoubleSide // 테 안쪽이 보여도 비지 않게
  const gem = mat('#e53935', { rough: 0.2, glow: '#b71c1c' })
  const g = new Group()
  const h = radius * 0.6
  g.add(part(new CylinderGeometry(radius, radius * 0.92, h, 20, 1, true), gold, [0, h / 2, 0]))
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2
    const x = Math.sin(a) * radius
    const z = Math.cos(a) * radius
    g.add(part(new ConeGeometry(radius * 0.3, radius * 0.75, 6), gold, [x, h + radius * 0.3, z]))
    g.add(part(new SphereGeometry(radius * 0.15, 8, 6), gem, [x, h * 0.5, z]))
  }
  return g
}

type Builder = (shape: FishShape) => Group

const BUILDERS: Record<Exclude<FishAccessoryKind, StudyAccessoryKind>, Builder> = {
  sunglasses: (shape) => {
    const frame = mat('#111111', { rough: 0.3 })
    const lens = mat('#20242e', { metal: 0.7, rough: 0.12 })
    return glasses(shape, frame, (x, r) => [
      part(new BoxGeometry(0.02, r * 1.9, r * 2.4), lens, [x, 0, 0.01]),
      // 렌즈 위 테두리
      part(new BoxGeometry(0.03, 0.025, r * 2.6), frame, [x, r * 0.95, 0.01]),
    ])
  },
  roundGlasses: (shape) => {
    const frame = mat('#d4a017', { metal: 0.8, rough: 0.3 })
    const glass = mat('#e3f2fd', { opacity: 0.3, rough: 0.05 })
    return glasses(shape, frame, (x, r) => [
      part(new TorusGeometry(r * 1.2, 0.013, 8, 24), frame, [x, 0, 0], [0, HALF_PI, 0]),
      part(new CylinderGeometry(r * 1.2, r * 1.2, 0.004, 24), glass, [x, 0, 0], [0, 0, HALF_PI]),
    ])
  },
  eyepatch: (shape) => {
    const { x, y, r } = shape.eye
    const black = mat('#141414')
    const red = mat('#d32f2f', { rough: 0.8 })
    const g = new Group()
    // 안대: 사진(왼쪽 옆모습)에서 보이는 -x 쪽 눈
    g.add(part(new CylinderGeometry(r * 1.25, r * 1.25, 0.02, 16), black, [-x - 0.012, 0, 0], [0, 0, HALF_PI]))
    // 끈: 안대에서 머리 위를 넘어 반대쪽으로 (반원)
    const head = headSection(shape)
    const up = head.top - y + 0.015
    g.add(part(new TorusGeometry(1, 0.012, 6, 24, Math.PI), black, [0, 0, -0.02], [-0.35, 0, 0], [x + 0.01, up, 1]))
    // 두건: 머리 꼭대기를 덮는 빨간 반구 + 뒤로 묶은 매듭
    const capR = Math.min(head.half, 0.3) * 0.95
    g.add(part(new SphereGeometry(1, 16, 8, 0, Math.PI * 2, 0, HALF_PI), red, [0, up - capR * 0.55, -r * 1.4], [-0.25, 0, 0], [capR, capR * 0.8, capR * 1.1]))
    // 두건의 흰 물방울무늬
    const dot = mat('#ffffff', { rough: 0.8 })
    for (const [a, b] of [[0.5, 0.3], [-0.5, 0.5], [0, -0.4], [1.2, -0.2], [-1.2, -0.1]]) {
      const n = new Vector3(Math.sin(a) * Math.cos(b), Math.sin(0.9 + b * 0.5), Math.cos(a) * Math.cos(b)).normalize()
      g.add(part(new SphereGeometry(0.022, 8, 6), dot, [n.x * capR, up - capR * 0.55 + n.y * capR * 0.8, -r * 1.4 + n.z * capR * 1.1]))
    }
    const knotZ = -r * 1.4 - capR
    g.add(part(new SphereGeometry(0.04, 8, 6), red, [0, up - capR * 0.3, knotZ]))
    for (const side of SIDES) g.add(part(new ConeGeometry(0.035, 0.14, 6), red, [side * 0.035, up - capR * 0.4, knotZ - 0.07], [-1.2, 0, side * 0.35]))
    return g
  },
  crown: (shape) => crownRing(Math.min(headSection(shape).half * 0.55, 0.16)),
  frogCrown: (shape) => {
    const half = Math.min(headSection(shape).half, 0.3)
    const green = mat('#7cc242', { rough: 0.7 })
    const white = mat('#ffffff', { rough: 0.4 })
    const black = mat('#111111')
    const g = new Group()
    // 개구리 모자: 납작한 초록 반구에 툭 튀어나온 눈 둘
    const capR = half * 1.0
    g.add(part(new SphereGeometry(1, 18, 8, 0, Math.PI * 2, 0, HALF_PI), green, [0, -0.02, 0], [0, 0, 0], [capR, capR * 0.55, capR * 1.1]))
    const ex = capR * 0.5
    for (const side of SIDES) {
      g.add(part(new SphereGeometry(0.075, 12, 10), green, [side * ex, capR * 0.45, capR * 0.4]))
      g.add(part(new SphereGeometry(0.058, 12, 10), white, [side * ex, capR * 0.5, capR * 0.4 + 0.035]))
      g.add(part(new SphereGeometry(0.026, 8, 6), black, [side * ex, capR * 0.52, capR * 0.4 + 0.088]))
    }
    const crown = crownRing(0.075)
    crown.position.set(0, capR * 0.5, -capR * 0.2)
    g.add(crown)
    return g
  },
  headband: (shape) => {
    const { x, r } = shape.eye
    // 흰 띠에 빨간 동그라미 (빨간 물고기에도 잘 보이게)
    const cloth = mat('#fafafa', { rough: 0.8 })
    cloth.side = DoubleSide
    const red = mat('#e53935', { rough: 0.6 })
    const g = new Group()
    // 눈 바로 위 이마를 가로로 감는 띠. 앞이 조금 내려가게 기울인다 (원점은 눈 높이)
    const tilt = 0.3
    // 앞 끝은 주둥이가 아니라 이마(눈 위)께라서 주둥이까지 거리보다 조금 뒤
    const front = (0.6 - shape.eye.z) * 0.7
    const rz = (front + r * 3) / 2
    const cz = front - rz
    const cy = r * 1.25
    const band = new Group()
    band.position.set(0, cy, cz)
    band.rotation.x = tilt
    band.add(part(new CylinderGeometry(1, 1, 0.08, 32, 1, true), cloth, [0, 0, 0], [0, 0, 0], [x * 0.9, 1, rz]))
    // 이마와 양옆의 빨간 동그라미
    band.add(part(new CylinderGeometry(0.035, 0.035, 0.012, 14), red, [0, 0, rz + 0.006], [HALF_PI, 0, 0]))
    for (const side of SIDES) band.add(part(new CylinderGeometry(0.03, 0.03, 0.012, 14), red, [side * (x * 0.9 + 0.006), 0, 0], [0, 0, HALF_PI]))
    // 뒤로 늘어진 매듭 끈
    for (const side of SIDES) band.add(part(new BoxGeometry(0.045, 0.014, 0.2), cloth, [side * 0.04, -0.03, -rz - 0.08], [0.6, side * 0.3, 0]))
    g.add(band)
    return g
  },
  nightcap: (shape) => {
    const base = Math.min(headSection(shape).half * 0.7, 0.2)
    const blue = mat('#3f51b5', { rough: 0.9 })
    const white = mat('#fafafa', { rough: 0.9 })
    const g = new Group()
    g.add(part(new TorusGeometry(base, base * 0.25, 8, 24), white, [0, 0.01, 0], [HALF_PI, 0, 0]))
    // 아래는 원뿔대, 위는 뒤로 꺾여 늘어진 원뿔
    const h = base * 1.3
    g.add(part(new CylinderGeometry(base * 0.55, base, h, 16), blue, [0, h / 2, 0]))
    const tipL = base * 1.8
    g.add(part(new ConeGeometry(base * 0.55, tipL, 16), blue, [0, h + tipL * 0.25, -tipL * 0.4], [-1.15, 0, 0]))
    g.add(part(new SphereGeometry(base * 0.32, 10, 8), white, [0, h + tipL * 0.15, -tipL * 0.9]))
    return g
  },
  lifebuoy: (shape) => {
    const s = sectionAt(shape, BODY_Z)
    const red = mat('#e53935', { rough: 0.5 })
    const white = mat('#fafafa', { rough: 0.5 })
    const g = new Group()
    // 몸통 가운데를 두르는 큼직한 튜브. 빨강·흰색 8조각
    const R = Math.max(s.half, (s.top - s.bottom) / 2) + 0.06
    const pieces = 8
    for (let i = 0; i < pieces; i++) {
      g.add(part(new TorusGeometry(R, 0.075, 10, 8, (Math.PI * 2) / pieces), i % 2 ? white : red, [0, 0, 0], [0, 0, (i / pieces) * Math.PI * 2 + 0.2]))
    }
    // 옆에서도 고리로 보이게 살짝 기울인다
    g.rotation.set(0.3, 0.35, 0)
    return g
  },
  spaceHelmet: (shape) => {
    const head = headSection(shape)
    const R = Math.max(shape.eye.x, (head.top - head.bottom) / 2) + 0.07
    const glass = mat('#b3e5fc', { opacity: 0.25, rough: 0.05, metal: 0.1 })
    const rim = mat('#cfd8dc', { metal: 0.8, rough: 0.3 })
    const g = new Group()
    // 머리를 덮는 투명 구 (원점은 눈 높이, 구는 머리 앞쪽에 맞춘다) + 목 테
    const cz = 0.6 - shape.eye.z - R * 0.85
    g.add(part(new SphereGeometry(R, 24, 18), glass, [0, 0, cz]))
    g.add(part(new TorusGeometry(R * 0.85, 0.035, 8, 28), rim, [0, 0, cz - R * 0.5]))
    // 위로 뻗은 대 끝에 빛나는 초롱
    const stalk = 0.22
    g.add(part(new CylinderGeometry(0.012, 0.012, stalk, 6), rim, [0, R + stalk / 2 - 0.02, cz + 0.05], [0.3, 0, 0]))
    g.add(part(new SphereGeometry(0.055, 14, 10), mat('#fff59d', { glow: '#ffee58' }), [0, R + stalk, cz + 0.12]))
    return g
  },
  ninjaMask: (shape) => {
    const { x, r } = shape.eye
    const cloth = mat('#15151c', { rough: 0.9 })
    cloth.side = DoubleSide
    const white = mat('#ffffff', { glow: '#ffffff' })
    const g = new Group()
    // 눈높이를 가로로 두르는 띠: 양쪽 눈과 얼굴 앞을 지나 뒤로 돈다
    const front = 0.6 - shape.eye.z + 0.01
    const rz = (front + r * 2) / 2
    const cz = front - rz
    const height = Math.max(r * 2.4, 0.08)
    g.add(part(new CylinderGeometry(1, 1, height, 32, 1, true), cloth, [0, 0, cz], [0, 0, 0], [x + 0.02, 1, rz + 0.02]))
    // 띠에 뚫린 눈 자리: 하얀 눈빛
    for (const side of SIDES) g.add(part(new BoxGeometry(0.02, height * 0.22, r * 1.5), white, [side * (x + 0.03), 0, 0]))
    // 뒤로 날리는 끈 둘
    const backZ = cz - rz
    g.add(part(new BoxGeometry(0.05, 0.012, 0.26), cloth, [0.04, 0.02, backZ - 0.12], [0.2, 0.3, 0.25]))
    g.add(part(new BoxGeometry(0.05, 0.012, 0.22), cloth, [-0.04, -0.01, backZ - 0.1], [-0.15, -0.35, -0.25]))
    return g
  },
  dreadlocks: (shape) => {
    const half = Math.min(headSection(shape).half, 0.3)
    const beanieR = half * 0.7
    const g = new Group()
    // 비니: 빨강·노랑·초록 줄무늬 반구
    const stripes = ['#43a047', '#fbc02d', '#e53935']
    stripes.forEach((c, i) => {
      g.add(part(new SphereGeometry(beanieR, 16, 4, 0, Math.PI * 2, (i / 3) * HALF_PI, HALF_PI / 3), mat(c, { rough: 0.9 }), [0, -0.02, 0], [0, 0, 0], [1, 0.9, 1.1]))
    })
    // 비니 테두리 뒤쪽 절반에서 뒤로 길게 늘어진 머리 다발 (등 위로 휘날린다)
    const colors = ['#3e2723', '#fbc02d', '#43a047', '#3e2723', '#fbc02d', '#43a047', '#3e2723', '#fbc02d', '#43a047']
    colors.forEach((c, i) => {
      const a = (i / (colors.length - 1) - 0.5) * Math.PI * 1.1 // 0 이 바로 뒤
      const len = 0.3 + (i % 3) * 0.06
      const tilt = 1.0 // 위쪽 끝(머리 쪽)이 앞·조금 위를 보게: 다발은 뒤로 거의 눕는다
      const rim = new Vector3(Math.sin(a) * beanieR, 0.04, -Math.cos(a) * beanieR)
      const axis = new Vector3(Math.sin(a) * 0.5, Math.cos(tilt), Math.sin(tilt)).normalize()
      const center = rim.addScaledVector(axis, -len / 2)
      g.add(part(new CylinderGeometry(0.03, 0.02, len, 6), mat(c, { rough: 0.9 }), center.toArray(), [tilt, 0, -a * 0.45]))
    })
    return g
  },
  crystal: (shape) => {
    const { x, r } = shape.eye
    const crystal = mat('#9ff3ff', { glow: '#00e5ff', rough: 0.1, metal: 0.2 })
    const g = new Group()
    // 눈 자리를 덮는 빛나는 수정
    for (const side of SIDES) g.add(part(new OctahedronGeometry(r * 1.7), crystal, [side * (x - r * 0.5), 0, 0], [0, 0, 0], [0.8, 1.3, 1]))
    return g
  },
  selfieStick: (shape) => {
    const s = sectionAt(shape, BODY_Z)
    const metal = mat('#9e9e9e', { metal: 0.8, rough: 0.3 })
    const g = new Group()
    // 왼쪽(-x) 가슴지느러미께에서 앞·위로 뻗은 막대 (사진에서 보이는 쪽)
    const pole = new Group()
    pole.position.set(-s.half - 0.02, -0.03, -0.06)
    pole.rotation.set(0.45, 0, 0.35)
    pole.add(part(new CylinderGeometry(0.014, 0.014, 0.5, 8), metal, [0, 0.25, 0]))
    pole.add(part(new CylinderGeometry(0.024, 0.024, 0.1, 8), mat('#212121'), [0, 0.02, 0]))
    // 끝의 폰: 화면이 물고기 쪽을 본다
    const phone = new Group()
    phone.position.set(0, 0.52, 0)
    phone.rotation.set(-0.9, 0, 0)
    phone.add(part(new BoxGeometry(0.12, 0.2, 0.018), mat('#263238', { rough: 0.3 })))
    phone.add(part(new BoxGeometry(0.1, 0.17, 0.004), mat('#4fc3f7', { glow: '#29b6f6' }), [0, 0, -0.01]))
    phone.add(part(new CylinderGeometry(0.012, 0.012, 0.006, 10), mat('#000000'), [0.03, 0.07, 0.011], [HALF_PI, 0, 0]))
    pole.add(phone)
    g.add(pole)
    return g
  },
}

/**
 * 물고기 머리에 붙는 소품. 기본 도형으로 만든다. 몸길이 1.2 물고기 기준 크기, +z 가 얼굴 쪽.
 * 원점이 붙이는 자리(accessoryPosition)다. 크기는 모델의 머리 모양(shape)에 맞춘다
 */
export function buildAccessory(kind: FishAccessoryKind, shape: FishShape): Group {
  let g: Group
  if (kind in STUDY_ACCESSORIES) {
    // 스터디원 소품은 물고기 좌표 그대로 만들어서 붙이는 자리만큼 되돌린다
    g = new Group()
    const inner = STUDY_ACCESSORIES[kind as StudyAccessoryKind].build(shape)
    inner.position.set(...accessoryPosition(kind, shape)).negate()
    g.add(inner)
  } else g = BUILDERS[kind as keyof typeof BUILDERS](shape)
  g.name = `accessory:${kind}`
  g.traverse((o) => {
    o.castShadow = true
  })
  return g
}

/** 소품을 붙일 뼈: 이름이 머리(Head·Face)인 뼈(preferHead), 없으면 붙일 자리에서 가장 가까운 뼈. 뼈가 없는 모델은 null */
function headBone(object: Object3D, at: Vector3, toFitted: Matrix4, preferHead = true): Bone | null {
  let named: Bone | null = null
  let nearest: Bone | null = null
  let best = Infinity
  const p = new Vector3()
  object.traverse((o) => {
    const bone = o as Bone
    if (!bone.isBone) return
    if (/head|face/i.test(bone.name) && !/_end$/i.test(bone.name)) named ??= bone
    const d = p.setFromMatrixPosition(bone.matrixWorld).applyMatrix4(toFitted).distanceToSquared(at)
    if (d < best) {
      best = d
      nearest = bone
    }
  })
  return (preferHead ? named : null) ?? nearest
}

/** 몸길이를 맞춘 좌표의 matrix 를 parent 아래 local 로 옮겨 붙인다 */
function attach(child: Object3D, fitted: Matrix4, parent: Object3D, toFitted: Matrix4) {
  const local = new Matrix4().multiplyMatrices(toFitted, parent.matrixWorld).invert().multiply(fitted)
  local.decompose(child.position, child.quaternion, child.scale)
  parent.add(child)
}

/**
 * 물고기 모델(복제본)에 생김새를 입힌다: 색·발광, 머리 +z 로 돌리기·몸 비율, 소품 만들어 붙이기.
 * 돌려준 scale(축별)·offset 은 부모 group 에 넣어 몸길이 1.2·가운데 원점으로 맞춘다.
 * 소품은 머리 뼈의 자식으로 붙여서 헤엄치는 애니메이션에 머리와 함께 움직인다. 몸 전체를 덮는 소품(털)은 덩어리마다
 * 가까운 뼈에 붙인다 (아직 배율·이동을 넣지 않은 object 에 호출한다). accessories 는 붙인 소품 전부 (정리용)
 */
export function dressFish(object: Object3D, look: FishLook): { scale: Vector3; offset: Vector3; accessories: Object3D[] } {
  applyFishLook(object, look)
  const { scale, offset, shape } = fitFish(object, look)
  const kinds = look.accessories ?? []
  const accessories: Object3D[] = []
  if (!kinds.length) return { scale, offset, accessories }

  // 소품이 대신하는 원래 부위는 숨긴다
  const hidden = new Set(kinds.map((k) => HIDES_PART[k]).filter(Boolean))
  object.traverse((o) => {
    const mesh = o as Mesh
    if (!mesh.isMesh) return
    const name = materialName(mesh)
    if ((hidden.has('eyes') && isEye(name)) || (hidden.has('fins') && isFin(name))) mesh.visible = false
  })

  // 몸길이를 맞춘 좌표 = toFitted × (object 기준 좌표). object 는 아직 부모가 없어 matrixWorld 가 곧 object 기준이다
  const toFitted = new Matrix4().compose(offset, new Quaternion(), scale)
  object.updateWorldMatrix(false, true)
  const center = new Vector3()
  kinds.forEach((kind, i) => {
    const accessory = buildAccessory(kind, shape)
    const at = new Vector3(...(i === 0 && look.accessoryAt ? look.accessoryAt : accessoryPosition(kind, shape)))
    // 몸 전체에 퍼진 부품(털 덩어리)은 저마다 가까운 뼈로
    accessory.position.copy(at)
    accessory.updateMatrixWorld(true)
    const spread: Object3D[] = []
    accessory.traverse((o) => {
      if (o.userData.spread) spread.push(o)
    })
    for (const piece of spread) {
      const fitted = piece.matrixWorld.clone()
      const mesh = piece as Mesh
      mesh.geometry.computeBoundingBox()
      mesh.geometry.boundingBox!.getCenter(center).applyMatrix4(fitted)
      piece.removeFromParent()
      attach(piece, fitted, headBone(object, center, toFitted, false) ?? object, toFitted)
      accessories.push(piece)
    }
    attach(accessory, new Matrix4().makeTranslation(at), headBone(object, at, toFitted) ?? object, toFitted)
    accessories.push(accessory)
  })
  return { scale, offset, accessories }
}

/** applyFishLook 이 복제한 재질을 정리한다 (지오메트리는 모델 캐시와 공유하므로 두고) */
export function disposeFishMaterials(root: Object3D): void {
  root.traverse((o) => {
    const mesh = o as Mesh
    if (!mesh.isMesh) return
    const m = mesh.material
    if (Array.isArray(m)) m.forEach((x) => x.dispose())
    else m.dispose()
  })
}

/** 지오메트리·재질을 모두 정리한다 (소품, 혼자 쓰는 모델) */
export function disposeObject(root: Object3D): void {
  root.traverse((o) => {
    const mesh = o as Mesh
    if (!mesh.isMesh) return
    mesh.geometry.dispose()
    const m = mesh.material
    if (Array.isArray(m)) m.forEach((x) => x.dispose())
    else m.dispose()
  })
}
