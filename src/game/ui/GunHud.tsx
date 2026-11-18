import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { GUNS, isGun } from '../data/guns'
import { gunRig } from '../guns/gunRig'
import { playerRig } from '../scene/Player'
import { useTouchUi } from '../input/touchDevice'
import { heatNow, reloadProgress, spreadOf } from '../logic/gun'
import { useProgressStore } from '../stores/progressStore'
import { useSessionStore } from '../stores/sessionStore'
import { gunStatus } from './gunStatus'
import { safeBottom, safeRight } from './styles'

/** 명중 표시를 띄워 두는 시간(초) */
const HIT_MARK = 0.25

/**
 * 총을 든 동안: 화면 가운데 조준선(퍼짐만큼 벌어진다, 맞히면 ✕), 오른쪽 아래 총 이름·탄창/예비·상태.
 * 매 프레임 바뀌는 퍼짐·명중 표시는 React 상태 대신 rAF 로 스타일만 고친다
 */
export function GunHud() {
  const mode = useSessionStore((s) => s.mode)
  const tool = useSessionStore((s) => s.tool)
  const mag = useProgressStore((s) => (isGun(tool) ? s.ammo[tool] : 0))
  const reserve = useProgressStore((s) => (isGun(tool) ? s.reserve[tool] : 0))
  const touchUi = useTouchUi()
  const cross = useRef<HTMLDivElement>(null)
  const mark = useRef<HTMLDivElement>(null)
  const [reloading, setReloading] = useState(false)
  const shown = mode === 'explore' && isGun(tool)

  useEffect(() => {
    if (!shown) return
    let raf = 0
    const tick = () => {
      raf = requestAnimationFrame(tick)
      const now = performance.now() / 1000
      const gun = gunRig.gun
      if (!gun) return
      const gap = 6 + spreadOf(gun, gunRig.aiming, heatNow(gunRig, now)) * 900
      cross.current?.style.setProperty('--gap', `${gap}px`)
      // 조준경·홀로로 볼 땐 그쪽 십자선을 쓴다 (은지 opticAim)
      if (cross.current) cross.current.style.visibility = gunRig.optic && playerRig.firstPerson ? 'hidden' : 'visible'
      if (mark.current) {
        mark.current.style.opacity = now - gunRig.hitAt < HIT_MARK ? '1' : '0'
        // 사격장 표적은 점수 (은지 flashHit)
        mark.current.textContent = gunRig.hitText || '✕'
      }
      const r = reloadProgress(gunRig, now) >= 0
      setReloading((prev) => (prev === r ? prev : r))
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [shown])

  if (!shown) return null
  const status = gunStatus(tool, mag, reserve, reloading)
  return (
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 999, color: '#fff' }}>
      <div ref={cross} style={crossBox} aria-hidden>
        {[0, 90, 180, 270].map((deg) => (
          <span key={deg} style={{ ...tick, transform: `rotate(${deg}deg) translateY(calc(-1 * var(--gap, 8px)))` }} />
        ))}
        <div ref={mark} style={hitMark}>
          ✕
        </div>
      </div>
      {!touchUi && (
        <div style={panel} aria-label="총">
          <div style={{ fontSize: 13, opacity: 0.85 }}>🔫 {GUNS[tool].name}</div>
          <div style={{ fontSize: 26, fontWeight: 800, lineHeight: 1.1 }}>
            {mag} <span style={{ fontSize: 15, opacity: 0.75 }}>/ {reserve}</span>
          </div>
          {status && <div style={{ fontSize: 12, color: mag === 0 ? '#ffab91' : '#ffe082' }}>{status}</div>}
        </div>
      )}
    </div>
  )
}

const crossBox: CSSProperties = { position: 'absolute', left: '50%', top: '50%', width: 0, height: 0 }
const tick: CSSProperties = { position: 'absolute', left: -1, top: -5, width: 2, height: 8, background: 'rgba(255,255,255,0.9)', boxShadow: '0 0 2px #000', transformOrigin: '1px 5px' }
const hitMark: CSSProperties = { position: 'absolute', left: -24, top: -13, width: 48, textAlign: 'center', fontSize: 18, fontWeight: 900, color: '#ff5252', textShadow: '0 0 3px #000', opacity: 0, transition: 'opacity 0.08s' }
const panel: CSSProperties = { position: 'absolute', right: safeRight(16), bottom: safeBottom(52), textAlign: 'right', background: 'rgba(15, 20, 30, 0.55)', padding: '6px 12px', borderRadius: 10, textShadow: '0 1px 2px #000' }
