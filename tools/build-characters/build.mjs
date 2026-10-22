// Quaternius 무료 팩(몸·머리카락·옷·애니메이션)을 성별마다 뼈대 하나짜리 glb 로 합친다.
// 사용: npm run fetch 로 .cache 를 채운 뒤 npm run build
// 노드·재질·클립 이름은 게임 코드(src/game/data/characterParts.ts)가 그대로 쓴다. 바꾸면 거기도 바꿔야 한다
import { NodeIO } from '@gltf-transform/core'
import { KHRMeshQuantization } from '@gltf-transform/extensions'
import { compactPrimitive, dedup, mergeDocuments, prune, quantize, resample, textureCompress, unpartition } from '@gltf-transform/functions'
import sharp from 'sharp'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const CACHE = path.join(HERE, '.cache')
const OUT = path.resolve(HERE, '../../public/models/characters')
// quantize() 가 붙이는 KHR_mesh_quantization 을 등록해야 쓸 때 extensionsUsed/Required 에 남는다
const io = new NodeIO().registerExtensions([KHRMeshQuantization])

// ---- 원본 경로 ----
const BASE = path.join(CACHE, 'universal-base-characters/Universal Base Characters[Standard]')
const FANT = path.join(CACHE, 'modular-character-outfits-fantasy/Modular Character Outfits - Fantasy[Standard]')
const UAL = path.join(CACHE, 'universal-animation-library/Universal Animation Library[Standard]/Unreal-Godot/UAL1_Standard.glb')
const BODY = (g) => path.join(BASE, `Base Characters/Godot - UE/Superhero_${g}_FullBody.gltf`)
const HAIR = (n) => path.join(BASE, `Hairstyles/Rigged to Head Bone/glTF (Godot -Unreal)/Hair_${n}.gltf`)
const OUTFIT = (n) => path.join(FANT, `Exports/glTF (Godot-Unreal)/Modular Parts/${n}.gltf`)
// 남자 레인저 팔찌는 Modular Parts 에 따로 없고 옷 한 벌 파일(Outfits/Male_Ranger.gltf)에만 있다
const OUTFIT_SET = (n) => path.join(FANT, `Exports/glTF (Godot-Unreal)/Outfits/${n}.gltf`)
const ALT_TEXTURES = {
  'peasant_alt.jpg': path.join(FANT, 'Textures/Peasant/T_Peasant_2_BaseColor.png'),
  'ranger_alt.jpg': path.join(FANT, 'Textures/Ranger/T_Ranger_3_BaseColor.png'),
}

