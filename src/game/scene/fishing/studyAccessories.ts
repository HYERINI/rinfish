import {
  BoxGeometry,
  BufferAttribute,
  Color,
  ConeGeometry,
  CylinderGeometry,
  Group,
  Matrix4,
  Mesh,
  type MeshStandardMaterial,
  SphereGeometry,
  TorusGeometry,
  Vector3,
  type BufferGeometry,
} from 'three'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'
import type { FishAccessoryKind } from '../../data/fishLooks'
import { bake, digitGeometry, glasses, HALF_PI, mat, part, readableFromBothSides, SIDES, STUB } from './accessoryKit'
import { backZ, BODY_Z, frontZ, midY, neckZ, sectionAt, type Anchor, type FishShape } from './fishShape'

/**
 * 스터디원 물고기 소품. 몸길이 1.2 물고기 기준 좌표(가운데 원점, 머리 +z)로 바로 만들고,
 * 붙이는 자리(anchor)를 원점으로 옮기는 일은 buildAccessory 가 한다. 사진에 보이는 쪽은 -x (왼쪽 옆모습)
 */

export type StudyAccessoryKind = Extract<
  FishAccessoryKind,
  | 'spoons' | 'googlyEyes' | 'sadBrows' | 'digit3' | 'digits31' | 'darkCircles' | 'priceTag3' | 'furPerm'
  | 'bossChain' | 'bossScar' | 'bread' | 'grandpaBeard' | 'magnifierGlasses' | 'sheepTowel' | 'cane' | 'bowlCut'
  | 'clampTeeth' | 'anchovySchool'
>

/** 0~1 사이 고정된 값 (i 마다 다름). 털·곱슬머리 배치가 매번 같게 Math.random 대신 쓴다 */
const hash01 = (i: number) => {
  const k = Math.sin(i * 127.1 + 311.7) * 43758.5453
  return k - Math.floor(k)
}

/** 얼굴 크기 (눈이 아주 작은 모델에서도 소품이 보이게 아래 한도를 둔다) */
const eyeR = (shape: FishShape) => Math.max(shape.eye.r, 0.045)
const headOf = (shape: FishShape) => sectionAt(shape, shape.eye.z)
const UP = new Vector3(0, 1, 0)

/** 금목걸이·꼬리표 끈처럼 몸통 단면을 두르는 고리의 반지름 [x, y] */
function ringRadii(shape: FishShape, z: number, room: number): [number, number, number] {
  const s = sectionAt(shape, z)
  return [s.half + room, (s.top - s.bottom) / 2 + room, midY(s)]
}

const spoons = (shape: FishShape) => {
  const silver = mat('#eef2f5', { metal: 0.35, rough: 0.25 })
  const z = frontZ(shape) - 0.14
  const s = sectionAt(shape, z)
  const g = new Group()
  for (const side of SIDES) {
    // 숟가락: 원점이 머리(오목한 타원) 가운데, 손잡이는 아래(-y)로. 오목한 면이 +z
    const spoon = new Group()
    spoon.add(part(new SphereGeometry(0.09, 16, 10), silver, [0, 0, 0], [0, 0, 0], [1, 1.35, 0.32]))
    spoon.add(part(new CylinderGeometry(0.016, 0.022, 0.36, 8), silver, [0, -0.29, 0]))
    spoon.add(part(new SphereGeometry(0.026, 8, 6), silver, [0, -0.47, 0], [0, 0, 0], [1, 1.4, 0.5]))
    // 입 양옆 바깥에서 숟가락 머리가 위·앞을 보게 비스듬히 든다
    spoon.position.set(side * (s.half + 0.08), s.top - 0.02, z + 0.1)
    spoon.rotation.set(0.45, side * 0.9, -side * 0.55, 'YXZ')
    g.add(spoon)
  }
  return g
}

const googlyEyes = (shape: FishShape) => {
  const { eye } = shape
  const head = headOf(shape)
  // 얼굴을 거의 다 덮는 왕눈이
  const R = Math.min(0.2, Math.max(eye.r * 2.6, (head.top - head.bottom) * 0.3))
  const white = mat('#ffffff', { rough: 0.25 })
  const black = mat('#111111', { rough: 0.2 })
  const shine = mat('#ffffff', { glow: '#ffffff' })
  const g = new Group()
  for (const side of SIDES) {
    const c = new Vector3(side * Math.max(eye.x - R * 0.45, R * 0.55), eye.y + R * 0.2, eye.z + R * 0.15)
    g.add(part(new SphereGeometry(R, 24, 18), white, c.toArray()))
    // 눈동자: 바깥·앞을 보며 흰자에서 조금 튀어나온다
    const look = new Vector3(side, -0.1, 0.5).normalize()
    const p = c.clone().addScaledVector(look, R * 0.62)
    g.add(part(new SphereGeometry(R * 0.5, 18, 14), black, p.toArray()))
    g.add(part(new SphereGeometry(R * 0.13, 8, 6), shine, p.clone().addScaledVector(look, R * 0.42).add(new Vector3(0, R * 0.15, R * 0.08)).toArray()))
  }
  // 코는 점 하나
  const nz = frontZ(shape) - 0.02
  g.add(part(new SphereGeometry(0.014, 8, 6), black, [0, midY(sectionAt(shape, nz)) + 0.02, nz + 0.015]))
  return g
}

