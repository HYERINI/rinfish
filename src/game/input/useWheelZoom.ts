import { useEffect, type RefObject } from 'react'
import { GUNS } from '../data/guns'
import { gunRig } from '../guns/gunRig'
import { canZoom } from '../logic/cameraZoom'
import { stepZoom } from '../logic/view'
import { WHEEL_IDLE, wheelStep, wheelTool, type WheelState } from '../logic/wheelTool'
import { useSessionStore } from '../stores/sessionStore'

/** - · = 키 한 번에 줌할 양 (휠 deltaY 로 친다) */
const KEY_ZOOM = 120

/**
 * 캔버스 위 마우스 휠.
 * - 돌아다닐 때: 무기(도구 칸) 바꾸기. 카메라 줌은 Shift+휠 또는 - · = 키 (은지와 같다)
 * - 소총·저격총으로 조준하는 동안: 조준경 배율 단계
 * - 낚시·벤치·배: 카메라 줌 (바꿀 무기가 없다)
 * 페이지가 같이 스크롤되지 않게 기본 동작을 막는다 (passive: false 필요)
 */
export function useWheelZoom(target: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const el = target.current
    if (!el) return
    let wheel: WheelState = WHEEL_IDLE
    const onWheel = (e: WheelEvent) => {
      const session = useSessionStore.getState()
      if (!canZoom(session.mode)) return
      e.preventDefault()
      const gun = gunRig.aiming ? gunRig.gun : null
      const zoom = gun && GUNS[gun].zoom
      if (gun && zoom) {
        gunRig.zoomStep[gun] = stepZoom(gunRig.zoomStep[gun], zoom.length, e.deltaY)
        return
      }
      // Shift 를 누르면 브라우저가 세로 휠을 가로(deltaX)로 바꿔 주기도 한다
      const dy = e.deltaY || e.deltaX
      if (session.mode !== 'explore' || e.shiftKey) {
        session.zoomBy(dy)
        return
      }
      const r = wheelStep(wheel, e.deltaY, performance.now() / 1000)
      wheel = r.state
      if (r.step !== 0) session.equip(wheelTool(session.tool, r.step))
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.code !== 'Minus' && e.code !== 'Equal') return
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      const session = useSessionStore.getState()
      if (!canZoom(session.mode)) return
      session.zoomBy(e.code === 'Minus' ? KEY_ZOOM : -KEY_ZOOM)
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    window.addEventListener('keydown', onKey)
    return () => {
      el.removeEventListener('wheel', onWheel)
      window.removeEventListener('keydown', onKey)
    }
  }, [target])
}
