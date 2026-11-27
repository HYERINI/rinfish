import { useGLTF } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { CuboidCollider, CylinderCollider, RigidBody } from '@react-three/rapier'
import { useMemo, useRef } from 'react'
import { AdditiveBlending, CanvasTexture, Vector3, type Group, type Material, type Mesh, type MeshStandardMaterial, type Texture } from 'three'
import { MINE, MINE_DEEP, MINE_ENTRANCE, MINE_EXIT, MINE_PILLARS, MINE_WALLS, ORES, ORE_NODES, ORE_RADIUS, isUnderground } from '../../data/mine'
import type { Interactable } from '../../logic/interaction'
import { mineRig } from '../../mine/mineRig'
import { useProgressStore } from '../../stores/progressStore'
import { ASSET } from '../assets'
import { InteractionZone } from '../facilities/InteractionZone'
import { restBox } from '../modelBounds'
import { playerRig } from '../Player'
import { Prop } from '../Prop'

const ENTER: Interactable = { kind: 'mineEntrance' }
const EXIT: Interactable = { kind: 'mineExit' }

const W = MINE.x1 - MINE.x0
const D = MINE.z1 - MINE.z0
const CX = (MINE.x0 + MINE.x1) / 2
const CZ = (MINE.z0 + MINE.z1) / 2
const FLOOR = MINE.floorY
const TOP = FLOOR + MINE.height
const WALL = 1

/** 깊은 굴 (금 간 벽 너머): 가운데와 크기 */
const DW = MINE_DEEP.x1 - MINE_DEEP.x0
const DD = MINE_DEEP.z1 - MINE_DEEP.z0
const DCX = (MINE_DEEP.x0 + MINE_DEEP.x1) / 2
const DCZ = (MINE_DEEP.z0 + MINE_DEEP.z1) / 2

/** 동쪽 벽을 금 간 벽(통로) 자리만 비우고 나눈 조각 [가운데 z, 길이]. 통로 자리는 CrackedWall 이 막고 있다가 무너지면 비운다 */
const EAST_WALL: [number, number][] = (() => {
  const out: [number, number][] = []
  let from = MINE.z0 - WALL
  for (const w of [...MINE_WALLS].sort((a, b) => a.z - b.z)) {
    const to = w.z - w.width / 2
    if (to > from) out.push([(from + to) / 2, to - from])
    from = w.z + w.width / 2
  }
  const end = MINE.z1 + WALL
  if (end > from) out.push([(from + end) / 2, end - from])
  return out
})()

/** 빛나는 자리 색 */
const GLOW = '#ffe08a'
/** 등불 색 */
const LAMP = '#ffc66b'

let haloTexture: Texture | null = null
/** 둥글게 번지는 빛 (가운데가 밝고 가장자리로 사라진다). 한 번만 그려서 같이 쓴다 */
function halo(): Texture {
  if (haloTexture) return haloTexture
  const c = document.createElement('canvas')
  c.width = c.height = 64
  const g = c.getContext('2d')
  if (g) {
    const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32)
    grad.addColorStop(0, 'rgba(255,255,255,1)')
    grad.addColorStop(0.35, 'rgba(255,255,255,0.45)')
    grad.addColorStop(1, 'rgba(255,255,255,0)')
    g.fillStyle = grad
    g.fillRect(0, 0, 64, 64)
  }
  haloTexture = new CanvasTexture(c)
  return haloTexture
}

