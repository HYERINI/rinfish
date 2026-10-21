import { NodeIO } from '@gltf-transform/core'
import fs from 'node:fs'

const EXPECTED_NODES = ['head', 'eyes', 'eyebrows', 'hair_simpleParted', 'hair_buzzed', 'hair_long', 'hair_buns', 'hair_buzzedFemale',
  'peasant_arms', 'peasant_body', 'peasant_legs', 'peasant_feet', 'ranger_arms', 'ranger_bracer', 'ranger_body', 'ranger_belt1',
  'ranger_belt2', 'ranger_pauldron', 'ranger_legs', 'ranger_feet', 'ranger_hood']
const EXPECTED_MATERIALS = ['skin', 'skin_hands', 'hair', 'peasant', 'ranger', 'eyes']
const EXPECTED_CLIPS = ['Idle_Loop', 'Walk_Loop', 'Jog_Fwd_Loop', 'Pistol_Aim_Up', 'Pistol_Aim_Neutral', 'Pistol_Aim_Down', 'Push_Loop',
  'Dance_Loop', 'Death01', 'Crouch_Idle_Loop', 'Sitting_Enter', 'Sitting_Idle_Loop', 'Sitting_Exit']

let failed = false
for (const gender of ['male', 'female']) {
  const file = `../../public/models/characters/${gender}.glb`
  const doc = await new NodeIO().read(file)
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
  console.log(gender, { size, skins: root.listSkins().length, jointNodes: jointNodes.size, missing, missingMats, missingClips, badTracks: badTracks.length })
  // 모든 skin 이 같은 65개 뼈 노드를 공유해야 한다
  if (missing.length || missingMats.length || missingClips.length || jointNodes.size !== 65 || jointSets.size !== 1 || badTracks.length || size > 4_000_000) failed = true
}
process.exit(failed ? 1 : 0)
