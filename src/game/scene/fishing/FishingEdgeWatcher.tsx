import { useFrame } from '@react-three/fiber'
import { findFishingEdge, shouldRefreshPlace } from '../../logic/fishingEdge'
import { useProgressStore } from '../../stores/progressStore'
import { useSessionStore } from '../../stores/sessionStore'
import { playerRig } from '../Player'

/**
 * 화면에는 아무것도 그리지 않고, 매 프레임 플레이어가 물가에 서 있는지 본다.
 * 물가면 "E 낚시하기" 대상(nearby)을 바라보는 물 쪽으로 잡아 두고, 벗어나면 지운다.
 * 시설 앞(감지 상자)에 서 있으면 시설이 먼저라 건드리지 않는다
 */
export function FishingEdgeWatcher() {
  useFrame(() => {
    const session = useSessionStore.getState()
    if (session.mode !== 'explore') return
    const nearby = session.nearby
    if (nearby && nearby.kind !== 'fishingSpot') return
    const place = findFishingEdge(playerRig.position.x, playerRig.position.z, useProgressStore.getState().unlockedZones)
    if (!place) {
      if (nearby) session.clearNearby(nearby)
      return
    }
    if (!nearby || shouldRefreshPlace(nearby.spot, place)) session.setNearby({ kind: 'fishingSpot', spot: place })
  })
  return null
}