// ---- 성별별 부위: [원본 파일, { 원본 노드 이름: 새 노드 이름 }] ----
// 첫 항목(Peasant_Body)의 뼈대가 그 성별 파일의 유일한 뼈대가 된다
const HAIRS = [
  [HAIR('SimpleParted'), { Hair_SimpleParted: 'hair_simpleParted' }],
  [HAIR('Buzzed'), { Hair_Buzzed: 'hair_buzzed' }],
  [HAIR('Long'), { Hair_Long: 'hair_long' }],
  [HAIR('Buns'), { Hair_Buns: 'hair_buns' }],
  [HAIR('BuzzedFemale'), { Hair_BuzzedFemale: 'hair_buzzedFemale' }],
]
const PARTS = {
  male: [
    [OUTFIT('Male_Peasant_Body'), { Male_Peasant_Body: 'peasant_body' }],
    [BODY('Male'), { SuperHero_Male: 'head', Eyes: 'eyes', Eyebrows: 'eyebrows' }],
    ...HAIRS,
    [HAIR('Beard'), { Hair_Beard: 'beard' }],
    [OUTFIT('Male_Peasant_Arms'), { Male_Peasant_Arms: 'peasant_arms' }],
    [OUTFIT('Male_Peasant_Legs'), { Male_Peasant_Legs: 'peasant_legs' }],
    [OUTFIT('Male_Peasant_Feet'), { Male_Peasant_Feet: 'peasant_feet' }],
    [OUTFIT('Male_Ranger_Arms'), { Male_Ranger_Arms: 'ranger_arms' }],
    [OUTFIT_SET('Male_Ranger'), { Male_Ranger_Arms_Bracer: 'ranger_bracer' }],
    [OUTFIT('Male_Ranger_Body'), { Male_Ranger_Body: 'ranger_body', Male_Ranger_Body_Belt_1: 'ranger_belt1', Male_Ranger_Body_Belt_2: 'ranger_belt2' }],
    [OUTFIT('Male_Ranger_Acc_Pauldron'), { Male_Ranger_Acc_Pauldron: 'ranger_pauldron' }],
    [OUTFIT('Male_Ranger_Legs'), { Male_Ranger_Legs: 'ranger_legs' }],
    [OUTFIT('Male_Ranger_Feet_Boots'), { Male_Ranger_Feet_Boots: 'ranger_feet' }],
    [OUTFIT('Male_Ranger_Head_Hood'), { Male_Ranger_Head_Hood: 'ranger_hood' }],
  ],
  female: [
    [OUTFIT('Female_Peasant_Body'), { Female_Peasant_Body: 'peasant_body' }],
    [BODY('Female'), { Superhero_Female: 'head', Eyes: 'eyes', Eyebrows: 'eyebrows' }],
    ...HAIRS,
    [OUTFIT('Female_Peasant_Arms'), { Female_Peasant_Arms: 'peasant_arms' }],
    [OUTFIT('Female_Peasant_Legs'), { Female_Peasant_Legs: 'peasant_legs' }],
    [OUTFIT('Female_Peasant_Feet'), { Female_Peasant_Feet: 'peasant_feet' }],
    [OUTFIT('Female_Ranger_Arms'), { Female_Ranger_Arms: 'ranger_arms', Female_Ranger_Arms_Bracer: 'ranger_bracer' }],
    [OUTFIT('Female_Ranger_Body'), { Female_Ranger_Body: 'ranger_body', Female_Ranger_Body_Belt_1: 'ranger_belt1', Female_Ranger_Body_Belt_2: 'ranger_belt2' }],
    [OUTFIT('Female_Ranger_Acc_Pauldrons'), { Female_Ranger_Acc_Pauldrons: 'ranger_pauldron' }],
    [OUTFIT('Female_Ranger_Legs'), { Female_Ranger_Legs: 'ranger_legs' }],
    [OUTFIT('Female_Ranger_Feet'), { Female_Ranger_Feet: 'ranger_feet' }],
    [OUTFIT('Female_Ranger_Head_Hood'), { Female_Ranger_Head_Hood: 'ranger_hood' }],
  ],
}

const CLIPS = ['Idle_Loop', 'Walk_Loop', 'Jog_Fwd_Loop', 'Pistol_Aim_Up', 'Pistol_Aim_Neutral', 'Pistol_Aim_Down', 'Push_Loop',
  'Dance_Loop', 'Death01', 'Crouch_Idle_Loop', 'Sitting_Enter', 'Sitting_Idle_Loop', 'Sitting_Exit',
  'Sprint_Loop', 'Jump_Start', 'Jump_Loop', 'Jump_Land', 'Idle_Talking_Loop', 'Roll', 'Punch_Jab', 'Spell_Simple_Shoot']

const MATERIAL_NAMES = [
  [/^MI_Superhero_/, 'skin'], [/^MI_Regular_/, 'skin_hands'], [/^MI_Hair_/, 'hair'],
  [/^MI_Peasant/, 'peasant'], [/^MI_Ranger/, 'ranger'], [/^MI_Eyes/, 'eyes'],
]
const KEEP_ATTRIBUTES = new Set(['POSITION', 'NORMAL', 'TEXCOORD_0', 'JOINTS_0', 'WEIGHTS_0'])

