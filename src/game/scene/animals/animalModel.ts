import { AnimationMixer, type AnimationAction, type AnimationClip, type Material, type Mesh, type MeshStandardMaterial, type Object3D, type SkinnedMesh } from 'three'
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js'
import { ANIMAL, speciesOf, type SpeciesId } from '../../data/animals'
import type { AnimalPose, AnimalView } from '../../logic/animalSim'
import { shortestAngleDelta } from '../../logic/cameraYaw'

/** 동작 → 은지 Cube Pets 클립 (들이받기는 머리를 숙이는 eat, 쓰러지면 idle 위에 옆으로 눕힌다) */
const CLIP: Record<AnimalPose, 'idle' | 'walk' | 'run' | 'eat'> = { idle: 'idle', eat: 'eat', walk: 'walk', run: 'run', butt: 'eat', dead: 'idle' }
/** 방향을 따라 도는 빠르기 (은지 8) */
const TURN = 8

/** 장면에 놓인 동물 한 마리 (그리기만. 움직임은 animalSim 이 정한다) */
export type AnimalObject = {
  obj: Object3D
  mixer: AnimationMixer
  actions: Partial<Record<'idle' | 'walk' | 'run' | 'eat', AnimationAction>>
  current: AnimationAction | null
  /** 번쩍이려고 동물마다 따로 복제한 재질 */
  mats: MeshStandardMaterial[]
  /** 마지막으로 본 체력 (줄면 번쩍) */
  hp: number
  flash: number
  /** 넘어진 정도 0..1 */
  fall: number
}

/** 모델을 복제해 동물 하나를 만든다 (SkeletonUtils.clone: 뼈까지 따로. 클립은 노드 이름으로 붙는다) */
export function makeAnimal(sp: SpeciesId, scene: Object3D, clips: AnimationClip[], v: AnimalView): AnimalObject {
  const obj = cloneSkinned(scene)
  obj.scale.setScalar(speciesOf(sp).scale)
  const mats: MeshStandardMaterial[] = []
  obj.traverse((o) => {
    const m = o as Mesh
    if (!m.isMesh) return
    m.castShadow = true
    m.material = (m.material as Material).clone()
    mats.push(m.material as MeshStandardMaterial)
  })
  obj.position.set(v.x, 0, v.z)
  obj.rotation.y = v.h
  const mixer = new AnimationMixer(obj)
  const actions: AnimalObject['actions'] = {}
  for (const name of ['idle', 'walk', 'run', 'eat'] as const) {
    const clip = clips.find((c) => c.name === name)
    if (clip) actions[name] = mixer.clipAction(clip)
  }
  const a: AnimalObject = { obj, mixer, actions, current: null, mats, hp: v.hp, flash: 0, fall: v.pose === 'dead' ? 1 : 0 }
  play(a, v.pose)
  return a
}

function play(a: AnimalObject, pose: AnimalPose) {
  const next = a.actions[CLIP[pose]] ?? a.actions.idle ?? null
  if (!next || next === a.current) return
  next.reset().fadeIn(0.2).play()
  a.current?.fadeOut(0.2)
  a.current = next
}

/** 매 프레임: 자리·방향(부드럽게)·클립, 맞으면 빨갛게 번쩍, 쓰러지면 0.5초 동안 옆으로 넘어진다 (은지 그대로) */
export function updateAnimal(a: AnimalObject, v: AnimalView, dt: number) {
  a.obj.position.set(v.x, 0, v.z)
  if (v.hp < a.hp) a.flash = ANIMAL.flash
  a.hp = v.hp
  if (v.pose === 'dead') {
    a.fall = Math.min(1, a.fall + dt / ANIMAL.fall)
    a.obj.rotation.z = (Math.PI / 2) * (1 - (1 - a.fall) ** 3)
  } else {
    a.obj.rotation.y += shortestAngleDelta(a.obj.rotation.y, v.h) * Math.min(1, TURN * dt)
  }
  if (a.flash > 0) a.flash = Math.max(0, a.flash - dt)
  const k = a.flash / ANIMAL.flash
  for (const m of a.mats) m.emissive.setRGB(k, 0, 0)
  play(a, v.pose)
  a.mixer.update(dt)
}

/**
 * 장면에서 뺄 때 복제한 재질과 뼈대(복제마다 따로인 뼈 텍스처)를 버리고 믹서 캐시를 놓는다
 * (형태·클립은 원본과 같이 쓰므로 그대로)
 */
export function disposeAnimal(a: AnimalObject) {
  a.mixer.stopAllAction()
  a.mixer.uncacheRoot(a.obj)
  a.obj.traverse((o) => {
    const s = o as SkinnedMesh
    if (s.isSkinnedMesh) s.skeleton.dispose()
  })
  for (const m of a.mats) m.dispose()
}