let crackTexture: Texture | null = null
/** 벽에 간 금 (투명 바탕에 가운데서 뻗어 나가는 검은 선). 한 번만 그린다 */
function cracks(): Texture {
  if (crackTexture) return crackTexture
  const c = document.createElement('canvas')
  c.width = c.height = 256
  const g = c.getContext('2d')
  if (g) {
    g.lineCap = 'round'
    g.lineJoin = 'round'
    // 정해진 순서의 수 (볼 때마다 같은 금)
    let seed = 7
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647)
    const branch = (x: number, y: number, angle: number, len: number, width: number) => {
      g.strokeStyle = 'rgba(12,8,6,0.95)'
      g.lineWidth = width
      g.beginPath()
      g.moveTo(x, y)
      let px = x
      let py = y
      const steps = 5
      for (let i = 0; i < steps; i++) {
        const a = angle + (rnd() - 0.5) * 1.1
        px += (Math.cos(a) * len) / steps
        py += (Math.sin(a) * len) / steps
        g.lineTo(px, py)
        if (width > 2.5 && rnd() < 0.45) {
          g.stroke()
          branch(px, py, a + (rnd() < 0.5 ? 0.8 : -0.8), len * 0.45, width * 0.55)
          g.strokeStyle = 'rgba(12,8,6,0.95)'
          g.lineWidth = width
          g.beginPath()
          g.moveTo(px, py)
        }
      }
      g.stroke()
    }
    for (let i = 0; i < 7; i++) branch(128, 150, (i / 7) * Math.PI * 2 + 0.3, 95 + rnd() * 30, 6)
  }
  crackTexture = new CanvasTexture(c)
  return crackTexture
}

/** 재질 이름 → 바꿀 색 (glow: 스스로 빛나는 세기. 밤에도 캄캄하지 않게, shine: 매끈한 결정) */
type Tint = Record<string, { color: string; glow?: number; shine?: boolean }>

/**
 * 광산 안 소품 glb: 높이에 맞춰 키우고, 가운데를 맞춰 바닥에 세운다 (Kenney Space·Nature 모델은 파일 안에서 원점이 비켜 있다).
 * 그림자는 끈다 — 해 그림자 지도에 광산 위 지상의 나무가 찍혀 있어서, 받으면 땅속에 나무 그림자가 진다.
 * tint 를 주면 그 이름의 재질을 복제해 색을 바꾼다 (같은 모델을 광석마다 다른 색으로)
 */
function MineModel({ url, height, position, rotationY = 0, tint }: { url: string; height: number; position: [number, number, number]; rotationY?: number; tint?: Tint }) {
  const { scene } = useGLTF(url)
  const { object, scale, offset } = useMemo(() => {
    const object = scene.clone(true)
    if (tint) {
      object.traverse((o) => {
        const mesh = o as Mesh
        if (!mesh.isMesh) return
        const paint = (m: Material): Material => {
          const t = tint[m.name]
          if (!t) return m
          const c = (m as MeshStandardMaterial).clone()
          c.color.set(t.color)
          c.emissive.set(t.color)
          c.emissiveIntensity = t.glow ?? 0
          // Kenney glTF 재질은 금속성 1 이라 환경 맵 없이는 검게 나온다
          c.metalness = 0
          c.roughness = t.shine ? 0.35 : 1
          return c
        }
        mesh.material = Array.isArray(mesh.material) ? mesh.material.map(paint) : paint(mesh.material)
      })
    }
    const box = restBox(object)
    const size = box.getSize(new Vector3())
    const center = box.getCenter(new Vector3())
    const scale = size.y > 0 ? height / size.y : 1
    return { object, scale, offset: [-center.x * scale, -box.min.y * scale, -center.z * scale] as [number, number, number] }
  }, [scene, height, tint])
  return (
    <group position={position} rotation-y={rotationY}>
      <primitive object={object} scale={scale} position={offset} />
    </group>
  )
}

/** 광산 바위 색 (벽과 어울리는 갈색 도는 회색) */
const ROCK_TINT = { rock: { color: '#6b5d52', glow: 0.25 }, rockTrack: { color: '#5c5047', glow: 0.25 } }
const PILLAR_TINT: Tint = { stone: { color: '#5a4e44', glow: 0.3 }, _defaultMat: { color: '#5a4e44', glow: 0.3 } }
/** 광석마다 결정 색을 바꾼 재질표 (돌은 빛나지 않는 회색 알갱이) */
const ORE_TINT = Object.fromEntries(Object.entries(ORES).map(([id, def]) => [id, { ...ROCK_TINT, crystal: { color: def.color, glow: id === 'stone' ? 0.1 : 0.9, shine: id !== 'stone' } }])) as Record<string, Tint>
/** 광맥 바위 모델 (번호로 돌려 쓴다) */
const ORE_MODELS = [ASSET.oreRockA, ASSET.oreRockB, ASSET.oreRockSmall]
/** 모델마다 키(m): 큰 것은 사람 키만 하게 (폭은 약 2.8m), 납작한 것은 조금 낮게. 작으면 멀리서 광맥인지 알아보기 어렵다 */
const ORE_HEIGHT = [1.9, 1.9, 1.3]

