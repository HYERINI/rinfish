import { AdditiveBlending, BufferGeometry, CircleGeometry, Group, Line, LineBasicMaterial, Mesh, MeshBasicMaterial, Sprite, SpriteMaterial, Vector3, type Object3D } from 'three'
import type { GunFx } from '../../guns/gunFx'

/** 은지 Effects 숫자: 자국 120개를 돌려 쓰고, 궤적 16개 (0.05초), 총구 불꽃 0.04초 */
const HOLES = 120
const TRACERS = 16
const TRACER_LIFE = 0.05
const FLASH_LIFE = 0.04

const up = new Vector3()

/**
 * 총알 효과 묶음 (scene/guns/GunEffects 가 하나 만들어 장면에 붙인다). 그려 둔 것을 돌려 쓴다.
 * step: 매 프레임 (다 된 궤적·불꽃을 숨긴다), dispose: 내릴 때
 */
export function createGunEffects(): { group: Group; api: GunFx; step: () => void; dispose: () => void } {
  const group = new Group()
  const holeMat = new MeshBasicMaterial({ color: 0x1a1a1a, transparent: true, opacity: 0.9, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 })
  const holeGeo = new CircleGeometry(0.022, 10)
  const holes: Mesh[] = []
  let holeI = 0
  const tracerMat = new LineBasicMaterial({ color: 0xffe9a8, transparent: true, opacity: 0.85 })
  const tracers = Array.from({ length: TRACERS }, () => {
    const line = new Line(new BufferGeometry().setFromPoints([new Vector3(), new Vector3()]), tracerMat)
    line.frustumCulled = false
    line.visible = false
    group.add(line)
    return { line, until: 0 }
  })
  let tracerI = 0
  const flash = new Sprite(new SpriteMaterial({ color: 0xffd27a, transparent: true, blending: AdditiveBlending, depthWrite: false }))
  flash.scale.setScalar(0.18)
  flash.visible = false
  group.add(flash)
  let flashUntil = 0
  const now = () => performance.now() / 1000
  const api: GunFx = {
    tracer(from, to) {
      const t = tracers[tracerI]
      tracerI = (tracerI + 1) % TRACERS
      t.line.geometry.setFromPoints([from, to])
      t.line.visible = true
      t.until = now() + TRACER_LIFE
    },
    hole(point, normal, parent?: Object3D | null) {
      let h = holes[holeI]
      if (!h) h = holes[holeI] = new Mesh(holeGeo, holeMat)
      holeI = (holeI + 1) % HOLES
      h.removeFromParent()
      if (parent) {
        parent.add(h)
        h.position.copy(parent.worldToLocal(point.clone()))
        h.position.z = 0.003
        h.quaternion.identity()
      } else {
        group.add(h)
        h.position.copy(point).addScaledVector(normal, 0.004)
        h.lookAt(up.copy(point).add(normal))
      }
    },
    flash(at) {
      flash.position.copy(at)
      flash.visible = true
      flash.material.rotation = Math.random() * Math.PI
      flashUntil = now() + FLASH_LIFE
    },
  }
  const step = () => {
    const t = now()
    for (const tr of tracers) if (tr.line.visible && t >= tr.until) tr.line.visible = false
    if (flash.visible && t >= flashUntil) flash.visible = false
  }
  const dispose = () => {
    for (const h of holes) h.removeFromParent()
    holeGeo.dispose()
    holeMat.dispose()
    tracerMat.dispose()
    for (const tr of tracers) tr.line.geometry.dispose()
    flash.material.dispose()
  }
  return { group, api, step, dispose }
}