const sadBrows = (shape: FishShape) => {
  const { eye } = shape
  const r = eyeR(shape)
  const black = mat('#1a1a1a', { rough: 0.8 })
  const white = mat('#ffffff', { rough: 0.4 })
  const lid = mat('#8a6a45', { rough: 0.9 })
  const g = new Group()
  for (const side of SIDES) {
    const x = side * eye.x
    // 눈이 없는 모델(오징어)도 있어서 억울한 눈도 같이: 흰자 + 아래를 보는 눈동자 + 반쯤 내려온 눈꺼풀
    g.add(part(new SphereGeometry(r * 1.1, 16, 12), white, [x, eye.y, eye.z], [0, 0, 0], [0.45, 1, 1]))
    g.add(part(new SphereGeometry(r * 0.5, 12, 10), black, [x + side * r * 0.4, eye.y - r * 0.4, eye.z + r * 0.15], [0, 0, 0], [0.5, 1, 1]))
    g.add(part(new SphereGeometry(r * 1.16, 16, 8, 0, Math.PI * 2, 0, HALF_PI), lid, [x, eye.y, eye.z], [0.35, 0, side * 0.2], [0.5, 0.75, 1]))
    // 八자 눈썹: 앞쪽 끝이 올라가고 뒤로 처진다
    g.add(part(new BoxGeometry(0.03, 0.03, Math.max(r * 2.8, 0.12)), black, [side * (eye.x + 0.01), eye.y + r * 1.6, eye.z], [-0.55, 0, 0]))
  }
  return g
}

const DIGIT_COLOR = '#ffca28'

const digit3 = (shape: FishShape) => {
  const { eye } = shape
  const z = eye.z - eye.r
  const h = 0.24
  // 머리(와 바가지 머리) 위에 둥둥 떠 있는 3
  const m = readableFromBothSides(new Mesh(digitGeometry('3', h, 0.034), mat(DIGIT_COLOR, { glow: '#ff8f00', rough: 0.4 })))
  m.position.set(0, sectionAt(shape, z).top + 0.12 + h / 2, z)
  m.rotation.y = -HALF_PI
  const g = new Group()
  g.add(m)
  return g
}

const digits31 = (shape: FishShape) => {
  // 몸통에서 가장 두꺼운 곳 옆면에 붙은 등번호 31
  let best = sectionAt(shape, 0)
  let bestZ = 0
  for (const c of shape.sections) {
    if (c.z > -0.25 && c.z < 0.15 && c.s.top - c.s.bottom > best.top - best.bottom) {
      best = c.s
      bestZ = c.z
    }
  }
  const h = (best.top - best.bottom) * 0.78
  const tube = h * 0.11
  const m = readableFromBothSides(new Mesh(digitGeometry('31', h, tube, best.half + tube * 0.2), mat('#ffd54f', { rough: 0.5 })))
  m.position.set(0, midY(best), bestZ)
  m.rotation.y = -HALF_PI
  const g = new Group()
  g.add(m)
  return g
}

const darkCircles = (shape: FishShape) => {
  const { eye } = shape
  const r = eyeR(shape)
  const dark = mat('#4a3570', { rough: 0.9 })
  const faint = mat('#7a63a6', { rough: 0.9 })
  const g = new Group()
  for (const side of SIDES) {
    // 눈 밑 반달 두 겹 (아래쪽 반원 고리를 옆을 보게)
    g.add(part(new TorusGeometry(r * 1.15, r * 0.34, 8, 18, Math.PI), dark, [side * (eye.x - r * 0.05), eye.y - r * 0.15, eye.z], [0, HALF_PI, Math.PI], [1, 1, 0.5]))
    g.add(part(new TorusGeometry(r * 1.6, r * 0.22, 8, 18, Math.PI), faint, [side * (eye.x - r * 0.25), eye.y - r * 0.2, eye.z - r * 0.1], [0, HALF_PI, Math.PI], [1, 1, 0.5]))
  }
  return g
}

