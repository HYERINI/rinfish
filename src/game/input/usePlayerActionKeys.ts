import { useEffect } from 'react'
import { ACTION_KEYS, EMOTES, type EmoteId } from '../data/emotes'
import type { FoodId } from '../data/types'
import { useSessionStore } from '../stores/sessionStore'
import { isKeyDown } from './keys'

// 지난 프레임 뒤로 새로 누른 점프·감정 표현 키. Player 가 매 프레임 가져가며 비운다
let jumpPressed = false
let emotePressed: EmoteId | null = null
let eatPressed: FoodId | null = null

/** 새로 누른 점프·감정 표현 키(와 먹기 시작)를 가져가고 비운다. 쓸지 말지(모드·공중 등)는 nextAction 이 정한다 */
export function takeActionPresses(): { jumpPressed: boolean; emotePressed: EmoteId | null; eatPressed: FoodId | null } {
  const presses = { jumpPressed, emotePressed, eatPressed }
  jumpPressed = false
  emotePressed = null
  eatPressed = null
  return presses
}

/** 음식을 먹기 시작한다 (미스터찜에서 먹기·HUD 간식을 누른 뒤). 다음 프레임에 Player 가 가져간다 */
export function pressEat(dish: FoodId) {
  eatPressed = dish
}

/** 점프 (터치 점프 버튼). Space 와 같다 */
export function pressJump() {
  jumpPressed = true
}

/** 감정 표현 (터치 감정 표현 메뉴). 숫자 키와 같다 */
export function pressEmote(id: EmoteId) {
  emotePressed = id
}

/** Shift 를 누르고 있다 */
export function isSprintHeld(): boolean {
  return ACTION_KEYS.sprint.some(isKeyDown)
}

/** 글자를 치는 칸(입력창·여러 줄 입력·선택 상자·편집 가능한 요소)에서 누른 키인가 */
function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  return target.isContentEditable || target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement
}

/** Space·숫자 키 → 점프·감정 표현. 꾹 누르고 있을 때 반복 입력과 글자 입력 칸에서 누른 키는 무시한다 */
export function usePlayerActionKeys() {
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.repeat || e.defaultPrevented || isTypingTarget(e.target)) return
      if (e.code === ACTION_KEYS.jump) {
        // 탐험 중엔 포커스가 남은 버튼이 Space 로 눌리거나 페이지가 스크롤되지 않게 막는다 (패널에선 그대로 둔다)
        if (useSessionStore.getState().mode === 'explore') e.preventDefault()
        jumpPressed = true
        return
      }
      const emote = EMOTES.find((em) => em.key === e.code)
      if (emote) emotePressed = emote.id
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])
}
