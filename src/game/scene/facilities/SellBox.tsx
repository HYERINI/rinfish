import { Html } from '@react-three/drei'
import { CuboidCollider, RigidBody } from '@react-three/rapier'
import { ASSET } from '../assets'
import { Prop } from '../Prop'
import { InteractionZone } from './InteractionZone'

/** 판매함 자리 (바닥 기준) */
const POSITION: [number, number, number] = [5, 0, 16]

/** 상자에 담긴 생선 [x, y, z, 돌림] */
const FISH_IN_CRATE: [number, number, number, number][] = [
  [-0.95, 0.42, 0.15, 0.6],
  [-0.65, 0.45, -0.2, -0.4],
  [-0.4, 0.42, 0.2, 0.2],
  [-0.7, 0.55, 0.05, 1.2],
]

/** 판매함: 생선을 담는 나무 상자와 아이스박스, 팻말 */
export function SellBox() {
  return (
    <group position={POSITION}>
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider args={[1.2, 0.5, 0.75]} position={[-0.05, 0.5, 0]} />
      </RigidBody>
      {/* crate.glb(1.08 x 1.31, 높이 0.77)를 옆으로 돌려 0.7 높이로: 1.19 x 0.98 */}
      <Prop url={ASSET.fishCrate} height={0.7} position={[-0.65, 0, 0]} rotationY={Math.PI / 2} />
      {FISH_IN_CRATE.map(([x, y, z, r]) => (
        <Prop key={`${x},${z}`} url={ASSET.fishLarge} height={0.2} position={[x, y, z]} rotationY={r} />
      ))}
      {/* 옆 아이스박스 (freezer.glb 0.8 x 0.6, 높이 0.35 → 0.65 높이로 1.49 x 1.11) 와 그 위에 올려 둔 생선 */}
      <Prop url={ASSET.iceBox} height={0.65} position={[0.55, 0, 0]} rotationY={Math.PI / 2} />
      <Prop url={ASSET.fishSmall} height={0.14} position={[0.5, 0.65, 0.15]} rotationY={0.5} />
      <Prop url={ASSET.signpost} height={1.6} position={[1.2, 0, 0.55]} rotationY={0.2} />
      <Html center position={[0, 2.1, 0]} zIndexRange={[100, 0]} style={sign}>
        💰 판매함
      </Html>
      <InteractionZone position={[0, 0.5, 0]} halfSize={[2, 1.5, 2]} target={{ kind: 'sellBox' }} />
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
