import { useEffect, useState } from 'react'
import { getZone } from '../data/zones'
import { nextGoal } from '../logic/zoneUnlock'
import { useProgressStore } from '../stores/progressStore'
import { useTouchUi } from '../input/touchDevice'
import { useSessionStore } from '../stores/sessionStore'
import { safeTop } from './styles'

/**
 * 화면 위 가운데 "다음 목표" 띠. 아직 안 열린 구역을 어떻게 여는지 알려 준다 (다 열리면 사라진다).
 * 누르면 접고 펼친다. 화면이 좁으면(폰·좁은 창) 위쪽 버튼들과 겹치지 않게 그 아래에 두고, 폰에선 처음엔 접어 둔다
 */
export function GoalTracker() {
  const mode = useSessionStore((s) => s.mode)
  const coins = useProgressStore((s) => s.coins)
  const dexCount = useProgressStore((s) => Object.keys(s.dex).length)
  const lineLevel = useProgressStore((s) => s.gear.line)
  const unlocked = useProgressStore((s) => s.unlockedZones)
  const touchUi = useTouchUi()
  const [folded, setFolded] = useState(touchUi)
  const narrow = useNarrow() || touchUi
  if (mode !== 'explore') return null
  const goal = nextGoal({ coins, dexCount, lineLevel, unlocked })
  if (!goal) return null
  const ready = goal.ratio >= 1

  return (
    <button style={{ ...box, ...(narrow ? narrowPlace : null) }} onClick={(e) => { e.currentTarget.blur(); setFolded((f) => !f) }} title={folded ? '목표 펼치기' : '목표 접기'}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'center' }}>
        <span>🎯</span>
        <strong>다음 목표 · {goal.title}</strong>
        <span style={{ opacity: 0.6, fontSize: 11 }}>{folded ? '▼' : '▲'}</span>
      </div>
      {!folded && (
        <>
          <div style={{ fontSize: 12, marginTop: 3, color: ready ? '#a5d6a7' : '#ffe082' }}>{goal.detail}</div>
          <div style={{ height: 5, background: 'rgba(255,255,255,0.2)', borderRadius: 3, overflow: 'hidden', marginTop: 5 }}>
            <div style={{ width: `${goal.ratio * 100}%`, height: '100%', background: ready ? '#66bb6a' : '#ffd166', transition: 'width 0.4s' }} />
          </div>
          <div style={{ fontSize: 11, opacity: 0.65, marginTop: 3 }}>{getZone(goal.zoneId).name} 문 앞에 가면 자세히 볼 수 있어요</div>
        </>
      )}
    </button>
  )
}

/** 위쪽 버튼 줄(🔊·어항 구경·도감·메뉴)이 가운데까지 오는 좁은 화면 */
const NARROW_BELOW = 900

function useNarrow(): boolean {
  const [narrow, setNarrow] = useState(() => window.innerWidth < NARROW_BELOW)
  useEffect(() => {
    const onResize = () => setNarrow(window.innerWidth < NARROW_BELOW)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])
  return narrow
}

/** 좁은 화면: 코인·체력 줄과 위쪽 버튼 줄 아래, 화면 폭에 맞춰 */
const narrowPlace = {
  top: safeTop(78),
  width: 'min(400px, calc(100vw - 32px))',
  minWidth: 0,
}

const box = {
  position: 'absolute' as const,
  top: 12,
  left: '50%',
  transform: 'translateX(-50%)',
  width: 'min(400px, calc(100vw - 260px))',
  minWidth: 200,
  boxSizing: 'border-box' as const,
  padding: '6px 12px',
  background: 'rgba(20, 24, 32, 0.85)',
  color: '#fff',
  border: '1px solid rgba(255, 209, 102, 0.5)',
  borderRadius: 10,
  fontSize: 13,
  textAlign: 'center' as const,
  cursor: 'pointer',
  pointerEvents: 'auto' as const,
  zIndex: 1000,
}
