import { Html } from '@react-three/drei'
import { CuboidCollider, RigidBody } from '@react-three/rapier'
import { MARKET } from '../../data/market'
import { FACILITY } from '../../data/zones'
import { ASSET } from '../assets'
import { Prop } from '../Prop'
import { CookingStation } from '../cooking/CookingStation'
import { InteractionZone } from './InteractionZone'
import { ShopSign } from './ShopSign'

const [X, Z] = FACILITY.market
/** 줄무늬 천막 색 */
const AWNING = ['#e53935', '#fafafa']

/** 찜 가게 미스터찜: 조리대, 화구, 냄비, 도마 위 생선, 천막, 간판, 사장님 배정빈 */
export function Market() {
  return (
    <group position={[X, 0, Z]} rotation-y={-Math.PI / 2}>
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider args={[2, 0.6, 0.5]} position={[0, 0.6, 0]} />
      </RigidBody>
      <Prop url={ASSET.counter} height={1} position={[-1, 0, 0]} />
      <Prop url={ASSET.counter} height={1} position={[0, 0, 0]} />
      <Prop url={ASSET.stove} height={1} position={[1.1, 0, 0]} />
      <Prop url={ASSET.potStew} height={0.35} position={[1.1, 1, 0]} />
      <Prop url={ASSET.cuttingBoard} height={0.06} position={[-0.6, 1, 0]} />
      <Prop url={ASSET.sushi} height={0.12} position={[0.1, 1, 0.1]} />
      <Prop url={ASSET.bowlBroth} height={0.18} position={[-1.3, 1, 0.1]} />
      {/* 사장님 배정빈과 도마 위 생선·냄비 김·다 된 요리 (주문하면 요리 연출) */}
      <CookingStation />
      {/* 기둥과 줄무늬 천막 */}
      {[-1.8, 1.8].map((x) => (
        <mesh key={x} position={[x, 1.3, -1.2]} castShadow>
          <cylinderGeometry args={[0.06, 0.06, 2.6]} />
          <meshStandardMaterial color="#6d4c41" />
        </mesh>
      ))}
      {Array.from({ length: 8 }, (_, i) => (
        <mesh key={i} position={[-1.75 + i * 0.5, 2.55, -0.6]} rotation-x={0.35} castShadow>
          <boxGeometry args={[0.5, 0.05, 1.6]} />
          <meshStandardMaterial color={AWNING[i % 2]} />
        </mesh>
      ))}
      {/* 간판: public/signs/market.png 가 있으면 그 그림, 없으면 글씨 간판 */}
      <ShopSign image={MARKET.signImage} text={MARKET.name} size={MARKET.signSize} position={[0, 3.05, 0.2]} rotationX={-0.12} />
      <Html center position={[0, 3.85, -0.4]} zIndexRange={[100, 0]} style={sign}>
        🍲 {MARKET.name}
      </Html>
      <Html center position={[0, 2.45, -0.9]} zIndexRange={[100, 0]} style={nameTag}>
        {MARKET.owner}
      </Html>
      <InteractionZone position={[0, 1, 1.2]} halfSize={[2.2, 1.5, 1.2]} target={{ kind: 'market' }} />
    </group>
  )
}

const nameTag = {
  pointerEvents: 'none' as const,
  whiteSpace: 'nowrap' as const,
  background: 'rgba(255,255,255,0.9)',
  color: '#b71c1c',
  padding: '2px 8px',
  borderRadius: 10,
  fontSize: 12,
  fontWeight: 800,
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
