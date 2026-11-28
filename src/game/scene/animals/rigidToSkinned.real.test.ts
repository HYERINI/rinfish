import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { AnimationMixer, Vector3, type SkinnedMesh } from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { SPECIES_IDS } from '../../data/animals'
import { rigidToSkinned } from './rigidToSkinned'

/** GLB 에서 그림(텍스처)만 뺀다 (테스트 환경엔 이미지를 읽을 수단이 없다. 모양·동작은 그대로) */
function withoutTextures(glb: Buffer): ArrayBuffer {
  const jsonLen = glb.readUInt32LE(12)
  const json = JSON.parse(glb.subarray(20, 20 + jsonLen).toString('utf8'))
  delete json.textures
  delete json.images
  delete json.samplers
  for (const m of json.materials ?? []) {
    if (m.pbrMetallicRoughness) {
      delete m.pbrMetallicRoughness.baseColorTexture
      delete m.pbrMetallicRoughness.metallicRoughnessTexture
    }
    delete m.normalTexture
    delete m.occlusionTexture
    delete m.emissiveTexture
  }
  let text = Buffer.from(JSON.stringify(json), 'utf8')
  text = Buffer.concat([text, Buffer.alloc((4 - (text.length % 4)) % 4, 0x20)])
  const rest = glb.subarray(20 + jsonLen)
  const head = Buffer.alloc(20)
  head.write('glTF', 0)
  head.writeUInt32LE(2, 4)
  head.writeUInt32LE(20 + text.length + rest.length, 8)
  head.writeUInt32LE(text.length, 12)
  head.write('JSON', 16)
  const out = Buffer.concat([head, text, rest])
  return out.buffer.slice(out.byteOffset, out.byteOffset + out.length) as ArrayBuffer
}

describe('실제 동물 모델 (Cube Pets 7종)', () => {
  it.each(SPECIES_IDS)('%s: 모든 동작의 모든 순간에 꼭짓점이 화면 밖 판정 구 안에 있다', async (id) => {
    const file = join(process.cwd(), 'public/meadow/models/pets', `animal-${id}.glb`)
    const gltf = await new GLTFLoader().parseAsync(withoutTextures(readFileSync(file)), '')
    const out = rigidToSkinned(gltf.scene)
    let mesh: SkinnedMesh | null = null
    let meshes = 0
    out.traverse((o) => {
      if ((o as SkinnedMesh).isMesh) meshes++
      if ((o as SkinnedMesh).isSkinnedMesh) mesh = o as SkinnedMesh
    })
    expect(meshes).toBe(1)
    const m = mesh as unknown as SkinnedMesh
    const sphere = m.boundingSphere!
    const v = new Vector3()
    let worst = 0
    for (const clip of gltf.animations) {
      const mixer = new AnimationMixer(out)
      const action = mixer.clipAction(clip).play()
      for (let k = 0; k <= 20; k++) {
        action.time = (clip.duration * k) / 20
        mixer.update(0)
        out.updateMatrixWorld(true)
        for (let i = 0; i < m.geometry.attributes.position.count; i++) {
          m.getVertexPosition(i, v)
          worst = Math.max(worst, v.distanceTo(sphere.center) / sphere.radius)
        }
      }
      mixer.stopAllAction()
    }
    // 1 보다 작으면 구 안. 얼마나 여유가 있는지도 본다
    expect(worst).toBeLessThan(1)
  })
})
