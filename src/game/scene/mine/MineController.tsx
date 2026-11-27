import { useEffect } from 'react'
import { useFrame } from '@react-three/fiber'
import { weaponSfx } from '../../audio/weaponSfx'
import { MINE, MINE_ENTRANCE, MINE_WALLS, ORE_NODES, PICK, WALL_REACH, isUnderground } from '../../data/mine'
import { takeAttackPress } from '../../input/pointer'
import { isSameInteractable, type Interactable } from '../../logic/interaction'
import { canSwing } from '../../logic/melee'
import { nearestOre, nearestWall, pickHitDue, pickProgress, regrowOres, startPick, wallDistance, wallStage } from '../../logic/mining'
import { strikeOre, strikeWall } from '../../mine/mineActions'
import { mineRig, resetPickRig } from '../../mine/mineRig'
import { useProgressStore } from '../../stores/progressStore'
import { useSessionStore } from '../../stores/sessionStore'
import { playerRig } from '../Player'
import { playerGround } from '../playerGround'

/** 맞는 순간 광맥이 이만큼(m) 더 멀어져 있어도 맞은 것으로 친다 (휘두르는 사이 조금 움직였다) */
const HIT_SLACK = 0.6
/** 광산 바닥 아래로 이만큼 떨어지면 (충돌체를 뚫고 빠졌다) 입구 앞으로 돌려보낸다 */
const FALL_LIMIT = 12

/**
 * 화면엔 아무것도 그리지 않는다. 광산 안에서:
 * - 가까운 광맥(없으면 금 간 벽)을 E 대상으로 잡는다 (감지 상자가 잡은 나가는 자리 등이 있으면 그쪽이 먼저)
 * - 곡괭이를 든 채 마우스 왼쪽(폰은 치기 버튼)이나 광맥·금 간 벽 앞 E 로 곡괭이질한다. 칼처럼 내려꽂히는 순간(hitAt)에 판정한다
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
    // 지금 칠 수 있는 금 간 벽 (금이 갔고 아직 안 무너졌다)
    const progress = useProgressStore.getState()
    const hittable = MINE_WALLS.map((w, i) => wallStage(progress.oreMined, w.need, progress.mineWalls[i] === true) === 'cracked')

    // E 대상: 가장 가까운 광맥, 없으면 금 간 벽 (내가 잡은 것만 바꾸거나 지운다)
    const current = session.nearby
    if (session.mode === 'explore' && (!current || current.kind === 'ore' || current.kind === 'mineWall')) {
      const near = under ? nearestOre(x, z, ORE_NODES, mineRig.nodes, PICK.reach) : null
      const nearWall = under && near === null ? nearestWall(x, z, MINE_WALLS, hittable, WALL_REACH) : null
      const found: Interactable | null = near !== null ? { kind: 'ore', index: near } : nearWall !== null ? { kind: 'mineWall', index: nearWall } : null
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
      // 클릭은 카메라가 보는 쪽 앞의 광맥(없으면 금 간 벽), E 는 안내에 뜬 그것
      const facing = { dx: -Math.sin(playerRig.yaw), dz: -Math.cos(playerRig.yaw) }
      let target: number | null = null
      let wallTarget: number | null = null
      if (under) {
        if (want === 'front') {
          target = nearestOre(x, z, ORE_NODES, mineRig.nodes, PICK.reach, facing)
          if (target === null) wallTarget = nearestWall(x, z, MINE_WALLS, hittable, WALL_REACH, facing)
        } else if (typeof want === 'number') {
          target = mineRig.nodes[want]?.left > 0 ? want : null
        } else if (hittable[want.wall]) {
          wallTarget = want.wall
        }
      }
      const next = startPick(mineRig, target, now, wallTarget)
      if (next) {
        const spot = target !== null ? ORE_NODES[target] : wallTarget !== null ? MINE_WALLS[wallTarget] : null
        // 광맥·벽을 보고, 없으면 카메라가 보는 쪽으로 헛손질 (벽은 통로 가운데가 아니라 내 앞의 벽면을 본다)
        const lookZ = spot && wallTarget !== null ? Math.min(spot.z + MINE_WALLS[wallTarget].width / 2, Math.max(spot.z - MINE_WALLS[wallTarget].width / 2, z)) : spot?.z
        Object.assign(mineRig, next, { facing: spot && lookZ !== undefined ? Math.atan2(spot.x - x, lookZ - z) : playerRig.yaw + Math.PI })
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
      const cracked = swing.wall === null ? null : MINE_WALLS[swing.wall]
      if (cracked && swing.wall !== null && wallDistance(x, z, cracked) <= WALL_REACH + HIT_SLACK && strikeWall(swing.wall)) {
        mineRig.wallHitAt[swing.wall] = now
        weaponSfx.thud()
      }
    }
    if (pickProgress(swing, now) < 0 && swing.hitDone) mineRig.swing = null
  })
  return null
}