const priceTag3 = (shape: FishShape) => {
  const z = neckZ(shape)
  const [rx, ry, cy] = ringRadii(shape, z, 0.012)
  const string = mat('#efe6d0', { rough: 0.9 })
  const paper = mat('#ffffff', { rough: 0.7 })
  const g = new Group()
  // 목에 두른 끈
  g.add(part(new TorusGeometry(1, 0.008, 6, 32), string, [0, cy, z], [0.15, 0, 0], [rx, ry, 1]))
  // 턱 밑으로 늘어진 끈과 꼬리표 (옆에서 보이게 면이 ±x)
  const bottom = cy - ry
  g.add(part(new CylinderGeometry(0.006, 0.006, 0.12, 5), string, [0, bottom - 0.05, z + 0.03], [0.4, 0, 0]))
  const tag = new Group()
  tag.position.set(0, bottom - 0.1 - 0.11, z + 0.1)
  tag.rotation.set(0.25, 0, 0)
  tag.add(part(new BoxGeometry(0.014, 0.2, 0.34), paper))
  tag.add(part(new CylinderGeometry(0.016, 0.016, 0.016, 10), mat('#8d6e63'), [0, 0.06, 0.13], [0, 0, HALF_PI]))
  const text = readableFromBothSides(new Mesh(digitGeometry('₩3', 0.13, 0.015, 0.014), mat('#c62828', { rough: 0.6 })))
  text.position.set(0, -0.02, -0.02)
  text.rotation.y = -HALF_PI
  tag.add(text)
  g.add(tag)
  return g
}

/** 털 한 가닥 (원뿔). p 에서 dir 쪽으로 len 만큼 */
function strand(p: Vector3, dir: Vector3, len: number, radius: number): Mesh {
  const m = part(new ConeGeometry(radius, len, 5), STUB, p.clone().addScaledVector(dir, len * 0.35).toArray())
  m.quaternion.setFromUnitVectors(UP, dir)
  return m
}

/** 털을 몸 길이 방향으로 몇 덩어리로 나눠, 덩어리마다 가까운 뼈에 붙인다 (헤엄칠 때 몸을 따라 움직이게) */
const FUR_CHUNKS = 4
const FUR_COLORS = ['#5d4037', '#8d6e63', '#a1887f']

const furPerm = (shape: FishShape) => {
  const { eye } = shape
  const r = eyeR(shape)
  const head = headOf(shape)
  const g = new Group()
  const back = backZ(shape) + 0.02
  // 얼굴(눈·주둥이)은 털 밖으로 내민다
  const faceZ = eye.z - r * 1.2
  const chunks: Mesh[][][] = Array.from({ length: FUR_CHUNKS }, () => FUR_COLORS.map(() => []))
  const chunkOf = (z: number) => Math.min(FUR_CHUNKS - 1, Math.max(0, Math.floor(((z - back) / (faceZ - back)) * FUR_CHUNKS)))
  let n = 0
  const dir = new Vector3()
  const p = new Vector3()
  for (let z = back, ring = 0; z <= faceZ; z += 0.045, ring++) {
    const s = sectionAt(shape, z)
    const hx = Math.max(s.half, 0.02)
    const hy = Math.max((s.top - s.bottom) / 2, 0.02)
    const cy = midY(s)
    const perimeter = Math.PI * (3 * (hx + hy) - Math.sqrt((3 * hx + hy) * (hx + 3 * hy)))
    const count = Math.max(6, Math.ceil(perimeter / 0.05))
    for (let i = 0; i < count; i++) {
      const a = ((i + (ring % 2) * 0.5) / count) * Math.PI * 2
      const c = Math.cos(a)
      const sn = Math.sin(a)
      p.set(c * hx, cy + sn * hy, z)
      dir.set(c / hx, sn / hy, 0).normalize()
      dir.z = -0.45
      dir.normalize()
      n++
      // 등 쪽은 더 길게 (등지느러미 자리를 덮는다)
      const len = 0.06 + hash01(n) * 0.04 + (sn > 0.5 ? 0.05 : 0) + (sn < -0.6 ? 0.03 : 0)
      chunks[chunkOf(z)][n % FUR_COLORS.length].push(strand(p, dir, len, 0.036))
    }
  }
  // 꼬리 자리: 뒤로 길게 뻗은 털 뭉치
  const tail = sectionAt(shape, back)
  for (let i = 0; i < 22; i++) {
    const a = (i / 22) * Math.PI * 2
    dir.set(Math.cos(a) * 0.35, Math.sin(a) * 0.9, -1).normalize()
    p.set(Math.cos(a) * 0.02, midY(tail) + Math.sin(a) * 0.03, back)
    chunks[0][i % FUR_COLORS.length].push(strand(p, dir, 0.16 + hash01(i + 500) * 0.1, 0.035))
  }
  chunks.forEach((colors) =>
    colors.forEach((parts, ci) => {
      if (!parts.length) return
      const mesh = new Mesh(bake(parts), mat(FUR_COLORS[ci], { rough: 1 }))
      // dressFish 가 덩어리마다 가까운 뼈로 옮겨 붙인다
      mesh.userData.spread = true
      g.add(mesh)
    }),
  )

  // 머리 위 뽀글 파마: 작은 구와 고리 여러 개를 반구 위에 흩뿌린다
  const dome = Math.min(head.half * 1.05, 0.2)
  const top = sectionAt(shape, eye.z - r).top
  const center = new Vector3(0, top - dome * 0.25, eye.z - r * 1.2)
  const curls: Mesh[] = []
  const total = 34
  for (let i = 0; i < total; i++) {
    // 반구 위 피보나치 점
    const y = 1 - (i / (total - 1)) * 0.85
    const rr = Math.sqrt(1 - y * y)
    const th = i * 2.399963
    const q = new Vector3(Math.cos(th) * rr * dome * 1.05, y * dome * 0.85, Math.sin(th) * rr * dome * 1.25).add(center)
    curls.push(part(new SphereGeometry(0.04 + hash01(i + 900) * 0.012, 8, 6), STUB, q.toArray()))
    curls.push(part(new TorusGeometry(0.035, 0.013, 6, 10), STUB, q.toArray(), [hash01(i) * 3, hash01(i + 40) * 3, 0]))
  }
  g.add(new Mesh(bake(curls), mat('#2b1a12', { rough: 1 })))
  // 분홍 집게핀: 파마 뒤쪽에 비스듬히
  const pink = mat('#ff4f9a', { rough: 0.35 })
  const clip = new Group()
  clip.position.set(-dome * 0.75, center.y + dome * 0.45, center.z - dome * 0.6)
  clip.rotation.set(0, -0.5, 0.5)
  clip.add(part(new BoxGeometry(0.06, 0.08, 0.22), pink))
  for (let i = 0; i < 7; i++) clip.add(part(new BoxGeometry(0.02, 0.1, 0.018), pink, [i % 2 ? 0.025 : -0.025, -0.08, -0.09 + i * 0.03]))
  g.add(clip)
  return g
}