// 다른 성별 머리에 씌우면 두피가 뚫고 나오는 머리카락: 법선 방향으로 이만큼(m) 부풀린다
// (남자 Hair_Buzzed 는 머리에 바짝 붙은 껍데기라 여자 머리 정수리가 뚫고 나온다)
const INFLATE = { female: { hair_buzzed: 0.005 } }
function inflateAlongNormals(node, amount) {
  for (const prim of node.getMesh().listPrimitives()) {
    const pos = prim.getAttribute('POSITION'), nrm = prim.getAttribute('NORMAL')
    const P = pos.getArray(), N = nrm.getArray()
    for (let i = 0; i < P.length; i++) P[i] += N[i] * amount
    pos.setArray(P)
  }
}

// ---- 4x4 행렬 (열 우선) ----
const mul = (a, b) => {
  const o = new Array(16)
  for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) {
    let s = 0
    for (let k = 0; k < 4; k++) s += a[k * 4 + r] * b[c * 4 + k]
    o[c * 4 + r] = s
  }
  return o
}
function invert(m) {
  const [a00, a01, a02, a03, a10, a11, a12, a13, a20, a21, a22, a23, a30, a31, a32, a33] = m
  const b00 = a00 * a11 - a01 * a10, b01 = a00 * a12 - a02 * a10, b02 = a00 * a13 - a03 * a10, b03 = a01 * a12 - a02 * a11
  const b04 = a01 * a13 - a03 * a11, b05 = a02 * a13 - a03 * a12, b06 = a20 * a31 - a21 * a30, b07 = a20 * a32 - a22 * a30
  const b08 = a20 * a33 - a23 * a30, b09 = a21 * a32 - a22 * a31, b10 = a21 * a33 - a23 * a31, b11 = a22 * a33 - a23 * a32
  const det = 1 / (b00 * b11 - b01 * b10 + b02 * b09 + b03 * b08 - b04 * b07 + b05 * b06)
  return [
    (a11 * b11 - a12 * b10 + a13 * b09) * det, (a02 * b10 - a01 * b11 - a03 * b09) * det, (a31 * b05 - a32 * b04 + a33 * b03) * det, (a22 * b04 - a21 * b05 - a23 * b03) * det,
    (a12 * b08 - a10 * b11 - a13 * b07) * det, (a00 * b11 - a02 * b08 + a03 * b07) * det, (a32 * b02 - a30 * b05 - a33 * b01) * det, (a20 * b05 - a22 * b02 + a23 * b01) * det,
    (a10 * b10 - a11 * b08 + a13 * b06) * det, (a01 * b08 - a00 * b10 - a03 * b06) * det, (a30 * b04 - a31 * b02 + a33 * b00) * det, (a21 * b02 - a20 * b04 - a23 * b00) * det,
    (a11 * b07 - a10 * b09 - a12 * b06) * det, (a00 * b09 - a01 * b07 + a02 * b06) * det, (a31 * b01 - a30 * b03 - a32 * b00) * det, (a20 * b03 - a21 * b01 + a22 * b00) * det,
  ]
}
const point = (m, [x, y, z]) => [m[0] * x + m[4] * y + m[8] * z + m[12], m[1] * x + m[5] * y + m[9] * z + m[13], m[2] * x + m[6] * y + m[10] * z + m[14]]
const dir = (m, [x, y, z]) => [m[0] * x + m[4] * y + m[8] * z, m[1] * x + m[5] * y + m[9] * z, m[2] * x + m[6] * y + m[10] * z]
const ibmList = (skin) => {
  const acc = skin.getInverseBindMatrices()
  return skin.listJoints().map((_, i) => acc.getElement(i, []))
}

// ---- gltf 읽기: 팩 안 gltf 몇 개는 없는 파일(T_Eye_Normal_png.png 등)을 가리킨다 ----
async function read(file) {
  if (file.endsWith('.glb')) return io.read(file)
  const json = JSON.parse(fs.readFileSync(file, 'utf8'))
  const dir = path.dirname(file)
  const resources = {}
  for (const r of [...(json.buffers ?? []), ...(json.images ?? [])]) {
    if (!r.uri) continue
    let p = path.join(dir, decodeURIComponent(r.uri))
    if (!fs.existsSync(p)) p = p.replace(/_png\.png$/, '.png')
    // 그래도 없으면 빈 이미지(노멀맵 등 어차피 버리는 텍스처뿐이다)
    resources[r.uri] = fs.existsSync(p) ? new Uint8Array(fs.readFileSync(p)) : new Uint8Array(0)
  }
  return io.readJSON({ json, resources })
}

