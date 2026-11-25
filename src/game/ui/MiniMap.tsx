import { useEffect, useRef, type CSSProperties } from 'react'
import { MEADOW_DOCK, MEADOW_RECT, areaToWorld, type Rect } from '../data/meadow'
import { MINE_ENTRANCE } from '../data/mine'
import { ISLAND_RADIUS, ZONES } from '../data/zones'
import { MAP_BOUNDS, MAP_PX_PER_M, fitBigMap, mapPixel, miniMapPoint } from '../logic/mapView'
import { remoteRig } from '../net/remoteRig'
import { playerRig } from '../scene/Player'
import { useSessionStore } from '../stores/sessionStore'
import { useMediaQuery, useTouchUi } from '../input/touchDevice'
import { ANIMAL_ZONE, YARD } from '../../meadow/vendor/outdoor.js'
import { TOWN_LAYOUT } from '../../meadow/vendor/town.js'
import { ROOMS } from '../../meadow/vendor/world.js'
import { safeRight, safeTop } from './styles'
import { useNarrow } from './useNarrow'

/** 미니맵이 보여 주는 반경(m)과 다시 그리는 간격(초, 10fps) */
const VIEW_RADIUS = 40
const REDRAW = 0.1

const SEA = '#3b8fd1'
const SAND = '#e9d8a6'

/** 정적 지도: 바다·초원·마당·동물 들판·마을·집·선착장·섬. 한 번만 그린다 */
function drawStatic(): HTMLCanvasElement {
  const c = document.createElement('canvas')
  c.width = (MAP_BOUNDS.x1 - MAP_BOUNDS.x0) * MAP_PX_PER_M
  c.height = (MAP_BOUNDS.z1 - MAP_BOUNDS.z0) * MAP_PX_PER_M
  const g = c.getContext('2d')!
  const rect = (r: Rect, color: string) => {
    const [x, y] = mapPixel(r.x0, r.z0)
    g.fillStyle = color
    g.fillRect(x, y, (r.x1 - r.x0) * MAP_PX_PER_M, (r.z1 - r.z0) * MAP_PX_PER_M)
  }
  g.fillStyle = SEA
  g.fillRect(0, 0, c.width, c.height)
  // 초원
  rect(MEADOW_RECT, SAND)
  rect({ x0: MEADOW_RECT.x0 + 4, x1: MEADOW_RECT.x1 - 4, z0: MEADOW_RECT.z0 + 4, z1: MEADOW_RECT.z1 - 4 }, '#7fb15a')
  rect(areaToWorld(ANIMAL_ZONE), '#9cc76f')
  rect(areaToWorld(YARD), '#a6d07a')
  rect(areaToWorld(TOWN_LAYOUT.square), '#c9bfae')
  for (const room of ROOMS) rect(areaToWorld(room), '#efe6d6')
  rect(MEADOW_DOCK, '#a1887f')
  // 섬: 모래 원 + 북쪽 반원 풀밭 + 구역 색 점
  const [ix, iy] = mapPixel(0, 0)
  g.fillStyle = SAND
  g.beginPath()
  g.arc(ix, iy, ISLAND_RADIUS * MAP_PX_PER_M, 0, Math.PI * 2)
  g.fill()
  g.fillStyle = '#9ccc65'
  g.beginPath()
  g.arc(ix, iy, (ISLAND_RADIUS - 0.1) * MAP_PX_PER_M, Math.PI, Math.PI * 2)
  g.fill()
  rect({ x0: -1.7, x1: 1.7, z0: 20.8, z1: 30 }, '#a1887f')
  for (const z of ZONES) {
    if (!z.gate) continue
    const [gx, gy] = mapPixel((z.gate.xFrom + z.gate.xTo) / 2, -10)
    g.fillStyle = z.color
    g.beginPath()
    g.arc(gx, gy, 6 * MAP_PX_PER_M, 0, Math.PI * 2)
    g.fill()
  }
  return c
}

/** 내 화살표 (바라보는 쪽 = angle, 캔버스 각도) */
function arrow(g: CanvasRenderingContext2D, x: number, y: number, angle: number, size: number) {
  g.save()
  g.translate(x, y)
  g.rotate(angle)
  g.fillStyle = '#ff5252'
  g.strokeStyle = '#fff'
  g.lineWidth = 1.5
  g.beginPath()
  g.moveTo(0, -size)
  g.lineTo(size * 0.7, size * 0.8)
  g.lineTo(0, size * 0.4)
  g.lineTo(-size * 0.7, size * 0.8)
  g.closePath()
  g.fill()
  g.stroke()
  g.restore()
}

/** 광산 입구 표시: 어두운 동그라미에 곡괭이. 지도가 돌아도 똑바로 서 있게 정적 지도가 아니라 매번 위에 그린다 */
function mineMark(g: CanvasRenderingContext2D, x: number, y: number, size: number) {
  g.fillStyle = '#4e4a45'
  g.strokeStyle = '#ffd23f'
  g.lineWidth = Math.max(1.5, size * 0.18)
  g.beginPath()
  g.arc(x, y, size, 0, Math.PI * 2)
  g.fill()
  g.stroke()
  g.font = `${Math.round(size * 1.25)}px sans-serif`
  g.textAlign = 'center'
  g.textBaseline = 'middle'
  g.fillStyle = '#fff'
  g.fillText('⛏', x, y + size * 0.08)
}

/** 같이 하는 사람들 마지막 위치 [x, z] */
function peers(): [number, number][] {
  const out: [number, number][] = []
  for (const e of remoteRig.values()) {
    const p = e.buf.at(-1)?.s.p
    if (p) out.push([p[0], p[2]])
  }
  return out
}

