import { useEffect, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { CuboidCollider, RigidBody } from '@react-three/rapier'
import { clampDelta } from '../game/logic/time'
import { useProgressStore } from '../game/stores/progressStore'
import { applyDoors, doorCuboid, meadowWorld } from './meadowSingleton'

/**
 * 은지 집 문 4개: 저장된 상태로 맞추고(처음엔 바로, 그 뒤엔 은지처럼 돌아가며), 문짝마다 Rapier 상자를 둔다.
 * 상자는 누르는 순간 다 돌아간 자리로 바뀐다 (key 를 바꿔 새로 만든다). 문짝은 0.5초쯤 돌아간다
 */
export function MeadowDoors() {
  const doors = useProgressStore((s) => s.doors)
  const first = useRef(true)
  useEffect(() => {
    applyDoors(doors, first.current)
    first.current = false
  }, [doors])
  useFrame((_, delta) => {
    const dt = clampDelta(delta)
    for (const d of meadowWorld().doors) d.update(dt)
  })
  return (
    <RigidBody type="fixed" colliders={false}>
      {doors.map((open, i) => {
        const c = doorCuboid(i, open)
        return c && <CuboidCollider key={`${i}:${open}`} args={c.half} position={c.center} />
      })}
    </RigidBody>
  )
}
