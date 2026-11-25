import { useEffect, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { useRapier } from '@react-three/rapier'
import { weaponSfx } from '../../audio/weaponSfx'
import { isGun } from '../../data/guns'
import { MELEE, meleeFor, type MeleeId } from '../../data/melee'
import { animalViews } from '../../hunt/animalRig'
import { strikeAnimal } from '../../hunt/huntActions'
import { meleeRig, resetMeleeRig } from '../../hunt/meleeRig'
import { takeAttackPress } from '../../input/pointer'
import { canSwing, hitDue, meleePeer, meleeTarget, startSwing, swingProgress } from '../../logic/melee'
import { netNow, peerBodies } from '../../net/remoteRig'
import { useNetStore } from '../../stores/netStore'
import { useSessionStore } from '../../stores/sessionStore'
import { playerRig } from '../Player'
import { playerGround } from '../playerGround'

/**
 * 화면엔 아무것도 그리지 않는다. 주먹·칼을 든 채 마우스 왼쪽(베기·주먹)·오른쪽(칼 찌르기)이나 폰 휘두르기 버튼을 누르면 휘두르고,
 * 은지처럼 칼이 뻗는 순간(hitAt)에 카메라가 보는 쪽으로 판정한다: 바닥의 선분 → 동물 판정 원 (같이 하는 중엔 다른 사람 몸 원도, PvP),
 * 그 앞에 벽(고정 충돌체)이 있으면 안 맞는다
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
    const session = useSessionStore.getState()
    // 총을 들었으면 누른 것은 GunController 가, 곡괭이를 들었으면 MineController 가 가져간다
    const press = isGun(session.tool) || session.tool === 'pickaxe' ? null : takeAttackPress()
    if (press && canSwing(session.mode, session.playerAction, playerGround.grounded)) {
      const kind = meleeFor(session.tool, press === 'secondary')
      const next = kind && startSwing(meleeRig, kind, now)
      if (next && kind) {
        Object.assign(meleeRig, next, { yaw: playerRig.yaw })
        swingSound(kind)
      }
    }
    const swing = meleeRig.swing
    if (!swing) return
    if (hitDue(swing, now)) {
      swing.hitDone = true
      const dx = -Math.sin(meleeRig.yaw)
      const dz = -Math.cos(meleeRig.yaw)
      const { x, y, z } = playerRig.position
      const net = useNetStore.getState()
      const online = net.phase !== 'off'
      const reach = MELEE[swing.kind].reach
      const animal = meleeTarget(x, z, dx, dz, reach, animalViews(online, netNow()))
      // 같이 하는 중엔 다른 사람도 맞는다 (PvP, 은지 칼 15 · 찌르기 30 · 주먹 5)
      const peer = online ? meleePeer(x, z, dx, dz, reach, peerBodies(netNow())) : null
      const target = peer && (!animal || peer.dist < animal.dist) ? peer : animal
      if (target) {
        const r = (ray.current ??= new rapier.Ray({ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 1 }))
        r.origin = { x, y, z }
        r.dir = { x: dx, y: 0, z: dz }
        const wall = target.dist > 0 ? world.castRay(r, target.dist, true, rapier.QueryFilterFlags.ONLY_FIXED | rapier.QueryFilterFlags.EXCLUDE_SENSORS) : null
        if (!wall) {
          if (typeof target.id === 'string') net.sendPvpHit(target.id, swing.kind, 1)
          else strikeAnimal(target.id, swing.kind)
          if (swing.kind === 'fists') weaponSfx.punch()
          else weaponSfx.thud()
        }
      }
    }
    if (swingProgress(swing, now) < 0 && swing.hitDone) meleeRig.swing = null
  })
  return null
}

/** 휘두르는 소리 (은지: 주먹 '퍽', 베기 휙, 찌르기는 낮게) */
function swingSound(kind: MeleeId) {
  if (kind === 'fists') weaponSfx.punch()
  else weaponSfx.swing(kind === 'stab' ? 0.6 : 1)
}