// 부위 메시를 기준 뼈대(refSkin)에 다시 묶는다.
// 꼭짓점을 "부위의 역바인드 행렬로 놓였을 자리"로 미리 옮겨 두고(베이크) 관절 번호를 기준 뼈대 순서로 바꾼다.
// 머리카락처럼 뼈 하나에만 붙은 부위는 정확히 같고, 몸·옷은 뼈마다 차이가 거의 0이라 그대로 따라간다
function rebind(doc, node, refSkin) {
  const skin = node.getSkin()
  const refJoints = refSkin.listJoints()
  const refIndex = new Map(refJoints.map((j, i) => [j.getName(), i]))
  const refIbm = ibmList(refSkin)
  const partIbm = ibmList(skin)
  const jointMap = skin.listJoints().map((j) => {
    const i = refIndex.get(j.getName())
    if (i === undefined) throw new Error(`뼈 ${j.getName()} 가 기준 뼈대에 없다`)
    return i
  })
  // C_i = IBM_ref^-1 · IBM_part (부위 관절 i → 기준 관절)
  const corr = partIbm.map((m, i) => mul(invert(refIbm[jointMap[i]]), m))
  const buffer = doc.getRoot().listBuffers()[0]
  for (const prim of node.getMesh().listPrimitives()) {
    for (const s of prim.listSemantics()) if (!KEEP_ATTRIBUTES.has(s)) prim.setAttribute(s, null)
    const pos = prim.getAttribute('POSITION'), nrm = prim.getAttribute('NORMAL')
    const jnt = prim.getAttribute('JOINTS_0'), wgt = prim.getAttribute('WEIGHTS_0')
    const n = pos.getCount()
    const P = new Float32Array(n * 3), N = new Float32Array(n * 3), J = new Uint8Array(n * 4)
    const j = [], w = [], p = [], q = []
    for (let v = 0; v < n; v++) {
      jnt.getElement(v, j); wgt.getElement(v, w); pos.getElement(v, p); nrm.getElement(v, q)
      const m = new Array(16).fill(0)
      for (let k = 0; k < 4; k++) if (w[k] > 0) for (let e = 0; e < 16; e++) m[e] += w[k] * corr[j[k]][e]
      const wsum = w[0] + w[1] + w[2] + w[3]
      if (wsum > 0) for (let e = 0; e < 16; e++) m[e] /= wsum
      else m.splice(0, 16, ...corr[j[0]]) // 가중치가 모두 0인 꼭짓점: 첫 관절 보정만 쓴다
      P.set(point(m, p), v * 3)
      // 행렬이 회전+이동뿐이라(크기 1) 방향 벡터는 3x3 그대로 돌리면 된다
      const d = dir(m, q), len = Math.hypot(...d) || 1
      N.set([d[0] / len, d[1] / len, d[2] / len], v * 3)
      for (let k = 0; k < 4; k++) J[v * 4 + k] = w[k] > 0 ? jointMap[j[k]] : 0
    }
    prim.setAttribute('POSITION', doc.createAccessor().setType('VEC3').setArray(P).setBuffer(buffer))
    prim.setAttribute('NORMAL', doc.createAccessor().setType('VEC3').setArray(N).setBuffer(buffer))
    prim.setAttribute('JOINTS_0', doc.createAccessor().setType('VEC4').setArray(J).setBuffer(buffer))
  }
  node.setSkin(refSkin)
}

