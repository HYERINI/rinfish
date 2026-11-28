import { Bone, Float32BufferAttribute, Matrix4, Skeleton, SkinnedMesh, Uint16BufferAttribute, type BufferGeometry, type Material, type Mesh, type Object3D } from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'

/**
 * 부위(메시)마다 따로 움직이는 모델(Cube Pets: 몸통·다리 4개·머리)을 뼈대 메시 하나로 합친 복제를 만든다.
 * 부위 메시는 같은 이름·자리의 뼈(Bone)로 바뀌고 꼭짓점은 제 부위 뼈만 따른다 → 이름으로 붙는 동작 클립이 그대로 돌고,
 * 그리기는 부위 수만큼이 아니라 한 번 (그림자도 한 번). 원본은 건드리지 않는다.
 * 재질이 부위마다 다르거나 형태 속성이 달라 합칠 수 없으면 그냥 복제를 돌려준다
 */
export function rigidToSkinned(src: Object3D): Object3D {
  const out = src.clone(true)
  out.updateMatrixWorld(true)
  const parts: Mesh[] = []
  out.traverse((o) => {
    if ((o as Mesh).isMesh) parts.push(o as Mesh)
  })
  const material = parts[0]?.material
  if (parts.length < 2 || Array.isArray(material) || parts.some((m) => m.material !== material || (m as SkinnedMesh).isSkinnedMesh)) return out

  // 꼭짓점을 맨 위(out) 좌표로 옮기고 부위 번호를 뼈 번호로 단다
  const toTop = new Matrix4().copy(out.matrixWorld).invert()
  const geos = parts.map((m, i) => {
    const g = m.geometry.clone().applyMatrix4(new Matrix4().multiplyMatrices(toTop, m.matrixWorld))
    const n = g.attributes.position.count
    const index = new Uint16Array(n * 4)
    const weight = new Float32Array(n * 4)
    for (let v = 0; v < n; v++) {
      index[v * 4] = i
      weight[v * 4] = 1
    }
    g.setAttribute('skinIndex', new Uint16BufferAttribute(index, 4))
    g.setAttribute('skinWeight', new Float32BufferAttribute(weight, 4))
    return g
  })
  const merged: BufferGeometry | null = mergeGeometries(geos)
  for (const g of geos) g.dispose()
  if (!merged) return out

  // 부위 메시를 같은 자리의 뼈로 바꾼다 (아래 붙은 부위·물체는 뼈로 옮긴다)
  const bones = parts.map((m) => {
    const bone = new Bone()
    bone.name = m.name
    bone.position.copy(m.position)
    bone.quaternion.copy(m.quaternion)
    bone.scale.copy(m.scale)
    for (const c of [...m.children]) bone.add(c)
    const parent = m.parent!
    parent.children.splice(parent.children.indexOf(m), 1, bone)
    bone.parent = parent
    m.parent = null
    return bone
  })

  const skinned = new SkinnedMesh(merged, material as Material)
  skinned.name = `${src.name}-skinned`
  skinned.castShadow = parts[0].castShadow
  skinned.receiveShadow = parts[0].receiveShadow
  out.add(skinned)
  out.updateMatrixWorld(true)
  skinned.bind(new Skeleton(bones))
  return out
}