const bossChain = (shape: FishShape) => {
  const z = neckZ(shape)
  const [rx, ry, cy] = ringRadii(shape, z, 0.025)
  const links: Mesh[] = []
  const n = 22
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2
    const link = part(new TorusGeometry(0.03, 0.012, 6, 12), STUB, [Math.cos(a) * rx, Math.sin(a) * ry, 0], [i % 2 ? HALF_PI : 0, 0, a + HALF_PI], [1.5, 1, 1])
    link.rotation.order = 'ZYX'
    links.push(link)
  }
  const gold = mat('#ffc107', { metal: 0.9, rough: 0.25 })
  const g = new Group()
  const chain = new Mesh(bake(links), gold)
  // 앞이 조금 처지게
  chain.position.set(0, cy, z)
  chain.rotation.x = -0.3
  g.add(chain)
  // 턱 밑 큼직한 금메달
  g.add(part(new CylinderGeometry(0.055, 0.055, 0.016, 20), gold, [0, cy - ry - 0.05, z + 0.06], [HALF_PI - 0.3, 0, 0]))
  return g
}

const bossScar = (shape: FishShape) => {
  const { eye } = shape
  const r = eyeR(shape)
  const red = mat('#b71c1c', { rough: 0.7 })
  const g = new Group()
  // 사진에 보이는 쪽(-x) 눈을 비스듬히 가로지르는 흉터와 바느질 셋. 선글라스보다 바깥
  const scar = new Group()
  scar.position.set(-(eye.x + 0.036), eye.y + r * 0.2, eye.z)
  scar.rotation.x = 0.65
  const len = Math.max(r * 4.4, 0.22)
  scar.add(part(new BoxGeometry(0.014, len, 0.026), red))
  for (const t of [-0.3, 0, 0.3]) scar.add(part(new BoxGeometry(0.016, 0.014, 0.075), red, [0, t * len, 0]))
  g.add(scar)
  return g
}

