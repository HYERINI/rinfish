import { useEffect } from 'react'
import { resolveKeyAction } from '../logic/interaction'
import { useFishingStore } from '../stores/fishingStore'
import { useProgressStore } from '../stores/progressStore'
import { useSessionStore } from '../stores/sessionStore'
import { escHandledByUnlock } from './pointerLock'

export function useInteractionKeys() {
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.repeat) return // 꾹 누르고 있을 때 반복 입력 무시
      if (e.code === 'Escape' && escHandledByUnlock()) return // 이 ESC 로 마우스 잠금이 풀리며 메뉴가 이미 열렸다
      const session = useSessionStore.getState()
      const action = resolveKeyAction(e.code, session.mode, session.nearby, session.mode === 'wardrobe' && !useProgressStore.getState().look)
      switch (action.type) {
        case 'startFishing':
          useFishingStore.getState().begin(action.spotId)
          session.setMode('fishing')
          break
        case 'openMode':
          session.setMode(action.mode)
          break
        case 'stopFishing':
          useFishingStore.getState().end()
          session.setMode('explore')
          break
        case 'closePanel':
          session.setMode('explore')
          break
        case 'none':
          break
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])
}
