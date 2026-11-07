import { useEffect, useRef, useState } from 'react'
import { NET } from '../data/net'
import { useTouchUi } from '../input/touchDevice'
import { isTypingTarget } from '../input/typing'
import type { Mode } from '../logic/interaction'
import { netNow } from '../net/remoteRig'
import { useNetStore } from '../stores/netStore'
import { useSessionStore } from '../stores/sessionStore'
import { button, safeBottom, safeLeft } from './styles'

/** 채팅을 열 수 있는 모드 (패널이 열려 있을 땐 그 패널 입력과 겹치지 않게 막는다) */
const CHAT_MODES: Mode[] = ['explore', 'fishing', 'rest']
/** 흐려지기 시작해서 사라질 때까지(초) */
const FADE_OUT = 3

/** 왼쪽 아래 채팅: 최근 30줄(10초 지나면 흐려짐), Enter 로 열고 보내기, Esc 로 닫기. 폰은 💬 버튼 */
export function ChatBox() {
  const phase = useNetStore((s) => s.phase)
  const chat = useNetStore((s) => s.chat)
  const mode = useSessionStore((s) => s.mode)
  const touchUi = useTouchUi()
  const [open, setOpen] = useState(false)
  const [text, setText] = useState('')
  const input = useRef<HTMLInputElement>(null)
  const [now, setNow] = useState(netNow)

  // 흐려지게 하려고 1초마다 다시 그린다
  useEffect(() => {
    const t = setInterval(() => setNow(netNow()), 1000)
    return () => clearInterval(t)
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code !== 'Enter' || isTypingTarget(e.target)) return
      if (useNetStore.getState().phase !== 'online' || !CHAT_MODES.includes(useSessionStore.getState().mode)) return
      e.preventDefault()
      // 마우스 잠금 중이면 풀어서 커서로 입력 칸을 볼 수 있게
      if (document.pointerLockElement) document.exitPointerLock()
      setOpen(true)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  useEffect(() => {
    if (open) input.current?.focus()
  }, [open])

  if (phase === 'off' || mode === 'lobby' || mode === 'cutscene' || mode === 'aquariumView') return null
  const send = () => {
    if (text.trim()) useNetStore.getState().sendChat(text)
    setText('')
    setOpen(false)
    input.current?.blur()
  }

  return (
    <div style={{ position: 'absolute', left: safeLeft(16), bottom: safeBottom(touchUi ? 200 : 60), width: 'min(340px, 64vw)', pointerEvents: 'none', display: 'flex', flexDirection: 'column', gap: 4 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2, maxHeight: '30vh', overflow: 'hidden', justifyContent: 'flex-end' }}>
        {chat.map((line) => {
          const age = now - line.at
          const opacity = open ? 1 : Math.max(0, 1 - Math.max(0, age - NET.chatFadeSeconds) / FADE_OUT)
          if (opacity <= 0) return null
          return (
            <div key={line.key} style={{ background: 'rgba(0,0,0,0.5)', color: '#fff', borderRadius: 6, padding: '2px 8px', fontSize: 14, opacity, wordBreak: 'break-all' }}>
              <b style={{ color: line.mine ? '#ffd166' : '#8ecae6' }}>{line.from}</b> {line.text}
            </div>
          )
        })}
      </div>
      {open ? (
        <form
          style={{ display: 'flex', gap: 4, pointerEvents: 'auto' }}
          onSubmit={(e) => {
            e.preventDefault()
            send()
          }}
        >
          <input
            ref={input}
            value={text}
            maxLength={NET.chatLength}
            aria-label="채팅"
            placeholder={touchUi ? '말하기' : '말하기 (Enter 보내기 · Esc 닫기)'}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                e.preventDefault()
                setText('')
                setOpen(false)
              }
            }}
            onBlur={() => !text && setOpen(false)}
            style={{ flex: 1, fontSize: 16, padding: '6px 8px', borderRadius: 6, border: 'none' }}
          />
          <button type="submit" style={button}>
            보내기
          </button>
        </form>
      ) : (
        touchUi &&
        phase === 'online' &&
        CHAT_MODES.includes(mode) && (
          <button style={{ ...button, pointerEvents: 'auto', alignSelf: 'flex-start' }} aria-label="채팅 열기" onClick={() => setOpen(true)}>
            💬
          </button>
        )
      )}
    </div>
  )
}
