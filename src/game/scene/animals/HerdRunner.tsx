import { useEffect } from 'react'
import { useFrame } from '@react-three/fiber'
import { isIndoor } from '../../data/meadow'
import { ME, setHurtHandler, setSoloHerd, soloHerd } from '../../hunt/animalRig'
import { stepHerd } from '../../logic/animalSim'
import { clampDelta, restStops } from '../../logic/time'
import { useDayStore } from '../../stores/dayStore'
import { useNetStore } from '../../stores/netStore'
import { useSessionStore } from '../../stores/sessionStore'
import { takeHit } from '../day/dayActions'
import { playerRig } from '../Player'

/**
 * 화면엔 아무것도 그리지 않는다. 혼자 할 때 들판 동물을 매 프레임 돌리고(같이 하면 서버가 돌린다), 들이받히면 체력을 깎는다.
 * 메뉴·꾸미기·로비나 잠·죽음으로 어두워지는 동안은 게임 시간처럼 멈춘다. 서버 hurt 도 같은 takeHit 로 받는다
 */
export function HerdRunner() {
  useEffect(() => {
    setHurtHandler(takeHit)
    return () => setHurtHandler(() => {})
  }, [])

  useFrame((_, delta) => {
    if (useNetStore.getState().phase !== 'off') return
    if (restStops(useSessionStore.getState().mode, useDayStore.getState().seq?.kind)) return
    const { x, z } = playerRig.position
    const r = stepHerd(soloHerd(), [{ id: ME, x, z, indoor: isIndoor(x, z) }], clampDelta(delta))
    setSoloHerd(r.herd)
    for (const e of r.events) if (e.type === 'attack' && e.target === ME) takeHit(e.dmg)
  })
  return null
}
