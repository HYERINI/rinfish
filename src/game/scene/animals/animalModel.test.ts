import { describe, expect, it, vi } from 'vitest'
import { AnimationMixer, Bone, BufferGeometry, Group, MeshStandardMaterial, Skeleton, SkinnedMesh } from 'three'
import { disposeAnimal, type AnimalObject } from './animalModel'

describe('disposeAnimal', () => {
  it('복제한 재질·뼈대(뼈 텍스처)를 버리고 믹서가 쥔 캐시를 놓는다', () => {
    const obj = new Group()
    const mat = new MeshStandardMaterial()
    const mesh = new SkinnedMesh(new BufferGeometry(), mat)
    const bone = new Bone()
    mesh.add(bone)
    mesh.bind(new Skeleton([bone]))
    obj.add(mesh)
    const mixer = new AnimationMixer(obj)
    const a: AnimalObject = { obj, mixer, actions: {}, current: null, mats: [mat], hp: 3, flash: 0, fall: 0 }
    const skel = vi.spyOn(mesh.skeleton, 'dispose')
    const matDispose = vi.spyOn(mat, 'dispose')
    const uncache = vi.spyOn(mixer, 'uncacheRoot')
    disposeAnimal(a)
    expect(skel).toHaveBeenCalledTimes(1)
    expect(matDispose).toHaveBeenCalledTimes(1)
    expect(uncache).toHaveBeenCalledWith(obj)
  })
})