/** E 자리 표시: 바닥의 빛나는 고리와 그 위에 떠서 도는 조각, 번지는 빛. 빛(PointLight)은 쓰지 않는다 (빛 개수를 늘리지 않는다) */
function GlowSpot({ position }: { position: [number, number, number] }) {
  const gem = useRef<Mesh>(null)
  const ring = useRef<Mesh>(null)
  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    if (gem.current) {
      gem.current.position.y = 1.15 + Math.sin(t * 2) * 0.12
      gem.current.rotation.y = t * 1.4
    }
    if (ring.current) ring.current.scale.setScalar(1 + Math.sin(t * 2) * 0.06)
  })
  return (
    <group position={position}>
      <mesh ref={ring} rotation-x={-Math.PI / 2} position-y={0.03}>
        <ringGeometry args={[0.55, 0.75, 32]} />
        <meshBasicMaterial color={GLOW} transparent opacity={0.85} depthWrite={false} />
      </mesh>
      <mesh ref={gem} position-y={1.15}>
        <octahedronGeometry args={[0.2, 0]} />
        <meshBasicMaterial color={GLOW} />
      </mesh>
      <sprite position-y={1.15} scale={[1.6, 1.6, 1]}>
        <spriteMaterial map={halo()} color={GLOW} transparent opacity={0.7} blending={AdditiveBlending} depthWrite={false} />
      </sprite>
    </group>
  )
}

/** 지상 입구: 바위 더미에 나무 문틀과 어두운 굴, 그 앞에 빛나는 자리 (E "광산 들어가기") */
function Entrance() {
  const [mx, mz] = MINE_ENTRANCE.mound
  const [sx, sz] = MINE_ENTRANCE.spot
  return (
    <>
      <Prop url={ASSET.mineRockC} height={3.6} position={[mx, 0, mz - 0.6]} rotationY={0.4} />
      <Prop url={ASSET.mineRockB} height={2.7} position={[mx - 2.1, 0, mz + 0.5]} rotationY={1.2} />
      <Prop url={ASSET.mineRockB} height={2.7} position={[mx + 2.1, 0, mz + 0.5]} rotationY={-2} />
      <Prop url={ASSET.mineRockA} height={1.3} position={[mx - 2.9, 0, mz + 2.2]} rotationY={0.7} />
      <Prop url={ASSET.mineRockA} height={1.1} position={[mx + 3, 0, mz + 2]} rotationY={2.6} />
      {/* 문틀 (모델 앞면이 +z) 과 그 뒤 어두운 굴 */}
      <Prop url={ASSET.mineDoorway} height={2.5} position={[mx, 0, mz + 2.15]} />
      <mesh position={[mx, 1.15, mz + 1.55]}>
        <boxGeometry args={[2.1, 2.3, 0.6]} />
        <meshBasicMaterial color="#0b0908" />
      </mesh>
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider args={[2.7, 1.7, 1.5]} position={[mx, 1.7, mz + 0.3]} />
      </RigidBody>
      <GlowSpot position={[sx, 0, sz]} />
      <InteractionZone position={[sx, 0.8, sz]} halfSize={[1.3, 1.2, 1.3]} target={ENTER} />
    </>
  )
}

/**
 * 광맥 하나: 결정이 박힌 바위 (Kenney Space Kit rock_crystals, 결정 색만 광석 색으로). 다 캐면 결정 없는 낮은 바위로 바뀐다.
 * 맞으면 잠깐 흔들린다
 */