const bread = (shape: FishShape) => {
  const z = BODY_Z - 0.02
  const s = sectionAt(shape, z)
  const g = new Group()
  // 소보로빵: 가슴지느러미께에 끼고 있다. 아래는 흰 종이, 위는 노란 소보로 알갱이
  const bun = new Group()
  bun.position.set(-(s.half + 0.1), midY(s) - (s.top - s.bottom) * 0.22, z)
  bun.rotation.set(0.2, 0, 0.5)
  const R = 0.12
  bun.add(part(new SphereGeometry(R, 20, 12), mat('#a86a2c', { rough: 0.9 }), [0, 0, 0], [0, 0, 0], [1, 0.62, 1]))
  bun.add(part(new CylinderGeometry(R * 1.04, R * 0.92, R * 0.5, 20, 1, true), mat('#fafafa', { rough: 0.9 }), [0, -R * 0.3, 0]))
  const crumbs: Mesh[] = []
  for (let i = 0; i < 26; i++) {
    const th = i * 2.399963
    const k = Math.sqrt((i + 0.5) / 26)
    crumbs.push(part(new SphereGeometry(0.022 + hash01(i + 300) * 0.01, 7, 5), STUB, [Math.cos(th) * k * R * 0.9, R * 0.62 * Math.sqrt(1 - k * k * 0.81) + 0.004, Math.sin(th) * k * R * 0.9]))
  }
  bun.add(new Mesh(bake(crumbs), mat('#f6d26b', { rough: 1 })))
  g.add(bun)
  return g
}

const grandpaBeard = (shape: FishShape) => {
  const { eye } = shape
  const r = eyeR(shape)
  const white = mat('#fafafa', { rough: 0.95 })
  const g = new Group()
  const z = frontZ(shape) - 0.08
  const s = sectionAt(shape, z)
  const chin = s.bottom + 0.02
  // 턱 밑으로 길게 늘어진 흰 수염 (원뿔 다발 + 뿌리 쪽 솜뭉치). 몸 아래로 확 나오게
  for (let i = -3; i <= 3; i++) {
    const x = i * 0.032
    const len = 0.32 - Math.abs(i) * 0.04
    const bz = z + 0.03 - Math.abs(i) * 0.015
    g.add(part(new ConeGeometry(0.045, len, 7), white, [x, chin - len / 2, bz + 0.03], [Math.PI - 0.3, 0, i * 0.1]))
    g.add(part(new SphereGeometry(0.05, 10, 8), white, [x, chin, bz]))
  }
  // 콧수염: 주둥이 양옆으로 처진 솜뭉치
  for (const side of SIDES) g.add(part(new SphereGeometry(0.045, 10, 8), white, [side * 0.06, chin + 0.06, z + 0.07], [0, 0, side * 0.5], [1.5, 0.7, 0.8]))
  // 흰 눈썹: 눈 위에서 바깥 아래로 처진 솜뭉치
  for (const side of SIDES) {
    const brow = new Group()
    brow.position.set(side * (eye.x + 0.005), eye.y + r * 2.1, eye.z)
    brow.rotation.set(0.35, 0, 0)
    brow.add(part(new SphereGeometry(0.045, 10, 8), white, [0, 0, 0], [0, 0, 0], [0.6, 0.7, 1.7]))
    brow.add(part(new ConeGeometry(0.025, 0.08, 6), white, [side * 0.01, -0.03, -0.07], [Math.PI - 0.6, 0, 0]))
    g.add(brow)
  }
  return g
}

const magnifierGlasses = (shape: FishShape) => {
  const r = Math.max(eyeR(shape) * 1.6, 0.075)
  const frame = mat('#3e2723', { rough: 0.4 })
  const lens = mat('#e1f5fe', { opacity: 0.3, rough: 0.05, metal: 0.1 })
  const white = mat('#ffffff', { rough: 0.3 })
  const black = mat('#111111', { rough: 0.2 })
  const g = glasses(
    shape,
    frame,
    (x, rr) => [
      part(new TorusGeometry(rr, 0.024, 10, 28), frame, [x, 0, 0], [0, HALF_PI, 0]),
      // 두꺼운 렌즈
      part(new CylinderGeometry(rr, rr, 0.03, 28), lens, [x + Math.sign(x) * 0.008, 0, 0], [0, 0, HALF_PI]),
      // 렌즈 너머로 크게 보이는 눈
      part(new SphereGeometry(rr * 0.78, 18, 12), white, [x - Math.sign(x) * 0.01, 0, 0], [0, 0, 0], [0.25, 1, 1]),
      part(new SphereGeometry(rr * 0.4, 14, 10), black, [x, -rr * 0.12, rr * 0.12], [0, 0, 0], [0.3, 1, 1]),
    ],
    r,
  )
  // glasses 는 눈 자리 기준으로 만든다
  g.position.set(0, shape.eye.y, shape.eye.z)
  const out = new Group()
  out.add(g)
  return out
}

