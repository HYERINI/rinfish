import { useEffect, useState, type CSSProperties } from 'react'
import { meadowRange } from '../../meadow/meadowSingleton'
import { toggleRangeGame } from '../../meadow/rangeActions'
import { inRangeRoom } from '../data/meadow'
import { playerRig } from '../scene/Player'
import { useSessionStore } from '../stores/sessionStore'
import { button, safeTop } from './styles'

type View = { state: 'idle' | 'countdown' | 'running' | 'over'; time: number; score: number; hits: number; shots: number; best: number; isBest: boolean; inside: boolean }

/**
 * 사격장 연습 게임 (은지 setGame): 카운트다운 숫자, 위쪽 남은 시간·점수·명중, 끝나면 결과와 최고 기록.
 * 사격장 안에서 쉬고 있으면 "연습 게임 시작 (G)" 버튼 (폰은 G 키가 없다)
 */
export function RangeHud() {
  const mode = useSessionStore((s) => s.mode)
  const [v, setV] = useState<View | null>(null)
  useEffect(() => {
    let raf = 0
    const tick = () => {
      raf = requestAnimationFrame(tick)
      const g = meadowRange().game
      const next: View = { state: g.state, time: Math.round(g.time * 10) / 10, score: g.score, hits: g.hits, shots: g.shots, best: g.best, isBest: g.isBest, inside: inRangeRoom(playerRig.position.x, playerRig.position.z) }
      setV((prev) => (prev && (Object.keys(next) as (keyof View)[]).every((k) => prev[k] === next[k]) ? prev : next))
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [])
  if (!v || mode !== 'explore') return null
  if (v.state === 'idle') {
    if (!v.inside) return null
    return (
      <div style={{ ...top, pointerEvents: 'auto' }}>
        <button style={button} onClick={(e) => { e.currentTarget.blur(); toggleRangeGame() }}>
          🎯 연습 게임 시작 (G)
        </button>
      </div>
    )
  }
  if (v.state === 'countdown') return <div style={count}>{Math.ceil(v.time)}</div>
  const acc = v.shots ? Math.round((v.hits / v.shots) * 100) : 0
  if (v.state === 'over') {
    return (
      <div style={{ ...top, ...card }} aria-label="연습 게임 결과">
        <div style={{ fontSize: 28, fontWeight: 800 }}>
          {v.score}
          <small style={{ fontSize: 14 }}>점</small>
        </div>
        <div>
          명중 {v.hits} / {v.shots} ({acc}%)
        </div>
        <div>
          최고 기록 {v.best}점{v.isBest && <b> 🏆 신기록!</b>}
        </div>
      </div>
    )
  }
  return (
    <div style={{ ...top, ...card, color: v.time < 10 ? '#ff8a80' : '#fff' }} aria-label="연습 게임">
      <div style={{ fontSize: 24, fontWeight: 800 }}>⏱ {v.time.toFixed(1)}</div>
      <div style={{ fontSize: 13 }}>
        점수 {v.score} · 명중 {v.hits} / {v.shots}
      </div>
    </div>
  )
}

const top: CSSProperties = { position: 'absolute', top: safeTop(100), left: '50%', transform: 'translateX(-50%)', zIndex: 1000, textAlign: 'center' }
const card: CSSProperties = { pointerEvents: 'none', background: 'rgba(15, 20, 30, 0.7)', color: '#fff', padding: '8px 18px', borderRadius: 12, textShadow: '0 1px 2px #000' }
const count: CSSProperties = { position: 'absolute', left: '50%', top: '38%', transform: 'translate(-50%, -50%)', fontSize: 96, fontWeight: 900, color: '#ffd166', textShadow: '0 3px 8px #000', pointerEvents: 'none', zIndex: 1000 }
