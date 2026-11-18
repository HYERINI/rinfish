import { useEffect, useRef } from 'react'
import { useSessionStore } from '../stores/sessionStore'

/** 맞으면 화면 가장자리가 빨갛게 번쩍였다 사라진다 (은지 hurtEl) */
export function HurtFlash() {
  const hurtAt = useSessionStore((s) => s.hurtAt)
  const el = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (hurtAt === null) return
    el.current?.animate([{ opacity: 0.75 }, { opacity: 0 }], { duration: 500, easing: 'ease-out', fill: 'forwards' })
  }, [hurtAt])
  return <div ref={el} aria-hidden style={{ position: 'absolute', inset: 0, pointerEvents: 'none', opacity: 0, boxShadow: 'inset 0 0 120px 30px rgba(220, 30, 30, 0.85)' }} />
}
