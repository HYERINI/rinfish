import { useEffect } from 'react'
import { useFrame } from '@react-three/fiber'
import { weaponSfx } from '../../audio/weaponSfx'
import { MINE, MINE_ENTRANCE, ORE_NODES, PICK, isUnderground } from '../../data/mine'
import { takeAttackPress } from '../../input/pointer'
import { isSameInteractable, type Interactable } from '../../logic/interaction'
import { canSwing } from '../../logic/melee'
import { nearestOre, pickHitDue, pickProgress, regrowOres, startPick } from '../../logic/mining'
import { strikeOre } from '../../mine/mineActions'
import { mineRig, resetPickRig } from '../../mine/mineRig'
import { useSessionStore } from '../../stores/sessionStore'
import { playerRig } from '../Player'
import { playerGround } from '../playerGround'

/** 맞는 순간 광맥이 이만큼(m) 더 멀어져 있어도 맞은 것으로 친다 (휘두르는 사이 조금 움직였다) */
const HIT_SLACK = 0.6
/** 광산 바닥 아래로 이만큼 떨어지면 (충돌체를 뚫고 빠졌다) 입구 앞으로 돌려보낸다 */
const FALL_LIMIT = 12

/**
 * 화면엔 아무것도 그리지 않는다. 광산 안에서:
 * - 가까운 광맥을 E 대상으로 잡는다 (감지 상자가 잡은 나가는 자리 등이 있으면 그쪽이 먼저)
 * - 곡괭이를 든 채 마우스 왼쪽(폰은 치기 버튼)이나 광맥 앞 E 로 곡괭이질한다. 칼처럼 내려꽂히는 순간(hitAt)에 판정한다
 * - 다 캔 광맥을 시간이 되면 다시 채운다
 */
export function MineController() {
  // 곡괭이질 시각은 캔버스 시계라 Game 을 다시 그리면(새 시계 0부터) 전 값이 막는다
  useEffect(() => {
    resetPickRig()
    return resetPickRig
  }, [])

  useFrame(({ clock }) => {
    const now = clock.elapsedTime
    const wall = performance.now() / 1000
    mineRig.nodes = regrowOres(mineRig.nodes, ORE_NODES, wall)
    const session = useSessionStore.getState()
    const { x, y, z } = playerRig.position
    const under = isUnderground(y)
    if (y < MINE.floorY - FALL_LIMIT && session.teleport === null) session.requestTeleport(MINE_ENTRANCE.out)

    // E 대상: 가장 가까운 광맥 (내가 잡은 것만 바꾸거나 지운다)
    const current = session.nearby
    if (session.mode === 'explore' && (!current || current.kind === 'ore')) {
      const near = under ? nearestOre(x, z, ORE_NODES, mineRig.nodes, PICK.reach) : null
      const found: Interactable | null = near === null ? null : { kind: 'ore', index: near }
      if (found) {
        if (!isSameInteractable(current, found)) session.setNearby(found)
      } else if (current) session.clearNearby(current)
    }

    // 곡괭이를 들었을 때만 누른 것을 가져간다 (아니면 MeleeController·GunController 가 가져간다)
    const holding = session.tool === 'pickaxe'
    if (holding && takeAttackPress() === 'primary' && mineRig.want === null) mineRig.want = 'front'
    const want = mineRig.want
    mineRig.want = null
    if (want !== null && holding && canSwing(session.mode, session.playerAction, playerGround.grounded)) {
      // 클릭은 카메라가 보는 쪽 앞의 광맥, E 는 안내에 뜬 그 광맥
      const dx = -Math.sin(playerRig.yaw)
      const dz = -Math.cos(playerRig.yaw)
      const target = !under ? null : want === 'front' ? nearestOre(x, z, ORE_NODES, mineRig.nodes, PICK.reach, { dx, dz }) : mineRig.nodes[want]?.left > 0 ? want : null
      const next = startPick(mineRig, target, now)
      if (next) {
        const spot = target === null ? null : ORE_NODES[target]
        // 광맥을 보고, 없으면 카메라가 보는 쪽으로 헛손질
        Object.assign(mineRig, next, { facing: spot ? Math.atan2(spot.x - x, spot.z - z) : playerRig.yaw + Math.PI })
        weaponSfx.swing(0.7)
      }
    }

    const swing = mineRig.swing
    if (!swing) return
    if (pickHitDue(swing, now)) {
      swing.hitDone = true
      const spot = swing.target === null ? null : ORE_NODES[swing.target]
      if (spot && swing.target !== null && Math.hypot(spot.x - x, spot.z - z) <= PICK.reach + HIT_SLACK && strikeOre(swing.target, wall)) {
        mineRig.hitAt[swing.target] = now
        weaponSfx.thud()
      }
    }
    if (pickProgress(swing, now) < 0 && swing.hitDone) mineRig.swing = null
  })
  return null
}
