import { Html } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { BallCollider, CuboidCollider, RigidBody } from '@react-three/rapier'
import { useEffect, useMemo, useRef, type ReactNode } from 'react'
import { CanvasTexture, SRGBColorSpace, type Group, type Mesh, type MeshStandardMaterial } from 'three'
import { CAVE_ROCK, HAMMER_TIMING, REPAIR_PLANS } from '../../data/repair'
import { BARRIER_COLLIDER_HEIGHT, FENCE_Z, INLAND_WATER_Y, ZONES, type ZoneDef } from '../../data/zones'
import { repairTimeline } from '../../logic/repairTimeline'
import { isZoneOpen } from '../../logic/zoneUnlock'
import { useProgressStore } from '../../stores/progressStore'
import { InteractionZone } from '../facilities/InteractionZone'
import { cutsceneTime } from './cutsceneClock'

/** 잠긴 구역 입구들: 무너진 다리(연못)·부서진 보트(암초)·바위(동굴). 열리면 보이지 않는 벽을 걷고 고친 모습을 보여 준다 */
export function ZoneGates() {
  const unlocked = useProgressStore((s) => s.unlockedZones)
  return (
    <>
      {ZONES.filter((z) => z.gate && z.unlock).map((zone) => (
        <ZoneGate key={zone.id} zone={zone} open={isZoneOpen(zone.id, unlocked)} />
      ))}
    </>
  )
}

function ZoneGate({ zone, open }: { zone: ZoneDef; open: boolean }) {
  const { xFrom, xTo } = zone.gate!
  const width = xTo - xFrom
  const cx = (xFrom + xTo) / 2
  let props: ReactNode = null
  if (zone.id === 'pond') props = <Bridge open={open} />
  if (zone.id === 'reef') props = <Boat open={open} />
  if (zone.id === 'cave') props = <CaveRock open={open} />
  return (
    <>
      {props}
      {!open && (
        <>
          {/* 보이는 것보다 훨씬 높은 보이지 않는 벽 (점프로 못 넘게). 바닥은 땅(y=0)에 맞춘다 */}
          <RigidBody type="fixed" colliders={false} position={[cx, 0, FENCE_Z]}>
            <CuboidCollider args={[width / 2, BARRIER_COLLIDER_HEIGHT.gate / 2, 0.3]} position={[0, BARRIER_COLLIDER_HEIGHT.gate / 2, 0]} />
          </RigidBody>
          {/* Html: 3D 위치에 일반 HTML을 띄운다 (한글 표시용) */}
          <Html center position={[cx, 3, FENCE_Z]} zIndexRange={[100, 0]} style={gateLabel}>
            잠김 · {zone.name} — {zone.unlockLabel}
          </Html>
          <InteractionZone position={[cx, 1, FENCE_Z + 2]} halfSize={[width / 2, 1.5, 1.7]} target={{ kind: 'zoneGate', zoneId: zone.id }} />
        </>
      )}
    </>
  )
}

/** 연출 중이면 지금 장면, 아니면 null */
function useCutsceneFrame(zoneId: 'pond' | 'reef' | 'cave', onFrame: (frame: ReturnType<typeof repairTimeline> | null, t: number) => void) {
  useFrame(() => {
    const t = cutsceneTime(zoneId)
    onFrame(t === null ? null : repairTimeline(REPAIR_PLANS[zoneId], t), t ?? 0)
  })
}

