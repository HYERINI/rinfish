import { Html } from '@react-three/drei'
import { CuboidCollider, CylinderCollider, RigidBody } from '@react-three/rapier'
import { FENCE_Z, INLAND_WATER_Y, ISLAND_RADIUS, WATER_Y, ZONES, type ZoneDef } from '../data/zones'

export function Island() {
  return (
    <>
      {/* 섬 본체: 윗면이 y=0인 납작한 원기둥. fixed = 움직이지 않는 물리 물체 */}
      <RigidBody type="fixed" colliders={false}>
        <CylinderCollider args={[1, ISLAND_RADIUS]} position={[0, -1, 0]} />
        <mesh position={[0, -1, 0]} receiveShadow>
          <cylinderGeometry args={[ISLAND_RADIUS, ISLAND_RADIUS, 2, 64]} />
          <meshStandardMaterial color="#e9d8a6" />
        </mesh>
      </RigidBody>

      {/* 북쪽 반원은 풀밭 (잠긴 구역들) */}
      <mesh rotation-x={-Math.PI / 2} position={[0, 0.01, 0]} receiveShadow>
        <circleGeometry args={[ISLAND_RADIUS - 0.1, 64, 0, Math.PI]} />
        <meshStandardMaterial color="#9ccc65" />
      </mesh>

      {/* 바다 */}
      <mesh rotation-x={-Math.PI / 2} position={[0, WATER_Y, 0]}>
        <planeGeometry args={[300, 300]} />
        <meshStandardMaterial color="#2a9df4" transparent opacity={0.85} />
      </mesh>

      {/* 선착장 (보기용, 충돌 없음). 섬 가장자리(z=30)에서 끝나서 찌가 떨어지는 바다를 가리지 않는다 */}
      <mesh position={[0, 0.05, 25.5]} castShadow receiveShadow>
        <boxGeometry args={[3, 0.3, 9]} />
        <meshStandardMaterial color="#a1887f" />
      </mesh>

      {/* 숲속 연못 */}
      <mesh rotation-x={-Math.PI / 2} position={[-15, INLAND_WATER_Y - 0.01, -12]}>
        <circleGeometry args={[5, 32]} />
        <meshStandardMaterial color="#4db6ac" />
      </mesh>

      {/* 동굴 지하호수 + 동굴 바위 */}
      <mesh rotation-x={-Math.PI / 2} position={[0, INLAND_WATER_Y - 0.01, -24]}>
        <circleGeometry args={[4, 32]} />
        <meshStandardMaterial color="#1a237e" />
      </mesh>
      <mesh position={[0, 2, -26]} castShadow>
        <boxGeometry args={[12, 4, 4]} />
        <meshStandardMaterial color="#5d4037" />
      </mesh>

      {/* 암초 */}
      {[
        [26, -20],
        [29, -14],
        [24, -25],
      ].map(([x, z]) => (
        <mesh key={`${x},${z}`} position={[x, 0, z]} castShadow>
          <dodecahedronGeometry args={[1.5]} />
          <meshStandardMaterial color="#78909c" />
        </mesh>
      ))}

      {fenceSegments().map(([from, to]) => (
        <FenceWall key={from} from={from} to={to} />
      ))}
      {ZONES.map((zone) => (
        <Gate key={zone.id} zone={zone} />
      ))}
    </>
  )
}

/** 문(gate) 자리를 뺀 나머지 울타리 구간들 */
function fenceSegments(): [number, number][] {
  const gates = ZONES.flatMap((z) => (z.gate ? [z.gate] : [])).sort((a, b) => a.xFrom - b.xFrom)
  const segments: [number, number][] = []
  let x = -ISLAND_RADIUS
  for (const gate of gates) {
    if (gate.xFrom > x) segments.push([x, gate.xFrom])
    x = gate.xTo
  }
  if (x < ISLAND_RADIUS) segments.push([x, ISLAND_RADIUS])
  return segments
}

function FenceWall({ from, to }: { from: number; to: number }) {
  const width = to - from
  return (
    <RigidBody type="fixed" colliders={false} position={[(from + to) / 2, 0.6, FENCE_Z]}>
      <CuboidCollider args={[width / 2, 1.5, 0.2]} />
      <mesh castShadow receiveShadow>
        <boxGeometry args={[width, 1.2, 0.3]} />
        <meshStandardMaterial color="#8d6e63" />
      </mesh>
    </RigidBody>
  )
}

/** 잠긴 구역 입구. 1차-B에서 해금되면 사라지게 만든다 */
function Gate({ zone }: { zone: ZoneDef }) {
  if (!zone.gate) return null
  const { xFrom, xTo } = zone.gate
  const width = xTo - xFrom
  return (
    <RigidBody type="fixed" colliders={false} position={[(xFrom + xTo) / 2, 1, FENCE_Z]}>
      <CuboidCollider args={[width / 2, 1, 0.3]} />
      <mesh castShadow>
        <boxGeometry args={[width, 2, 0.6]} />
        <meshStandardMaterial color={zone.color} transparent opacity={0.7} />
      </mesh>
      {/* Html: 3D 위치에 일반 HTML을 띄운다 (한글 표시용) */}
      <Html center position={[0, 2, 0]} style={gateLabel}>
        잠김 · {zone.name} — {zone.unlockLabel}
      </Html>
    </RigidBody>
  )
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