// 몸 메시에서 머리·목만 남긴다: 세 꼭짓점 모두 가장 큰 가중치의 뼈가 neck_01 이나 Head 인 삼각형
function cutHead(node, refSkin) {
  const names = refSkin.listJoints().map((j) => j.getName())
  const keepBones = new Set(['neck_01', 'Head'].map((n) => {
    const i = names.indexOf(n)
    if (i < 0) throw new Error(`기준 뼈대에 ${n} 뼈가 없다`)
    return i
  }))
  for (const prim of node.getMesh().listPrimitives()) {
    const jnt = prim.getAttribute('JOINTS_0'), wgt = prim.getAttribute('WEIGHTS_0')
    const n = jnt.getCount()
    const keepVertex = new Uint8Array(n)
    const j = [], w = []
    for (let v = 0; v < n; v++) {
      jnt.getElement(v, j); wgt.getElement(v, w)
      let best = 0
      for (let k = 1; k < 4; k++) if (w[k] > w[best]) best = k
      keepVertex[v] = keepBones.has(j[best]) ? 1 : 0
    }
    const idx = prim.getIndices().getArray()
    const kept = []
    for (let t = 0; t < idx.length; t += 3) {
      if (keepVertex[idx[t]] && keepVertex[idx[t + 1]] && keepVertex[idx[t + 2]]) kept.push(idx[t], idx[t + 1], idx[t + 2])
    }
    prim.getIndices().setArray(new Uint32Array(kept))
    compactPrimitive(prim)
  }
}

// Animation.dispose() 만 하면 샘플러가 남아 키프레임 데이터가 prune 에서 지워지지 않는다
function disposeAnimation(a) {
  for (const s of a.listSamplers()) s.dispose()
  for (const c of a.listChannels()) c.dispose()
  a.dispose()
}

async function lighten(texture) {
  const img = await sharp(Buffer.from(texture.getImage())).modulate({ saturation: 0.15, brightness: 1.6 }).png().toBuffer()
  texture.setImage(new Uint8Array(img)).setMimeType('image/png')
}

