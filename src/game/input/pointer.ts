import { useEffect } from 'react'
import type { FishingInput } from '../logic/fishingSession'

const pointer = { down: false, pressed: false }

/** 캔버스 영역에서 마우스를 눌렀을 때 호출 (UI 버튼 클릭은 여기로 오지 않는다) */
export function pressPointer(e: { button: number }) {
  // 우클릭·휠 클릭은 입력으로 보지 않는다 (컨텍스트 메뉴가 pointerup을 삼켜 입력이 고착될 수 있다)
  if (e.button !== 0) return
  pointer.down = true
  pointer.pressed = true
}

export function isPointerDown(): boolean {
  return pointer.down
}

/** 현재 입력을 읽고 '이번에 새로 눌림' 신호를 비운다. 매 프레임 한 번만 호출 */
export function readPointer(): FishingInput {
  const input = { pointerDown: pointer.down, pressed: pointer.pressed }
  pointer.pressed = false
  return input
}

export function usePointerRelease() {
  useEffect(() => {
    const release = () => {
      pointer.down = false
    }
    window.addEventListener('pointerup', release)
    window.addEventListener('pointercancel', release)
    window.addEventListener('blur', release)
    return () => {
      window.removeEventListener('pointerup', release)
      window.removeEventListener('pointercancel', release)
      window.removeEventListener('blur', release)
    }
  }, [])
}
