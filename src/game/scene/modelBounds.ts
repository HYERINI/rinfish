import { Box3, Matrix4 } from 'three'
import type { Mesh, Object3D } from 'three'

/** 애니메이션 전 기본 자세의 경계 상자. 스킨 메시는 setFromObject 가 뼈 변환까지 섞어 값이 튀어서 지오메트리로 직접 잰다 */
export function restBox(root: Object3D): Box3 {
  const box = new Box3()
  const part = new Box3()
  root.updateWorldMatrix(false, true)
  root.traverse((o) => {
    const mesh = o as Mesh
    if (!mesh.isMesh) return
    mesh.geometry.computeBoundingBox()
    box.union(part.copy(mesh.geometry.boundingBox!).applyMatrix4(mesh.matrixWorld))
  })
  return box
}

/** root 자신의 좌표계(root 의 위치·회전·배율을 뺀)로 잰 기본 자세 경계 상자. 메시가 아직 없으면 빈 상자 */
export function localRestBox(root: Object3D): Box3 {
  const box = new Box3()
  const part = new Box3()
  const toLocal = new Matrix4()
  const m = new Matrix4()
  root.updateWorldMatrix(true, true)
  toLocal.copy(root.matrixWorld).invert()
  root.traverse((o) => {
    const mesh = o as Mesh
    if (!mesh.isMesh) return
    mesh.geometry.computeBoundingBox()
    box.union(part.copy(mesh.geometry.boundingBox!).applyMatrix4(m.multiplyMatrices(toLocal, mesh.matrixWorld)))
  })
  return box
}
