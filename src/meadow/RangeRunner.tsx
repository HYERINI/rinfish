import { useEffect, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { inRangeRoom } from '../game/data/meadow'
import { clampDelta, restStops } from '../game/logic/time'
import { playerRig } from '../game/scene/Player'
import { useDayStore } from '../game/stores/dayStore'
import { useSessionStore } from '../game/stores/sessionStore'
import { resetRangeGame, stepRange } from './rangeActions'

/**
 * 화면엔 아무것도 그리지 않는다. 사격장 표적·연습 게임을 매 프레임 돌리고(메뉴 등 시간이 멈추는 때는 멈춘다),
 * 처음 사격장에 들어오면 할 수 있는 일을 알려 준다 (은지 ROOM_HINTS). 게임을 다시 열면 하던 연습 게임을 지운다
 */
export function RangeRunner() {
  const hinted = useRef(false)
  useEffect(() => resetRangeGame(), [])
  useFrame((_, delta) => {
    stepRange(clampDelta(delta), performance.now() / 1000, restStops(useSessionStore.getState().mode, useDayStore.getState().seq?.kind))
    if (!hinted.current && inRangeRoom(playerRig.position.x, playerRig.position.z)) {
      hinted.current = true
      useSessionStore.getState().notify('🎯 사격장이에요. 선반에서 E 로 무기를 고르고, G 로 연습 게임을 시작해요')
    }
  })
  return null
}
