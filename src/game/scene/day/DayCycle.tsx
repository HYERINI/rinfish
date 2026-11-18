import { useFrame } from '@react-three/fiber'
import { BED_ZONE } from '../../data/meadow'
import type { Interactable } from '../../logic/interaction'
import { clampDelta, restStops } from '../../logic/time'
import { useDayStore } from '../../stores/dayStore'
import { useSessionStore } from '../../stores/sessionStore'
import { InteractionZone } from '../facilities/InteractionZone'
import { stepRest } from './dayActions'

const BED: Interactable = { kind: 'bed' }

/** 시계를 돌리고(혼자: 메뉴·로비·잠·죽음 화면에서 멈춤, 같이: 방 시계) 잠·죽음 화면 어두워지기를 진행한다. 침대 E 감지 상자 */
export function DayCycle() {
  useFrame((_, delta) => {
    // 잠·죽음으로 어두워지는 동안 혼자 시계가 흘러 06:00 을 넘으면 하루를 더 건너뛴다: 멈춘다
    const day = useDayStore.getState()
    day.stepClock(clampDelta(delta), restStops(useSessionStore.getState().mode, day.seq?.kind))
    stepRest(performance.now() / 1000)
  })
  return <InteractionZone position={[BED_ZONE.center[0], 0.8, BED_ZONE.center[1]]} halfSize={BED_ZONE.half} target={BED} />
}