const sheepTowel = (shape: FishShape) => {
  const { eye } = shape
  const head = headOf(shape)
  const z = eye.z - eye.r
  const top = sectionAt(shape, z).top
  const half = Math.min(head.half, 0.2)
  const towel = mat('#f8bbd0', { rough: 1 })
  const fold = mat('#f48fb1', { rough: 1 })
  const g = new Group()
  // 머리를 덮는 수건
  g.add(part(new SphereGeometry(1, 20, 10, 0, Math.PI * 2, 0, HALF_PI), towel, [0, top - 0.04, z], [0, 0, 0], [half * 1.15, 0.09, 0.2]))
  // 양옆에 돌돌 만 양 귀 (옆을 보는 고리 + 안쪽 작은 고리)
  for (const side of SIDES) {
    const roll = new Group()
    roll.position.set(side * half * 0.95, top + 0.02, z - 0.01)
    roll.rotation.y = HALF_PI
    roll.add(part(new TorusGeometry(0.07, 0.04, 10, 20), towel))
    roll.add(part(new TorusGeometry(0.03, 0.022, 8, 14), fold, [0, 0, side * 0.012]))
    roll.add(part(new SphereGeometry(0.03, 8, 6), towel))
    g.add(roll)
  }
  // 가운데 매듭
  g.add(part(new SphereGeometry(0.045, 12, 8), fold, [0, top + 0.05, z + 0.06], [0, 0, 0], [1.3, 0.8, 1]))
  return g
}

const cane = (shape: FishShape) => {
  const z = BODY_Z + 0.16
  const s = sectionAt(shape, z)
  const wood = mat('#5d4037', { rough: 0.7 })
  const g = new Group()
  const stick = new Group()
  // 사진에 보이는 쪽(-x) 가슴지느러미께에 비스듬히 짚은 지팡이
  const L = 0.62
  stick.position.set(-(s.half + 0.1), midY(s) - 0.08, z)
  stick.rotation.set(0.25, 0, 0.12)
  stick.add(part(new CylinderGeometry(0.018, 0.018, L, 8), wood))
  // 손잡이: 위끝에서 앞으로 굽은 반원
  stick.add(part(new TorusGeometry(0.06, 0.02, 8, 16, Math.PI), wood, [0, L / 2, 0.06], [0, HALF_PI, 0]))
  stick.add(part(new CylinderGeometry(0.022, 0.022, 0.04, 8), mat('#212121'), [0, -L / 2, 0]))
  g.add(stick)
  return g
}

/** 점 a 에서 b 까지 굵기 w 의 막대 (구운 지오메트리용) */
function stick(a: Vector3, b: Vector3, w: number): Mesh {
  const d = b.clone().sub(a)
  const m = part(new BoxGeometry(w, d.length() + w, w * 0.6), STUB, a.clone().add(b).multiplyScalar(0.5).toArray())
  m.quaternion.setFromUnitVectors(UP, d.normalize())
  return m
}

const bowlCut = (shape: FishShape) => {
  const { eye } = shape
  const r = eyeR(shape)
  const head = headOf(shape)
  const g = new Group()
  // 앞머리 끝은 눈 바로 위에서 일자로 자른다
  const rim = eye.y + r * 1.25
  const front = Math.min(frontZ(shape) - 0.02, eye.z + r * 2.4)
  const back = eye.z - 0.4
  const cz = (front + back) / 2
  const rz = (front - back) / 2
  const rx = Math.max(head.half, eye.x) * 1.04
  const height = Math.max(sectionAt(shape, eye.z - r).top - rim + 0.07, 0.08)
  g.add(part(new SphereGeometry(1, 28, 10, 0, Math.PI * 2, 0, HALF_PI), mat('#2b1d16', { rough: 0.85 }), [0, rim, cz], [0, 0, 0], [rx, height, rz]))
  // 각 잡힌 아랫단
  g.add(part(new CylinderGeometry(1, 1, 0.035, 28, 1, true), mat('#2b1d16', { rough: 0.85 }), [0, rim + 0.015, cz], [0, 0, 0], [rx * 1.015, 1, rz * 1.015]))
  // 정수리에서 아랫단까지 빗어 내린 머리결
  const strands: Mesh[] = []
  const on = (th: number, ph: number) => new Vector3(Math.sin(th) * Math.cos(ph) * rx * 1.01, rim + Math.cos(th) * height * 1.01, cz + Math.sin(th) * Math.sin(ph) * rz * 1.01)
  for (let k = 0; k < 40; k++) {
    const ph = (k / 40) * Math.PI * 2
    for (let j = 0; j < 4; j++) strands.push(stick(on(0.12 + j * 0.36, ph), on(0.12 + (j + 1) * 0.36, ph), 0.012))
  }
  g.add(new Mesh(bake(strands), mat('#5a4032', { rough: 0.8 })))
  return g
}