/** 고치는 순간 퍼지는 먼지 구름 (고친 모습으로 바뀐 걸 가려 준다) */
function Puff({ at, size, zoneId }: { at: [number, number, number]; size: number; zoneId: 'pond' | 'reef' }) {
  const group = useRef<Group>(null)
  useCutsceneFrame(zoneId, (_, t) => {
    const g = group.current
    if (!g) return
    const age = t - (HAMMER_TIMING.arrive + HAMMER_TIMING.fixAt) + 0.25
    const alive = cutsceneTime(zoneId) !== null && age > 0 && age < 1
    g.visible = alive
    if (!alive) return
    g.scale.setScalar(size * (0.6 + age * 0.9))
    g.children.forEach((c) => (((c as Mesh).material as MeshStandardMaterial).opacity = 0.85 * (1 - age)))
  })
  return (
    <group ref={group} position={at} visible={false}>
      {[0, 1, 2, 3, 4, 5, 6].map((i) => {
        const a = (i / 7) * Math.PI * 2
        return (
          <mesh key={i} position={[Math.cos(a) * 0.9, 0.3 + (i % 2) * 0.35, Math.sin(a) * 0.9]}>
            <sphereGeometry args={[0.55, 10, 8]} />
            <meshStandardMaterial color="#efebe9" transparent opacity={0.8} depthWrite={false} />
          </mesh>
        )
      })}
    </group>
  )
}

/** 고친 모습은 열린 뒤에만, 연출 중이면 고친 순간부터 보인다 */
function useFixedSwap(zoneId: 'pond' | 'reef', open: boolean) {
  const broken = useRef<Group>(null)
  const fixed = useRef<Group>(null)
  useCutsceneFrame(zoneId, (frame) => {
    const showFixed = open && (frame ? frame.fixed : true)
    if (broken.current) broken.current.visible = !showFixed
    if (fixed.current) fixed.current.visible = showFixed
  })
  return { broken, fixed }
}

const WOOD = '#a1887f'
const WOOD_DARK = '#6d4c41'
const OLD_WOOD = '#8d7b6c'

// ---------------------------------------------------------------- 연못: 개울 위 나무다리

const [BX, BZ] = REPAIR_PLANS.pond.site
/** 다리 판자: 개울(z 3.6 ~ 6.4)을 건너는 길이 4.4m, 폭 3m. 가운데가 조금 높다 */
const PLANKS = Array.from({ length: 9 }, (_, i) => {
  const z = -2 + i * 0.5
  return { z, y: 0.12 + 0.1 * (1 - (z / 2.2) ** 2) }
})

function Bridge({ open }: { open: boolean }) {
  const { broken, fixed } = useFixedSwap('pond', open)
  return (
    <group position={[BX, 0, BZ]}>
      {/* 개울 (다리 아래만). 다리 옆으로는 못 건너게 막는다 */}
      <mesh rotation-x={-Math.PI / 2} position={[0, INLAND_WATER_Y, 0]} receiveShadow>
        <planeGeometry args={[8, 2.8]} />
        <meshStandardMaterial color="#4db6ac" />
      </mesh>
      {[-1, 1].map((s) => (
        <mesh key={s} rotation-x={-Math.PI / 2} position={[0, INLAND_WATER_Y + 0.005, s * 1.35]}>
          <planeGeometry args={[8, 0.18]} />
          <meshStandardMaterial color="#8d6e63" />
        </mesh>
      ))}
      <RigidBody type="fixed" colliders={false}>
        {[-1, 1].map((s) => (
          <CuboidCollider key={s} args={[1.2, BARRIER_COLLIDER_HEIGHT.gate / 2, 1.4]} position={[s * 2.8, BARRIER_COLLIDER_HEIGHT.gate / 2, 0]} />
        ))}
      </RigidBody>

      <group ref={fixed} visible={open}>
        {PLANKS.map(({ z, y }) => (
          <mesh key={z} position={[0, y, z]} castShadow receiveShadow>
            <boxGeometry args={[3, 0.1, 0.46]} />
            <meshStandardMaterial color={WOOD} />
          </mesh>
        ))}
        {[-1.45, 1.45].map((x) => (
          <group key={x}>
            {[-2, 0, 2].map((z) => (
              <mesh key={z} position={[x, 0.55, z]} castShadow>
                <boxGeometry args={[0.14, 1.1, 0.14]} />
                <meshStandardMaterial color={WOOD_DARK} />
              </mesh>
            ))}
            <mesh position={[x, 1.02, 0]} castShadow>
              <boxGeometry args={[0.1, 0.1, 4.2]} />
              <meshStandardMaterial color={WOOD_DARK} />
            </mesh>
          </group>
        ))}
      </group>

      <group ref={broken} visible={!open}>
        {/* 가운데 판자가 빠지고 몇 개는 물에 빠져 기울었다 */}
        {PLANKS.map(({ z, y }, i) =>
          i >= 3 && i <= 5 ? null : (
            <mesh key={z} position={[0, y - (i === 2 || i === 6 ? 0.05 : 0), z]} rotation-z={i === 2 ? 0.12 : i === 6 ? -0.18 : 0} castShadow>
              <boxGeometry args={[i === 2 ? 2.1 : 3, 0.1, 0.46]} />
              <meshStandardMaterial color={OLD_WOOD} />
            </mesh>
          ),
        )}
        <mesh position={[0.6, 0.02, 0.1]} rotation={[0.3, 0.6, 0.15]}>
          <boxGeometry args={[2.4, 0.08, 0.42]} />
          <meshStandardMaterial color={OLD_WOOD} />
        </mesh>
        <mesh position={[-0.9, 0, -0.4]} rotation={[-0.2, -0.4, -0.1]}>
          <boxGeometry args={[1.6, 0.08, 0.4]} />
          <meshStandardMaterial color={OLD_WOOD} />
        </mesh>
        {[-1.45, 1.45].map((x) => (
          <group key={x}>
            {[-2, 2].map((z) => (
              <mesh key={z} position={[x, 0.55, z]} castShadow>
                <boxGeometry args={[0.14, 1.1, 0.14]} />
                <meshStandardMaterial color={OLD_WOOD} />
              </mesh>
            ))}
            {/* 부러져 늘어진 난간 */}
            <mesh position={[x, 0.75, 1.2]} rotation-x={x < 0 ? 0.5 : -0.35} castShadow>
              <boxGeometry args={[0.1, 0.1, 1.8]} />
              <meshStandardMaterial color={OLD_WOOD} />
            </mesh>
          </group>
        ))}
        <WarningSign position={[1.9, 0, 2.3]} text="다리 수리 필요" />
      </group>
      <Puff at={[0, 0, 0.6]} size={1.4} zoneId="pond" />
    </group>
  )
}

