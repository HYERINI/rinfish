import { Environment, Lightformer, OrbitControls } from '@react-three/drei'
import { Canvas, useFrame } from '@react-three/fiber'
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { CanvasTexture, Object3D, SRGBColorSpace } from 'three'
import type { InstancedMesh } from 'three'
import { getTankType } from '../data/aquarium'
import { RARITY_COLOR, RARITY_LABEL, findSpecies } from '../data/fish'
import { fishLookFor } from '../data/fishLooks'
import type { TankTypeId } from '../data/types'
import { isHungry, slotCount, viewFishList } from '../logic/aquarium'
import { swimSeed, tankFloorY } from '../logic/aquariumSwim'
import { AquariumFish } from '../scene/facilities/AquariumFish'
import { TankBody } from '../scene/facilities/Aquarium'
import { FISH_LENGTH } from '../scene/fishing/fishAppearance'
import { useProgressStore } from '../stores/progressStore'
import { useMediaQuery, useTouchUi } from '../input/touchDevice'
import { useSessionStore } from '../stores/sessionStore'
import { AquariumSpectators } from './AquariumSpectators'
import { FishImage } from './FishImage'
import { button, disabledButton, safeLeft, safeRight, safeTop } from './styles'

/** 크게 보기 수조 크기 */
const VIEW_TANK: [number, number, number] = [8, 4, 4]
/** 헤엄 경로 범위 (수조 안쪽 절반보다 작게, 큰 물고기가 유리를 뚫지 않게) */
const VIEW_HALF: [number, number, number] = [3.6, 1.7, 1.6]
/** 크게 보기 물고기 크기 (몸길이 1.2 × 어종 배율에 곱한다) */
const VIEW_FISH_SCALE = 0.9
/** 크게 보기 물고기 몸길이 상한 (XXL 처럼 아주 큰 어종도 수조 안에 들어가게) */
const VIEW_MAX_LENGTH = 2.4
/** 물방울 개수 */
const BUBBLES = 36

/** 어항 종류별 배경 (수조 뒤로 보이는 물빛) */
const BACKDROP: Record<TankTypeId, string> = {
  basic: 'linear-gradient(180deg, #2a8fd0 0%, #135c94 55%, #0a3358 100%)',
  sea: 'linear-gradient(180deg, #1f86d6 0%, #0d4f8f 55%, #072a52 100%)',
  fresh: 'linear-gradient(180deg, #2a9a9a 0%, #13606a 55%, #0a3540 100%)',
  cave: 'linear-gradient(180deg, #1c2a6b 0%, #101a45 55%, #070b22 100%)',
}

/** 물고기 한 마리. 얇은 물고기(가오리 등)도 누르기 쉽게 몸보다 큰 투명 상자로 클릭을 받는다 */
function ViewFish({ id, speciesId, hungry, sinceFed, guest, tagScale, onSelect }: {
  id: string
  speciesId: string
  hungry: boolean
  sinceFed: number
  /** 구경용 물고기면 머리 위에 작은 이름표를 단다 */
  guest: boolean
  /** 이름표 크기 배율 (좁은 화면은 카메라가 멀어서 키운다) */
  tagScale: number
  onSelect: (id: string) => void
}) {
  const length = Math.min(FISH_LENGTH * VIEW_FISH_SCALE * fishLookFor(speciesId).size, VIEW_MAX_LENGTH)
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
      <AquariumFish
        speciesId={speciesId}
        half={VIEW_HALF}
        seed={swimSeed(id)}
        hungry={hungry}
        sinceFed={sinceFed}
        floorY={tankFloorY(VIEW_TANK[1])}
        scale={VIEW_FISH_SCALE}
        maxLength={VIEW_MAX_LENGTH}
      >
        {/* 클릭 판정용. 재질만 숨겨서 그리지는 않고 광선 판정은 받는다 */}
        <mesh>
          <boxGeometry args={[length * 0.8, length * 0.55, length * 1.05]} />
          <meshBasicMaterial visible={false} />
        </mesh>
        {guest && (
          // 이름표는 글자를 그린 그림판(sprite)이라 늘 화면을 본다. 다른 물고기·유리에 가리지 않게 맨 위에 그린다
          <sprite position={[0, length * 0.35 + 0.3 * tagScale, 0]} scale={[GUEST_TAG_SIZE[0] * tagScale, GUEST_TAG_SIZE[1] * tagScale, 1]} renderOrder={5}>
            <spriteMaterial map={guestTagTexture()} transparent depthTest={false} depthWrite={false} toneMapped={false} />
          </sprite>
        )}
      </AquariumFish>
    </group>
  )
}

