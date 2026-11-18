import { ITEMS, getRecipe, type MeadowDishId } from '../game/data/meadowItems'
import { useProgressStore } from '../game/stores/progressStore'
import { useSessionStore } from '../game/stores/sessionStore'
import { harvestPickup } from './meadowSingleton'

/** E 로 버섯·호박 따기 → 가방 */
export function harvest(index: number) {
  const item = harvestPickup(index)
  if (!item) return
  const progress = useProgressStore.getState()
  progress.addItem(item)
  const { icon, name } = ITEMS[item]
  useSessionStore.getState().notify(`${icon} ${name} 획득 (${useProgressStore.getState().items[item]}개)`)
}

/**
 * 가스레인지 요리 시작 (가스레인지 앞에서 연 가방의 "요리하기"). 재료를 빼고 창을 닫는다. 요리 중이거나 재료가 모자라면 false.
 * now: performance.now() 초
 */
export function startStoveCook(recipe: MeadowDishId, now = performance.now() / 1000): boolean {
  const session = useSessionStore.getState()
  if (session.stoveCook || session.nearby?.kind !== 'stove') return false
  if (!useProgressStore.getState().startRecipe(recipe)) return false
  session.setStoveCook({ recipe, startedAt: now })
  session.setMode('explore')
  return true
}

/** 요리가 끝나기까지 남은 초 (요리 중이 아니면 null) */
export function stoveCookLeft(now: number): number | null {
  const cook = useSessionStore.getState().stoveCook
  return cook ? Math.max(0, getRecipe(cook.recipe).time - (now - cook.startedAt)) : null
}

/** 매 프레임: 요리 시간이 다 되면 가방에 넣고 알린다 */
export function stepStoveCook(now: number) {
  const session = useSessionStore.getState()
  const cook = session.stoveCook
  if (!cook || (stoveCookLeft(now) ?? 1) > 0) return
  const recipe = getRecipe(cook.recipe)
  useProgressStore.getState().addItem(recipe.result)
  session.setStoveCook(null)
  session.notify(`${ITEMS[recipe.result].icon} ${recipe.name} 완성! 가방에 넣었어요 (F 로 먹기)`)
}

/** 문 여닫기 (상태는 저장되고, MeadowDoors 가 문짝을 돌리고 충돌 상자를 바꾼다) */
export function toggleDoor(index: number) {
  const progress = useProgressStore.getState()
  progress.setDoorOpen(index, !progress.doors[index])
}
