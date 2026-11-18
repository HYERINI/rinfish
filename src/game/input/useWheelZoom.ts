import { useEffect, type RefObject } from 'react'
import { GUNS } from '../data/guns'
import { gunRig } from '../guns/gunRig'
import { canZoom } from '../logic/cameraZoom'
import { stepZoom } from '../logic/view'
import { useSessionStore } from '../stores/sessionStore'

/**
 * 캔버스 위 마우스 휠 → 카메라 줌. 소총·저격총으로 조준하는 동안엔 조준경 배율 단계 (은지는 우클릭 두 번).
 * 페이지가 같이 스크롤되지 않게 기본 동작을 막는다 (passive: false 필요)
 */
export function useWheelZoom(target: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const el = target.current
    if (!el) return
    const onWheel = (e: WheelEvent) => {
      const session = useSessionStore.getState()
      if (!canZoom(session.mode)) return
      e.preventDefault()
      const gun = gunRig.aiming ? gunRig.gun : null
      const zoom = gun && GUNS[gun].zoom
      if (gun && zoom) gunRig.zoomStep[gun] = stepZoom(gunRig.zoomStep[gun], zoom.length, e.deltaY)
      else session.zoomBy(e.deltaY)
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [target])
}