function OreNode({ index }: { index: number }) {
  const spot = ORE_NODES[index]
  const group = useRef<Group>(null)
  const full = useRef<Group>(null)
  const spent = useRef<Group>(null)
  useFrame(({ clock }) => {
    const state = mineRig.nodes[index]
    const g = group.current
    if (!state || !g) return
    const since = clock.elapsedTime - mineRig.hitAt[index]
    // 맞은 적이 없으면 since 가 무한대다: 그대로 sin 에 넣으면 NaN 이 되어 광맥이 사라진다
    const shaking = since >= 0 && since < 0.25
    g.position.x = spot.x + (shaking ? Math.sin(since * 70) * (1 - since / 0.25) * 0.06 : 0)
    if (full.current) full.current.visible = state.left > 0
    if (spent.current) spent.current.visible = state.left <= 0
  })
  return (
    <group ref={group} position={[spot.x, FLOOR, spot.z]}>
      <group ref={full}>
        <MineModel url={ORE_MODELS[index % ORE_MODELS.length]} height={ORE_HEIGHT[index % ORE_MODELS.length]} position={[0, 0, 0]} rotationY={index * 0.9} tint={ORE_TINT[spot.ore]} />
      </group>
      <group ref={spent} visible={false}>
        <MineModel url={ASSET.oreSpent} height={0.8} position={[0, 0, 0]} rotationY={index * 0.9} tint={ROCK_TINT} />
      </group>
    </group>
  )
}

/** 벽 재질 값 (첫 방 · 깊은 굴: 깊은 쪽이 더 어둡고 푸르다) */
const WALL_LOOK = { color: '#4b3f36', emissive: '#2e251f' }
const DEEP_LOOK = { color: '#3d3a46', emissive: '#252330' }

/**
 * 금 간 벽 (통로 자리를 막은 벽 조각). 광맥을 need 번 캐면 금이 가고 틈으로 빛이 샌다. 곡괭이로 hits 번 치면 무너져 사라지고 돌무더기만 남는다.
 * 맞으면 잠깐 흔들린다. 무너지면 충돌체도 없앤다 (지나갈 수 있다)
 */
function CrackedWall({ index }: { index: number }) {
  const w = MINE_WALLS[index]
  const opened = useProgressStore((s) => s.mineWalls[index] === true)
  const cracked = useProgressStore((s) => s.oreMined >= w.need)
  const plug = useRef<Group>(null)
  useFrame(({ clock }) => {
    const g = plug.current
    if (!g) return
    const since = clock.elapsedTime - mineRig.wallHitAt[index]
    const shaking = since >= 0 && since < 0.25
    g.position.z = w.z + (shaking ? Math.sin(since * 70) * (1 - since / 0.25) * 0.05 : 0)
  })
  if (opened) {
    return (
      <>
        <MineModel url={ASSET.stonePile} height={0.7} position={[w.x - 0.9, FLOOR, w.z - w.width / 2 + 0.5]} rotationY={0.6} />
        <MineModel url={ASSET.stonePile} height={0.55} position={[w.x + 0.8, FLOOR, w.z + w.width / 2 - 0.5]} rotationY={2.4} />
        <MineModel url={ASSET.mineRockA} height={0.6} position={[w.x - 1.1, FLOOR, w.z + w.width / 2 - 0.3]} rotationY={1.1} />
      </>
    )
  }
  return (
    <>
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider args={[WALL / 2, MINE.height / 2, w.width / 2]} position={[w.x, FLOOR + MINE.height / 2, w.z]} />
      </RigidBody>
      <group ref={plug} position={[w.x, FLOOR, w.z]}>
        <mesh position-y={MINE.height / 2}>
          <boxGeometry args={[WALL, MINE.height, w.width]} />
          <meshStandardMaterial color={WALL_LOOK.color} roughness={1} emissive={WALL_LOOK.emissive} emissiveIntensity={0.6} />
        </mesh>
        {cracked && (
          <>
            {/* 첫 방 쪽(-x) 벽면에 금을 붙이고, 틈으로 새는 빛 */}
            <mesh position={[-WALL / 2 - 0.02, MINE.height / 2, 0]} rotation-y={-Math.PI / 2}>
              <planeGeometry args={[w.width, MINE.height]} />
              <meshBasicMaterial map={cracks()} transparent depthWrite={false} />
            </mesh>
            <sprite position={[-WALL / 2 - 0.15, 1.9, 0]} scale={[3.4, 3.4, 1]}>
              <spriteMaterial map={halo()} color="#ffb066" transparent opacity={0.4} blending={AdditiveBlending} depthWrite={false} />
            </sprite>
            <MineModel url={ASSET.mineRockA} height={0.45} position={[-WALL / 2 - 0.5, 0, -0.9]} rotationY={0.5} />
            <MineModel url={ASSET.mineRockA} height={0.35} position={[-WALL / 2 - 0.4, 0, 0.8]} rotationY={2} />
          </>
        )}
      </group>
    </>
  )
}

