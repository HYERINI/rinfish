import { useEffect, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { moveLatency, netStats, sendRate } from '../../net/netStats'
import { remoteRig } from '../../net/remoteRig'
import { useNetStore } from '../../stores/netStore'

/** 직전 프레임에 그린 양. 브라우저 콘솔에 __render 라고 치면 보인다 (개발 모드, 또는 배포 주소에 ?probe 를 붙였을 때) */
export type RenderStats = { calls: number; triangles: number; lines: number; geometries: number; textures: number }

declare global {
  interface Window {
    __render?: RenderStats
  }
}

const ms = (sec: number) => `${Math.round(sec * 1000)}ms`

/**
 * 같이 하는 중이면 통신 지연 한 줄: 서버 왕복 시간, 내가 모습을 보내는 빠르기, 다른 사람을 늦게 그리는 시간(평균),
 * 그리고 셋을 더한 "남의 움직임이 내 화면에 보이기까지" 어림. 서버가 ping 에 답하지 않으면(옛 서버) 왕복 시간은 모른다
 */
function netLine(): string {
  if (useNetStore.getState().phase !== 'online') return ''
  let sum = 0
  for (const e of remoteRig.values()) sum += e.delay
  const draw = remoteRig.size ? sum / remoteRig.size : null
  const total = draw === null ? null : moveLatency(draw)
  const parts = [netStats.rtt === null ? '왕복 ?' : `왕복 ${ms(netStats.rtt)}`, `보내기 ${sendRate()}/초`]
  if (draw !== null) parts.push(`늦게 그리기 ${ms(draw)}`)
  if (total !== null) parts.push(`움직임 지연 약 ${ms(total)}`)
  return ` · ${parts.join(' · ')}`
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
    el.textContent = `${fps} fps · 드로우 콜 ${out.calls} · 삼각형 ${out.triangles.toLocaleString()} · 형상 ${out.geometries} · 텍스처 ${out.textures}${netLine()}`
  })
  return null
}
