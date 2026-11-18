import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Vector3, type Group, type Material, type Mesh, type Object3D } from 'three'
import { VIEW_MODEL, isGun } from '../../data/guns'
import { gunRig } from '../../guns/gunRig'
import { meleeRig } from '../../hunt/meleeRig'
import { swingProgress } from '../../logic/melee'
import { useSessionStore } from '../../stores/sessionStore'
import { playerRig } from '../Player'
import { buildViewModel, viewModelRest, type ViewTool } from './viewModel'

const rest = new Vector3()
/** 무기가 따라가는 자리 (반동·휘두르기는 그 위에 더한다) */
const base = new Vector3()
const muzzleAt = new Vector3()

/**
 * 1인칭일 때 든 무기를 카메라에 붙여 그린다 (은지 view). 총은 조준하면 가늠쇠가 화면 가운데로 오고, 쏘면 뒤로 밀렸다 돌아온다.
 * 칼·주먹은 휘두르는 동안 앞으로 뻗는다. 소총·저격총 조준경으로 보는 동안은 숨긴다 (ui/ScopeOverlay 가 십자선·둥근 화면을 그린다).
 * Player 다음에 그려서 이번 프레임 카메라 자리를 쓴다. 총구 자리를 쏘기(궤적·불꽃)에 알려 준다
 */
export function FirstPersonView() {
  const tool = useSessionStore((s) => s.tool)
  const id: ViewTool | null = tool === 'fists' || tool === 'knife' || isGun(tool) ? tool : null
  const model = useMemo(() => (id ? buildViewModel(id) : null), [id])
  const root = useRef<Group>(null)

  useEffect(
    () => () => {
      model?.traverse((o) => {
        const m = o as Mesh
        if (!m.isMesh) return
        m.geometry.dispose()
        for (const mat of ([] as Material[]).concat(m.material)) mat.dispose()
      })
    },
    [model],
  )

  useFrame(({ camera, clock }, delta) => {
    const r = root.current
    const m = r?.children[0]
    if (!r) return
    gunRig.viewKick *= Math.exp(-delta * VIEW_MODEL.kickDecay)
    // 조준경(홀로 포함)으로 보는 동안은 무기를 치우고 ui/ScopeOverlay 의 십자선만 본다
    r.visible = playerRig.firstPerson && !!m && !!id && !gunRig.optic
    if (!r.visible || !m || !id) return
    r.position.copy(camera.position)
    r.quaternion.copy(camera.quaternion)
    viewModelRest(id, gunRig.aiming, m.userData, rest)
    base.lerp(rest, Math.min(1, delta * VIEW_MODEL.follow))
    m.position.copy(base)
    const swing = swingProgress(meleeRig.swing, clock.elapsedTime)
    const reach = swing >= 0 ? Math.sin(Math.PI * swing) : 0
    if (id === 'fists') {
      // 치는 오른 주먹이 가운데로 모이며 앞으로 뻗었다 돌아온다
      const right = m.userData.right as Object3D | undefined
      right?.position.set(0.16 - 0.1 * reach, 0.03 * reach, -0.3 * reach)
    } else if (id === 'knife') {
      m.position.z -= 0.3 * reach
      m.rotation.set(-0.3 * reach, 0.4 * reach, -1.2 * reach)
    } else {
      m.position.z += gunRig.viewKick
      m.rotation.set((0.25 * gunRig.viewKick) / VIEW_MODEL.kick, 0, 0)
      const muzzle = m.userData.muzzle as Object3D | undefined
      if (muzzle) gunRig.muzzle = muzzle.getWorldPosition(muzzleAt)
    }
  })

  return <group ref={root}>{model && <primitive object={model} />}</group>
}
