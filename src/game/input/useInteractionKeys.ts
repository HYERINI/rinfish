import { useEffect } from 'react'
import { isCookingSkipKey, resolveKeyAction } from '../logic/interaction'
import { harvest, toggleDoor } from '../../meadow/meadowActions'
import { toggleRangeGame } from '../../meadow/rangeActions'
import { pickLoot } from '../hunt/huntActions'
import { enterMine, leaveMine, requestPick } from '../mine/mineActions'
import { pressReload } from './pointer'
import { finishCooking } from '../scene/cooking/finishCooking'
import { startSleep, wake } from '../scene/day/dayActions'
import { useFishingStore } from '../stores/fishingStore'
import { useProgressStore } from '../stores/progressStore'
import { useSessionStore } from '../stores/sessionStore'
import { eatBestNow } from '../ui/eatFromBag'
import { escHandledByUnlock } from './pointerLock'
import { isTypingTarget } from './typing'

export function useInteractionKeys() {
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.repeat) return // 꾹 누르고 있을 때 반복 입력 무시
      if (e.defaultPrevented) return // 먼저 쓴 곳이 있다 (T 바퀴의 숫자 키)
      if (isTypingTarget(e.target)) return // 채팅 등 글자 입력 칸에서 누른 키
      if (e.code === 'Escape' && escHandledByUnlock()) return // 이 ESC 로 마우스 잠금이 풀리며 메뉴가 이미 열렸다
      const session = useSessionStore.getState()
      // 요리 연출 건너뛰기. 같은 Space 가 점프로 이어지지 않게 막는다 (usePlayerActionKeys 가 defaultPrevented 를 본다)
      if (session.cooking && isCookingSkipKey(e.code)) {
        e.preventDefault()
        finishCooking()
        return
      }
      // Tab 으로 지도를 열고 닫을 땐 포커스가 다른 버튼으로 넘어가지 않게 막는다
      if (runKeyAction(e.code) && e.code === 'Tab') e.preventDefault()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])
}

/**
 * 키 하나(e.code)를 누른 것처럼 처리한다. 키보드와 터치 버튼(상호작용 = KeyE, 메뉴·그만하기 = Escape)이 같은 길로 온다.
 * 요리 연출 건너뛰기는 여기서 하지 않는다 (키보드는 위에서, 터치는 화면을 눌러서). 무언가 했으면 true
 */
export function runKeyAction(code: string): boolean {
  const session = useSessionStore.getState()
  const action = resolveKeyAction(code, session.mode, session.nearby, session.mode === 'wardrobe' && !useProgressStore.getState().look)
  switch (action.type) {
    case 'startFishing':
      // 다른 도구를 들고 있어도 물가에서 E 를 누르면 저절로 낚싯대로 바꿔 시작한다
      session.equip('rod')
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
    case 'boardBoat':
      session.startBoat(action.dir)
      break
    case 'sleep':
      startSleep()
      break
    case 'wake':
      wake()
      break
    case 'equip':
      session.equip(action.tool)
      break
    case 'openVendor':
      session.openVendor(action.id)
      break
    case 'toggleDoor':
      toggleDoor(action.index)
      break
    case 'harvest':
      harvest(action.index)
      break
    case 'pickLoot':
      pickLoot(action.key)
      break
    case 'enterMine':
      enterMine()
      break
    case 'leaveMine':
      leaveMine()
      break
    case 'mineOre':
      requestPick(action.index)
      break
    case 'eatBest':
      eatBestNow()
      break
    case 'reload':
      pressReload()
      break
    case 'toggleView':
      session.toggleView()
      break
    case 'rangeGame':
      toggleRangeGame()
      break
    case 'toggleMap':
      if (session.mode === 'map') session.closeMap()
      else session.openMap()
      break
    case 'none':
      return false
  }
  return true
}
