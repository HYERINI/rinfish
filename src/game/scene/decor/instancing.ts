import { Box3, Color, Euler, Matrix4, MeshStandardMaterial, Quaternion, Vector3 } from 'three'
import type { BufferGeometry, InstancedMesh, Material, Mesh, Object3D } from 'three'
import type { Placement } from '../../logic/decor'
import { NATURE_COLORS } from './decorAssets'
import { addWind } from './wind'

/** glb 를 한 덩어리처럼 찍어 내기 위한 조각 (재질 하나당 지오메트리 하나) */
export type ModelPart = { geometry: BufferGeometry; material: Material }

/**
 * glb 장면을 키 1(밑면 y = 0)짜리 조각들로 굽는다. 노드 변환은 지오메트리에 넣고, 재질은 복제해 색을 섬에 맞춘다.
 * wind > 0 이면 재질에 바람을 넣는다
 */
export function bakeModel(scene: Object3D, wind: number): ModelPart[] {
  scene.updateWorldMatrix(false, true)
  const meshes: Mesh[] = []
  scene.traverse((o) => {
    if ((o as Mesh).isMesh) meshes.push(o as Mesh)
  })
  const box = new Box3()
  const part = new Box3()
  for (const mesh of meshes) {
    mesh.geometry.computeBoundingBox()
    box.union(part.copy(mesh.geometry.boundingBox!).applyMatrix4(mesh.matrixWorld))
  }
  const height = Math.max(box.max.y - box.min.y, 1e-6)
  const normalize = new Matrix4().makeScale(1 / height, 1 / height, 1 / height).multiply(new Matrix4().makeTranslation(0, -box.min.y, 0))
  return meshes.map((mesh) => {
    const geometry = mesh.geometry.clone().applyMatrix4(new Matrix4().multiplyMatrices(normalize, mesh.matrixWorld))
    const source = (Array.isArray(mesh.material) ? mesh.material[0] : mesh.material) as MeshStandardMaterial
    const material = source.clone()
    const tint = NATURE_COLORS[source.name]
    if (tint) material.color = new Color(tint)
    material.metalness = 0
    material.roughness = 0.9
    material.flatShading = true
    if (wind > 0) addWind(material, wind)
    return { geometry, material }
  })
}

const m = new Matrix4()
const q = new Quaternion()
const e = new Euler()
const p = new Vector3()
const s = new Vector3()

/** 배치대로 인스턴스 행렬을 채운다. y = 바닥에서 띄울 높이 */
export function fillInstances(mesh: InstancedMesh, placements: Placement[], y = 0) {
  placements.forEach((pl, i) => {
    q.setFromEuler(e.set(0, pl.rotY, 0))
    m.compose(p.set(pl.x, y, pl.z), q, s.setScalar(pl.height))
    mesh.setMatrixAt(i, m)
  })
  mesh.count = placements.length
  mesh.instanceMatrix.needsUpdate = true
  // 인스턴스가 섬 곳곳에 흩어져 있어서 경계 구를 다시 잰다 (안 그러면 원점 기준으로 잘려 사라진다)
  mesh.computeBoundingSphere()
}