/** 구경용 물고기 이름표 크기 (가로, 세로. 수조 단위) */
const GUEST_TAG_SIZE: [number, number] = [0.96, 0.24]

/** '구경용 물고기' 이름표 그림. 모든 구경용 물고기가 같이 쓰도록 처음 한 번만 그린다 (DOM 이름표는 크게 보기를 닫을 때 정리가 꼬여서 쓰지 않는다) */
let guestTag: CanvasTexture | null = null
function guestTagTexture(): CanvasTexture {
  if (guestTag) return guestTag
  const canvas = document.createElement('canvas')
  canvas.width = 256
  canvas.height = 64
  const ctx = canvas.getContext('2d')
  if (ctx) {
    ctx.fillStyle = 'rgba(255, 255, 255, 0.85)'
    ctx.beginPath()
    ctx.roundRect(4, 8, 248, 48, 24)
    ctx.fill()
    ctx.fillStyle = '#0d3b66'
    ctx.font = 'bold 26px sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText('구경용 물고기', 128, 33)
  }
  guestTag = new CanvasTexture(canvas)
  guestTag.colorSpace = SRGBColorSpace
  return guestTag
}

/** 0~1 사이 고정된 값 (i 마다 다름). 렌더마다 바뀌지 않게 Math.random 대신 쓴다 */
const hash01 = (i: number) => {
  const k = Math.sin(i * 127.1 + 311.7) * 43758.5453
  return k - Math.floor(k)
}

/** 바닥에서 수면으로 천천히 올라가는 물방울. 한 번에 그리는 인스턴스 구 */
function Bubbles() {
  const ref = useRef<InstancedMesh>(null)
  const dummy = useMemo(() => new Object3D(), [])
  const [w, h, d] = VIEW_TANK
  const bubbles = useMemo(
    () =>
      Array.from({ length: BUBBLES }, (_, i) => {
        // 절반은 왼쪽 뒤 공기돌에서 줄지어, 나머지는 여기저기서 올라온다
        const stream = i % 2 === 0
        return {
          x: stream ? -w * 0.36 + (hash01(i) - 0.5) * 0.2 : (hash01(i) - 0.5) * (w - 0.6),
          z: stream ? -d * 0.3 + (hash01(i + 50) - 0.5) * 0.2 : (hash01(i + 50) - 0.5) * (d - 0.6),
          speed: 0.25 + hash01(i + 100) * 0.35,
          offset: hash01(i + 150) * h,
          radius: 0.025 + hash01(i + 200) * 0.05,
          wobble: hash01(i + 250) * Math.PI * 2,
        }
      }),
    [w, h, d],
  )
  useFrame(({ clock }) => {
    const mesh = ref.current
    if (!mesh) return
    const t = clock.elapsedTime
    const bottom = tankFloorY(h)
    const rise = h / 2 - 0.1 - bottom
    bubbles.forEach((b, i) => {
      const y = bottom + ((t * b.speed + b.offset) % rise)
      dummy.position.set(b.x + Math.sin(t * 2 + b.wobble) * 0.05, y, b.z + Math.cos(t * 1.7 + b.wobble) * 0.05)
      dummy.scale.setScalar(b.radius)
      dummy.updateMatrix()
      mesh.setMatrixAt(i, dummy.matrix)
    })
    mesh.instanceMatrix.needsUpdate = true
  })
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, BUBBLES]} renderOrder={3} frustumCulled={false}>
      <sphereGeometry args={[1, 10, 8]} />
      <meshStandardMaterial color="#ffffff" emissive="#bfefff" emissiveIntensity={0.3} transparent opacity={0.45} depthWrite={false} roughness={0.1} />
    </instancedMesh>
  )
}

