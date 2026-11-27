import { useEffect, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'

/** 직전 프레임에 그린 양. 브라우저 콘솔에 __render 라고 치면 보인다 (개발 모드, 또는 배포 주소에 ?probe 를 붙였을 때) */
export type RenderStats = { calls: number; triangles: number; lines: number; geometries: number; textures: number }

declare global {
  interface Window {
    __render?: RenderStats
  }
}

/** 화면 글자를 고치는 간격(초). 매 프레임 고치면 숫자가 떨려 읽을 수 없다 */
const PANEL_EVERY = 0.5

/**
 * 그리기 측정 (개발 모드이거나 주소에 ?probe 가 있을 때만 붙인다): 직전 프레임의 드로우 콜·삼각형 수와 GPU 에 올라가 있는 형상·텍스처 수를 window.__render 에 적는다.
 * useFrame 은 그리기 전에 돌아서, 이때 읽는 renderer.info 는 직전 프레임 것이다.
 * panel 이 켜지면 화면 위쪽 가운데에 fps 와 함께 작은 글자로도 띄운다 (0.5초마다 고친다. 눌리지 않는다)
 */
export function RenderProbe({ panel = false }: { panel?: boolean }) {
  const gl = useThree((s) => s.gl)
  const box = useRef<HTMLDivElement | null>(null)
  const frames = useRef(0)
  const since = useRef(0)

  useEffect(() => {
    if (!panel) return
    const el = document.createElement('div')
    el.style.cssText =
      'position:fixed;top:6px;left:50%;transform:translateX(-50%);z-index:9999;pointer-events:none;' +
      'padding:4px 10px;border-radius:6px;background:rgba(0,0,0,0.6);color:#d7ffd7;' +
      'font:12px/1.4 ui-monospace,Consolas,monospace;white-space:nowrap'
    document.body.appendChild(el)
    box.current = el
    return () => {
      el.remove()
      box.current = null
    }
  }, [panel])

  useFrame(() => {
    const { render, memory } = gl.info
    const out = (window.__render ??= { calls: 0, triangles: 0, lines: 0, geometries: 0, textures: 0 })
    out.calls = render.calls
    out.triangles = render.triangles
    out.lines = render.lines
    out.geometries = memory.geometries
    out.textures = memory.textures

    const el = box.current
    if (!el) return
    const now = performance.now() / 1000
    frames.current++
    if (since.current === 0) since.current = now
    const dt = now - since.current
    if (dt < PANEL_EVERY) return
    const fps = Math.round(frames.current / dt)
    frames.current = 0
    since.current = now
    el.textContent = `${fps} fps · 드로우 콜 ${out.calls} · 삼각형 ${out.triangles.toLocaleString()} · 형상 ${out.geometries} · 텍스처 ${out.textures}`
  })
  return null
}
