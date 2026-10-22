import { Html } from '@react-three/drei'
import { RigidBody } from '@react-three/rapier'
import { FACILITY } from '../../data/zones'
import { InteractionZone } from './InteractionZone'

const [X, Z] = FACILITY.wardrobe

/** 선착장 옷장: 열면 캐릭터 꾸미기 화면. 나무 장 + 거울 */
export function Wardrobe() {
  return (
    <group position={[X, 0, Z]} rotation-y={-Math.PI / 2}>
      <RigidBody type="fixed" colliders="cuboid">
        <mesh position={[0, 1.1, 0]} castShadow receiveShadow>
          <boxGeometry args={[1.4, 2.2, 0.6]} />
          <meshStandardMaterial color="#8d6e63" />
        </mesh>
      </RigidBody>
      {/* 문 두 짝과 손잡이 */}
      {[-0.35, 0.35].map((x) => (
        <group key={x}>
          <mesh position={[x, 1.1, 0.31]}>
            <boxGeometry args={[0.66, 2.0, 0.02]} />
            <meshStandardMaterial color="#a1887f" />
          </mesh>
          <mesh position={[x > 0 ? 0.06 : -0.06, 1.1, 0.34]}>
            <sphereGeometry args={[0.04, 8, 8]} />
            <meshStandardMaterial color="#ffd54f" metalness={0.6} roughness={0.3} />
          </mesh>
        </group>
      ))}
      {/* 옆 거울 */}
      <mesh position={[1.0, 1.0, 0]} rotation-y={-0.3}>
        <boxGeometry args={[0.5, 1.6, 0.05]} />
        <meshStandardMaterial color="#cfe8ff" metalness={0.9} roughness={0.05} />
      </mesh>
      <Html center position={[0, 2.6, 0]} zIndexRange={[100, 0]} style={sign}>
        👗 옷장
      </Html>
      <InteractionZone position={[0, 1, 0]} halfSize={[1.8, 1.5, 1.8]} target={{ kind: 'wardrobe' }} />
    </group>
  )
}

const sign = {
  pointerEvents: 'none' as const,
  whiteSpace: 'nowrap' as const,
  background: 'rgba(0,0,0,0.6)',
  color: '#fff',
  padding: '4px 10px',
  borderRadius: 6,
  fontSize: 14,
  fontWeight: 700,
}
