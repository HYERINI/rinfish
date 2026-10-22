import { OrbitControls } from '@react-three/drei'
import { Canvas, useFrame } from '@react-three/fiber'
import { useMemo, useRef, useState } from 'react'
import { Vector3 } from 'three'
import type { Group } from 'three'
import { getTankType } from '../data/aquarium'
import { RARITY_COLOR, RARITY_LABEL, findSpecies } from '../data/fish'
import { isHungry, slotCount } from '../logic/aquarium'
import { swimPose } from '../logic/aquariumSwim'
import { FishModel } from '../scene/fishing/FishModel'
import { TankBody } from '../scene/facilities/Aquarium'
import { useProgressStore } from '../stores/progressStore'
import { useSessionStore } from '../stores/sessionStore'
import { FishImage } from './FishImage'
import { button } from './styles'

/** 크게 보기 수조 크기 */
const VIEW_TANK: [number, number, number] = [8, 4, 4]
/** 헤엄 경로 범위 (수조 안쪽 절반보다 작게, 큰 물고기가 유리를 뚫지 않게) */
const VIEW_HALF: [number, number, number] = [3.6, 1.7, 1.6]
/** 크게 보기 물고기 크기 (몸길이 1.2 × 어종 배율에 곱한다) */
const VIEW_FISH_SCALE = 0.9

function ViewFish({ id, speciesId, seed, hungry, sinceFed, onSelect }: {
  id: string
  speciesId: string
  seed: number
  hungry: boolean
  sinceFed: number
  onSelect: (id: string) => void
}) {
  const ref = useRef<Group>(null)
  const target = useMemo(() => new Vector3(), [])
  useFrame(({ clock }) => {
    const fish = ref.current
    if (!fish) return
    const pose = swimPose(clock.elapsedTime, seed, VIEW_HALF, hungry, sinceFed)
    fish.position.lerp(target.set(pose.x, pose.y, pose.z), 0.08)
    fish.rotation.y = pose.heading
    fish.rotation.z = pose.tilt
  })
  return (
    <group
      onClick={(e) => {
        e.stopPropagation()
        onSelect(id)
      }}
      onPointerOver={(e) => {
        e.stopPropagation()
        document.body.style.cursor = 'pointer'
      }}
      onPointerOut={() => {
        document.body.style.cursor = ''
      }}
    >
      <FishModel ref={ref} speciesId={speciesId} scale={VIEW_FISH_SCALE} />
    </group>
  )
}

/** 어항을 화면 가득 크게 본다. 끌어서 돌리고 휠로 확대·축소, 물고기를 누르면 카드가 뜬다 */
export function AquariumView() {
  const aquarium = useProgressStore((s) => s.aquarium)
  const playTime = useProgressStore((s) => s.playTime)
  const setMode = useSessionStore((s) => s.setMode)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const hungry = isHungry(aquarium, playTime)
  const sinceFed = playTime - aquarium.lastFedAt
  const type = getTankType(aquarium.activeType)
  const selected = aquarium.displayed.find((f) => f.id === selectedId)
  const species = selected ? findSpecies(selected.speciesId) : undefined
  const count = aquarium.displayed.length

  return (
    <div style={{ position: 'absolute', inset: 0, zIndex: 1000, background: '#0b1622', color: '#fff', pointerEvents: 'auto' }}>
      <Canvas camera={{ position: [0, 0.8, 10], fov: 40 }} onPointerMissed={() => setSelectedId(null)}>
        <ambientLight intensity={1.2} />
        <directionalLight position={[4, 8, 6]} intensity={2.2} />
        <TankBody type={aquarium.activeType} size={VIEW_TANK} />
        {aquarium.displayed.map((fish, i) => (
          <ViewFish key={fish.id} id={fish.id} speciesId={fish.speciesId} seed={i} hungry={hungry} sinceFed={sinceFed} onSelect={setSelectedId} />
        ))}
        <OrbitControls enablePan={false} minDistance={4} maxDistance={14} target={[0, 0, 0]} />
      </Canvas>

      <div style={{ ...topBar, left: '50%', transform: 'translateX(-50%)' }}>
        🐠 어항 Lv{aquarium.level + 1} · {type.name} · 전시 {count}/{slotCount(aquarium)}
        {count > 0 && (hungry ? <b style={{ color: '#ef5350' }}> · 배고파요!</b> : ' · 배불러요')}
      </div>
      <button style={{ ...button, position: 'absolute', top: 16, right: 16 }} onClick={() => setMode('aquarium')}>
        닫기 (ESC)
      </button>

      {count === 0 && <div style={emptyNote}>아직 전시한 물고기가 없어요. 낚시해서 전시해 보세요</div>}

      {selected && (
        <div style={card}>
          <FishImage speciesId={selected.speciesId} width={160} style={{ borderRadius: 8, background: '#1b2a3b', flexShrink: 0 }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 18, fontWeight: 700, color: species ? RARITY_COLOR[species.rarity] : undefined }}>
              {species?.name ?? '???'}
              {species && <span style={{ fontSize: 12, marginLeft: 8, opacity: 0.9 }}>{RARITY_LABEL[species.rarity]}</span>}
            </div>
            <div style={{ fontSize: 14, margin: '2px 0 6px' }}>{selected.weight}kg</div>
            <div style={{ fontSize: 13, opacity: 0.85 }}>{species?.description}</div>
          </div>
          <button style={{ ...button, alignSelf: 'flex-start' }} onClick={() => setSelectedId(null)} aria-label="카드 닫기">
            X
          </button>
        </div>
      )}
    </div>
  )
}

const topBar = {
  position: 'absolute',
  top: 16,
  background: 'rgba(0,0,0,0.6)',
  padding: '8px 16px',
  borderRadius: 8,
  fontSize: 15,
  fontWeight: 700,
  whiteSpace: 'nowrap',
  pointerEvents: 'none',
} as const

const emptyNote = {
  position: 'absolute',
  top: '50%',
  left: '50%',
  transform: 'translate(-50%, -50%)',
  background: 'rgba(0,0,0,0.55)',
  padding: '10px 18px',
  borderRadius: 8,
  fontSize: 16,
  pointerEvents: 'none',
  textAlign: 'center',
  maxWidth: '85vw',
} as const

const card = {
  position: 'absolute',
  bottom: 24,
  left: '50%',
  transform: 'translateX(-50%)',
  width: 'min(520px, 92vw)',
  boxSizing: 'border-box',
  display: 'flex',
  gap: 12,
  alignItems: 'center',
  background: 'rgba(20, 30, 45, 0.95)',
  borderRadius: 12,
  padding: 14,
} as const
