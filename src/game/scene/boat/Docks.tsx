import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import type { Group } from 'three'
import { BOAT_BOARD } from '../../data/boat'
import { WATER_Y } from '../../data/zones'
import { BOAT_WAYPOINTS } from '../../logic/boatRoute'
import { waveHeight } from '../../logic/waves'
import { useSessionStore } from '../../stores/sessionStore'
import { InteractionZone } from '../facilities/InteractionZone'
import { BoatModel } from './BoatModel'

const first = BOAT_WAYPOINTS[0]
const last = BOAT_WAYPOINTS[BOAT_WAYPOINTS.length - 1]
/** 선착장에 떠 있는 배 [x, z, 바라보는 각도]: 초원 쪽은 서쪽(섬), 섬 쪽은 남쪽(바다)을 본다 */
const MOORED: [number, number, number][] = [
  [first[0], first[1], -Math.PI / 2],
  [last[0], last[1], 0],
]

/** 두 선착장의 배(물결 따라 출렁인다)와 배 타기 감지 상자. 내가 배를 타는 동안엔 선착장 배를 숨긴다 (타고 있는 배가 대신 간다) */
export function Docks() {
  const boats = useRef<(Group | null)[]>([])
  const riding = useSessionStore((s) => s.boat !== null)

  useFrame(({ clock }) => {
    MOORED.forEach(([x, z], i) => {
      const g = boats.current[i]
      if (g) g.position.y = WATER_Y + waveHeight(x, z, clock.elapsedTime)
    })
  })

  return (
    <>
      {MOORED.map(([x, z, heading], i) => (
        <group key={i} ref={(g) => void (boats.current[i] = g)} position={[x, WATER_Y, z]} rotation-y={heading} visible={!riding}>
          <BoatModel />
        </group>
      ))}
      {BOAT_BOARD.map((b) => (
        <InteractionZone key={b.dir} position={[b.center[0], 0.8, b.center[1]]} halfSize={[1.5, 1.2, 1.5]} target={{ kind: 'dock', dir: b.dir }} />
      ))}
    </>
  )
}
