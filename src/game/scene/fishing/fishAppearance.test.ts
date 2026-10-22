import { Bone, BoxGeometry, Group, Mesh, MeshStandardMaterial, SphereGeometry, type Material } from 'three'
import { describe, expect, it } from 'vitest'
import type { FishAccessoryKind, FishLook } from '../../data/fishLooks'
import { applyFishLook, buildAccessory, dressFish, fitFish } from './fishAppearance'

/** 머리가 +z 인 길이 2 짜리 상자 물고기 + 양옆 눈 + 머리 뼈 */
function toyFish() {
  const root = new Group()
  const body = new MeshStandardMaterial({ name: 'Toy_Main', color: '#202020' })
  const eyes = new MeshStandardMaterial({ name: 'Eyes', color: '#010101' })
  root.add(new Mesh(new BoxGeometry(0.6, 0.8, 2), body))
  for (const x of [-0.35, 0.35]) {
    const eye = new Mesh(new SphereGeometry(0.1), eyes)
    eye.position.set(x, 0.1, 0.7)
    root.add(eye)
  }
  const head = new Bone()
  head.name = 'Head'
  head.position.set(0, 0, 0.6)
  root.add(head)
  return { root, body, eyes }
}

const materialsOf = (root: Group) => {
  const out: Material[] = []
  root.traverse((o) => {
    if ((o as Mesh).isMesh) out.push((o as Mesh).material as Material)
  })
  return out
}

describe('applyFishLook', () => {
  it('같은 재질을 쓰는 두 마리에 다른 색을 입혀도 서로 섞이지 않는다', () => {
    const { root, body } = toyFish()
    const a = root.clone() // three 의 clone 은 재질을 공유한다
    const b = root.clone()
    applyFishLook(a, { model: 'tuna', size: 1, tint: '#ff0000' })
    applyFishLook(b, { model: 'tuna', size: 1, tint: '#0000ff' })
    const bodyA = materialsOf(a)[0] as MeshStandardMaterial
    const bodyB = materialsOf(b)[0] as MeshStandardMaterial
    expect(bodyA).not.toBe(bodyB)
    expect(bodyA).not.toBe(body)
    expect(bodyA.color.r).toBeGreaterThan(bodyA.color.b)
    expect(bodyB.color.b).toBeGreaterThan(bodyB.color.r)
    expect(body.color.getHexString()).toBe('202020') // 원본은 그대로
  })

  it('눈은 물들이지 않고, 발광 색을 넣는다', () => {
    const { root } = toyFish()
    applyFishLook(root, { model: 'tuna', size: 1, tint: '#ff0000', glow: '#00ff00' })
    const [body, eye] = materialsOf(root) as MeshStandardMaterial[]
    expect(eye.color.getHexString()).toBe('010101')
    expect(body.emissive.getHexString()).toBe('00ff00')
  })
})

describe('fitFish', () => {
  it('몸길이 1.2 로 맞추고 눈 자리를 잰다', () => {
    const { root } = toyFish()
    const { scale, shape } = fitFish(root, 'tuna')
    expect(scale).toBeCloseTo(0.6)
    expect(shape.eye.z).toBeCloseTo(0.7 * 0.6)
    expect(shape.eye.x).toBeCloseTo(0.45 * 0.6)
  })
})

describe('buildAccessory', () => {
  const kinds: FishAccessoryKind[] = [
    'sunglasses', 'eyepatch', 'crown', 'frogCrown', 'roundGlasses', 'headband', 'nightcap',
    'lifebuoy', 'spaceHelmet', 'ninjaMask', 'dreadlocks', 'crystal', 'selfieStick',
  ]
  it.each(kinds)('%s 를 기본 도형으로 만든다', (kind) => {
    const { root } = toyFish()
    const { shape } = fitFish(root, 'tuna')
    const g = buildAccessory(kind, shape)
    let meshes = 0
    g.traverse((o) => {
      if ((o as Mesh).isMesh) meshes++
    })
    expect(meshes).toBeGreaterThan(0)
  })
})

describe('dressFish', () => {
  it('소품을 머리 뼈에 붙여 헤엄칠 때 머리와 함께 움직이게 한다', () => {
    const { root } = toyFish()
    const look: FishLook = { model: 'tuna', size: 1, accessory: 'crown' }
    const { accessory } = dressFish(root, look)
    expect(accessory?.parent?.name).toBe('Head')
  })

  it('accessoryAt 를 주면 그 자리(몸길이 1.2 기준)에 놓인다', () => {
    const { root } = toyFish()
    const { scale, offset, accessory } = dressFish(root, { model: 'tuna', size: 1, accessory: 'crown', accessoryAt: [0, 0.3, 0.2] })
    const holder = new Group()
    holder.scale.setScalar(scale)
    holder.position.copy(offset)
    holder.add(root)
    holder.updateWorldMatrix(false, true)
    const p = accessory!.getWorldPosition(accessory!.position.clone())
    expect(p.x).toBeCloseTo(0)
    expect(p.y).toBeCloseTo(0.3)
    expect(p.z).toBeCloseTo(0.2)
  })
})
