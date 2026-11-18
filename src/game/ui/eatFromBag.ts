import { ITEMS } from '../data/meadowItems'
import { SNACKS } from '../data/snacks'
import { pressEat } from '../input/usePlayerActionKeys'
import { bagFoodFill, type BagFood } from '../logic/inventory'
import { playerGround } from '../scene/playerGround'
import { useProgressStore } from '../stores/progressStore'
import { useSessionStore } from '../stores/sessionStore'

/** 가방 음식 이름 (은지 요리·간식) */
export function bagFoodName(id: BagFood): string {
  return SNACKS.find((s) => s.id === id)?.name ?? ITEMS[id as keyof typeof ITEMS].name
}

/** 먹었다는 알림을 띄우고 창을 닫고 캐릭터가 먹는 모습을 보여 준다 */
function ate(id: BagFood) {
  const { heal, hunger } = bagFoodFill(id)
  const session = useSessionStore.getState()
  session.notify(`냠냠! ${bagFoodName(id)} · 배고픔 +${hunger} · 체력 +${heal}`)
  if (session.mode !== 'explore') session.setMode('explore')
  pressEat(id)
}

/**
 * 먹는 모습을 시작할 수 있나: 이미 먹는 중이 아니고 땅에 서 있다 (nextAction 과 같은 조건).
 * 아니면 F·가방 먹기를 무시한다 (음식만 사라지거나 연달아 눌러 낭비하지 않게)
 */
function canStartEating(): boolean {
  const action = useSessionStore.getState().playerAction
  return !action.eat && !action.airborne && playerGround.grounded
}

/** 가방에서 골라 먹기. 없거나 지금 먹을 수 없으면 false */
export function eatFromBagNow(id: BagFood): boolean {
  if (!canStartEating()) return false
  if (!useProgressStore.getState().eatFromBag(id)) return false
  ate(id)
  return true
}

/** F: 배고픔을 가장 많이 채우는 것부터 먹는다. 먹을 게 없으면 알림만 */
export function eatBestNow() {
  if (!canStartEating()) return
  const id = useProgressStore.getState().eatBest()
  if (id) ate(id)
  else useSessionStore.getState().notify('먹을 음식이 없어요. 가스레인지에서 요리하거나 미스터찜에서 사 와요')
}