async function buildGender(gender) {
  const parts = PARTS[gender]
  const doc = await read(parts[0][0])
  const root = doc.getRoot()
  for (const a of root.listAnimations()) disposeAnimation(a) // Female_Peasant_Body 에 떠돌이 Jog 클립이 있다
  const refSkin = root.listSkins()[0]
  const refScene = root.listScenes()[0]
  const armature = refScene.listChildren()[0]
  const renames = new Map() // node → 새 이름
  for (const [name, to] of Object.entries(parts[0][1])) renames.set(root.listNodes().find((n) => n.getName() === name), to)
  for (const prim of root.listMeshes().flatMap((m) => m.listPrimitives())) for (const s of prim.listSemantics()) if (!KEEP_ATTRIBUTES.has(s)) prim.setAttribute(s, null)

  for (const [file, nodeNames] of parts.slice(1)) {
    const other = await read(file)
    for (const a of other.getRoot().listAnimations()) disposeAnimation(a)
    const otherNodes = other.getRoot().listNodes()
    const otherScene = other.getRoot().listScenes()[0]
    const otherSkins = other.getRoot().listSkins()
    const map = mergeDocuments(doc, other)
    for (const [name, to] of Object.entries(nodeNames)) {
      const src = otherNodes.find((n) => n.getName() === name)
      if (!src) throw new Error(`${path.basename(file)} 에 ${name} 노드가 없다`)
      const node = map.get(src)
      rebind(doc, node, refSkin)
      const inflate = INFLATE[gender]?.[to]
      if (inflate) inflateAlongNormals(node, inflate)
      armature.addChild(node)
      renames.set(node, to)
    }
    // 들어온 쪽 뼈대(관절 트리)·skin·장면을 지운다
    map.get(otherScene).dispose()
    for (const s of otherSkins) map.get(s).dispose()
    for (const n of otherNodes) {
      const m = map.get(n)
      if (!renames.has(m)) m.dispose()
    }
  }
  for (const [node, name] of renames) {
    node.setName(name)
    node.getMesh().setName(name)
    if (name === 'head') cutHead(node, refSkin)
  }

  // ---- 재질 이름·텍스처 ----
  for (const mat of root.listMaterials()) {
    const rule = MATERIAL_NAMES.find(([re]) => re.test(mat.getName()))
    if (!rule) throw new Error(`이름 규칙이 없는 재질 ${mat.getName()}`)
    mat.setName(rule[1])
    mat.setNormalTexture(null).setOcclusionTexture(null).setMetallicRoughnessTexture(null)
    mat.setMetallicFactor(0).setRoughnessFactor(rule[1] === 'eyes' ? 0.3 : 0.85)
  }
  const lightened = new Set()
  for (const mat of root.listMaterials()) {
    const tex = mat.getBaseColorTexture()
    if ((mat.getName() === 'skin' || mat.getName() === 'skin_hands') && tex && !lightened.has(tex)) {
      lightened.add(tex)
      await lighten(tex)
    }
  }

  // ---- 애니메이션 ----
  const ual = await io.read(UAL)
  const ualRoot = ual.getRoot()
  for (const a of ualRoot.listAnimations()) if (!CLIPS.includes(a.getName())) disposeAnimation(a)
  const ualPelvis = ualRoot.listNodes().find((n) => n.getName() === 'pelvis')
  const refJoints = new Map(refSkin.listJoints().map((j) => [j.getName(), j]))
  const ratio = refJoints.get('pelvis').getWorldTranslation()[1] / ualPelvis.getWorldTranslation()[1]
  for (const a of ualRoot.listAnimations()) {
    for (const c of a.listChannels()) {
      const p = c.getTargetPath(), n = c.getTargetNode().getName()
      if (p === 'scale' || (p === 'translation' && n !== 'pelvis')) {
        c.getSampler().dispose()
        c.dispose()
      } else if (p === 'translation') {
        const out = c.getSampler().getOutput()
        out.setArray(out.getArray().map((v) => v * ratio))
      }
    }
  }
  const ualNodes = ualRoot.listNodes(), ualScenes = ualRoot.listScenes(), ualSkins = ualRoot.listSkins(), ualMeshes = ualRoot.listMeshes()
  const ualAnims = ualRoot.listAnimations()
  const amap = mergeDocuments(doc, ual)
  for (const a of ualAnims) for (const c of amap.get(a).listChannels()) {
    const target = refJoints.get(c.getTargetNode().getName())
    if (!target) throw new Error(`클립 뼈 ${c.getTargetNode().getName()} 가 기준 뼈대에 없다`)
    c.setTargetNode(target)
  }
  for (const s of ualScenes) amap.get(s).dispose()
  for (const s of ualSkins) amap.get(s).dispose()
  for (const n of ualNodes) amap.get(n).dispose()
  for (const m of ualMeshes) amap.get(m).dispose()
  root.setDefaultScene(refScene)
  for (const s of root.listScenes()) if (s !== refScene) s.dispose()

  // ---- 정리·압축 ----
  await doc.transform(
    unpartition(),
    dedup(),
    resample(),
    // 두 파일 합계를 6MB 아래로: 꼭짓점을 정수로 줄인다(KHR_mesh_quantization, three.js 기본 지원).
    // 'scene' 은 모든 메시에 같은 보정을 써서, 메시마다 복제된 skin 을 아래 dedup 이 다시 하나로 합친다
    quantize({ quantizationVolume: 'scene' }),
    dedup(),
    prune({ keepLeaves: true }),
    textureCompress({ encoder: sharp, targetFormat: 'jpeg', resize: [1024, 1024], quality: 80 }),
  )
  fs.mkdirSync(OUT, { recursive: true })
  const file = path.join(OUT, `${gender}.glb`)
  await io.write(file, doc)
  console.log(gender, '→', file, fs.statSync(file).size, 'bytes, ratio(pelvis)', ratio.toFixed(4))
}

for (const gender of Object.keys(PARTS)) await buildGender(gender)

fs.mkdirSync(path.join(OUT, 'textures'), { recursive: true })
for (const [name, src] of Object.entries(ALT_TEXTURES)) {
  const out = path.join(OUT, 'textures', name)
  await sharp(src).resize(1024, 1024).jpeg({ quality: 80 }).toFile(out)
  console.log(name, '→', out, fs.statSync(out).size, 'bytes')
}
