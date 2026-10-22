import { useEffect, useState, type CSSProperties } from 'react'
import { BAITS } from '../data/bait'
import { RARITY_COLOR, RARITY_LABEL, getSpecies } from '../data/fish'
import type { FishInstance } from '../data/types'
import { castPowerFromHold } from '../logic/cast'
import type { FightState } from '../logic/fight'
import type { FishingState } from '../logic/fishingSession'
import { useFishingStore } from '../stores/fishingStore'
import { useProgressStore } from '../stores/progressStore'
import { useSessionStore } from '../stores/sessionStore'
import { FishImage } from './FishImage'
import { ItemIcon } from './ItemIcon'
import { button, hint, overlayLayer, panelBox } from './styles'

export function FishingOverlay() {
  const mode = useSessionStore((s) => s.mode)
  const state = useFishingStore((s) => s.state)
  const caught = useFishingStore((s) => s.caught)
  if (mode !== 'fishing' || !state) return null

  return (
    <div style={overlayLayer}>
      {state.stage === 'aiming' && <AimingView holdTime={state.holdTime} />}
      {state.stage === 'waiting' && <WaitingView biting={state.bite.phase === 'bite'} />}
      {state.stage === 'fighting' && <TensionGauge fight={state.fight} />}
      {state.stage === 'done' && <ResultCard state={state} caught={caught} />}
      {state.stage !== 'done' && <BaitBar />}
    </div>
  )
}

/** 미끼 고르기 (오른쪽 아래). 숫자 키 1~3·0 또는 눌러서 고른다. 다음에 던질 때 쓴다 */
function BaitBar() {
  const counts = useProgressStore((s) => s.bait)
  const selected = useProgressStore((s) => s.selectedBait)
  const selectBait = useProgressStore((s) => s.selectBait)
  const options = [{ id: null, name: '미끼 없이', key: '0', count: null }, ...BAITS.map((b) => ({ id: b.id, name: b.name, key: b.key.replace('Digit', ''), count: counts[b.id] }))]
  return (
    <div style={baitBar}>
      <div style={{ fontSize: 12, opacity: 0.85, marginBottom: 4 }}>미끼 (숫자 키)</div>
      <div style={{ display: 'flex', gap: 6 }}>
        {options.map((o) => {
          const active = selected === o.id
          const empty = o.count === 0
          return (
            <button
              key={o.key}
              style={{ ...baitChip, borderColor: active ? '#ffd166' : 'transparent', background: active ? 'rgba(255,209,102,0.22)' : 'rgba(0,0,0,0.45)', opacity: empty && !active ? 0.5 : 1 }}
              onClick={(e) => {
                selectBait(o.id)
                e.currentTarget.blur()
              }}
            >
              <span style={keyBadge}>{o.key}</span>
              <ItemIcon id={o.id ?? 'none'} size={34} />
              <span style={{ fontSize: 11, whiteSpace: 'nowrap' }}>{o.name}</span>
              <span style={{ fontSize: 11, color: empty ? '#ef9a9a' : '#ffe082' }}>{o.count === null ? '기본' : `×${o.count}`}</span>
            </button>
          )
        })}
      </div>
      {selected && counts[selected] === 0 && <div style={{ fontSize: 11, color: '#ef9a9a', marginTop: 4 }}>다 떨어져서 미끼 없이 던져요</div>}
    </div>
  )
}

const baitBar: CSSProperties = {
  position: 'absolute',
  right: 12,
  bottom: 96,
  pointerEvents: 'auto',
  background: 'rgba(20, 30, 45, 0.7)',
  borderRadius: 10,
  padding: '6px 8px 8px',
}

const baitChip: CSSProperties = {
  position: 'relative',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: 1,
  width: 58,
  padding: '4px 2px',
  border: '2px solid transparent',
  borderRadius: 8,
  color: '#fff',
  cursor: 'pointer',
}

const keyBadge: CSSProperties = {
  position: 'absolute',
  top: 2,
  left: 4,
  fontSize: 10,
  fontWeight: 700,
  opacity: 0.8,
}

function AimingView({ holdTime }: { holdTime: number }) {
  const power = castPowerFromHold(holdTime)
  return (
    <div style={hint}>
      <div>마우스를 누르고 있다가 떼서 던지기 · ESC 그만하기</div>
      <Bar ratio={power} color="#ffd166" />
    </div>
  )
}