/** 깊은 굴의 등불 [x, z] */
const DEEP_LAMPS: [number, number][] = [
  [128, -27],
  [134, -22],
  [134, -32],
  [140, -27],
]

/** 깊은 굴 (금 간 벽을 무너뜨려야 그린다): 바닥·천장·벽, 등불, 소품, 광맥. 충돌체는 Interior 가 늘 둔다 */
function DeepRoom() {
  return (
    <>
      <mesh position={[DCX + WALL / 2, FLOOR - 0.25, DCZ]}>
        <boxGeometry args={[DW + WALL, 0.5, DD + WALL * 2]} />
        <meshStandardMaterial color="#4a4350" roughness={1} emissive="#2c2833" emissiveIntensity={0.55} />
      </mesh>
      <mesh position={[DCX + WALL / 2, TOP + 0.25, DCZ]}>
        <boxGeometry args={[DW + WALL, 0.5, DD + WALL * 2]} />
        <meshStandardMaterial color="#2f2c36" roughness={1} emissive="#1d1b24" emissiveIntensity={0.6} />
      </mesh>
      {(
        [
          [MINE_DEEP.x1 + WALL / 2, DCZ, WALL, DD + WALL * 2],
          [DCX, MINE_DEEP.z0 - WALL / 2, DW, WALL],
          [DCX, MINE_DEEP.z1 + WALL / 2, DW, WALL],
        ] as [number, number, number, number][]
      ).map(([x, z, w, d]) => (
        <mesh key={`${x},${z}`} position={[x, FLOOR + MINE.height / 2, z]}>
          <boxGeometry args={[w, MINE.height, d]} />
          <meshStandardMaterial color={DEEP_LOOK.color} roughness={1} emissive={DEEP_LOOK.emissive} emissiveIntensity={0.6} />
        </mesh>
      ))}
      {DEEP_LAMPS.map(([x, z]) => (
        <group key={`${x},${z}`} position={[x, TOP - 0.75, z]}>
          <mesh>
            <sphereGeometry args={[0.13, 10, 8]} />
            <meshBasicMaterial color={LAMP} />
          </mesh>
          <sprite scale={[2.6, 2.6, 1]}>
            <spriteMaterial map={halo()} color={LAMP} transparent opacity={0.55} blending={AdditiveBlending} depthWrite={false} />
          </sprite>
        </group>
      ))}
      <MineModel url={ASSET.mineFrame} height={MINE.height - 0.1} position={[131, FLOOR, -27]} />
      <MineModel url={ASSET.mineFrame} height={MINE.height - 0.1} position={[138, FLOOR, -27]} />
      <MineModel url={ASSET.stonePile} height={0.5} position={[132, FLOOR, -24]} rotationY={0.8} />
      <MineModel url={ASSET.stonePile} height={0.45} position={[139, FLOOR, -34]} rotationY={2} />
      <MineModel url={ASSET.crateLong} height={0.8} position={[126.4, FLOOR, -21]} rotationY={1.5} />
      <MineModel url={ASSET.barrel} height={1} position={[141.8, FLOOR, -19.2]} />
      {ORE_NODES.map((n, i) => (n.deep ? <OreNode key={i} index={i} /> : null))}
    </>
  )
}

/** 버팀목 줄 (x 자리). 가운데 통로를 따라 세운다 */
const FRAMES: [number, number][] = [
  [102, -24],
  [102, -32],
  [112, -22],
  [113, -34],
  [120, -27],
]
/** 등불 [x, z] (버팀목과 벽에). 스스로 빛나는 구슬과 번지는 빛뿐이다 */
const LAMPS: [number, number][] = [
  [102, -24],
  [102, -32],
  [112, -22],
  [113, -34],
  [120, -27],
  [98.5, -18.5],
  [121, -38],
]

