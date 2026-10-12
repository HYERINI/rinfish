import { useEffect } from 'react'

// 지금 눌려 있는 키 목록. useFrame 안에서 리렌더 없이 읽는다
const pressed = new Set<string>()

/** e.code 기준 ('KeyW', 'KeyE', 'Escape' …) */
export function isKeyDown(code: string): boolean {
  return pressed.has(code)
}

export function useKeyboardTracking() {
  useEffect(() => {
    const down = (e: KeyboardEvent) => pressed.add(e.code)
    const up = (e: KeyboardEvent) => pressed.delete(e.code)
    // 창 밖으로 포커스가 나가면 keyup을 못 받으니 전부 뗀 것으로 처리
    const clear = () => pressed.clear()
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    window.addEventListener('blur', clear)
    return () => {
      window.removeEventListener('keydown', down)
      window.removeEventListener('keyup', up)
      window.removeEventListener('blur', clear)
    }
  }, [])
}