/**
 * 오른쪽 위 둥근 미니맵: 내 주변 40m 를 카메라가 보는 쪽이 위로 오게 돌려 그린다. 누르면 큰 지도(위 = 북, 고정, mode 'map').
 * 정적 지도는 한 번만 그리고 10fps 로 다시 그린다
 */
export function MiniMap() {
  const mode = useSessionStore((s) => s.mode)
  const narrowScreen = useNarrow()
  const touchUi = useTouchUi()
  const narrow = narrowScreen || touchUi
  // 폰 가로 화면은 키가 낮아(390) 188 에 두면 점프 버튼·상호작용 버튼과 겹친다: 위 버튼 줄과 방 표시(52) 바로 아래로
  const portrait = useMediaQuery('(orientation: portrait)')
  const top = touchUi && narrowScreen && !portrait ? 88 : narrow ? 188 : 140
  // 큰 지도는 모드로 연다 (열린 동안 이동·E 가 막히고 ESC 로 닫힌다. 메뉴의 지도 버튼도 같은 길)
  const big = mode === 'map'
  const { openMap, closeMap } = useSessionStore.getState()
  const mini = useRef<HTMLCanvasElement>(null)
  const large = useRef<HTMLCanvasElement>(null)
  const size = narrow ? 110 : 140

  useEffect(() => {
    const map = drawStatic()
    let last = 0
    let raf = 0
    const tick = (ms: number) => {
      raf = requestAnimationFrame(tick)
      if (ms / 1000 - last < REDRAW) return
      last = ms / 1000
      const { x, z } = playerRig.position
      const c = mini.current
      if (c) {
        const g = c.getContext('2d')!
        const r = c.width / 2
        const k = r / VIEW_RADIUS // px/m
        g.clearRect(0, 0, c.width, c.height)
        g.save()
        g.beginPath()
        g.arc(r, r, r, 0, Math.PI * 2)
        g.clip()
        g.translate(r, r)
        g.rotate(playerRig.yaw)
        g.scale(k / MAP_PX_PER_M, k / MAP_PX_PER_M)
        const [px, py] = mapPixel(x, z)
        g.drawImage(map, -px, -py)
        g.restore()
        // 광산 입구: 미니맵 밖이면 그쪽 가장자리에 작게 붙여 방향을 알려 준다
        {
          const [sx, sy] = miniMapPoint(MINE_ENTRANCE.mound[0] - x, MINE_ENTRANCE.mound[1] - z, playerRig.yaw, k)
          const d = Math.hypot(sx, sy)
          const edge = r - 22
          const far = d > edge
          const f = far ? edge / d : 1
          mineMark(g, r + sx * f, r + sy * f, far ? 15 : 20)
        }
        for (const [qx, qz] of peers()) {
          const [sx, sy] = miniMapPoint(qx - x, qz - z, playerRig.yaw, k)
          if (Math.hypot(sx, sy) > r - 4) continue
          g.fillStyle = '#ffeb3b'
          g.beginPath()
          g.arc(r + sx, r + sy, 3.5, 0, Math.PI * 2)
          g.fill()
        }
        // 바라보는 쪽: facing(0 = +z)을 미니맵 화면 각도로
        const [fx, fy] = miniMapPoint(Math.sin(playerRig.facing), Math.cos(playerRig.facing), playerRig.yaw, 1)
        arrow(g, r, r, Math.atan2(fx, -fy), 7)
      }
      const L = large.current
      if (L) {
        const g = L.getContext('2d')!
        const f = fitBigMap(L.width, L.height)
        g.clearRect(0, 0, L.width, L.height)
        g.drawImage(map, f.ox, f.oy, (map.width / MAP_PX_PER_M) * f.scale, (map.height / MAP_PX_PER_M) * f.scale)
        const at = (wx: number, wz: number): [number, number] => [f.ox + (wx - MAP_BOUNDS.x0) * f.scale, f.oy + (wz - MAP_BOUNDS.z0) * f.scale]
        mineMark(g, ...at(MINE_ENTRANCE.mound[0], MINE_ENTRANCE.mound[1]), 17)
        for (const [qx, qz] of peers()) {
          const [sx, sy] = at(qx, qz)
          g.fillStyle = '#ffeb3b'
          g.beginPath()
          g.arc(sx, sy, 4, 0, Math.PI * 2)
          g.fill()
        }
        const [mx, my] = at(x, z)
        // 위 = 북(-z): facing 0(+z) 이 아래를 향하도록
        arrow(g, mx, my, Math.PI - playerRig.facing, 9)
      }
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [big])

  if (mode === 'cutscene' || mode === 'lobby' || mode === 'aquariumView' || mode === 'wardrobe') return null
  const box: CSSProperties = { position: 'absolute', top: safeTop(top), right: safeRight(16), width: size, height: size, borderRadius: '50%', border: '2px solid rgba(255,255,255,0.85)', boxShadow: '0 2px 6px rgba(0,0,0,0.4)', overflow: 'hidden', cursor: 'pointer', pointerEvents: 'auto', zIndex: 1000 }
  return (
    <>
      <canvas ref={mini} width={size * 2} height={size * 2} style={box} onClick={openMap} aria-label="미니맵 (누르면 큰 지도)" />
      {big && (
        <div onClick={closeMap} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1002, pointerEvents: 'auto' }}>
          <canvas ref={large} width={1360} height={880} style={{ width: 'min(92vw, 1100px, calc(86vh * 1360 / 880))', aspectRatio: '1360 / 880', borderRadius: 12, background: SEA }} aria-label="큰 지도 (누르면 닫기)" />
        </div>
      )}
    </>
  )
}
