import { Matrix4, Vector3, type Bone, type Material, type MeshStandardMaterial, type Object3D, type SkinnedMesh, type Texture } from 'three'
import { ALWAYS_VISIBLE_NODES, PART_NODES } from '../data/characterParts'
import type { CharacterLook, OutfitId } from '../data/types'

type Axis = 0 | 1 | 2

/** 뼈 하나의 로컬 축: 길이 방향, 모델 옆(x)·앞(z) 방향과 가장 나란한 축 */
type BoneAxes = { length: Axis; side: Axis; depth: Axis }

/**
 * 몸 부위 배율은 bone.scale 이 아니라 "그 뼈에 붙은 꼭짓점만" 늘리는 방식으로 준다.
 * 스킨 행렬 = 뼈 월드 행렬 × 역바인드 행렬 이므로, 역바인드 행렬 앞에 뼈 로컬 축 배율 S 를 곱하면
 * 그 뼈에 붙은 살만 뼈 기준으로 부풀고 자식 뼈(손·발·머리)는 전혀 영향을 받지 않는다.
 * bone.scale 을 쓰면 배율이 자식에게 번지고, 자식이 돌아가 있을 때 되돌리기 배율이 맞지 않아
 * 팔꿈치·무릎을 굽히면 살이 비틀린다(전단). 길이는 자식 뼈 위치를 옮겨서 늘린다(위치 트랙이 없어 유지된다)
 */
export type CharacterRig = {
  root: Object3D
  parts: Map<string, Object3D>
  skin: MeshStandardMaterial[]
  hair: MeshStandardMaterial[]
  outfits: Record<OutfitId, { material: MeshStandardMaterial; base: Texture | null }[]>
  bones: Map<string, Bone>
  /** 기본 자세에서 잰 값들 (배율 계산용) */
  rest: {
    /** 허벅지 시작 ~ 발목 높이 차 */
    legLength: number
    /** 뼈마다 로컬 축 */
    axes: Map<string, BoneAxes>
    /** 길이·어깨 조절로 옮기는 뼈들의 원래 위치 */
    positions: Map<string, Vector3>
    /** 쇄골마다: spine_03 로컬 옆 방향으로 잰 위팔 시작점 거리(부호 포함). 어깨를 벌릴 때 이만큼을 기준으로 옮긴다 */
    shoulderSpan: Map<string, number>
    /** 스켈레톤별 원래 역바인드 행렬. 인스턴스마다 복제한 배열에 배율을 곱해 넣는다 */
    skeletons: { inverses: Matrix4[]; rest: Matrix4[]; names: string[] }[]
  }
  /** 다리 길이 배율. applyLook 이 채운다 */
  legScale: number
  /**
   * 다리 길이에 맞춰 몸을 올리는 높이(키 배율 포함). applyLook 이 선 자세 기준값을 넣고,
   * 매 프레임 measureLift 가 지금 자세로 다시 잰다
   */
  lift: number
}

const worldAxis = new Vector3()
const tmp = new Vector3()
const m = new Matrix4()

/** bone 의 로컬 축 중 world 방향 dir 과 가장 나란한 축 */
function axisAlong(bone: Object3D, dir: Vector3): Axis {
  m.extractRotation(bone.matrixWorld)
  let best: Axis = 0
  let bestDot = -1
  for (const i of [0, 1, 2] as Axis[]) {
    worldAxis.setFromMatrixColumn(m, i).normalize()
    const d = Math.abs(worldAxis.dot(dir))
    if (d > bestDot) {
      bestDot = d
      best = i
    }
  }
  return best
}

/** 자식 뼈 쪽을 가리키는 로컬 축 (= 뼈 길이 방향). 이 뼈대는 모두 y 지만 이름 규칙에 기대지 않고 잰다 */
function lengthAxis(bone: Object3D): Axis {
  const child = bone.children.find((c) => (c as Bone).isBone)
  if (!child) return 1
  const p = child.position
  const abs = [Math.abs(p.x), Math.abs(p.y), Math.abs(p.z)]
  return abs.indexOf(Math.max(...abs)) as Axis
}

