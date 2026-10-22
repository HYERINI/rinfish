import { Canvas, useFrame } from '@react-three/fiber'
import { Suspense, useRef, useState, type ReactNode } from 'react'
import { Vector3, type Group } from 'three'
import {
  BODY_PART_LABEL, BODY_PARTS, BODY_RANGES, DEFAULT_BODY, DYE_COLORS, GENDER_LABEL, HAIR_COLORS, HAIRS, HEIGHT_RANGE, LOOK_PRESETS, OUTFITS, SKIN_COLORS,
} from '../data/characterParts'
import type { CharacterLook, Gender, OutfitId } from '../data/types'
import { randomLook, switchGender } from '../logic/characterLook'
import { IDLE_ACTION } from '../logic/playerMotion'
import { PlayerModel, type PlayerModelHandle } from '../scene/PlayerModel'
import { useProgressStore } from '../stores/progressStore'
import { useSessionStore } from '../stores/sessionStore'
import { button, panelBox } from './styles'

/** 자동 회전 속도 (라디안/초) */
const SPIN_SPEED = 0.4
/** 기본 체격(키 1)의 대략적인 키(m). 남 1.81, 여 1.77 */
const BASE_FIGURE_HEIGHT = 1.8
/** 화면 세로에서 캐릭터가 차지하는 비율. 나머지는 머리 위·발 아래 여백 */
const FIGURE_FILL = 0.78
const PREVIEW_FOV = 35

/** 지금 모습의 대략적인 키. 다리는 키의 절반쯤, 머리는 0.25쯤을 차지한다 */
function figureHeight(look: CharacterLook): number {
  const legs = 0.5 * (look.body.legLength - 1)
  const head = 0.13 * (look.body.head - 1)
  return BASE_FIGURE_HEIGHT * look.height * (1 + legs + head)
}

/**
 * 키가 커지면 카메라를 뒤로 빼서 머리 위 여백을 지킨다.
 * 기본 키보다 작을 땐 카메라를 그대로 둬서 작아진 게 그대로 보이게 한다 (발은 늘 같은 자리)
 */
function FramingCamera({ look }: { look: CharacterLook }) {
  const target = useRef(new Vector3())
  const eye = useRef(new Vector3())
  useFrame(({ camera }, delta) => {
    const h = Math.max(figureHeight(look), BASE_FIGURE_HEIGHT)
    const distance = (h / FIGURE_FILL / 2) / Math.tan(((PREVIEW_FOV / 2) * Math.PI) / 180)
    // 가운데보다 살짝 아래를 봐서 발이 아래 버튼에 가리지 않게 한다
    target.current.set(0, h * 0.47, 0)
    // 슬라이더를 움직일 때 툭 끊기지 않게 부드럽게 따라간다
    const k = 1 - Math.exp(-delta * 8)
    camera.position.lerp(eye.current.set(0, h * 0.55, distance), k)
    camera.lookAt(target.current)
  })
  return null
}

/** 미리보기: 천천히 돌고(멈출 수 있음), 드래그로 돌릴 수 있다 */
function Preview({ look, spinning }: { look: CharacterLook; spinning: boolean }) {
  const turn = useRef<Group>(null)
  const model = useRef<PlayerModelHandle>(null)
  const drag = useRef({ active: false, x: 0, extra: 0 })
  /** 자동 회전으로 돈 각도. 멈추면 그 자리에서 선다 */
  const spin = useRef(0)
  useFrame(({ clock }, delta) => {
    if (spinning) spin.current += delta * SPIN_SPEED
    if (turn.current) turn.current.rotation.y = spin.current + drag.current.extra
    model.current?.update(delta, clock.elapsedTime, null, IDLE_ACTION, 0, 0.5, false)
  })
  return (
    <group
      ref={turn}
      onPointerDown={(e) => {
        // 포인터를 붙잡아 두면 모델 밖에서 손을 떼도 pointerup 이 이 그룹으로 온다
        ;(e.target as Element).setPointerCapture(e.pointerId)
        drag.current.active = true
        drag.current.x = e.clientX
      }}
      onPointerUp={() => (drag.current.active = false)}
      onLostPointerCapture={() => (drag.current.active = false)}
      onPointerMove={(e) => {
        if (!drag.current.active) return
        // 그래도 버튼이 이미 떼어져 있으면(캔버스 밖에서 놓은 경우 등) 드래그를 끝낸다. 손을 뗀 채 지나가기만 해도 돌면 안 된다
        if (e.buttons === 0) {
          drag.current.active = false
          return
        }
        drag.current.extra += (e.clientX - drag.current.x) * 0.01
        drag.current.x = e.clientX
      }}
    >
      <PlayerModel ref={model} look={look} />
    </group>
  )
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div style={{ margin: '10px 0' }}>
      <div style={{ fontSize: 13, opacity: 0.75, marginBottom: 4 }}>{label}</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>{children}</div>
    </div>
  )
}

