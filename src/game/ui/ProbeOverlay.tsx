import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { PROBE_SPOTS } from '../data/probeSpots'
import { useQualityPreset } from '../input/touchDevice'
import { frameStats } from '../logic/probeStats'
import { playerRig } from '../scene/Player'
import { useSessionStore } from '../stores/sessionStore'
import { safeLeft, safeTop } from './styles'

type Light = { isLight?: boolean; castShadow: boolean }
type SceneLike = { traverse: (fn: (o: Light) => void) => void }

/** 그림자를 드리우는 빛을 모두 켜거나 끈다 (측정용. 다시 켜면 끈 빛만 되돌린다) */
const switchedOff: Light[] = []
function setShadows(on: boolean) {
  const scene = window.__three?.scene as SceneLike | undefined
  if (!scene) return
  if (on) {
    for (const l of switchedOff.splice(0)) l.castShadow = true
    return
  }
  scene.traverse((o) => {
    if (o.isLight && o.castShadow) {
      o.castShadow = false
      switchedOff.push(o)
    }
  })
}

type Shown = { fps: number; p95: number; calls: number; tris: number; renderMs: number; x: number; z: number }

/**
 * 그리기 측정 창 (주소에 ?probe 를 붙였을 때만). 폰에서도 숫자를 볼 수 있게 1초마다
 * FPS·느린 프레임·드로우 콜·삼각형·그리기 CPU 시간·내 자리를 왼쪽 중간에 띄우고, 그림자 켜기/끄기와 측정 자리 이동 버튼을 둔다
 */
export function ProbeOverlay() {
  const [shown, setShown] = useState<Shown | null>(null)
  const [shadows, setShadowsOn] = useState(true)
  const [open, setOpen] = useState(true)
  const { dpr } = useQualityPreset()
  const deltas = useRef<number[]>([])
  const renders = useRef<number[]>([])

  useEffect(() => {
    let raf = 0
    let last = performance.now()
    const tick = (t: number) => {
      deltas.current.push(t - last)
      last = t
      if (window.__render) renders.current.push(window.__render.renderMs)
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    const id = setInterval(() => {
      const r = window.__render
      const ms = renders.current
      setShown({
        ...frameStats(deltas.current),
        calls: r?.calls ?? 0,
        tris: r?.triangles ?? 0,
        renderMs: ms.length ? Math.round((ms.reduce((a, b) => a + b, 0) / ms.length) * 10) / 10 : 0,
        x: Math.round(playerRig.position.x),
        z: Math.round(playerRig.position.z),
      })
      deltas.current = []
      renders.current = []
    }, 1000)
    return () => {
      cancelAnimationFrame(raf)
      clearInterval(id)
    }
  }, [])

  const toggleShadows = () => {
    setShadows(!shadows)
    setShadowsOn(!shadows)
  }

  return (
    <div style={box}>
      <button type="button" style={headBtn} onClick={() => setOpen(!open)}>
        📊 측정 {open ? '▲' : '▼'}
      </button>
      {open && shown && (
        <>
          <div style={mono}>
            FPS {shown.fps} · 느린 {shown.p95}ms
            <br />
            콜 {shown.calls} · 삼각형 {(shown.tris / 1000).toFixed(0)}k
            <br />
            그리기 CPU {shown.renderMs}ms
            <br />
            자리 ({shown.x}, {shown.z}) · DPR {Array.isArray(dpr) ? dpr.join('~') : dpr}
          </div>
          <button type="button" style={btn} onClick={toggleShadows}>
            그림자 {shadows ? '끄기' : '켜기'}
          </button>
          <div style={spots}>
            {PROBE_SPOTS.map(([name, x, z]) => (
              <button key={name} type="button" style={btn} onClick={() => useSessionStore.getState().requestTeleport([x, z])}>
                {name}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

const box: CSSProperties = {
  position: 'absolute',
  // 목표 표시(가운데 위)·미니맵(오른쪽 위)·조이스틱(왼쪽 아래)을 피해 왼쪽 중간
  top: safeTop(172),
  left: safeLeft(8),
  zIndex: 50,
  display: 'flex',
  flexDirection: 'column',
  gap: 4,
  alignItems: 'stretch',
  width: 168,
  padding: 6,
  borderRadius: 8,
  background: 'rgba(0,0,0,0.6)',
  color: '#fff',
  fontSize: 11,
}
const mono: CSSProperties = { fontFamily: 'ui-monospace, Menlo, monospace', lineHeight: 1.45 }
const btn: CSSProperties = { fontSize: 11, padding: '3px 6px', borderRadius: 5, border: '1px solid rgba(255,255,255,0.35)', background: 'rgba(255,255,255,0.12)', color: '#fff' }
const headBtn: CSSProperties = { ...btn, fontWeight: 700, background: 'transparent', border: 'none', textAlign: 'left', padding: 0 }
const spots: CSSProperties = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4 }