const clampTeeth = (shape: FishShape) => {
  // 몸통 가운데를 위아래에서 꽉 문 큼직한 앞니 한 쌍 (XXL배정빈의 이). 잇몸이 조금 보인다
  const s = sectionAt(shape, BODY_Z)
  const white = mat('#fbfbf6', { rough: 0.25 })
  const gum = mat('#ec8f9a', { rough: 0.7 })
  const jaw = mat('#4e342e', { rough: 0.6 })
  const w = 0.2 // 앞뒤(z) 폭
  const h = 0.2 // 이 높이
  const t = 0.16 // 두께(x)
  const bite = 0.035 // 몸에 파고드는 깊이
  const g = new Group()
  for (const up of SIDES) {
    const edge = up > 0 ? s.top - bite : s.bottom + bite
    const y = edge + (up * h) / 2
    g.add(part(new RoundedBoxGeometry(t, h, w, 3, 0.04), white, [0, y, BODY_Z]))
    // 이 양옆에 조금 짧은 이가 하나씩 (이빨 줄로 보이게). 뿌리는 잇몸에 맞춘다
    for (const side of SIDES) g.add(part(new RoundedBoxGeometry(t * 0.85, h * 0.72, w * 0.72, 3, 0.035), white, [0, edge + up * h * 0.64, BODY_Z + side * w * 0.9]))
    // 이 뿌리 쪽 잇몸
    g.add(part(new RoundedBoxGeometry(t * 1.15, 0.07, w * 2.6, 3, 0.03), gum, [0, edge + up * (h + 0.015), BODY_Z]))
    // 잇몸을 감싼 XXL배정빈의 짙은 갈색 턱 (이가 누구 건지 보이게)
    g.add(part(new RoundedBoxGeometry(t * 1.9, 0.2, w * 3.4, 4, 0.08), jaw, [0, edge + up * (h + 0.14), BODY_Z]))
  }
  // 위턱 옆면에 XXL배정빈 등번호 31
  const numH = 0.15
  const tube = numH * 0.12
  const upperEdge = s.top - bite
  const num = readableFromBothSides(new Mesh(digitGeometry('31', numH, tube, t * 0.95 + tube * 0.2), mat('#ffd54f', { rough: 0.5 })))
  num.position.set(0, upperEdge + h + 0.14, BODY_Z)
  num.rotation.y = -HALF_PI
  g.add(num)
  return g
}

/** 추멸치떼 한 마리: 몸통 + 꼬리를 한 지오메트리로 (색은 정점 색). 머리 +z, 몸길이 약 0.13 */
function anchovyGeometry(): BufferGeometry {
  const pieces = [
    part(new SphereGeometry(1, 8, 6), STUB, [0, 0, 0.012], [0, 0, 0], [0.019, 0.026, 0.06]),
    part(new ConeGeometry(0.032, 0.06, 4), STUB, [0, 0, -0.065], [HALF_PI, 0, 0], [0.3, 1, 1]),
  ]
  const geometry = bake(pieces)
  // 등은 짙고 배는 은빛. 같은 멸치끼리 지오메트리를 나눠 쓰고, 색은 재질 색과 곱한다
  const pos = geometry.attributes.position
  const colors = new Float32Array(pos.count * 3)
  const back = new Color('#5f7f96')
  const belly = new Color('#ffffff')
  const c = new Color()
  for (let i = 0; i < pos.count; i++) {
    c.lerpColors(belly, back, Math.min(1, Math.max(0, pos.getY(i) / 0.026 + 0.35)))
    c.toArray(colors, i * 3)
  }
  geometry.setAttribute('color', new BufferAttribute(colors, 3))
  return geometry
}

/** 추멸치떼 한 마리가 제자리에서 꼬리를 흔드는 속도·각도 */
const SCHOOL_WIGGLE = { speed: 9, angle: 0.3 }
const wiggleBase = new Matrix4()
const wiggleTurn = new Matrix4()

/**
 * 작은 멸치 수십 마리가 모여 큰 물고기 모양을 만든다 (헤엄이 무리). 원래 몸은 숨기고(HIDES_PART) 그 자리를 채운다.
 * 눈 자리에는 까만 대장 멸치. 멸치마다 가까운 뼈에 붙어서 헤엄치는 몸을 따라 휘고, 그릴 때 저마다 꼬리를 흔든다
 */
