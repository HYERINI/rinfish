import { useEffect, type RefObject } from 'react'
import { create } from 'zustand'
import { canLockPointer, shouldOpenMenuOnUnlock } from '../logic/mouseLook'
import { useSessionStore } from '../stores/sessionStore'

/**
 * 마우스 잠금(Pointer Lock): 탐험 중 캔버스를 클릭하면 커서를 숨기고 잠가서, 마우스를 움직이는 만큼 시점이 돈다 (Player 가 읽는다).
 * - 패널·낚시·꾸미기 등 탐험이 아닌 화면이 되면 게임이 바로 풀어 준다 (커서가 필요하다)
 * - 잠긴 동안 ESC 는 브라우저가 가져가 잠금만 푼다. 그래서 탐험 중 저절로 풀리면 메뉴를 연다 (ESC 한 번 = 메뉴)
 * - 터치 기기·잠금을 못 쓰는 환경(잠금을 허락하지 않은 iframe 등)에선 예전처럼 드래그로 돌린다
 */
export const usePointerLockStore = create<{ locked: boolean }>(() => ({ locked: false }))

export function isPointerLocked(): boolean {
  return usePointerLockStore.getState().locked
}

/** 마우스로 시점 돌리기를 쓸 수 있는 환경 (잠금 API 가 있고 마우스처럼 정밀한 포인터가 있다) */
export function canUseMouseLook(): boolean {
  if (typeof document === 'undefined' || !('exitPointerLock' in document)) return false
  return typeof matchMedia !== 'function' || matchMedia('(any-pointer: fine)').matches
}

/** 잠금을 풀며 메뉴를 연 직후 들어오는 ESC 는 무시한다 (그 ESC 로 메뉴가 바로 닫히지 않게) */
const ESC_GRACE_MS = 200
let escHandledAt = -Infinity

export function escHandledByUnlock(): boolean {
  return performance.now() - escHandledAt < ESC_GRACE_MS
}

export function usePointerLock(target: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const el = target.current
    if (!el || !canUseMouseLook()) return
    /** 게임이 직접 푸는 중 (메뉴를 열지 않는다) */
    let releasedByGame = false

    const release = () => {
      if (document.pointerLockElement !== el) return
      releasedByGame = true
      document.exitPointerLock()
    }

    const onPointerDown = (e: PointerEvent) => {
      if (e.button !== 0 || e.pointerType !== 'mouse' || document.pointerLockElement === el) return
      if (!canLockPointer(useSessionStore.getState().mode)) return
      try {
        // 최신 브라우저는 Promise 를 돌려준다. 실패해도(ESC 직후 잠시 잠금 금지 등) 드래그로 돌릴 수 있다
        const result = el.requestPointerLock() as unknown
        if (result instanceof Promise) result.catch(() => {})
      } catch {
        // 잠금을 못 쓰는 환경
      }
    }

    const onChange = () => {
      const locked = document.pointerLockElement === el
      usePointerLockStore.setState({ locked })
      if (!locked) {
        const session = useSessionStore.getState()
        if (shouldOpenMenuOnUnlock(session.mode, releasedByGame)) {
          escHandledAt = performance.now()
          session.setMode('menu')
        }
        releasedByGame = false
      }
    }

    el.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('pointerlockchange', onChange)
    const unsubMode = useSessionStore.subscribe((s) => {
      if (!canLockPointer(s.mode)) release()
    })
    return () => {
      el.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('pointerlockchange', onChange)
      unsubMode()
      release()
      usePointerLockStore.setState({ locked: false })
    }
  }, [target])
}
