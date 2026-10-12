import { useFrame } from '@react-three/fiber'
import { getSpot } from '../../data/zones'
import { readPointer } from '../../input/pointer'
import { gearStats } from '../../logic/economy'
import { stepFishing } from '../../logic/fishingSession'
import { clampDelta } from '../../logic/time'
import { useFishingStore } from '../../stores/fishingStore'
import { useProgressStore } from '../../stores/progressStore'
import { useSessionStore } from '../../stores/sessionStore'

/** 화면에는 아무것도 그리지 않고, 매 프레임 낚시 로직만 한 칸씩 진행시킨다 */
export function FishingController() {
  useFrame((_, delta) => {
    // 낚시 중이 아니어도 매 프레임 읽어서 '새로 눌림' 신호를 비워 둔다
    const input = readPointer()
    if (useSessionStore.getState().mode !== 'fishing') return

    const fishing = useFishingStore.getState()
    if (!fishing.state || !fishing.spotId) return
    const spot = getSpot(fishing.spotId)
    const next = stepFishing(fishing.state, input, clampDelta(delta), {
      zone: spot.zone,
      gear: gearStats(useProgressStore.getState().gear),
      rng: Math.random,
    })
    if (next === fishing.state) return

    // 'done'은 한 번만 들어온다 (done 상태는 stepFishing이 그대로 돌려주므로 위에서 return)
    if (next.stage === 'done' && next.result === 'caught') {
      const caught = useProgressStore.getState().addCatch(next.speciesId, next.weight)
      fishing.update(next, caught)
    } else {
      fishing.update(next)
    }
  })
  return null
}
