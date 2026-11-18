import { CuboidCollider, RigidBody } from '@react-three/rapier'
import { MEADOW_DOCK, MEADOW_DOCK_TOP, MEADOW_RECT, SHORE_SAND } from '../game/data/meadow'

const W = MEADOW_RECT.x1 - MEADOW_RECT.x0
const D = MEADOW_RECT.z1 - MEADOW_RECT.z0
const CX = (MEADOW_RECT.x0 + MEADOW_RECT.x1) / 2
const CZ = (MEADOW_RECT.z0 + MEADOW_RECT.z1) / 2
const SAND = '#e9d8a6'
/** 모래 띠 네 변 [가운데 x, 가운데 z, 가로, 세로] (사각형 안쪽 SHORE_SAND m) */
const STRIPS: [number, number, number, number][] = [
  [MEADOW_RECT.x0 + SHORE_SAND / 2, CZ, SHORE_SAND, D],
  [MEADOW_RECT.x1 - SHORE_SAND / 2, CZ, SHORE_SAND, D],
  [CX, MEADOW_RECT.z0 + SHORE_SAND / 2, W - SHORE_SAND * 2, SHORE_SAND],
  [CX, MEADOW_RECT.z1 - SHORE_SAND / 2, W - SHORE_SAND * 2, SHORE_SAND],
]
const DOCK_W = MEADOW_DOCK.x1 - MEADOW_DOCK.x0
const DOCK_D = MEADOW_DOCK.z1 - MEADOW_DOCK.z0
const DOCK_H = 0.3

/**
 * 초원 바닥 충돌체(윗면 y=0), 가장자리 모래 띠와 물 아래로 내려가는 옆면, 마을 쪽 선착장.
 * 은지 모델보다 먼저 있어야 초원에서 시작해도 떨어지지 않는다
 */
export function MeadowGround() {
  return (
    <>
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider args={[W / 2, 0.5, D / 2]} position={[CX, -0.5, CZ]} />
        <CuboidCollider args={[DOCK_W / 2, DOCK_H / 2, DOCK_D / 2]} position={[(MEADOW_DOCK.x0 + MEADOW_DOCK.x1) / 2, MEADOW_DOCK_TOP - DOCK_H / 2, (MEADOW_DOCK.z0 + MEADOW_DOCK.z1) / 2]} />
      </RigidBody>
      {/* 옆면: 섬처럼 물 아래로 내려가는 2m 두께 상자. 윗면은 은지 풀밭(-0.01) 아래에 숨는다 */}
      <mesh position={[CX, -1.02, CZ]} receiveShadow>
        <boxGeometry args={[W, 2, D]} />
        <meshStandardMaterial color={SAND} />
      </mesh>
      {STRIPS.map(([x, z, w, d]) => (
        <mesh key={`${x},${z}`} rotation-x={-Math.PI / 2} position={[x, -0.005, z]} receiveShadow>
          <planeGeometry args={[w, d]} />
          <meshStandardMaterial color={SAND} />
        </mesh>
      ))}
      <mesh position={[(MEADOW_DOCK.x0 + MEADOW_DOCK.x1) / 2, MEADOW_DOCK_TOP - DOCK_H / 2, (MEADOW_DOCK.z0 + MEADOW_DOCK.z1) / 2]} castShadow receiveShadow>
        <boxGeometry args={[DOCK_W, DOCK_H, DOCK_D]} />
        <meshStandardMaterial color="#a1887f" />
      </mesh>
    </>
  )
}
