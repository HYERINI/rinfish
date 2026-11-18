import { useFrame } from '@react-three/fiber'
import { MEADOW_RECT, toMeadowLocal } from '../game/data/meadow'
import { meadowNearbyUpdate, nearestSpot, type MeadowSpot } from '../game/logic/meadowInteract'
import { clampDelta } from '../game/logic/time'
import { playerRig } from '../game/scene/Player'
import { useSessionStore } from '../game/stores/sessionStore'
import { stepStoveCook } from './meadowActions'
import { meadowPickups, meadowSpots, regrowPickups } from './meadowSingleton'

/** 따서 숨긴 버섯·호박은 건너뛴다 */
const usable = (s: MeadowSpot) => s.target.kind !== 'pickup' || meadowPickups()[s.target.index]?.obj.visible === true

/**
 * 화면엔 아무것도 그리지 않고, 매 프레임 초원 E 대상(meadowSpots)을 은지처럼 가장 가까운 것 하나로 고른다.
 * 감지 상자(침대 등)나 물가 낚시가 이미 잡혀 있으면 그쪽이 먼저다. 버섯 다시 자라기와 가스레인지 요리 완성도 여기서
 */
export function MeadowInteractions() {
  useFrame((_, delta) => {
    regrowPickups(clampDelta(delta))
    stepStoveCook(performance.now() / 1000)
    const session = useSessionStore.getState()
    if (session.mode !== 'explore') return
    const { x, z } = playerRig.position
    // 섬에선 찾지 않는다 (내가 잡아 둔 게 있으면 지운다)
    const [lx, lz] = toMeadowLocal(x, z)
    const found = x > MEADOW_RECT.x0 - 2 ? nearestSpot(lx, lz, meadowSpots(), usable) : null
    const current = session.nearby
    const next = meadowNearbyUpdate(current, found)
    if (next === 'clear') {
      if (current) session.clearNearby(current)
    } else if (next !== 'keep') {
      session.setNearby(next)
    }
  })
  return null
}