/** 길이 조절로 위치를 옮기는 뼈 (부모 뼈 길이만큼 떨어진 자식) */
const LENGTH_CHILDREN = ['lowerarm_l', 'lowerarm_r', 'hand_l', 'hand_r', 'calf_l', 'calf_r', 'foot_l', 'foot_r']
const CLAVICLES = { clavicle_l: 'upperarm_l', clavicle_r: 'upperarm_r' }

/** StrictMode 는 useMemo 를 두 번 불러 한쪽 결과를 버린다. 두 번째 호출이 재질을 또 바꿔 끼우지 않게 객체마다 한 번만 준비한다 */
const prepared = new WeakMap<Object3D, CharacterRig>()

/**
 * 복제한 캐릭터를 꾸밀 준비를 한다. 재질과 역바인드 행렬은 인스턴스마다 복제해서
 * 미리보기와 게임 속 캐릭터가 서로의 색·체형을 바꾸지 않게 한다. 반드시 애니메이션 전 기본 자세에서 부른다
 */
export function prepareCharacter(root: Object3D): CharacterRig {
  const done = prepared.get(root)
  if (done) return done
  const parts = new Map<string, Object3D>()
  const bones = new Map<string, Bone>()
  const skin: MeshStandardMaterial[] = []
  const hair: MeshStandardMaterial[] = []
  const outfits: CharacterRig['outfits'] = { peasant: [], ranger: [] }
  const cloned = new Map<Material, MeshStandardMaterial>()
  // SkeletonUtils.clone 은 역바인드 행렬 배열을 원본과 함께 쓴다. 원본 배열마다 한 번만 복제한다
  const inverseCopies = new Map<Matrix4[], CharacterRig['rest']['skeletons'][number]>()

  root.updateWorldMatrix(true, true)
  root.traverse((o) => {
    if ((o as Bone).isBone) bones.set(o.name, o as Bone)
    if (o.name) parts.set(o.name, o)
    const mesh = o as SkinnedMesh
    if (!mesh.isMesh) return
    // 머리카락 재질은 텍스처가 달라 두 개지만 이름이 같아(hair) 둘 다 색을 곱한다
    const original = mesh.material as MeshStandardMaterial
    let material = cloned.get(original)
    if (!material) {
      material = original.clone()
      cloned.set(original, material)
      if (material.name.startsWith('skin')) skin.push(material)
      else if (material.name === 'hair') hair.push(material)
      else if (material.name === 'peasant' || material.name === 'ranger') outfits[material.name].push({ material, base: material.map })
    }
    mesh.material = material

    if (!mesh.isSkinnedMesh) return
    const skeleton = mesh.skeleton
    let copy = inverseCopies.get(skeleton.boneInverses)
    if (!copy) {
      copy = {
        inverses: skeleton.boneInverses.map((x) => x.clone()),
        rest: skeleton.boneInverses.map((x) => x.clone()),
        names: skeleton.bones.map((b) => b.name),
      }
      inverseCopies.set(skeleton.boneInverses, copy)
    }
    skeleton.boneInverses = copy.inverses
  })

  const side = new Vector3(1, 0, 0)
  const depth = new Vector3(0, 0, 1)
  const axes = new Map<string, BoneAxes>()
  for (const [name, bone] of bones) axes.set(name, { length: lengthAxis(bone), side: axisAlong(bone, side), depth: axisAlong(bone, depth) })

  const positions = new Map<string, Vector3>()
  for (const name of [...LENGTH_CHILDREN, ...Object.keys(CLAVICLES)]) {
    const b = bones.get(name)
    if (b) positions.set(name, b.position.clone())
  }

  const shoulderSpan = new Map<string, number>()
  const chest = bones.get('spine_03')
  const chestSide = axes.get('spine_03')?.side ?? 0
  for (const [clavicle, upperarm] of Object.entries(CLAVICLES)) {
    const arm = bones.get(upperarm)
    // 쇄골 위치는 spine_03 기준이라 부모가 spine_03 일 때만 맞다
    if (!chest || !arm || bones.get(clavicle)?.parent !== chest) continue
    const local = chest.worldToLocal(arm.getWorldPosition(new Vector3()))
    shoulderSpan.set(clavicle, local.getComponent(chestSide))
  }

  const thigh = bones.get('thigh_l')
  const foot = bones.get('foot_l')
  const legLength = thigh && foot ? thigh.getWorldPosition(tmp).y - foot.getWorldPosition(new Vector3()).y : 0.8
  const rig: CharacterRig = { root, parts, skin, hair, outfits, bones, rest: { legLength, axes, positions, shoulderSpan, skeletons: [...inverseCopies.values()] }, legScale: 1, lift: 0 }
  prepared.set(root, rig)
  return rig
}

