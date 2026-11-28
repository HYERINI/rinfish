import { describe, expect, it } from 'vitest'
import { AnimationClip, AnimationMixer, BoxGeometry, Group, Mesh, MeshStandardMaterial, MeshBasicMaterial, QuaternionKeyframeTrack, SkinnedMesh, Vector3, type Bone, type Object3D } from 'three'
import { rigidToSkinned } from './rigidToSkinned'

/** root(body(head), leg) 모양: 부위가 따로 움직이는 Cube Pets 처럼 */
function pet(mat = new MeshStandardMaterial()) {
  const top = new Group()
  top.name = 'pet'
  const root = new Group()
  root.name = 'root'
  root.position.set(0, 0.5, 0)
  const body = new Mesh(new BoxGeometry(1, 0.6, 1.4), mat)
  body.name = 'body'
  body.position.set(0, 0.4, 0)
  const head = new Mesh(new BoxGeometry(0.5, 0.5, 0.5), mat)
  head.name = 'head'
  head.position.set(0, 0.3, 0.8)
  const leg = new Mesh(new BoxGeometry(0.2, 0.4, 0.2), mat)
  leg.name = 'leg'
  leg.position.set(0.3, -0.2, 0.5)
  leg.rotation.x = 0.3
  top.add(root)
  root.add(body, leg)
  body.add(head)
  return top
}

const find = (o: Object3D, name: string) => o.getObjectByName(name)!
/** 메시(일반·뼈대) 꼭짓점의 세계 좌표들 */
function worldVerts(o: Object3D): Vector3[] {
  o.updateMatrixWorld(true)
  const out: Vector3[] = []
  o.traverse((m) => {
    const mesh = m as Mesh
    if (!mesh.isMesh) return
    const n = mesh.geometry.attributes.position.count
    for (let i = 0; i < n; i++) {
      const v = new Vector3()
      if ((mesh as SkinnedMesh).isSkinnedMesh) (mesh as SkinnedMesh).getVertexPosition(i, v)
      else v.fromBufferAttribute(mesh.geometry.attributes.position, i)
      out.push(v.applyMatrix4(mesh.matrixWorld))
    }
  })
  return out.sort((a, b) => a.x - b.x || a.y - b.y || a.z - b.z)
}
const close = (a: Vector3[], b: Vector3[]) => {
  expect(a.length).toBe(b.length)
  a.forEach((v, i) => expect(v.distanceTo(b[i])).toBeLessThan(1e-5))
}

describe('rigidToSkinned (부위마다 따로 그리던 모델을 한 번에 그리기)', () => {
  it('부위 메시 3개가 뼈대 메시 하나가 되고, 부위는 같은 이름의 뼈로 자리·부모가 그대로', () => {
    const src = pet()
    const out = rigidToSkinned(src)
    const meshes: Mesh[] = []
    out.traverse((o) => (o as Mesh).isMesh && meshes.push(o as Mesh))
    expect(meshes.length).toBe(1)
    expect((meshes[0] as SkinnedMesh).isSkinnedMesh).toBe(true)
    expect((find(out, 'head') as Bone).isBone).toBe(true)
    expect(find(out, 'head').parent?.name).toBe('body')
    expect(find(out, 'leg').parent?.name).toBe('root')
    // 원본은 건드리지 않는다
    expect((find(src, 'body') as Mesh).isMesh).toBe(true)
  })

  it('그린 모양이 원본과 같다 (처음 자세)', () => {
    const src = pet()
    close(worldVerts(rigidToSkinned(src)), worldVerts(src))
  })

  it('부위를 움직여도 원본과 같은 모양 (몸을 돌리면 머리도 따라 돈다)', () => {
    const src = pet()
    const out = rigidToSkinned(src)
    for (const o of [src, out]) {
      find(o, 'body').rotation.y = 0.7
      find(o, 'leg').rotation.x = -0.5
    }
    close(worldVerts(out), worldVerts(src))
  })

  it('화면에서 빼는 판정(바운딩 구)이 부위가 크게 움직여도 다 덮을 만큼 넉넉하고, 복제에도 따라간다', () => {
    const out = rigidToSkinned(pet())
    let mesh: SkinnedMesh | null = null
    out.traverse((o) => {
      if ((o as SkinnedMesh).isSkinnedMesh) mesh = o as SkinnedMesh
    })
    const m = mesh as unknown as SkinnedMesh
    expect(m.boundingSphere).not.toBeNull()
    // 다리를 90° 돌리고 몸을 돌려도 모든 꼭짓점이 구 안
    find(out, 'leg').rotation.x = Math.PI / 2
    find(out, 'body').rotation.y = Math.PI / 2
    out.updateMatrixWorld(true)
    const inv = m.matrixWorld.clone().invert()
    for (const v of worldVerts(out)) expect(m.boundingSphere!.containsPoint(v.applyMatrix4(inv))).toBe(true)
    expect(m.clone().boundingSphere?.radius).toBe(m.boundingSphere!.radius)
  })

  it('이름으로 붙는 동작 클립이 뼈를 움직인다', () => {
    const out = rigidToSkinned(pet())
    const clip = new AnimationClip('walk', 1, [new QuaternionKeyframeTrack('leg.quaternion', [0, 1], [0, 0, 0.3826834, 0.9238795, 0, 0, 0.3826834, 0.9238795])])
    const mixer = new AnimationMixer(out)
    mixer.clipAction(clip).play()
    mixer.update(0.5)
    expect(find(out, 'leg').quaternion.z).toBeCloseTo(0.3826834)
  })

  it('재질이 부위마다 다르면 합치지 않고 복제만 돌려준다', () => {
    const src = pet()
    ;(find(src, 'head') as Mesh).material = new MeshBasicMaterial()
    const out = rigidToSkinned(src)
    expect(out).not.toBe(src)
    expect((find(out, 'head') as Mesh).isMesh).toBe(true)
  })
})
