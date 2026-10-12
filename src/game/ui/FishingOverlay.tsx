import { useEffect, useState, type CSSProperties } from 'react'
import { RARITY_COLOR, RARITY_LABEL, getSpecies } from '../data/fish'
import type { FishInstance } from '../data/types'
import { castPowerFromHold } from '../logic/cast'
import type { FightState } from '../logic/fight'
import type { FishingState } from '../logic/fishingSession'
import { useFishingStore } from '../stores/fishingStore'
import { useProgressStore } from '../stores/progressStore'
import { useSessionStore } from '../stores/sessionStore'
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
    </div>
  )
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
  const spotId = useFishingStore((s) => s.spotId)
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    const id = setTimeout(() => setVisible(true), state.result === 'caught' ? RESULT_DELAY_CAUGHT_MS : RESULT_DELAY_MS)
    return () => clearTimeout(id)
  }, [state.result])

  const retry = () => {
    if (spotId) useFishingStore.getState().begin(spotId)
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
        <div style={{ width: 80, height: 40, borderRadius: '50%', background: species.color, margin: '12px auto' }} />
        <h2 style={{ margin: '4px 0' }}>{species.name}</h2>
        <div style={{ color: RARITY_COLOR[species.rarity] }}>{RARITY_LABEL[species.rarity]}</div>
        <div style={{ margin: '8px 0' }}>{caught.weight}kg</div>
        <div style={{ opacity: 0.8, fontSize: 14 }}>{species.description}</div>
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
