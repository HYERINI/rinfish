import { pressEat } from '../../input/usePlayerActionKeys'
import { useSessionStore } from '../../stores/sessionStore'

/** 요리 연출 끝 (다 봤거나 건너뛰었다): 탐험으로 돌아와 바로 먹는 동작 */
export function finishCooking() {
  const session = useSessionStore.getState()
  const cooking = session.cooking
  if (!cooking) return
  session.endCooking()
  pressEat(cooking.dish)
}

/** 요리 연출이 시작된 뒤 지난 시간(초). 연출 중이 아니면 null */
export function cookingTime(): number | null {
  const c = useSessionStore.getState().cooking
  return c ? performance.now() / 1000 - c.startedAt : null
}
