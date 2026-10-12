import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { clampDelta } from '../logic/time'
import { useProgressStore } from '../stores/progressStore'

/** 매 프레임 저장하면 localStorage 쓰기가 너무 잦으므로 1초씩 모아서 기록한다 */
export function PlayTimeTicker() {
  const pending = useRef(0)
  useFrame((_, delta) => {
    pending.current += clampDelta(delta)
    if (pending.current >= 1) {
      useProgressStore.getState().addPlayTime(pending.current)
      pending.current = 0
    }
  })
  return null
}
