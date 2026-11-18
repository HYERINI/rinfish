import { useEffect, useRef } from 'react'
import { seqOpacity } from '../logic/restSeq'
import { wake } from '../scene/day/dayActions'
import { useDayStore } from '../stores/dayStore'
import { button } from './styles'

/**
 * 잠·죽음·방 아침 때 화면을 어둡게 한다 (불투명도만 매 프레임 바꾼다, React 다시 그리기 없이).
 * 같이 하기 잠 투표 중엔 "😴 잠자는 중 (n/필요 수)" 와 일어나기 버튼. 알림(NoticeLayer)은 이 위에 뜬다
 */
export function SleepOverlay() {
  const fade = useRef<HTMLDivElement>(null)
  const voting = useDayStore((s) => s.voting)
  const sleepers = useDayStore((s) => s.sleepers)

  useEffect(() => {
    let raf = 0
    const tick = () => {
      raf = requestAnimationFrame(tick)
      const seq = useDayStore.getState().seq
      const o = seq ? seqOpacity(seq.kind, performance.now() / 1000 - seq.startedAt) : 0
      if (fade.current) fade.current.style.opacity = String(o)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [])

  return (
    <>
      {voting && (
        // 바깥 막은 클릭을 통과시킨다 (자는 동안에도 채팅 💬 버튼을 누를 수 있게). 가운데 상자만 클릭을 받는다
        <div style={{ position: 'absolute', inset: 0, zIndex: 1000, background: 'rgba(5, 10, 30, 0.55)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, pointerEvents: 'auto' }}>
            <div style={{ fontSize: 22, fontWeight: 800 }}>{sleepers ? `😴 잠자는 중 (${sleepers.n}/${sleepers.need})` : '😴 잠자는 중…'}</div>
            {sleepers && <div style={{ fontSize: 14, opacity: 0.85 }}>{Math.max(0, sleepers.need - sleepers.n)}명 더 자면 모두 아침이 와요</div>}
            <button style={button} onClick={() => wake()}>
              일어나기
            </button>
          </div>
        </div>
      )}
      <div ref={fade} style={{ position: 'absolute', inset: 0, zIndex: 1000, background: '#000', opacity: 0, pointerEvents: 'none' }} />
    </>
  )
}
