import { Html } from '@react-three/drei'
import { RigidBody } from '@react-three/rapier'
import { FACILITY } from '../../data/zones'
import { ASSET } from '../assets'
import { Prop } from '../Prop'
import { Visitor } from '../Visitor'

const [X, Z] = FACILITY.clinic

/** 진료소: 쓰러지면 이 앞에서 깨어난다. 상호작용은 없다 */
export function Clinic() {
  return (
    <group position={[X, 0, Z]}>
      <RigidBody type="fixed" colliders="cuboid">
        <mesh position={[0, 1.2, 0]} castShadow receiveShadow>
          <boxGeometry args={[3.4, 2.4, 2.6]} />
          <meshStandardMaterial color="#fafafa" />
        </mesh>
      </RigidBody>
      {/* 빨간 십자 */}
      <mesh position={[0, 1.8, 1.31]}>
        <boxGeometry args={[0.9, 0.25, 0.02]} />
        <meshStandardMaterial color="#e53935" />
      </mesh>
      <mesh position={[0, 1.8, 1.31]}>
        <boxGeometry args={[0.25, 0.9, 0.02]} />
        <meshStandardMaterial color="#e53935" />
      </mesh>
      <Prop url={ASSET.bed} height={0.6} position={[1.2, 0, 1.9]} rotationY={Math.PI / 2} />
      <Prop url={ASSET.plant} height={0.9} position={[-1.4, 0, 1.6]} />
      <Visitor url={ASSET.visitorC} position={[-0.6, 0, 1.8]} clip="idle" />
      <Html center position={[0, 2.9, 0]} style={sign}>
        🏥 진료소
      </Html>
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
