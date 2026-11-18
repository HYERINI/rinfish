import { useEffect, useRef, useState } from 'react'
import { EMOTES } from '../data/emotes'
import { pressEmote } from '../input/usePlayerActionKeys'
import { isTypingTarget } from '../input/typing'
import { addAim, wheelPick, wheelSlot } from '../logic/emoteWheel'
import { useSessionStore } from '../stores/sessionStore'

/** 바퀴 반지름(px) */
const RADIUS = 110

/** 바퀴를 닫고, 고른 게 있으면 그 감정 표현을 한다 (다음 프레임에 Player 가 가져간다) */
function close(pick: number | null) {
  const session = useSessionStore.getState()
  if (session.mode !== 'emote') return
  session.setMode('explore')
  if (pick !== null) pressEmote(EMOTES[pick].id)
}

/**
 * T 를 누르고 있는 동안 화면 가운데 감정 표현 5개 바퀴 (mode 'emote').
 * 마우스 방향(잠금 중엔 움직인 만큼, 아니면 화면 가운데에서 커서까지)이나 숫자 1~5 로 고르고, T 를 떼면 한다.
 * 창 밖으로 포커스가 나가면(떼는 걸 못 받으니) 아무것도 하지 않고 닫는다. 폰은 지금 😀 메뉴 그대로
 */
export function EmoteWheel() {
  const mode = useSessionStore((s) => s.mode)
  const [pick, setPick] = useState<number | null>(null)
  const aim = useRef({ x: 0, y: 0 })
  const picked = useRef<number | null>(null)

  useEffect(() => {
    const choose = (i: number | null) => {
      picked.current = i
      setPick(i)
    }
    const onDown = (e: KeyboardEvent) => {
      if (e.repeat || isTypingTarget(e.target)) return
      const current = useSessionStore.getState().mode
      // 바퀴가 쓴 키는 막아 둔다: 같은 숫자가 도구 칸으로 이어지지 않게 (useInteractionKeys 가 defaultPrevented 를 본다)
      if (e.code === 'KeyT' && current === 'explore') {
        e.preventDefault()
        aim.current = { x: 0, y: 0 }
        choose(null)
        useSessionStore.getState().setMode('emote')
        return
      }
      if (current !== 'emote') return
      const i = EMOTES.findIndex((em) => em.key === e.code)
      if (i >= 0) {
        e.preventDefault()
        close(i)
      }
    }
    const onUp = (e: KeyboardEvent) => {
      if (e.code === 'KeyT') close(picked.current)
    }
    const onMove = (e: PointerEvent) => {
      if (useSessionStore.getState().mode !== 'emote') return
      aim.current = document.pointerLockElement ? addAim(aim.current, e.movementX, e.movementY) : { x: e.clientX - window.innerWidth / 2, y: e.clientY - window.innerHeight / 2 }
      const i = wheelPick(aim.current.x, aim.current.y, EMOTES.length)
      if (i !== picked.current) choose(i)
    }
    const onBlur = () => close(null)
    window.addEventListener('keydown', onDown)
    window.addEventListener('keyup', onUp)
    window.addEventListener('pointermove', onMove)
    window.addEventListener('blur', onBlur)
    return () => {
      window.removeEventListener('keydown', onDown)
      window.removeEventListener('keyup', onUp)
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('blur', onBlur)
    }
  }, [])

  if (mode !== 'emote') return null
  return (
    <div style={{ position: 'absolute', inset: 0, zIndex: 1001, pointerEvents: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center' }} aria-label="감정 표현 바퀴">
      <div style={{ position: 'relative', width: 0, height: 0 }}>
        <div style={{ position: 'absolute', left: -RADIUS - 46, top: -RADIUS - 46, width: (RADIUS + 46) * 2, height: (RADIUS + 46) * 2, borderRadius: '50%', background: 'rgba(15, 20, 30, 0.45)' }} />
        <div style={{ position: 'absolute', transform: 'translate(-50%, -50%)', color: '#fff', fontSize: 13, whiteSpace: 'nowrap', textShadow: '0 1px 2px #000' }}>{pick === null ? 'T 를 떼면 닫기' : EMOTES[pick].label}</div>
        {EMOTES.map((em, i) => {
          const p = wheelSlot(i, EMOTES.length, RADIUS)
          const on = i === pick
          return (
            <div
              key={em.id}
              style={{ position: 'absolute', left: p.x, top: p.y, transform: `translate(-50%, -50%) scale(${on ? 1.2 : 1})`, width: 70, height: 70, borderRadius: '50%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: on ? 'rgba(255, 209, 102, 0.95)' : 'rgba(255, 255, 255, 0.85)', color: '#222', boxShadow: '0 3px 10px rgba(0,0,0,0.35)', transition: 'transform 0.08s' }}
            >
              <span style={{ fontSize: 26, lineHeight: 1 }}>{em.icon}</span>
              <span style={{ fontSize: 11, fontWeight: 700 }}>
                {em.key.replace('Digit', '')} {em.label}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
