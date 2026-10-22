import { useEffect } from 'react'
import { isCookingSkipKey, resolveKeyAction } from '../logic/interaction'
import { finishCooking } from '../scene/cooking/finishCooking'
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
      // 요리 연출 건너뛰기. 같은 Space 가 점프로 이어지지 않게 막는다 (usePlayerActionKeys 가 defaultPrevented 를 본다)
      if (session.cooking && isCookingSkipKey(e.code)) {
        e.preventDefault()
        finishCooking()
        return
      }
      runKeyAction(e.code)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])
}

/**
 * 키 하나(e.code)를 누른 것처럼 처리한다. 키보드와 터치 버튼(상호작용 = KeyE, 메뉴·그만하기 = Escape)이 같은 길로 온다.
 * 요리 연출 건너뛰기는 여기서 하지 않는다 (키보드는 위에서, 터치는 화면을 눌러서)
 */
export function runKeyAction(code: string) {
  const session = useSessionStore.getState()
  const action = resolveKeyAction(code, session.mode, session.nearby, session.mode === 'wardrobe' && !useProgressStore.getState().look)
  switch (action.type) {
    case 'startFishing':
      useFishingStore.getState().begin(action.spot)
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