function Choice({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button style={{ ...button, opacity: active ? 1 : 0.5 }} onClick={(e) => { onClick(); e.currentTarget.blur() }}>
      {children}
    </button>
  )
}

function Swatches({ colors, value, onChange }: { colors: string[]; value: string; onChange: (c: string) => void }) {
  return (
    <>
      {colors.map((c) => (
        <button key={c} aria-label={c} onClick={(e) => { onChange(c); e.currentTarget.blur() }}
          style={{ width: 26, height: 26, borderRadius: '50%', background: c, cursor: 'pointer', border: value === c ? '3px solid #ffd166' : '2px solid #555', pointerEvents: 'auto' }} />
      ))}
      {/* 직접 고르기 */}
      <input type="color" value={value} onChange={(e) => onChange(e.target.value)} style={{ width: 34, height: 28, pointerEvents: 'auto', background: 'none', border: 'none' }} />
    </>
  )
}

/** 옷 염색: "원래 색" + 견본 + 직접 고르기 */
function DyePicker({ value, onChange }: { value: string | null; onChange: (c: string | null) => void }) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center', width: '100%', marginTop: 2 }}>
      <Choice active={value === null} onClick={() => onChange(null)}>원래 색</Choice>
      <Swatches colors={DYE_COLORS} value={value ?? '#ffffff'} onChange={onChange} />
    </div>
  )
}

function Slider({ label, value, range, onChange }: { label: string; value: number; range: [number, number]; onChange: (v: number) => void }) {
  return (
    <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, margin: '4px 0' }}>
      <span style={{ width: 84 }}>{label}</span>
      <input type="range" min={range[0]} max={range[1]} step={0.01} value={value} onChange={(e) => onChange(Number(e.target.value))} style={{ flex: 1, pointerEvents: 'auto' }} />
      <span style={{ width: 40, textAlign: 'right' }}>{value.toFixed(2)}</span>
    </label>
  )
}