function setVisible(rig: CharacterRig, names: string[], visible: boolean) {
  for (const name of names) {
    const node = rig.parts.get(name)
    if (node) node.visible = visible
  }
}

const allPartNodes = [
  ...Object.values(PART_NODES.hair),
  PART_NODES.beard,
  ...Object.values(PART_NODES.top).flat(),
  ...Object.values(PART_NODES.bottom).flat(),
  ...Object.values(PART_NODES.shoes).flat(),
  PART_NODES.hood,
]

/** 모습 적용: 부위 보이기, 색, 옷 텍스처, 몸 부위 배율 */
export function applyLook(rig: CharacterRig, look: CharacterLook, altMaps: Record<OutfitId, Texture>) {
  // 1) 부위
  setVisible(rig, allPartNodes, false)
  setVisible(rig, ALWAYS_VISIBLE_NODES, true)
  if (look.hair !== 'none' && !look.hood) setVisible(rig, [PART_NODES.hair[look.hair]], true)
  if (look.gender === 'male' && look.beard) setVisible(rig, [PART_NODES.beard], true)
  setVisible(rig, PART_NODES.top[look.top], true)
  setVisible(rig, PART_NODES.bottom[look.bottom], true)
  setVisible(rig, PART_NODES.shoes[look.shoes], true)
  if (look.hood) setVisible(rig, [PART_NODES.hood], true)

  // 2) 색: 밝게 만든 피부·머리 텍스처에 색을 곱한다
  for (const mat of rig.skin) mat.color.set(look.skinColor)
  for (const mat of rig.hair) mat.color.set(look.hairColor)

  // 3) 옷 색: 텍스처 바꾸기
  for (const outfit of ['peasant', 'ranger'] as OutfitId[]) {
    for (const { material, base } of rig.outfits[outfit]) {
      const map = look.outfitColor === 'alt' ? altMaps[outfit] : base
      if (material.map !== map) {
        material.map = map
        material.needsUpdate = true
      }
    }
  }

  // 4) 몸 부위 배율 (뼈 로컬 축 기준, 그 뼈에 붙은 살만)
  const { bones, rest } = rig
  const b = look.body
  const scales = new Map<string, Vector3>()
  /** name 뼈의 어떤 축에 배율 s 를 곱한다 */
  const mul = (name: string, pick: (a: BoneAxes) => Axis[], s: number) => {
    const a = rest.axes.get(name)
    if (!a) return
    let v = scales.get(name)
    if (!v) scales.set(name, (v = new Vector3(1, 1, 1)))
    for (const i of new Set(pick(a))) v.setComponent(i, v.getComponent(i) * s)
  }
  const sideAxis = (a: BoneAxes) => [a.side]
  const depthAxis = (a: BoneAxes) => [a.depth]
  /** 길이 방향이 아닌 두 축 */
  const thickness = (a: BoneAxes) => ([0, 1, 2] as Axis[]).filter((x) => x !== a.length)
  const lengthAxisOf = (a: BoneAxes) => [a.length]
  const all = () => [0, 1, 2] as Axis[]

  mul('Head', all, b.head)
  // 배: 골반·허리 옆·앞뒤
  for (const name of ['pelvis', 'spine_01']) {
    mul(name, sideAxis, b.belly)
    mul(name, depthAxis, b.belly)
  }
  // 가슴·등: 척추 위쪽 옆·앞뒤. 어깨 너비는 spine_03 옆 방향에도 곱한다
  // 앞뒤는 1.5제곱으로 더 늘린다. 가슴 앞뒤 살 상당 부분이 쇄골·목 뼈에도 묶여 있어, 같은 배율이면 옆에서 봐도 두께 차이가 거의 안 보였다
  for (const name of ['spine_02', 'spine_03']) {
    mul(name, sideAxis, b.chest)
    mul(name, depthAxis, b.chest ** 1.5)
  }
  mul('spine_03', sideAxis, b.shoulders)
  for (const s of ['l', 'r']) {
    for (const name of [`upperarm_${s}`, `lowerarm_${s}`]) {
      mul(name, thickness, b.armThickness)
      mul(name, lengthAxisOf, b.armLength)
    }
    for (const name of [`thigh_${s}`, `calf_${s}`]) {
      mul(name, thickness, b.legThickness)
      mul(name, lengthAxisOf, b.legLength)
    }
  }
  for (const sk of rest.skeletons) {
    for (let i = 0; i < sk.names.length; i++) {
      const v = scales.get(sk.names[i])
      sk.inverses[i].copy(sk.rest[i])
      if (v) sk.inverses[i].premultiply(m.makeScale(v.x, v.y, v.z))
    }
  }

  // 길이: 늘린 뼈 끝에 있는 자식 뼈를 같은 비율로 옮긴다 (손·발 크기는 그대로)
  for (const [name, restPos] of rest.positions) {
    const bone = bones.get(name)
    if (!bone) continue
    const k = name.startsWith('lowerarm') || name.startsWith('hand') ? b.armLength : name.startsWith('calf') || name.startsWith('foot') ? b.legLength : 1
    bone.position.copy(restPos).multiplyScalar(k)
  }

  // 어깨 너비: 넓어진 가슴(spine_03 옆 배율)만큼 쇄골째 팔을 옆으로 옮긴다. 팔이 몸통에 파묻히거나 떠 있지 않게
  const chestSide = rest.axes.get('spine_03')?.side
  for (const [name, span] of rest.shoulderSpan) {
    const bone = bones.get(name)
    const restPos = rest.positions.get(name)
    if (!bone || !restPos || chestSide === undefined) continue
    bone.position.copy(restPos)
    bone.position.setComponent(chestSide, restPos.getComponent(chestSide) + span * (b.chest * b.shoulders - 1))
  }

  // 키: 루트 균일 배율 (발이 원점이라 땅에 붙어 있다)
  bones.get('root')?.scale.setScalar(look.height)

  // 다리가 길어진 만큼 몸을 올려 발이 땅에 닿게 한다 (선 자세 기준. 애니메이션 중엔 measureLift 가 덮어쓴다)
  rig.legScale = b.legLength
  rig.lift = (b.legLength - 1) * rest.legLength * look.height
}

