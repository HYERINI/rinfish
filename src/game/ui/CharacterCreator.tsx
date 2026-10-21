import { Canvas, useFrame } from '@react-three/fiber'
import { Suspense, useRef, useState, type ReactNode } from 'react'
import type { Group } from 'three'
import {
  BODY_PART_LABEL, BODY_PARTS, BODY_RANGES, DEFAULT_BODY, GENDER_LABEL, HAIR_COLORS, HAIRS, HEIGHT_RANGE, LOOK_PRESETS, OUTFITS, SKIN_COLORS,
} from '../data/characterParts'
import type { CharacterLook, Gender, OutfitId } from '../data/types'
import { randomLook, switchGender } from '../logic/characterLook'
import { PlayerModel, type PlayerModelHandle } from '../scene/PlayerModel'
import { useProgressStore } from '../stores/progressStore'
import { useSessionStore } from '../stores/sessionStore'
import { button, panelBox } from './styles'

/** 미리보기: 천천히 돌고, 드래그로 돌릴 수 있다 */
function Preview({ look }: { look: CharacterLook }) {
  const turn = useRef<Group>(null)
  const model = useRef<PlayerModelHandle>(null)
  const drag = useRef({ active: false, x: 0, extra: 0 })
  useFrame(({ clock }, delta) => {
    if (turn.current) turn.current.rotation.y = clock.elapsedTime * 0.4 + drag.current.extra
    model.current?.update(delta, clock.elapsedTime, null, 0, 0.5, false)
  })
  return (
    <group
      ref={turn}
      onPointerDown={(e) => {
        drag.current.active = true
        drag.current.x = e.clientX
      }}
      onPointerUp={() => (drag.current.active = false)}
      onPointerMove={(e) => {
        if (!drag.current.active) return
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
  const set = (patch: Partial<CharacterLook>) => setDraft((d) => ({ ...d, ...patch }))
  const close = () => useSessionStore.getState().setMode('explore')
  const done = () => {
    useProgressStore.getState().setLook(draft)
    close()
  }

  return (
    <div style={{ ...panelBox, width: 'min(960px, 96vw)', maxHeight: '92vh', display: 'flex', gap: 16, padding: 16 }}>
      <div style={{ flex: '0 0 42%', minHeight: 420, background: 'radial-gradient(#3a5068, #16212e)', borderRadius: 10 }}>
        <Canvas camera={{ position: [0, 1.3, 5.6], fov: 35 }} onCreated={({ camera }) => camera.lookAt(0, 1.1, 0)}>
          <ambientLight intensity={1} />
          <directionalLight position={[2, 4, 3]} intensity={1.8} />
          <Suspense fallback={null}>
            <Preview look={draft} />
          </Suspense>
        </Canvas>
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
