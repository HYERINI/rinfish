import { Html } from '@react-three/drei'
import { CuboidCollider, RigidBody } from '@react-three/rapier'
import { ASSET } from '../assets'
import { Prop } from '../Prop'
import { InteractionZone } from './InteractionZone'

/** 가게 자리 (바닥 기준) */
const POSITION: [number, number, number] = [-6, 0, 14]
/** stall-green.glb(1 x 1, 높이 1.237)를 키울 높이. 바닥 2.1 x 2.1, 진열대 윗면 약 0.78. 원래 진열대 앞이 +x 라서 -90° 돌려 +z(해변)를 보게 한다 */
const STALL_HEIGHT = 2.6
const HALF = 1.05

/** 진열대 옆에 세워 둔 낚싯대 [x, z, 기울기, 손잡이 색] */
const RODS: [number, number, number, string][] = [
  [1.4, -0.55, 0.1, '#c62828'],
  [1.45, -0.2, 0.04, '#1565c0'],
  [1.4, 0.15, -0.04, '#2e7d32'],
]

function Rod({ x, z, tilt, grip }: { x: number; z: number; tilt: number; grip: string }) {
  return (
    <group position={[x, 0, z]} rotation-z={0.12} rotation-x={tilt}>
      <mesh position={[0, 1.1, 0]} castShadow>
        <cylinderGeometry args={[0.012, 0.025, 2.2]} />
        <meshStandardMaterial color="#3e2723" />
      </mesh>
      <mesh position={[0, 0.3, 0]} castShadow>
        <cylinderGeometry args={[0.035, 0.035, 0.45]} />
        <meshStandardMaterial color={grip} />
      </mesh>
      {/* 릴 */}
      <mesh position={[0.06, 0.6, 0]} rotation-z={Math.PI / 2}>
        <cylinderGeometry args={[0.06, 0.06, 0.05, 12]} />
        <meshStandardMaterial color="#cfd8dc" metalness={0.6} roughness={0.3} />
      </mesh>
    </group>
  )
}

/** 낚시 장비 노점: 초록 천막 진열대, 옆에 세운 낚싯대, 상자·통·양동이 */
export function GearShop() {
  return (
    <group position={POSITION}>
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider args={[HALF, 1, HALF]} position={[0, 1, 0]} />
      </RigidBody>
      <Prop url={ASSET.stall} height={STALL_HEIGHT} rotationY={-Math.PI / 2} />
      {/* 진열대 위 미끼 상자와 양동이 */}
      <Prop url={ASSET.boxOpen} height={0.3} position={[-0.5, 0.78, 0.55]} rotationY={0.3} />
      <Prop url={ASSET.bucket} height={0.3} position={[0.45, 0.78, 0.6]} />
      {RODS.map(([x, z, tilt, grip]) => (
        <Rod key={z} x={x} z={z} tilt={tilt} grip={grip} />
      ))}
      {/* 옆에 쌓은 상자와 통 */}
      <Prop url={ASSET.crateLong} height={0.5} position={[-1.45, 0, 0.4]} />
      <Prop url={ASSET.crateLong} height={0.5} position={[-1.45, 0.5, 0.35]} rotationY={0.15} />
      <Prop url={ASSET.barrel} height={0.8} position={[-1.5, 0, -0.5]} />
      <Html center position={[0, 3.1, 0]} zIndexRange={[100, 0]} style={sign}>
        🎣 장비 상점
      </Html>
      <InteractionZone position={[0, 1, 0]} halfSize={[2.5, 1.5, 2]} target={{ kind: 'gearShop' }} />
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
