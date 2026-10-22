import { useEffect } from 'react'
import { ACTION_KEYS, EMOTES, type EmoteId } from '../data/emotes'
import { useSessionStore } from '../stores/sessionStore'
import { isKeyDown } from './keys'

// 지난 프레임 뒤로 새로 누른 점프·감정 표현 키. Player 가 매 프레임 가져가며 비운다
let jumpPressed = false
let emotePressed: EmoteId | null = null

/** 새로 누른 점프·감정 표현 키를 가져가고 비운다. 쓸지 말지(모드·공중 등)는 nextAction 이 정한다 */
export function takeActionPresses(): { jumpPressed: boolean; emotePressed: EmoteId | null } {
  const presses = { jumpPressed, emotePressed }
  jumpPressed = false
  emotePressed = null
  return presses
}

/** Shift 를 누르고 있다 */
export function isSprintHeld(): boolean {
  return ACTION_KEYS.sprint.some(isKeyDown)
}

/** Space·숫자 키 → 점프·감정 표현. 꾹 누르고 있을 때 반복 입력은 무시한다 */
export function usePlayerActionKeys() {
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.repeat) return
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
