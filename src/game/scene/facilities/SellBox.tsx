import { RigidBody } from '@react-three/rapier'
import { InteractionZone } from './InteractionZone'

const POSITION: [number, number, number] = [5, 0.5, 16]

export function SellBox() {
  return (
    <>
      {/* colliders="cuboid": 메시 모양에 맞춰 상자 충돌체를 자동으로 만든다 */}
      <RigidBody type="fixed" colliders="cuboid" position={POSITION}>
        <mesh castShadow receiveShadow>
          <boxGeometry args={[1.2, 1, 1.2]} />
          <meshStandardMaterial color="#c62828" />
        </mesh>
      </RigidBody>
      <InteractionZone position={POSITION} halfSize={[2, 1.5, 2]} target={{ kind: 'sellBox' }} />
    </>
  )
}