const hip = new Vector3()
const ankle = new Vector3()

/**
 * 지금 자세에서 다리 길이 때문에 몸을 올려야 하는 높이를 재서 rig.lift 에 넣는다. mixer.update 뒤에 부른다.
 * 다리를 L 배 늘리면 엉덩이는 "지금 허벅지~발목의 세로 거리"의 (L-1)/L 만큼만 올라간다(그 거리는 이미 L 배라서).
 * 서 있으면 다리 전체, 앉으면 정강이만큼, 누워 다리를 든 자세면 0 이다. 두 다리 중 더 긴 쪽(땅을 딛는 쪽)을 쓴다.
 * 조상 노드는 y축 회전·이동뿐이라 월드 y 차이 = 모델 기준 높이 차이다
 */
export function measureLift(rig: CharacterRig): number {
  const L = rig.legScale
  if (L === 1) return (rig.lift = 0)
  let span = 0
  for (const [t, f] of [['thigh_l', 'foot_l'], ['thigh_r', 'foot_r']]) {
    const thigh = rig.bones.get(t)
    const foot = rig.bones.get(f)
    if (!thigh || !foot) continue
    foot.updateWorldMatrix(true, false) // 허벅지는 발의 조상이라 함께 갱신된다
    span = Math.max(span, hip.setFromMatrixPosition(thigh.matrixWorld).y - ankle.setFromMatrixPosition(foot.matrixWorld).y)
  }
  return (rig.lift = (span * (L - 1)) / L)
}