/** 어항을 화면 가득 크게 본다. 끌어서 돌리고 휠로 확대·축소, 물고기를 누르면 카드가 뜬다 */
export function AquariumView() {
  const aquarium = useProgressStore((s) => s.aquarium)
  const playTime = useProgressStore((s) => s.playTime)
  const feed = useProgressStore((s) => s.feed)
  const inventory = useProgressStore((s) => s.inventory)
  const setMode = useSessionStore((s) => s.setMode)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const touchUi = useTouchUi()
  /** 좁은 화면(휴대폰 세로): 위쪽 막대를 버튼 줄 아래로 내리고, 수조가 가로로 다 보이게 카메라를 뒤로 뺀다 */
  const narrow = useMediaQuery('(max-width: 640px)')
  const hungry = isHungry(aquarium, playTime)
  const sinceFed = playTime - aquarium.lastFedAt
  const type = getTankType(aquarium.activeType)
  // 전시한 물고기가 없으면 구경용 물고기가 대신 헤엄친다 (입장료·먹이와는 상관없다)
  const view = viewFishList(aquarium.displayed)
  const selected = view.fish.find((f) => f.id === selectedId)
  const species = selected ? findSpecies(selected.speciesId) : undefined
  const count = aquarium.displayed.length
  const junk = inventory.find((f) => findSpecies(f.speciesId)?.rarity === 'junk')
  const canFeed = count > 0 && (feed > 0 || !!junk)
  const feedHint = count === 0 ? '전시한 물고기가 없어요' : feed > 0 ? `사료 ${feed}개` : junk ? '사료가 없어 잡어를 줘요' : '사료·잡어가 없어요 (사료는 장비 상점)'

  // 카드가 열려 있으면 ESC 는 카드만 닫는다. 게임 키 처리(useInteractionKeys)보다 먼저 받도록 capture 로 듣는다
  const cardOpen = selected !== undefined
  useEffect(() => {
    if (!cardOpen) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code !== 'Escape') return
      e.stopImmediatePropagation()
      setSelectedId(null)
    }
    window.addEventListener('keydown', onKeyDown, true)
    return () => window.removeEventListener('keydown', onKeyDown, true)
  }, [cardOpen])

  // 물고기 위에서 손가락 모양이 된 채로 닫혀도 커서를 되돌린다
  useLayoutEffect(
    () => () => {
      document.body.style.cursor = ''
    },
    [],
  )

  const feedFish = () => {
    const s = useProgressStore.getState()
    if (s.feed > 0) s.feedWithPellet()
    else if (junk) s.feedWithJunk(junk.id)
  }

  return (
    <div style={{ position: 'absolute', inset: 0, zIndex: 1000, background: BACKDROP[aquarium.activeType], color: '#fff', pointerEvents: 'auto' }}>
      <Canvas dpr={[1, 1.5]} camera={{ position: [0, 0.8, narrow ? 24 : 10], fov: 40 }} onPointerMissed={() => setSelectedId(null)}>
        <ambientLight intensity={0.35} color="#d8f1ff" />
        <hemisphereLight args={['#c8ecff', '#2c5a78', 0.7]} />
        {/* 장식(Kenney) 재질이 금속(metallic 1)이라 주변광만으로는 옆면이 까맣다. 물빛 환경맵을 만들어 비춘다 (내려받기 없음) */}
        <Environment resolution={64}>
          <Lightformer form="rect" intensity={1.4} color="#e8f8ff" position={[0, 5, 0]} rotation-x={Math.PI / 2} scale={[10, 10, 1]} />
          <Lightformer form="rect" intensity={0.7} color="#4fb3ea" position={[0, 0, -5]} scale={[10, 5, 1]} />
          <Lightformer form="rect" intensity={0.7} color="#4fb3ea" position={[0, 0, 5]} rotation-y={Math.PI} scale={[10, 5, 1]} />
          <Lightformer form="rect" intensity={0.5} color="#2a7fb8" position={[-5, 0, 0]} rotation-y={Math.PI / 2} scale={[10, 5, 1]} />
          <Lightformer form="rect" intensity={0.5} color="#2a7fb8" position={[5, 0, 0]} rotation-y={-Math.PI / 2} scale={[10, 5, 1]} />
        </Environment>
        {/* 수면 위에서 내리쬐는 부드러운 빛 */}
        <directionalLight position={[1, 10, 3]} intensity={1.5} color="#f0fbff" />
        <pointLight position={[0, VIEW_TANK[1] / 2 + 0.5, 0]} intensity={4} distance={10} color="#9fe3ff" />
        <TankBody type={aquarium.activeType} size={VIEW_TANK} big />
        <Bubbles />
        {view.fish.map((fish) => (
          <ViewFish
            key={fish.id}
            id={fish.id}
            speciesId={fish.speciesId}
            hungry={view.guest ? false : hungry}
            sinceFed={view.guest ? Infinity : sinceFed}
            guest={view.guest}
            tagScale={narrow ? 1.8 : 1}
            onSelect={setSelectedId}
          />
        ))}
        <OrbitControls enablePan={false} minDistance={4} maxDistance={narrow ? 28 : 14} target={[0, 0, 0]} />
      </Canvas>

      <AquariumSpectators narrow={narrow} />

      <div style={{ position: 'absolute', top: safeTop(16), left: safeLeft(16), right: narrow ? safeRight(96) : undefined, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <button
          style={canFeed ? button : disabledButton}
          disabled={!canFeed}
          title={feedHint}
          onClick={(e) => {
            e.currentTarget.blur()
            feedFish()
          }}
        >
          먹이 주기
        </button>
        <span style={{ fontSize: 13, opacity: 0.85, background: 'rgba(0,0,0,0.45)', padding: '4px 8px', borderRadius: 6 }}>{feedHint}</span>
      </div>
      <div style={{ ...topBar, left: '50%', transform: 'translateX(-50%)', ...(narrow ? { top: safeTop(108), whiteSpace: 'normal', width: 'max-content', maxWidth: '92vw', textAlign: 'center', fontSize: 14 } : null) }}>
        🐠 어항 Lv{aquarium.level + 1} · {type.name} · 전시 {count}/{slotCount(aquarium)}
        {count > 0 && (hungry ? <b style={{ color: '#ef5350' }}> · 배고파요!</b> : ' · 배불러요')}
      </div>
      <button style={{ ...button, position: 'absolute', top: safeTop(16), right: safeRight(16) }} onClick={() => setMode('aquarium')}>
        {touchUi ? '닫기' : '닫기 (ESC)'}
      </button>

      {view.guest && (
        <div style={{ ...emptyNote, ...(narrow ? { top: safeTop(162), fontSize: 14, width: 'max-content', maxWidth: '92vw' } : { top: safeTop(70) }) }}>
          아직 내 물고기가 없어요{narrow ? <br /> : ' · '}지금은 구경용 물고기가 헤엄쳐요. 낚시해서 전시해 보세요
        </div>
      )}

      {selected && (
        <div style={card}>
          <FishImage speciesId={selected.speciesId} width={narrow ? 104 : 160} style={{ borderRadius: 8, background: '#1b2a3b', flexShrink: 0 }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 18, fontWeight: 700, color: species ? RARITY_COLOR[species.rarity] : undefined }}>
              {species?.name ?? '???'}
              {species && <span style={{ fontSize: 12, marginLeft: 8, opacity: 0.9 }}>{RARITY_LABEL[species.rarity]}</span>}
              {view.guest && <span style={guestBadge}>구경용</span>}
            </div>
            <div style={{ fontSize: 14, margin: '2px 0 6px' }}>{view.guest ? `${selected.weight}kg · 내 물고기가 아니에요` : `${selected.weight}kg`}</div>
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
  left: '50%',
  transform: 'translateX(-50%)',
  background: 'rgba(0,0,0,0.55)',
  padding: '10px 18px',
  borderRadius: 8,
  fontSize: 16,
  pointerEvents: 'none',
  textAlign: 'center',
  maxWidth: '85vw',
} as const

/** 카드 이름 옆 '구경용' 표시 */
const guestBadge = {
  fontSize: 11,
  marginLeft: 8,
  padding: '1px 7px',
  borderRadius: 10,
  background: '#4fc3f7',
  color: '#0d3b66',
  verticalAlign: 'middle',
} as const

const card = {
  position: 'absolute',
  bottom: 'calc(24px + env(safe-area-inset-bottom, 0px))',
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
