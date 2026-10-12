import type { CSSProperties } from 'react'
import type { GameProps } from '../Game'
import { useGameStore } from '../store'

// 캔버스 위에 겹쳐 보이는 HTML UI (점수, 버튼 등)
export function Hud({ onExit, onFinish }: GameProps) {
  const phase = useGameStore((s) => s.phase)
  const score = useGameStore((s) => s.score)
  const start = useGameStore((s) => s.start)
  const addScore = useGameStore((s) => s.addScore)
  const finish = useGameStore((s) => s.finish)
  const reset = useGameStore((s) => s.reset)

  const handleFinish = () => {
    finish()
    onFinish?.({ score })
  }

  return (
    <div style={overlay}>
      <div style={topBar}>
        <strong>Game (임시 제목)</strong>
        <span>
          {phase} · 점수 {score}
        </span>
        <button style={button} onClick={onExit}>
          나가기
        </button>
      </div>

      {/* 흐름 확인용 임시 버튼들: 실제 게임 로직이 생기면 교체 */}
      <div style={bottomBar}>
        {phase === 'ready' && (
          <button style={button} onClick={start}>
            시작
          </button>
        )}
        {phase === 'playing' && (
          <>
            <button style={button} onClick={() => addScore(1)}>
              +1점
            </button>
            <button style={button} onClick={handleFinish}>
              종료
            </button>
          </>
        )}
        {phase === 'result' && (
          <button style={button} onClick={reset}>
            다시 하기
          </button>
        )}
      </div>
    </div>
  )
}

// 오버레이 전체는 마우스 이벤트를 통과시켜(none) 캔버스 조작이 가능하게 하고,
// 실제 UI 요소에서만 다시 이벤트를 받는다(auto).
const overlay: CSSProperties = {
  position: 'absolute',
  inset: 0,
  pointerEvents: 'none',
  color: '#fff',
  display: 'flex',
  flexDirection: 'column',
  justifyContent: 'space-between',
  padding: 16,
  boxSizing: 'border-box',
}

const topBar: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 16,
}

const bottomBar: CSSProperties = {
  display: 'flex',
  justifyContent: 'center',
  gap: 8,
}

const button: CSSProperties = {
  pointerEvents: 'auto',
  padding: '6px 14px',
  cursor: 'pointer',
}