/** 광산 안: 흙바닥·바위벽·천장(충돌 포함), 버팀목, 등불, 소품, 광맥, 나가는 자리 */
function Interior() {
  const [ex, ez] = MINE_EXIT.spot
  const deepOpen = useProgressStore((s) => s.mineWalls[0] === true)
  return (
    <>
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider args={[W / 2 + WALL, 0.5, D / 2 + WALL]} position={[CX, FLOOR - 0.5, CZ]} />
        <CuboidCollider args={[W / 2 + WALL, 0.5, D / 2 + WALL]} position={[CX, TOP + 0.5, CZ]} />
        <CuboidCollider args={[WALL / 2, MINE.height / 2, D / 2 + WALL]} position={[MINE.x0 - WALL / 2, FLOOR + MINE.height / 2, CZ]} />
        {EAST_WALL.map(([z, len]) => (
          <CuboidCollider key={z} args={[WALL / 2, MINE.height / 2, len / 2]} position={[MINE.x1 + WALL / 2, FLOOR + MINE.height / 2, z]} />
        ))}
        {/* 깊은 굴: 바닥·천장·세 벽 (첫 방 쪽은 동쪽 벽을 같이 쓴다) */}
        <CuboidCollider args={[(DW + WALL) / 2, 0.5, DD / 2 + WALL]} position={[DCX + WALL / 2, FLOOR - 0.5, DCZ]} />
        <CuboidCollider args={[(DW + WALL) / 2, 0.5, DD / 2 + WALL]} position={[DCX + WALL / 2, TOP + 0.5, DCZ]} />
        <CuboidCollider args={[WALL / 2, MINE.height / 2, DD / 2 + WALL]} position={[MINE_DEEP.x1 + WALL / 2, FLOOR + MINE.height / 2, DCZ]} />
        <CuboidCollider args={[DW / 2, MINE.height / 2, WALL / 2]} position={[DCX, FLOOR + MINE.height / 2, MINE_DEEP.z0 - WALL / 2]} />
        <CuboidCollider args={[DW / 2, MINE.height / 2, WALL / 2]} position={[DCX, FLOOR + MINE.height / 2, MINE_DEEP.z1 + WALL / 2]} />
        <CuboidCollider args={[W / 2, MINE.height / 2, WALL / 2]} position={[CX, FLOOR + MINE.height / 2, MINE.z0 - WALL / 2]} />
        <CuboidCollider args={[W / 2, MINE.height / 2, WALL / 2]} position={[CX, FLOOR + MINE.height / 2, MINE.z1 + WALL / 2]} />
        {MINE_PILLARS.map(([x, z, r]) => (
          <CylinderCollider key={`${x},${z}`} args={[MINE.height / 2, r]} position={[x, FLOOR + MINE.height / 2, z]} />
        ))}
        {ORE_NODES.map((n, i) => (
          <CylinderCollider key={i} args={[0.8, ORE_RADIUS]} position={[n.x, FLOOR + 0.8, n.z]} />
        ))}
      </RigidBody>
      {/* 바닥·천장·벽. 밤에도 캄캄하지 않게 스스로 조금 빛난다 (빛을 더하지 않는다) */}
      <mesh position={[CX, FLOOR - 0.25, CZ]}>
        <boxGeometry args={[W + WALL * 2, 0.5, D + WALL * 2]} />
        <meshStandardMaterial color="#5a4a3c" roughness={1} emissive="#3a2e24" emissiveIntensity={0.55} />
      </mesh>
      <mesh position={[CX, TOP + 0.25, CZ]}>
        <boxGeometry args={[W + WALL * 2, 0.5, D + WALL * 2]} />
        <meshStandardMaterial color="#3a3029" roughness={1} emissive="#241d18" emissiveIntensity={0.6} />
      </mesh>
      {(
        [
          [MINE.x0 - WALL / 2, CZ, WALL, D + WALL * 2],
          ...EAST_WALL.map(([z, len]): [number, number, number, number] => [MINE.x1 + WALL / 2, z, WALL, len]),
          [CX, MINE.z0 - WALL / 2, W, WALL],
          [CX, MINE.z1 + WALL / 2, W, WALL],
        ] as [number, number, number, number][]
      ).map(([x, z, w, d]) => (
        <mesh key={`${x},${z}`} position={[x, FLOOR + MINE.height / 2, z]}>
          <boxGeometry args={[w, MINE.height, d]} />
          <meshStandardMaterial color={WALL_LOOK.color} roughness={1} emissive={WALL_LOOK.emissive} emissiveIntensity={0.6} />
        </mesh>
      ))}
      {/* 금 간 벽과, 무너뜨렸으면 그 너머 깊은 굴 */}
      {MINE_WALLS.map((_, i) => (
        <CrackedWall key={i} index={i} />
      ))}
      {deepOpen && <DeepRoom />}
      {/* 바위 기둥 (Kenney Nature Kit stone_tallG: 천장 높이로 키우면 반지름이 충돌 원기둥과 비슷하다), 발치에 작은 바위 */}
      {MINE_PILLARS.map(([x, z, r]) => (
        <group key={`${x},${z}`}>
          <MineModel url={ASSET.cavePillar} height={MINE.height + 0.1} position={[x, FLOOR, z]} rotationY={x} tint={PILLAR_TINT} />
          <MineModel url={ASSET.mineRockA} height={0.9} position={[x + r * 0.9, FLOOR, z + r * 0.5]} rotationY={x} />
          <MineModel url={ASSET.mineRockA} height={0.7} position={[x - r * 0.8, FLOOR, z - r * 0.7]} rotationY={z} />
        </group>
      ))}
      {/* 버팀목 */}
      {FRAMES.map(([x, z]) => (
        <MineModel key={`${x},${z}`} url={ASSET.mineFrame} height={MINE.height - 0.1} position={[x, FLOOR, z]} />
      ))}
      {/* 등불: 스스로 빛나는 구슬 + 번지는 빛 */}
      {LAMPS.map(([x, z]) => (
        <group key={`${x},${z}`} position={[x, TOP - 0.75, z]}>
          <mesh>
            <sphereGeometry args={[0.13, 10, 8]} />
            <meshBasicMaterial color={LAMP} />
          </mesh>
          <sprite scale={[2.6, 2.6, 1]}>
            <spriteMaterial map={halo()} color={LAMP} transparent opacity={0.55} blending={AdditiveBlending} depthWrite={false} />
          </sprite>
        </group>
      ))}
      {/* 소품 */}
      <MineModel url={ASSET.barrel} height={1} position={[107.5, FLOOR, -17.1]} />
      <MineModel url={ASSET.crateLong} height={0.8} position={[97.2, FLOOR, -22]} rotationY={0.3} />
      <MineModel url={ASSET.chest} height={0.7} position={[100.3, FLOOR, -17.2]} rotationY={Math.PI} />
      <MineModel url={ASSET.stonePile} height={0.5} position={[106, FLOOR, -33]} rotationY={1} />
      <MineModel url={ASSET.stonePile} height={0.45} position={[119, FLOOR, -19]} rotationY={2.2} />
      <MineModel url={ASSET.bucket} height={0.45} position={[114.2, FLOOR, -17.3]} />
      {ORE_NODES.map((n, i) => (n.deep ? null : <OreNode key={i} index={i} />))}
      {/* 나가는 자리: 벽의 문틀(밖의 빛이 새어 든다)과 빛나는 자리 */}
      <MineModel url={ASSET.mineDoorway} height={2.5} position={[ex, FLOOR, MINE.z1 - 0.02]} rotationY={Math.PI} />
      <mesh position={[ex, FLOOR + 1.15, MINE.z1 - 0.03]}>
        <planeGeometry args={[1.9, 2.25]} />
        <meshBasicMaterial color="#d9ecff" />
      </mesh>
      <GlowSpot position={[ex, FLOOR, ez]} />
    </>
  )
}

/**
 * 광산: 지상 입구(늘 보인다)와 땅속 안쪽. 안쪽은 내가 땅속에 있을 때만 그린다 (지상에선 땅에 가려 안 보이는데 그리기 명령만 든다).
 * 충돌체와 E 감지 상자는 늘 있다
 */
export function Mine() {
  const interior = useRef<Group>(null)
  const [ex, ez] = MINE_EXIT.spot
  useFrame(() => {
    if (interior.current) interior.current.visible = isUnderground(playerRig.position.y)
  })
  return (
    <>
      <Entrance />
      <group ref={interior} visible={false}>
        <Interior />
      </group>
      <InteractionZone position={[ex, FLOOR + 0.8, ez]} halfSize={[1.3, 1.2, 1.3]} target={EXIT} />
    </>
  )
}
