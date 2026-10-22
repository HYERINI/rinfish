import { useFrame } from '@react-three/fiber'
import { readPointer } from '../../input/pointer'
import { usableBait } from '../../logic/bait'
import { gearStats } from '../../logic/economy'
import { stepFishing } from '../../logic/fishingSession'
import { fightMods } from '../../logic/stamina'
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
    const spot = fishing.spot
    if (!fishing.state || !spot) return
    const progress = useProgressStore.getState()
    // 고른 미끼가 떨어졌으면 미끼 없이 던진다
    const bait = usableBait(progress.selectedBait, progress.bait)
    const next = stepFishing(fishing.state, input, clampDelta(delta), {
      zone: spot.zone,
      gear: gearStats(progress.gear),
      mods: fightMods(progress.survival),
      rng: Math.random,
      bait,
    })
    if (next === fishing.state) return

    // 던지는 순간 체력을 쓴다 (줄다리기 중 소모는 PlayTimeTicker가 1초마다 처리)
    // 미끼도 이때 1개 쓴다 (입질을 놓쳐도 돌려받지 못한다)
    if (fishing.state.stage === 'aiming' && next.stage === 'waiting') {
      progress.spendCastStamina()
      if (bait) progress.spendBait(bait)
    }

    // 'done'은 한 번만 들어온다 (done 상태는 stepFishing이 그대로 돌려주므로 위에서 return)
    if (next.stage === 'done' && next.result === 'caught') {
      const caught = progress.addCatch(next.speciesId, next.weight)
      fishing.update(next, caught)
    } else {
      fishing.update(next)
    }
  })
  return null
}
