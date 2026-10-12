import { RigidBody } from '@react-three/rapier'
import { InteractionZone } from './InteractionZone'

const POSITION: [number, number, number] = [-6, 1, 14]

export function GearShop() {
  return (
    <>
      <RigidBody type="fixed" colliders="cuboid" position={POSITION}>
        <mesh castShadow receiveShadow>
          <boxGeometry args={[3, 2, 2]} />
          <meshStandardMaterial color="#1565c0" />
        </mesh>
      </RigidBody>
      {/* 지붕 */}
      <mesh position={[POSITION[0], 2.3, POSITION[2]]} castShadow>
        <boxGeometry args={[3.6, 0.3, 2.6]} />
        <meshStandardMaterial color="#ffca28" />
      </mesh>
      <InteractionZone position={POSITION} halfSize={[2.5, 1.5, 2]} target={{ kind: 'gearShop' }} />
    </>
  )
}
