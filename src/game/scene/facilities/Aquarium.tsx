import { Html } from '@react-three/drei'
import { CuboidCollider, RigidBody } from '@react-three/rapier'
import type { TankTypeId } from '../../data/types'
import { TANK_LEVELS, getTankType } from '../../data/aquarium'
import { FACILITY } from '../../data/zones'
import { incomePerSecond, isHungry } from '../../logic/aquarium'
import { useProgressStore } from '../../stores/progressStore'
import { ASSET } from '../assets'
import { Prop } from '../Prop'
import { Visitor } from '../Visitor'
import { AquariumFish } from './AquariumFish'
import { InteractionZone } from './InteractionZone'

const [X, Z] = FACILITY.aquarium
/** 받침대 높이 */
const STAND = 0.8
const VISITOR_URLS = [ASSET.visitorA, ASSET.visitorB, ASSET.visitorC]
/** 분당 입장료 몇 코인마다 구경꾼 1명 (최대 VISITOR_URLS × 2명) */
const INCOME_PER_VISITOR = 3

export function Aquarium() {
  const aquarium = useProgressStore((s) => s.aquarium)
  const playTime = useProgressStore((s) => s.playTime)
  const level = TANK_LEVELS[aquarium.level]
  const type = getTankType(aquarium.activeType)
  const [w, h, d] = level.size
  const hungry = isHungry(aquarium, playTime)
  const perMinute = hungry ? 0 : incomePerSecond(aquarium) * 60
  const visitors = Math.min(VISITOR_URLS.length * 2, Math.ceil(perMinute / INCOME_PER_VISITOR))

  return (
    <group position={[X, 0, Z]}>
      {/* 받침대 */}
      <RigidBody type="fixed" colliders={false}>
        {/* 확장하면 크기가 바뀌므로 자동 콜라이더 대신 args 로 다시 만든다. 유리 탱크 윗면까지 막는다 */}
        <CuboidCollider args={[(w + 0.3) / 2, (STAND + h) / 2, (d + 0.3) / 2]} position={[0, (STAND + h) / 2, 0]} />
        <mesh position={[0, STAND / 2, 0]} castShadow receiveShadow>
          <boxGeometry args={[w + 0.3, STAND, d + 0.3]} />
          <meshStandardMaterial color="#5d4037" />
        </mesh>
      </RigidBody>

      <group position={[0, STAND + h / 2, 0]}>
        {/* 물과 유리. 물은 안쪽, 유리는 바깥 테두리 */}
        <mesh renderOrder={1}>
          <boxGeometry args={[w - 0.05, h - 0.1, d - 0.05]} />
          <meshStandardMaterial color={type.water} transparent opacity={type.waterOpacity} depthWrite={false} />
        </mesh>
        <mesh renderOrder={2}>
          <boxGeometry args={[w, h, d]} />
          <meshPhysicalMaterial color="#ffffff" transparent opacity={0.12} roughness={0.05} metalness={0} depthWrite={false} />
        </mesh>
        {/* 바닥 */}
        <mesh position={[0, -h / 2 + 0.06, 0]} receiveShadow>
          <boxGeometry args={[w - 0.05, 0.12, d - 0.05]} />
          <meshStandardMaterial color={type.floor} />
        </mesh>
        <TankDecor type={aquarium.activeType} w={w} h={h} d={d} />
        {aquarium.displayed.map((fish, i) => (
          <AquariumFish
            key={fish.id}
            speciesId={fish.speciesId}
            half={[w / 2 - 0.3, h / 2 - 0.25, d / 2 - 0.25]}
            seed={i}
            hungry={hungry}
            sinceFed={playTime - aquarium.lastFedAt}
          />
        ))}
      </group>

      {/* 구경꾼: 수입이 높을수록 많이 모인다 */}
      {Array.from({ length: visitors }, (_, i) => {
        // 어항 양옆 앞쪽에 서서 어항 가운데를 바라본다. 앞을 막지 않게 가운데는 비워 둔다
        const vx = (i % 2 === 0 ? -1 : 1) * (w / 2 + 0.7 + Math.floor(i / 2) * 0.85)
        const vz = d / 2 + 0.9
        return (
          <Visitor
            key={i}
            url={VISITOR_URLS[i % VISITOR_URLS.length]}
            position={[vx, 0, vz]}
            rotationY={Math.atan2(-vx, -vz)}
            clip={i % 2 === 0 ? 'idle' : 'emote-yes'}
          />
        )
      })}

      <Html center position={[0, STAND + h + 0.6, 0]} zIndexRange={[100, 0]} style={sign}>
        🐠 어항 Lv{aquarium.level + 1} · {type.name}
        {hungry && ' · 배고파요!'}
      </Html>
      <InteractionZone position={[0, 1, d / 2 + 1]} halfSize={[w / 2 + 0.5, 1.5, 1.2]} target={{ kind: 'aquarium' }} />
    </group>
  )
}

/** 어항 종류별 장식. 동굴 수조의 이끼는 스스로 빛난다 */
function TankDecor({ type, w, h, d }: { type: TankTypeId; w: number; h: number; d: number }) {
  const floorY = -h / 2 + 0.12
  switch (type) {
    case 'sea':
      return (
        <>
          {[-0.35, 0.1, 0.38].map((k, i) => (
            <mesh key={k} position={[w * k, floorY + 0.25, -d * 0.25]}>
              <coneGeometry args={[0.12, 0.5 + i * 0.15, 6]} />
              <meshStandardMaterial color={['#ff7043', '#f06292', '#ffca28'][i]} />
            </mesh>
          ))}
          <Prop url={ASSET.rockA} height={0.25} position={[-w * 0.2, floorY, d * 0.15]} />
        </>
      )
    case 'fresh':
      return (
        <>
          <Prop url={ASSET.bush} height={0.6} position={[-w * 0.35, floorY, -d * 0.2]} />
          <Prop url={ASSET.bush} height={0.45} position={[w * 0.3, floorY, -d * 0.25]} />
          <Prop url={ASSET.rockC} height={0.25} position={[w * 0.05, floorY, d * 0.15]} />
          <Prop url={ASSET.lily} height={0.03} position={[w * 0.2, h / 2 - 0.1, 0]} />
        </>
      )
    case 'cave':
      return (
        <>
          <Prop url={ASSET.stoneTall} height={0.8} position={[-w * 0.35, floorY, -d * 0.2]} />
          <Prop url={ASSET.rockTall} height={0.6} position={[w * 0.3, floorY, -d * 0.2]} />
          {[-0.2, 0.1, 0.25].map((k) => (
            <mesh key={k} position={[w * k, floorY + 0.03, d * 0.1]}>
              <sphereGeometry args={[0.08, 8, 8]} />
              <meshStandardMaterial color="#76ff03" emissive="#76ff03" emissiveIntensity={1.5} />
            </mesh>
          ))}
        </>
      )
    default:
      return <Prop url={ASSET.rockA} height={0.2} position={[w * 0.25, floorY, -d * 0.15]} />
  }
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
