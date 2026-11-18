import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { CLINIC_SPAWN } from '../data/zones'
import type { AquariumEvent } from '../logic/aquarium'
import { clampDelta, restStops } from '../logic/time'
import { liveClock, useDayStore } from '../stores/dayStore'
import { useFishingStore } from '../stores/fishingStore'
import { useProgressStore } from '../stores/progressStore'
import { useSessionStore } from '../stores/sessionStore'
import { startDeath } from './day/dayActions'

const AQUARIUM_NOTICE: Record<AquariumEvent, string> = {
  hungry: '어항 물고기들이 배고파해요. 수입이 멈췄어요!',
  releaseWarning: '2분 안에 먹이를 주지 않으면 어항 물고기들이 바다로 돌아가요!',
  released: '배고픈 물고기들이 바다로 돌아갔어요… (도감 기록은 남아요)',
}

/**
 * 플레이 시간, 체력(유예·버프)·배고픔, 어항 시간, 혼자 시계 저장을 1초씩 모아서 진행한다.
 * 매 프레임 저장하면 localStorage 쓰기가 너무 잦기 때문
 */
export function PlayTimeTicker() {
  const pending = useRef(0)
  useFrame((_, delta) => {
    const session = useSessionStore.getState()
    const day = useDayStore.getState()
    // 메뉴·꾸미기·로비 화면을 열어 둔 동안이나 잠·죽음으로 화면이 어두워지는 동안은 시간이 흐르지 않는다.
    // 멈춘 시간이 다음 틱에 몰려 들어가지 않게 비운다
    if (restStops(session.mode, day.seq?.kind)) {
      pending.current = 0
      return
    }
    pending.current += clampDelta(delta)
    if (pending.current < 1) return
    const seconds = pending.current
    pending.current = 0

    const fighting = session.mode === 'fishing' && useFishingStore.getState().state?.stage === 'fighting'
    const ctx = { fighting, resting: session.mode === 'rest', exploring: session.mode === 'explore', sleeping: day.voting }
    // 혼자 할 때만 시계를 저장한다 (같이 하는 동안 방 시계로 덮어쓰지 않게)
    const events = useProgressStore.getState().tick(seconds, ctx, day.roomClock ? null : { ...liveClock })

    for (const event of events.aquarium) session.notify(AQUARIUM_NOTICE[event])
    if (events.died) startDeath()
    else if (events.fainted) {
      useFishingStore.getState().end()
      session.setMode('explore')
      session.requestTeleport(CLINIC_SPAWN)
      session.notify('쓰러졌다… 진료소에서 깨어났어요. 들고 있던 물고기를 잃고 진료비를 냈어요.')
    }
  })
  return null
}