/** 캐릭터 꾸미기. firstTime 이면 취소가 없고 완료해야 닫힌다 */
export function CharacterCreator({ firstTime }: { firstTime: boolean }) {
  const saved = useProgressStore((s) => s.look)
  const [draft, setDraft] = useState<CharacterLook>(saved ?? LOOK_PRESETS[0].look)
  const [spinning, setSpinning] = useState(true)
  const set = (patch: Partial<CharacterLook>) => setDraft((d) => ({ ...d, ...patch }))
  const close = () => useSessionStore.getState().setMode('explore')
  const done = () => {
    useProgressStore.getState().setLook(draft)
    close()
  }

  return (
    <div style={{ ...panelBox, width: 'min(960px, 96vw)', maxHeight: '92vh', display: 'flex', gap: 16, padding: 16 }}>
      <div style={{ position: 'relative', flex: '0 0 42%', minHeight: 420, background: 'radial-gradient(#3a5068, #16212e)', borderRadius: 10 }}>
        <Canvas camera={{ position: [0, 1, 5.6], fov: PREVIEW_FOV }}>
          <ambientLight intensity={1} />
          <directionalLight position={[2, 4, 3]} intensity={1.8} />
          <FramingCamera look={draft} />
          <Suspense fallback={null}>
            <Preview look={draft} spinning={spinning} />
          </Suspense>
        </Canvas>
        <button
          style={{ ...button, position: 'absolute', left: 10, bottom: 10, fontSize: 13 }}
          onClick={(e) => {
            setSpinning((s) => !s)
            e.currentTarget.blur()
          }}
        >
          {spinning ? '⏸ 회전 멈추기' : '▶ 다시 돌리기'}
        </button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', paddingRight: 12, colorScheme: 'dark' }}>
        <h2 style={{ margin: '0 0 4px', fontSize: 20 }}>{firstTime ? '나만의 낚시꾼 만들기' : '옷장'}</h2>

        <Row label="기본 꾸밈">
          {LOOK_PRESETS.map((p) => (
            <Choice key={p.id} active={false} onClick={() => setDraft(p.look)}>{p.name}</Choice>
          ))}
          <Choice active onClick={() => setDraft(randomLook(Math.random))}>🎲 랜덤</Choice>
        </Row>

        <Row label="성별">
          {(['male', 'female'] as Gender[]).map((g) => (
            <Choice key={g} active={draft.gender === g} onClick={() => setDraft((d) => switchGender(d, g))}>{GENDER_LABEL[g]}</Choice>
          ))}
        </Row>

        <Row label="피부색"><Swatches colors={SKIN_COLORS} value={draft.skinColor} onChange={(c) => set({ skinColor: c })} /></Row>

        <Row label="머리 모양">
          {HAIRS.map((h) => <Choice key={h.id} active={draft.hair === h.id} onClick={() => set({ hair: h.id })}>{h.name}</Choice>)}
          {draft.gender === 'male' && <Choice active={draft.beard} onClick={() => set({ beard: !draft.beard })}>수염 {draft.beard ? '있음' : '없음'}</Choice>}
        </Row>
        <Row label="머리색"><Swatches colors={HAIR_COLORS} value={draft.hairColor} onChange={(c) => set({ hairColor: c })} /></Row>

        {(['top', 'bottom', 'shoes'] as const).map((slot) => (
          <Row key={slot} label={{ top: '윗옷', bottom: '바지', shoes: '신발' }[slot]}>
            {OUTFITS.map((o) => <Choice key={o.id} active={draft[slot] === o.id} onClick={() => set({ [slot]: o.id as OutfitId })}>{o.name}</Choice>)}
            <DyePicker value={draft.dye[slot]} onChange={(c) => setDraft((d) => ({ ...d, dye: { ...d.dye, [slot]: c } }))} />
          </Row>
        ))}
        <Row label="소품·옷 색">
          <Choice active={draft.hood} onClick={() => set({ hood: !draft.hood })}>후드 {draft.hood ? '씀' : '벗음'}</Choice>
          <Choice active={draft.outfitColor === 'base'} onClick={() => set({ outfitColor: 'base' })}>기본 색</Choice>
          <Choice active={draft.outfitColor === 'alt'} onClick={() => set({ outfitColor: 'alt' })}>다른 색</Choice>
        </Row>

        <Row label="몸">
          <div style={{ width: '100%' }}>
            <Slider label="키" value={draft.height} range={HEIGHT_RANGE} onChange={(v) => set({ height: v })} />
            {BODY_PARTS.map((part) => (
              <Slider key={part} label={BODY_PART_LABEL[part]} value={draft.body[part]} range={BODY_RANGES[part]}
                onChange={(v) => setDraft((d) => ({ ...d, body: { ...d.body, [part]: v } }))} />
            ))}
            <Choice active={false} onClick={() => set({ height: 1, body: DEFAULT_BODY })}>몸 부위 초기화</Choice>
          </div>
        </Row>

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 }}>
          {!firstTime && <button style={{ ...button, background: '#555', color: '#fff' }} onClick={close}>취소</button>}
          <button style={button} onClick={done}>완료</button>
        </div>
      </div>
    </div>
  )
}