function WaitingView({ biting }: { biting: boolean }) {
  return (
    <>
      {biting && (
        <div style={{ position: 'absolute', top: '35%', width: '100%', textAlign: 'center', fontSize: 72, fontWeight: 800, color: '#ffeb3b' }}>
          !
        </div>
      )}
      <div style={hint}>찌를 지켜보세요… 크게 잠기면 클릭!</div>
    </>
  )
}

function TensionGauge({ fight }: { fight: FightState }) {
  const ratio = fight.tension / fight.gear.maxTension
  const color = ratio > 0.8 ? '#ef5350' : ratio < 0.15 ? '#90caf9' : '#66bb6a'
  return (
    <div style={{ ...hint, width: 360 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <span>텐션</span>
        <span>남은 거리 {Math.ceil(fight.distance)}m</span>
      </div>
      <Bar ratio={ratio} color={color} />
      <div style={{ fontSize: 13, opacity: 0.8, marginTop: 4 }}>
        누르고 있으면 감기 · 떼면 풀기 {fight.pull.active && '· 물고기가 당긴다!'}
      </div>
    </div>
  )
}

function Bar({ ratio, color }: { ratio: number; color: string }) {
  return (
    <div style={{ height: 12, background: '#333', borderRadius: 6, overflow: 'hidden', marginTop: 6 }}>
      <div style={{ width: `${Math.min(1, ratio) * 100}%`, height: '100%', background: color }} />
    </div>
  )
}

const FAIL_TEXT = {
  missed: '놓쳤다! 찌가 크게 잠길 때 챔질해야 해요.',
  snapped: '줄이 끊어졌다! 텐션이 빨개지면 손을 떼세요.',
  escaped: '물고기가 도망갔다! 줄을 팽팽하게 유지해 보세요.',
}

/** 결과 카드를 띄우기까지 기다리는 시간 (3D 연출 시간과 맞춘다) */
const RESULT_DELAY_CAUGHT_MS = 900
const RESULT_DELAY_MS = 500

/** 결과 카드: 화면 아래쪽에 띄워서 가운데의 낚싯대·물고기를 가리지 않는다 */
const resultBox: CSSProperties = {
  ...panelBox,
  top: 'auto',
  bottom: 24,
  transform: 'translateX(-50%)',
  textAlign: 'center',
  width: 'min(360px, 90vw)',
  maxHeight: '55vh',
}

function ResultCard({ state, caught }: { state: Extract<FishingState, { stage: 'done' }>; caught: FishInstance | null }) {
  const dex = useProgressStore((s) => s.dex)
  const spot = useFishingStore((s) => s.spot)
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    const id = setTimeout(() => setVisible(true), state.result === 'caught' ? RESULT_DELAY_CAUGHT_MS : RESULT_DELAY_MS)
    return () => clearTimeout(id)
  }, [state.result])

  const retry = () => {
    if (spot) useFishingStore.getState().begin(spot)
  }
  const quit = () => {
    useFishingStore.getState().end()
    useSessionStore.getState().setMode('explore')
  }

  let body
  if (state.result === 'caught' && caught) {
    const species = getSpecies(caught.speciesId)
    const isNew = dex[species.id]?.count === 1
    body = (
      <>
        {isNew && <div style={{ color: '#ffd166', fontWeight: 700 }}>새로운 물고기!</div>}
        <FishImage speciesId={species.id} width={180} style={{ margin: '4px auto' }} />
        <h2 style={{ margin: '4px 0' }}>{species.name}</h2>
        <div style={{ color: RARITY_COLOR[species.rarity] }}>{RARITY_LABEL[species.rarity]}</div>
        <div style={{ margin: '8px 0' }}>{caught.weight}kg</div>
        <div style={{ opacity: 0.8, fontSize: 14 }}>{species.description}</div>
        {species.trivia && <div style={{ color: '#ffe082', fontSize: 13, marginTop: 4 }}>{species.trivia}</div>}
      </>
    )
  } else {
    body = <h3>{state.result === 'caught' ? '' : FAIL_TEXT[state.result]}</h3>
  }

  // 물고기가 튀어 오르고 찌를 감아 들이는 연출을 먼저 보여 준 뒤에 카드를 띄운다
  if (!visible) return null
  return (
    <div style={resultBox}>
      {body}
      <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginTop: 16 }}>
        <button style={button} onClick={retry}>
          다시 던지기
        </button>
        <button style={button} onClick={quit}>
          그만하기
        </button>
      </div>
    </div>
  )
}
