import { useEffect } from 'react'
import { isTypingTarget } from './typing'

// 지금 눌려 있는 키 목록. useFrame 안에서 리렌더 없이 읽는다
const pressed = new Set<string>()

/** e.code 기준 ('KeyW', 'KeyE', 'Escape' …) */
export function isKeyDown(code: string): boolean {
  return pressed.has(code)
}

export function useKeyboardTracking() {
  useEffect(() => {
    // 글자 입력 칸(채팅 등)에서 누른 키는 이동 키로 치지 않는다
    const down = (e: KeyboardEvent) => {
      if (!isTypingTarget(e.target)) pressed.add(e.code)
    }
    // 입력 칸으로 들어가는 순간 누르고 있던 이동 키를 뗀다 (keyup 이 입력 칸으로 가도 멈추게)
    const focusIn = (e: FocusEvent) => {
      if (isTypingTarget(e.target)) pressed.clear()
    }
    const up = (e: KeyboardEvent) => pressed.delete(e.code)
    // 창 밖으로 포커스가 나가면 keyup을 못 받으니 전부 뗀 것으로 처리
    const clear = () => pressed.clear()
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    window.addEventListener('blur', clear)
    window.addEventListener('focusin', focusIn)
    return () => {
      window.removeEventListener('focusin', focusIn)
      window.removeEventListener('keydown', down)
      window.removeEventListener('keyup', up)
      window.removeEventListener('blur', clear)
    }
  }, [])
}
