import { NodeIO } from '@gltf-transform/core'
import { KHRMeshQuantization } from '@gltf-transform/extensions'
import fs from 'node:fs'
import { fileURLToPath } from 'node:url'

const OUT = fileURLToPath(new URL('../../public/models/characters/', import.meta.url))

// glb 의 JSON 덩어리를 그대로 읽는다(NodeIO 는 선언 안 된 확장을 조용히 넘어가므로 원본으로 검사)
function readGlbJson(file) {
  const buf = fs.readFileSync(file)
  const len = buf.readUInt32LE(12)
  return JSON.parse(buf.subarray(20, 20 + len).toString('utf8'))
}
// 정수(양자화) POSITION 이 있으면 KHR_mesh_quantization 이 extensionsUsed·Required 둘 다에 있어야 한다
function quantizationProblems(json) {
  const quantized = (json.meshes ?? []).some((m) => m.primitives.some((p) => json.accessors[p.attributes.POSITION].componentType !== 5126))
  if (!quantized) return []
  const ext = 'KHR_mesh_quantization'
  return [!json.extensionsUsed?.includes(ext) && 'extensionsUsed', !json.extensionsRequired?.includes(ext) && 'extensionsRequired'].filter(Boolean)
}

const EXPECTED_NODES = ['head', 'eyes', 'eyebrows', 'hair_simpleParted', 'hair_buzzed', 'hair_long', 'hair_buns', 'hair_buzzedFemale',
  'peasant_arms', 'peasant_body', 'peasant_legs', 'peasant_feet', 'ranger_arms', 'ranger_bracer', 'ranger_body', 'ranger_belt1',
  'ranger_belt2', 'ranger_pauldron', 'ranger_legs', 'ranger_feet', 'ranger_hood']
const EXPECTED_MATERIALS = ['skin', 'skin_hands', 'hair', 'peasant', 'ranger', 'eyes']
const EXPECTED_CLIPS = ['Idle_Loop', 'Walk_Loop', 'Jog_Fwd_Loop', 'Pistol_Aim_Up', 'Pistol_Aim_Neutral', 'Pistol_Aim_Down', 'Push_Loop',
  'Dance_Loop', 'Death01', 'Crouch_Idle_Loop', 'Sitting_Enter', 'Sitting_Idle_Loop', 'Sitting_Exit',
  'Sprint_Loop', 'Jump_Start', 'Jump_Loop', 'Jump_Land', 'Idle_Talking_Loop', 'Roll', 'Punch_Jab', 'Spell_Simple_Shoot', 'Fixing_Kneeling']

let failed = false
for (const gender of ['male', 'female']) {
  const file = `${OUT}${gender}.glb`
  const doc = await new NodeIO().registerExtensions([KHRMeshQuantization]).read(file)
  const quantMissing = quantizationProblems(readGlbJson(file))
  const root = doc.getRoot()
  const nodes = new Set(root.listNodes().map((n) => n.getName()))
  const want = gender === 'male' ? [...EXPECTED_NODES, 'beard'] : EXPECTED_NODES
  const missing = want.filter((n) => !nodes.has(n))
  const mats = new Set(root.listMaterials().map((m) => m.getName()))
  const missingMats = EXPECTED_MATERIALS.filter((m) => !mats.has(m))
  const clips = root.listAnimations().map((a) => a.getName())
  const missingClips = EXPECTED_CLIPS.filter((c) => !clips.includes(c))
  const jointSets = new Set(root.listSkins().map((s) => s.listJoints().map((j) => j.getName()).join(',')))
  const jointNodes = new Set(root.listSkins().flatMap((s) => s.listJoints()))
  const badTracks = root.listAnimations().flatMap((a) => a.listChannels())
    .filter((c) => c.getTargetPath() === 'scale' || (c.getTargetPath() === 'translation' && c.getTargetNode().getName() !== 'pelvis'))
  const size = fs.statSync(file).size
  console.log(gender, { size, skins: root.listSkins().length, jointNodes: jointNodes.size, missing, missingMats, missingClips, badTracks: badTracks.length, quantMissing })
  // 모든 skin 이 같은 65개 뼈 노드를 공유해야 한다
  if (missing.length || missingMats.length || missingClips.length || jointNodes.size !== 65 || jointSets.size !== 1 || badTracks.length || quantMissing.length || size > 4_000_000) failed = true
}
process.exit(failed ? 1 : 0)