const anchovySchool = () => {
  // 큰 물고기 윤곽: 길이 1.2(z -0.6~0.6, 가운데 높이 0), 높이 H. u 는 꼬리 끝 0 ~ 주둥이 1.
  // 뒤쪽 TAIL 만큼은 가운데가 파인 갈라진 꼬리, 나머지는 앞쪽이 조금 뭉툭한 타원 몸통
  const H = 0.6
  const TAIL = 0.24
  const inside = (u: number, y: number) => {
    const a = Math.abs(y)
    if (u < TAIL) {
      const k = u / TAIL
      // 꼬리 끝은 넓고 가운데가 파였다가, 몸에 붙는 자루(k=1)는 좁다
      return a < (H / 2) * (0.95 - 0.75 * k) && a > (H / 2) * 0.45 * (1 - k * 2.2)
    }
    const v = (u - TAIL) / (1 - TAIL)
    return a < (H / 2) * Math.max(0.22, Math.sqrt(1 - ((v - 0.55) / (v < 0.55 ? 0.55 : 0.45)) ** 2))
  }
  // 대장 멸치(눈) 자리: 주둥이 쪽 위
  const eye = { z: 0.38, y: H * 0.1 }
  const geometry = anchovyGeometry()
  const silver = mat('#eef6fa', { metal: 0.25, rough: 0.35 })
  silver.vertexColors = true
  const black = mat('#1d2a33', { rough: 0.5 })
  const g = new Group()
  const dz = 0.135
  const dy = 0.085
  let n = 0
  let leader: { mesh: Mesh; d: number } | null = null
  for (let row = 0, y = -H / 2; y <= H / 2 + 1e-6; row++, y += dy) {
    for (let z = -0.6 + 0.05 + (row % 2) * (dz / 2); z <= 0.58; z += dz) {
      const u = (z + 0.6) / 1.2
      if (!inside(u, y)) continue
      n++
      // 두 겹으로 엇갈려 두께를 조금 준다 (위에서 봐도 떼로 보이게)
      const p = new Vector3((row % 2 ? 1 : -1) * 0.03 + (hash01(n + 150) - 0.5) * 0.08, y + (hash01(n) - 0.5) * 0.02, z + (hash01(n + 70) - 0.5) * 0.03)
      const mesh = schoolFish(geometry, silver, p, n)
      g.add(mesh)
      const d = Math.hypot(p.z - eye.z, p.y - eye.y)
      if (!leader || d < leader.d) leader = { mesh, d }
    }
  }
  // 대장(눈): 눈 자리에 가장 가까운 멸치를 까맣게 하고 사진에 보이는 쪽(-x)으로 조금 내민다
  if (leader) {
    leader.mesh.material = black
    leader.mesh.position.x = -0.1
  }
  return g
}

function schoolFish(geometry: BufferGeometry, material: MeshStandardMaterial, at: Vector3, n: number): Mesh {
  const m = new Mesh(geometry, material)
  m.position.copy(at)
  m.rotation.set((hash01(n + 30) - 0.5) * 0.25, (hash01(n + 50) - 0.5) * 0.35, 0)
  m.userData.spread = true
  const phase = hash01(n + 110) * Math.PI * 2
  // 그릴 때만 세로축으로 살짝 돌려 꼬리를 흔든다 (뼈 애니메이션과 따로)
  m.onBeforeRender = () => {
    if (!m.parent) return
    const a = Math.sin(performance.now() * 0.001 * SCHOOL_WIGGLE.speed + phase) * SCHOOL_WIGGLE.angle
    wiggleBase.multiplyMatrices(m.parent.matrixWorld, m.matrix)
    m.matrixWorld.copy(wiggleBase.multiply(wiggleTurn.makeRotationY(a)))
  }
  return m
}

export const STUDY_ACCESSORIES: Record<StudyAccessoryKind, { anchor: Anchor; build: (shape: FishShape) => Group }> = {
  spoons: { anchor: 'mouth', build: spoons },
  googlyEyes: { anchor: 'eye', build: googlyEyes },
  sadBrows: { anchor: 'eye', build: sadBrows },
  digit3: { anchor: 'top', build: digit3 },
  digits31: { anchor: 'body', build: digits31 },
  darkCircles: { anchor: 'eye', build: darkCircles },
  priceTag3: { anchor: 'neck', build: priceTag3 },
  furPerm: { anchor: 'top', build: furPerm },
  bossChain: { anchor: 'neck', build: bossChain },
  bossScar: { anchor: 'eye', build: bossScar },
  bread: { anchor: 'body', build: bread },
  grandpaBeard: { anchor: 'mouth', build: grandpaBeard },
  magnifierGlasses: { anchor: 'eye', build: magnifierGlasses },
  sheepTowel: { anchor: 'top', build: sheepTowel },
  cane: { anchor: 'body', build: cane },
  bowlCut: { anchor: 'top', build: bowlCut },
  clampTeeth: { anchor: 'body', build: clampTeeth },
  anchovySchool: { anchor: 'body', build: anchovySchool },
}

/** 이 소품을 쓰면 모델의 원래 부위를 숨긴다 (왕눈이 → 원래 눈, 털 → 지느러미, 멸치떼 → 몸 전체) */
export const HIDES_PART: Partial<Record<FishAccessoryKind, 'eyes' | 'fins' | 'body'>> = { googlyEyes: 'eyes', furPerm: 'fins', anchovySchool: 'body' }
