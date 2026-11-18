import { useEffect } from 'react'
import { useTouchUi } from '../input/touchDevice'
import { isStarving } from '../logic/survival'
import { useProgressStore } from '../stores/progressStore'
import { playHeartbeat } from './heartbeat'
import { useNarrow } from './useNarrow'

/**
 * 약화 상태: 화면 가장자리 붉은 효과 + 쓰러지기까지 남은 시간 + 심장 소리.
 * 굶는 중(배고픔 0): 주황 가장자리 + "배고파요!" (체력이 다 떨어지면 침대에서 깨어난다)
 */
export function WeaknessOverlay() {
  const graceLeft = useProgressStore((s) => s.survival.graceLeft)
  const starving = useProgressStore((s) => isStarving(s.survival))
  const weak = graceLeft !== null
  // Hud·목표 안내와 같은 기준 (터치 화면이면 넓어도 좁은 배치)
  const touchUi = useTouchUi()
  const narrow = useNarrow() || touchUi

  useEffect(() => {
    if (!weak) return
    playHeartbeat()
    const id = setInterval(playHeartbeat, 1000)
    return () => clearInterval(id)
  }, [weak])

  if (graceLeft === null) {
    if (!starving) return null
    return (
      <div style={{ position: 'absolute', inset: 0, zIndex: 900, pointerEvents: 'none', boxShadow: 'inset 0 0 120px 30px rgba(230, 120, 0, 0.45)' }}>
        {/* 위쪽 가운데 목표 안내(GoalTracker) 아래에 띄운다 (좁은 화면에선 목표 안내가 더 아래까지 온다) */}
        <div style={{ position: 'absolute', top: narrow ? 200 : 120, width: narrow ? 'calc(100% - 150px)' : '100%', left: narrow ? 16 : undefined, textAlign: narrow ? 'left' : 'center', color: '#ffcc80', fontWeight: 800, fontSize: 18, textShadow: '0 1px 3px #000' }}>
          배고파요! 뭐라도 먹어야 해요
        </div>
      </div>
    )
  }
  const minutes = Math.floor(graceLeft / 60)
  const seconds = Math.floor(graceLeft % 60)
  return (
    <div style={{ position: 'absolute', inset: 0, zIndex: 900, pointerEvents: 'none', boxShadow: 'inset 0 0 140px 40px rgba(200, 0, 0, 0.55)' }}>
      <div style={{ position: 'absolute', top: 56, width: '100%', textAlign: 'center', color: '#ff8a80', fontWeight: 800, fontSize: 18, textShadow: '0 1px 3px #000' }}>
        기진맥진! {minutes}:{String(seconds).padStart(2, '0')} 안에 먹거나 쉬지 않으면 쓰러져요
      </div>
    </div>
  )
}