// ---------------------------------------------------------------- 암초: 해변에 올려 둔 보트

const [OX, OZ] = REPAIR_PLANS.reef.site

/** 위에서 본 배 모양(뱃머리가 +x). 판으로 밀어 올려 배 몸통을 만든다 */
function HullShape({ color, stripe }: { color: string; stripe: string }) {
  return (
    <group>
      {/* 몸통: 아래가 좁은 사다리꼴 단면을 길게 */}
      <mesh position={[0, 0.35, 0]} castShadow receiveShadow>
        <boxGeometry args={[3, 0.5, 1.3]} />
        <meshStandardMaterial color={color} />
      </mesh>
      <mesh position={[0, 0.12, 0]} castShadow>
        <boxGeometry args={[2.6, 0.24, 0.8]} />
        <meshStandardMaterial color={color} />
      </mesh>
      {/* 뱃머리 */}
      <mesh position={[1.75, 0.38, 0]} rotation-y={Math.PI / 4} castShadow>
        <boxGeometry args={[0.92, 0.56, 0.92]} />
        <meshStandardMaterial color={color} />
      </mesh>
      {/* 띠 */}
      <mesh position={[0.1, 0.56, 0]}>
        <boxGeometry args={[3.1, 0.1, 1.34]} />
        <meshStandardMaterial color={stripe} />
      </mesh>
      {/* 안쪽 바닥 */}
      <mesh position={[0, 0.61, 0]}>
        <boxGeometry args={[2.7, 0.02, 1.08]} />
        <meshStandardMaterial color="#5d4037" />
      </mesh>
    </group>
  )
}

