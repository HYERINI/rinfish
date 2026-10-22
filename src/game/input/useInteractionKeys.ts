import { useEffect } from 'react'
import { isCookingSkipKey, resolveKeyAction } from '../logic/interaction'
import { finishCooking } from '../scene/cooking/finishCooking'
import { useFishingStore } from '../stores/fishingStore'
import { useProgressStore } from '../stores/progressStore'
import { useSessionStore } from '../stores/sessionStore'

export function useInteractionKeys() {
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.repeat) return // 꾹 누르고 있을 때 반복 입력 무시
      const session = useSessionStore.getState()
      // 요리 연출 건너뛰기. 같은 Space 가 점프로 이어지지 않게 막는다 (usePlayerActionKeys 가 defaultPrevented 를 본다)
      if (session.cooking && isCookingSkipKey(e.code)) {
        e.preventDefault()
        finishCooking()
        return
      }
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
        case 'selectBait':
          useProgressStore.getState().selectBait(action.bait)
          break
        case 'none':
          break
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])
}
