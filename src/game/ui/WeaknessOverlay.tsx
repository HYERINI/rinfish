import { useEffect } from 'react'
import { useProgressStore } from '../stores/progressStore'
import { playHeartbeat } from './heartbeat'

/** 약화 상태: 화면 가장자리 붉은 효과 + 쓰러지기까지 남은 시간 + 심장 소리 */
export function WeaknessOverlay() {
  const graceLeft = useProgressStore((s) => s.survival.graceLeft)
  const weak = graceLeft !== null

  useEffect(() => {
    if (!weak) return
    playHeartbeat()
    const id = setInterval(playHeartbeat, 1000)
    return () => clearInterval(id)
  }, [weak])

  if (graceLeft === null) return null
  const minutes = Math.floor(graceLeft / 60)
  const seconds = Math.floor(graceLeft % 60)
  return (
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', boxShadow: 'inset 0 0 140px 40px rgba(200, 0, 0, 0.55)' }}>
      <div style={{ position: 'absolute', top: 56, width: '100%', textAlign: 'center', color: '#ff8a80', fontWeight: 800, fontSize: 18, textShadow: '0 1px 3px #000' }}>
        기진맥진! {minutes}:{String(seconds).padStart(2, '0')} 안에 먹거나 쉬지 않으면 쓰러져요
      </div>
    </div>
  )
}