function Boat({ open }: { open: boolean }) {
  const { broken, fixed } = useFixedSwap('reef', open)
  const { xFrom, xTo } = ZONES.find((z) => z.id === 'reef')!.gate!
  return (
    <>
      <group position={[OX, 0, OZ]} rotation-y={0.25}>
        <RigidBody type="fixed" colliders={false}>
          <CuboidCollider args={[1.9, 0.4, 0.75]} position={[0.1, 0.4, 0]} />
        </RigidBody>
        <group ref={fixed} visible={open}>
          <HullShape color="#fafafa" stripe="#e53935" />
          {[-0.6, 0.6].map((x) => (
            <mesh key={x} position={[x, 0.66, 0]} castShadow>
              <boxGeometry args={[0.3, 0.08, 1.2]} />
              <meshStandardMaterial color={WOOD} />
            </mesh>
          ))}
          {/* 노 두 개 */}
          {[-1, 1].map((s) => (
            <mesh key={s} position={[0, 0.72, s * 0.75]} rotation={[0, s * 0.35, Math.PI / 2 - 0.15]} castShadow>
              <cylinderGeometry args={[0.03, 0.03, 2.2, 6]} />
              <meshStandardMaterial color={WOOD_DARK} />
            </mesh>
          ))}
          <mesh position={[-1.3, 1.25, 0]} castShadow>
            <cylinderGeometry args={[0.025, 0.025, 1.2, 6]} />
            <meshStandardMaterial color="#5d4037" />
          </mesh>
          <mesh position={[-1.08, 1.6, 0]}>
            <boxGeometry args={[0.42, 0.28, 0.02]} />
            <meshStandardMaterial color="#29b6f6" />
          </mesh>
        </group>
        <group ref={broken} visible={!open}>
          {/* 한쪽으로 기울고 옆구리에 구멍이 났다 */}
          <group rotation-x={0.28} position={[0, -0.08, 0]}>
            <HullShape color="#9e958a" stripe="#7b5e57" />
            <mesh position={[0.3, 0.32, 0.66]}>
              <circleGeometry args={[0.22, 10]} />
              <meshStandardMaterial color="#2b1d16" />
            </mesh>
            <mesh position={[-0.7, 0.3, 0.66]} rotation-z={0.6}>
              <planeGeometry args={[0.5, 0.18]} />
              <meshStandardMaterial color="#2b1d16" />
            </mesh>
          </group>
          {[
            [0.6, 1.3, 0.4],
            [-0.9, 1.25, -0.9],
            [1.6, 1.1, 1.2],
          ].map(([x, z, r]) => (
            <mesh key={x} position={[x, 0.04, z]} rotation-y={r}>
              <boxGeometry args={[0.9, 0.06, 0.2]} />
              <meshStandardMaterial color={OLD_WOOD} />
            </mesh>
          ))}
        </group>
        <Puff at={[0, 0, 0]} size={1.5} zoneId="reef" />
      </group>
      {/* 잠겨 있는 동안 문 앞을 밧줄로 막아 둔다 */}
      {!open && (
        <group position={[(xFrom + xTo) / 2, 0, FENCE_Z + 0.2]}>
          {[-3.7, 0, 3.7].map((x) => (
            <mesh key={x} position={[x, 0.55, 0]} castShadow>
              <cylinderGeometry args={[0.08, 0.1, 1.1, 8]} />
              <meshStandardMaterial color={WOOD_DARK} />
            </mesh>
          ))}
          {[-1.85, 1.85].map((x) => (
            <mesh key={x} position={[x, 0.9, 0]} rotation-z={Math.PI / 2}>
              <cylinderGeometry args={[0.025, 0.025, 3.7, 6]} />
              <meshStandardMaterial color="#e0c080" />
            </mesh>
          ))}
          <WarningSign position={[0, 0, 0.1]} text="보트 수리 필요" low />
        </group>
      )}
    </>
  )
}

// ---------------------------------------------------------------- 동굴: 입구를 막은 바위

const [RX, RZ] = REPAIR_PLANS.cave.site

