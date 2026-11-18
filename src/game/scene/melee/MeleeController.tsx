import { useEffect, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { useRapier } from '@react-three/rapier'
import { MELEE, meleeFor } from '../../data/melee'
import { animalViews } from '../../hunt/animalRig'
import { strikeAnimal } from '../../hunt/huntActions'
import { meleeRig, resetMeleeRig } from '../../hunt/meleeRig'
import { takeAttackPress } from '../../input/pointer'
import { canSwing, hitDue, meleeTarget, startSwing, swingProgress } from '../../logic/melee'
import { netNow } from '../../net/remoteRig'
import { useNetStore } from '../../stores/netStore'
import { useSessionStore } from '../../stores/sessionStore'
import { playerRig } from '../Player'
import { playerGround } from '../playerGround'

/**
 * 화면엔 아무것도 그리지 않는다. 주먹·칼을 든 채 마우스 왼쪽(베기·주먹)·오른쪽(칼 찌르기)이나 폰 휘두르기 버튼을 누르면 휘두르고,
 * 은지처럼 칼이 뻗는 순간(hitAt)에 카메라가 보는 쪽으로 판정한다: 바닥의 선분 → 동물 판정 원, 그 앞에 벽(고정 충돌체)이 있으면 안 맞는다
 */
export function MeleeController() {
  const { world, rapier } = useRapier()
  const ray = useRef<InstanceType<typeof rapier.Ray> | null>(null)

  // 휘두르기 시각은 캔버스 시계라 Game 을 다시 그리면(새 시계 0부터) 전 값이 공격을 막는다
  useEffect(() => {
    resetMeleeRig()
    return resetMeleeRig
  }, [])

  useFrame(({ clock }) => {
    const now = clock.elapsedTime
    const press = takeAttackPress()
    const session = useSessionStore.getState()
    if (press && canSwing(session.mode, session.playerAction, playerGround.grounded)) {
      const kind = meleeFor(session.tool, press === 'secondary')
      const next = kind && startSwing(meleeRig, kind, now)
      if (next) Object.assign(meleeRig, next, { yaw: playerRig.yaw })
    }
    const swing = meleeRig.swing
    if (!swing) return
    if (hitDue(swing, now)) {
      swing.hitDone = true
      const dx = -Math.sin(meleeRig.yaw)
      const dz = -Math.cos(meleeRig.yaw)
      const { x, y, z } = playerRig.position
      const target = meleeTarget(x, z, dx, dz, MELEE[swing.kind].reach, animalViews(useNetStore.getState().phase !== 'off', netNow()))
      if (target) {
        const r = (ray.current ??= new rapier.Ray({ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 1 }))
        r.origin = { x, y, z }
        r.dir = { x: dx, y: 0, z: dz }
        const wall = target.dist > 0 ? world.castRay(r, target.dist, true, rapier.QueryFilterFlags.ONLY_FIXED | rapier.QueryFilterFlags.EXCLUDE_SENSORS) : null
        if (!wall) strikeAnimal(target.id, swing.kind)
      }
    }
    if (swingProgress(swing, now) < 0 && swing.hitDone) meleeRig.swing = null
  })
  return null
}
