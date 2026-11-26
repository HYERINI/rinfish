import { AdditiveBlending, BufferAttribute, BufferGeometry, CircleGeometry, Group, InstancedMesh, LineBasicMaterial, LineSegments, Matrix4, Mesh, MeshBasicMaterial, Quaternion, Sprite, SpriteMaterial, Vector3, type Object3D } from 'three'
import type { GunFx } from '../../guns/gunFx'

/**
 * 벽 자국 120개 (은지 Effects 숫자), 표적판 자국 40개, 궤적 64개 (0.05초), 총구 불꽃 8개 (0.04초).
 * 궤적·불꽃은 여럿이 같이 쏴도 서로의 것을 덮어쓰지 않을 만큼: 산탄총 한 발이 궤적 8개라 64개면 여덟 명이 0.05초 안에 같이 쏴도 된다
 */
const WALL_HOLES = 120
const BOARD_HOLES = 40
const TRACERS = 64
const FLASHES = 8
const TRACER_LIFE = 0.05
const FLASH_LIFE = 0.04

const Z = new Vector3(0, 0, 1)
const ONE = new Vector3(1, 1, 1)
const m = new Matrix4()
const q = new Quaternion()
const p = new Vector3()

/**
 * 총알 효과 묶음 (scene/guns/GunEffects 가 하나 만들어 장면에 붙인다). 그려 둔 것을 돌려 쓴다.
 * 같은 것은 한 번에 그린다 (드로우 콜): 벽 자국은 InstancedMesh 하나, 궤적은 LineSegments 하나.
 * 표적판 자국만 따로 된 Mesh 다 (판에 붙어 같이 움직여야 해서 묶지 못한다).
 * step: 매 프레임 (다 된 궤적·불꽃을 숨긴다), dispose: 내릴 때
 */
export function createGunEffects(): { group: Group; api: GunFx; step: () => void; dispose: () => void } {
  const group = new Group()
  const holeMat = new MeshBasicMaterial({ color: 0x1a1a1a, transparent: true, opacity: 0.9, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 })
  const holeGeo = new CircleGeometry(0.022, 10)

  // 벽 자국: 자리(행렬)만 120개 들고 한 번에 그린다. count = 지금까지 찍은 수 (120 에서 멈추고 그 뒤로는 오래된 것을 덮어쓴다)
  const wallHoles = new InstancedMesh(holeGeo, holeMat, WALL_HOLES)
  wallHoles.count = 0
  // 자국이 맵 곳곳에 흩어진다: 묶음 하나로 화면 밖인지 가릴 수 없어서 늘 그린다
  wallHoles.frustumCulled = false
  group.add(wallHoles)
  let wallI = 0

  const boardHoles: Mesh[] = []
  let boardI = 0

  // 궤적: 선분 64개를 한 버퍼에 (선분마다 점 2개 × xyz). 안 보이는 것은 두 점을 한자리에 둔다 (길이 0)
  const tracerPos = new Float32Array(TRACERS * 6)
  const tracerAttr = new BufferAttribute(tracerPos, 3)
  const tracerGeo = new BufferGeometry()
  tracerGeo.setAttribute('position', tracerAttr)
  const tracerMat = new LineBasicMaterial({ color: 0xffe9a8, transparent: true, opacity: 0.85 })
  const tracers = new LineSegments(tracerGeo, tracerMat)
  tracers.frustumCulled = false
  // 보이는 궤적이 없으면 통째로 숨긴다 (그리기 명령도 안 나간다)
  tracers.visible = false
  group.add(tracers)
  const tracerUntil = new Float64Array(TRACERS)
  let tracerI = 0
  let tracersLive = 0

  // 총구 불꽃: 쏘는 사람마다 하나씩 쓰게 여러 개 (돌리는 각도가 재질에 있어서 재질도 하나씩)
  const flashes = Array.from({ length: FLASHES }, () => {
    const sprite = new Sprite(new SpriteMaterial({ color: 0xffd27a, transparent: true, blending: AdditiveBlending, depthWrite: false }))
    sprite.scale.setScalar(0.18)
    sprite.visible = false
    group.add(sprite)
    return { sprite, until: 0 }
  })
  let flashI = 0

  const now = () => performance.now() / 1000
  const api: GunFx = {
    tracer(from, to) {
      const i = tracerI
      tracerI = (tracerI + 1) % TRACERS
      if (tracerUntil[i] === 0) tracersLive++
      from.toArray(tracerPos, i * 6)
      to.toArray(tracerPos, i * 6 + 3)
      tracerUntil[i] = now() + TRACER_LIFE
      tracerAttr.needsUpdate = true
      tracers.visible = true
    },
    hole(point, normal, parent?: Object3D | null) {
      if (parent) {
        let h = boardHoles[boardI]
        if (!h) h = boardHoles[boardI] = new Mesh(holeGeo, holeMat)
        boardI = (boardI + 1) % BOARD_HOLES
        h.removeFromParent()
        parent.add(h)
        h.position.copy(parent.worldToLocal(p.copy(point)))
        h.position.z = 0.003
        h.quaternion.identity()
        return
      }
      // 원판(+z 를 본다)을 면 쪽으로 돌리고, 면에서 살짝 띄운다
      q.setFromUnitVectors(Z, normal)
      p.copy(point).addScaledVector(normal, 0.004)
      wallHoles.setMatrixAt(wallI, m.compose(p, q, ONE))
      wallHoles.instanceMatrix.needsUpdate = true
      wallI = (wallI + 1) % WALL_HOLES
      wallHoles.count = Math.min(WALL_HOLES, wallHoles.count + 1)
    },
    flash(at) {
      const f = flashes[flashI]
      flashI = (flashI + 1) % FLASHES
      f.sprite.position.copy(at)
      f.sprite.visible = true
      f.sprite.material.rotation = Math.random() * Math.PI
      f.until = now() + FLASH_LIFE
    },
  }
  const step = () => {
    const t = now()
    if (tracersLive > 0) {
      for (let i = 0; i < TRACERS; i++) {
        if (tracerUntil[i] === 0 || t < tracerUntil[i]) continue
        tracerUntil[i] = 0
        tracersLive--
        // 끝점을 시작점에 겹쳐 길이 0 으로
        tracerPos.copyWithin(i * 6 + 3, i * 6, i * 6 + 3)
        tracerAttr.needsUpdate = true
      }
      if (tracersLive === 0) tracers.visible = false
    }
    for (const f of flashes) if (f.sprite.visible && t >= f.until) f.sprite.visible = false
  }
  const dispose = () => {
    for (const h of boardHoles) h.removeFromParent()
    wallHoles.dispose()
    holeGeo.dispose()
    holeMat.dispose()
    tracerGeo.dispose()
    tracerMat.dispose()
    for (const f of flashes) f.sprite.material.dispose()
  }
  return { group, api, step, dispose }
}