function CaveRock({ open }: { open: boolean }) {
  const rock = useRef<Group>(null)
  const to = REPAIR_PLANS.cave.rockTo!
  useCutsceneFrame('cave', (frame) => {
    const g = rock.current
    if (!g) return
    if (frame) {
      g.position.set(frame.rock.x, CAVE_ROCK.radius * 0.8, frame.rock.z)
      // 굴러가는 방향에 수직인 축으로 돈다
      g.rotation.set(0, Math.atan2(to[0] - RX, to[1] - RZ), 0)
      g.rotateX(frame.rock.roll)
    } else {
      const [x, z] = open ? to : [RX, RZ]
      g.position.set(x, CAVE_ROCK.radius * 0.8, z)
      g.rotation.set(0, Math.atan2(to[0] - RX, to[1] - RZ), 0)
      if (open) g.rotateX(Math.hypot(to[0] - RX, to[1] - RZ) / CAVE_ROCK.radius)
    }
  })
  const [px, pz] = open ? to : [RX, RZ]
  return (
    <>
      <group ref={rock} position={[px, CAVE_ROCK.radius * 0.8, pz]}>
        <mesh castShadow receiveShadow>
          <dodecahedronGeometry args={[CAVE_ROCK.radius, 1]} />
          <meshStandardMaterial color="#8d8478" flatShading />
        </mesh>
        <mesh position={[0.6, 0.9, 0.9]} castShadow>
          <dodecahedronGeometry args={[0.55, 0]} />
          <meshStandardMaterial color="#7a7166" flatShading />
        </mesh>
        <mesh position={[-0.9, -0.2, 1.3]}>
          <dodecahedronGeometry args={[0.4, 0]} />
          <meshStandardMaterial color="#6d655b" flatShading />
        </mesh>
      </group>
      {/* 바위는 어디 있든 부딪힌다 (치운 뒤엔 치운 자리에서) */}
      <RigidBody key={open ? 'moved' : 'blocking'} type="fixed" colliders={false} position={[px, CAVE_ROCK.radius * 0.8, pz]}>
        <BallCollider args={[CAVE_ROCK.radius * 0.95]} />
      </RigidBody>
      {/* 입구 양옆의 작은 바위들 (울타리 안쪽, 기사님 오가는 길을 막지 않게) */}
      {[-3.4, 3.4].map((x) => (
        <mesh key={x} position={[x, 0.5, FENCE_Z - 0.7]} castShadow>
          <dodecahedronGeometry args={[0.9, 0]} />
          <meshStandardMaterial color="#7a7166" flatShading />
        </mesh>
      ))}
    </>
  )
}

/** "수리 필요" 같은 노란 경고 팻말 */
function WarningSign({ position, text, low = false }: { position: [number, number, number]; text: string; low?: boolean }) {
  const h = low ? 0.55 : 1.1
  const label = useSignTexture(text)
  return (
    <group position={position}>
      {!low && (
        <mesh position={[0, 0.55, 0]} castShadow>
          <boxGeometry args={[0.08, 1.1, 0.08]} />
          <meshStandardMaterial color={WOOD_DARK} />
        </mesh>
      )}
      <mesh position={[0, h + 0.2, 0.05]} castShadow>
        <boxGeometry args={[1.25, 0.42, 0.05]} />
        <meshStandardMaterial color="#fbc02d" />
      </mesh>
      {/* 글씨는 캔버스 텍스처로 그린다 (Html 은 부모를 숨겨도 남아 있어서) */}
      <mesh position={[0, h + 0.2, 0.08]}>
        <planeGeometry args={[1.2, 0.38]} />
        <meshStandardMaterial map={label} transparent />
      </mesh>
    </group>
  )
}

/** 노란 팻말 글씨 텍스처 */
function useSignTexture(text: string): CanvasTexture {
  const texture = useMemo(() => {
    const canvas = document.createElement('canvas')
    canvas.width = 320
    canvas.height = 100
    const ctx = canvas.getContext('2d')
    if (ctx) {
      ctx.fillStyle = '#3e2723'
      ctx.font = '900 46px sans-serif'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(text, 160, 54, 300)
    }
    const t = new CanvasTexture(canvas)
    t.colorSpace = SRGBColorSpace
    return t
  }, [text])
  useEffect(() => () => texture.dispose(), [texture])
  return texture
}

const gateLabel = {
  pointerEvents: 'none' as const,
  whiteSpace: 'nowrap' as const,
  background: 'rgba(0,0,0,0.6)',
  color: '#fff',
  padding: '4px 8px',
  borderRadius: 6,
  fontSize: 13,
}
