import { useEffect, type RefObject } from 'react'
import { canZoom } from '../logic/cameraZoom'
import { useSessionStore } from '../stores/sessionStore'

/** 캔버스 위 마우스 휠 → 카메라 줌. 페이지가 같이 스크롤되지 않게 기본 동작을 막는다 (passive: false 필요) */
export function useWheelZoom(target: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const el = target.current
    if (!el) return
    const onWheel = (e: WheelEvent) => {
      const session = useSessionStore.getState()
      if (!canZoom(session.mode)) return
      e.preventDefault()
      session.zoomBy(e.deltaY)
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [target])
}
