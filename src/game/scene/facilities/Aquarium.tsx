import { Html } from '@react-three/drei'
import { CuboidCollider, RigidBody } from '@react-three/rapier'
import { BackSide, Color } from 'three'
import type { TankTypeId } from '../../data/types'
import { TANK_LEVELS, getTankType } from '../../data/aquarium'
import { FACILITY } from '../../data/zones'
import { incomePerSecond, isHungry } from '../../logic/aquarium'
import { TANK_FLOOR, swimSeed, tankFloorY } from '../../logic/aquariumSwim'
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
/** 물고기 몸길이 상한 (수조 폭·깊이 대비). 아주 큰 어종도 수조 안에 들어가게 */
const MAX_FISH_LENGTH = { width: 0.4, depth: 0.75 }

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
        <TankBody type={aquarium.activeType} size={level.size} />
        {aquarium.displayed.map((fish) => (
          <AquariumFish
            key={fish.id}
            speciesId={fish.speciesId}
            half={[w / 2 - 0.3, h / 2 - 0.25, d / 2 - 0.25]}
            seed={swimSeed(fish.id)}
            hungry={hungry}
            sinceFed={playTime - aquarium.lastFedAt}
            floorY={tankFloorY(h)}
            maxLength={Math.min(w * MAX_FISH_LENGTH.width, d * MAX_FISH_LENGTH.depth)}
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

/** 크게 보기 물 색·불투명도. 화면 가득 볼 때 회색으로 가라앉지 않게 게임 속보다 밝고 파랗게 */
const VIEW_WATER: Record<TankTypeId, { color: string; opacity: number }> = {
  basic: { color: '#4fc3f7', opacity: 0.3 },
  sea: { color: '#1e9be0', opacity: 0.4 },
  fresh: { color: '#3fae8f', opacity: 0.38 },
  cave: { color: '#2a3a9e', opacity: 0.55 },
}

/**
 * 물·유리·바닥·장식. 원점이 수조 가운데다. 게임 속 어항과 크게 보기(big)가 같이 쓴다.
 * 물은 안쪽 면(BackSide)만 그려서 뒤쪽 벽·바닥이 물빛으로 보이고, 앞에 있는 물고기는 물빛에 덮이지 않는다
 */
export function TankBody({ type, size, big = false }: { type: TankTypeId; size: [number, number, number]; big?: boolean }) {
  const [w, h, d] = size
  const look = getTankType(type)
  const water = big ? VIEW_WATER[type] : { color: look.water, opacity: look.waterOpacity }
  return (
    <>
      {/* 물과 유리. 물은 안쪽, 유리는 바깥 테두리. 둘 다 깊이를 쓰지 않아 물고기 뒤에 그려진다 */}
      <mesh renderOrder={1}>
        <boxGeometry args={[w - 0.05, h - 0.1, d - 0.05]} />
        <meshStandardMaterial color={water.color} transparent opacity={water.opacity} depthWrite={false} side={BackSide} />
      </mesh>
      <mesh renderOrder={2}>
        <boxGeometry args={[w, h, d]} />
        <meshPhysicalMaterial color="#ffffff" transparent opacity={big ? 0.06 : 0.12} roughness={0.05} metalness={0} depthWrite={false} />
      </mesh>
      {/* 바닥 */}
      <mesh position={[0, -h / 2 + TANK_FLOOR / 2, 0]} receiveShadow>
        <boxGeometry args={[w - 0.05, TANK_FLOOR, d - 0.05]} />
        {/* 크게 보기는 위에서 비추는 빛이 세서 모래가 하얗게 날아가지 않게 조금 어둡게 */}
        <meshStandardMaterial color={big ? new Color(look.floor).multiplyScalar(0.65) : look.floor} />
      </mesh>
      <TankDecor type={type} w={w} h={h} d={d} big={big} />
    </>
  )
}

/** 어항 종류별 장식. 크게 보기(big)에서는 큰 수조에 맞게 키우고 몇 개 더 놓는다. 동굴 수조의 이끼는 스스로 빛난다 */
function TankDecor({ type, w, h, d, big }: { type: TankTypeId; w: number; h: number; d: number; big: boolean }) {
  const floorY = tankFloorY(h)
  /** 장식 크기 배율 */
  const k = big ? 2.2 : 1
  switch (type) {
    case 'sea':
      return (
        <>
          {[-0.35, 0.1, 0.38].map((x, i) => (
            <mesh key={x} position={[w * x, floorY + (0.25 + i * 0.075) * k, -d * 0.25]}>
              <coneGeometry args={[0.12 * k, (0.5 + i * 0.15) * k, 6]} />
              <meshStandardMaterial color={['#ff7043', '#f06292', '#ffca28'][i]} />
            </mesh>
          ))}
          <Prop url={ASSET.rockA} height={0.25 * k} position={[-w * 0.2, floorY, d * 0.15]} />
          {big && (
            <>
              {[-0.1, 0.25].map((x, i) => (
                <mesh key={x} position={[w * x, floorY + (0.2 + i * 0.05) * k, -d * 0.32]}>
                  <coneGeometry args={[0.1 * k, (0.4 + i * 0.1) * k, 6]} />
                  <meshStandardMaterial color={['#ab47bc', '#ff8a65'][i]} />
                </mesh>
              ))}
              <Prop url={ASSET.rockC} height={0.2 * k} position={[w * 0.32, floorY, d * 0.2]} rotationY={1.2} />
              <Prop url={ASSET.bush} height={0.35 * k} position={[-w * 0.42, floorY, d * 0.05]} />
            </>
          )}
        </>
      )
    case 'fresh':
      return (
        <>
          <Prop url={ASSET.bush} height={0.6 * k} position={[-w * 0.35, floorY, -d * 0.2]} />
          <Prop url={ASSET.bush} height={0.45 * k} position={[w * 0.3, floorY, -d * 0.25]} />
          <Prop url={ASSET.rockC} height={0.25 * k} position={[w * 0.05, floorY, d * 0.15]} />
          <Prop url={ASSET.lily} height={0.03 * k} position={[w * 0.2, h / 2 - 0.1, 0]} />
          {big && (
            <>
              <Prop url={ASSET.bush} height={0.5 * k} position={[-w * 0.05, floorY, -d * 0.32]} rotationY={0.8} />
              <Prop url={ASSET.rockA} height={0.2 * k} position={[-w * 0.25, floorY, d * 0.25]} />
              <Prop url={ASSET.lily} height={0.03 * k} position={[-w * 0.25, h / 2 - 0.1, -d * 0.1]} rotationY={2} />
            </>
          )}
        </>
      )
    case 'cave':
      return (
        <>
          <Prop url={ASSET.stoneTall} height={0.8 * k} position={[-w * 0.35, floorY, -d * 0.2]} />
          <Prop url={ASSET.rockTall} height={0.6 * k} position={[w * 0.3, floorY, -d * 0.2]} />
          {[-0.2, 0.1, 0.25, ...(big ? [-0.4, 0.4] : [])].map((x, i) => (
            <mesh key={x} position={[w * x, floorY + 0.03 * k, d * (i % 2 === 0 ? 0.1 : -0.05)]}>
              <sphereGeometry args={[0.08 * k, 8, 8]} />
              <meshStandardMaterial color="#76ff03" emissive="#76ff03" emissiveIntensity={1.5} />
            </mesh>
          ))}
          {big && (
            <>
              <Prop url={ASSET.stoneTall} height={0.55 * k} position={[w * 0.05, floorY, -d * 0.35]} rotationY={1.5} />
              <Prop url={ASSET.rockC} height={0.2 * k} position={[-w * 0.1, floorY, d * 0.25]} />
            </>
          )}
        </>
      )
    default:
      return (
        <>
          <Prop url={ASSET.rockA} height={0.2 * k} position={[w * 0.25, floorY, -d * 0.15]} />
          <Prop url={ASSET.rockC} height={0.15 * k} position={[-w * 0.3, floorY, d * 0.1]} rotationY={0.7} />
          <Prop url={ASSET.bush} height={0.35 * k} position={[-w * 0.38, floorY, -d * 0.25]} />
          {big && (
            <>
              <Prop url={ASSET.bush} height={0.3 * k} position={[w * 0.4, floorY, -d * 0.3]} rotationY={2.2} />
              <Prop url={ASSET.rockA} height={0.12 * k} position={[w * 0.05, floorY, d * 0.25]} rotationY={0.4} />
            </>
          )}
        </>
      )
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
