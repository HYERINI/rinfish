import { BoxGeometry, CylinderGeometry, Group, Mesh, MeshStandardMaterial, SphereGeometry } from 'three'
import type { RawItemId } from '../../data/meadowItems'

/** 고기 색 (은지 makeItemMesh) */
const MEAT_COLOR: Partial<Record<RawItemId, number>> = { beef: 0xc8484e, pork: 0xe8a0a8, boar: 0x9a3a3a, venison: 0x8a3a2a, rabbit: 0xe0b0a8, foxmeat: 0xd07060, chicken: 0xf0c8a0 }

// 모양·재질은 한 벌만 만들어 같이 쓴다 (전리품마다 새로 만들지 않는다)
const geo = {
  boneShaft: new CylinderGeometry(0.035, 0.035, 0.36, 8),
  knob: new SphereGeometry(0.06, 8, 8),
  fat: new BoxGeometry(0.24, 0.12, 0.18),
  egg: new SphereGeometry(0.1, 10, 10),
  meat: new SphereGeometry(0.16, 12, 10),
  meatBone: new CylinderGeometry(0.03, 0.03, 0.3, 8),
}
const mats = new Map<number, MeshStandardMaterial>()
const std = (color: number, roughness = 0.6) => {
  const key = color * 10 + Math.round(roughness * 10)
  let m = mats.get(key)
  if (!m) {
    m = new MeshStandardMaterial({ color, roughness })
    mats.set(key, m)
  }
  return m
}

/** 바닥에 떨어진 전리품 모양 (은지 makeItemMesh: 뼈·비계·달걀, 나머지는 색만 다른 뼈 붙은 고기) */
export function makeLootMesh(id: RawItemId): Group {
  const g = new Group()
  const add = (m: Mesh) => {
    m.castShadow = true
    g.add(m)
    return m
  }
  if (id === 'bone') {
    add(new Mesh(geo.boneShaft, std(0xf2eee4))).rotation.z = Math.PI / 2
    add(new Mesh(geo.knob, std(0xf2eee4))).position.x = -0.18
    add(new Mesh(geo.knob, std(0xf2eee4))).position.x = 0.18
  } else if (id === 'fat') {
    add(new Mesh(geo.fat, std(0xf4e2b0)))
  } else if (id === 'egg') {
    add(new Mesh(geo.egg, std(0xfaf3e0, 0.4))).scale.set(1, 1.3, 1)
  } else {
    add(new Mesh(geo.meat, std(MEAT_COLOR[id] ?? 0xc8484e))).scale.set(1.3, 0.7, 1)
    const bone = add(new Mesh(geo.meatBone, std(0xf2eee4)))
    bone.rotation.z = Math.PI / 2
    bone.position.x = 0.22
  }
  return g
}
