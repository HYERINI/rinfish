import { useCallback } from 'react'
import { create } from 'zustand'

/** 왼쪽 위 코인·체력 칸 오른쪽 끝(16 + 200) + 사이 16. 목표 띠는 이보다 오른쪽에 둔다 */
export const GOAL_HUD_LEFT_END = 232
/** 목표 띠와 오른쪽 위 버튼 줄 사이 */
export const GOAL_ROW_GAP = 12
/** 목표 띠 폭: 넓으면 400, 이보다 좁아지면 버튼 줄 아래로 내린다 */
export const GOAL_MAX_WIDTH = 400
export const GOAL_MIN_WIDTH = 220
/** 버튼 줄 폭을 아직 못 쟀을 때 (🔊·가방 (I)·어항 구경·도감·메뉴 (ESC) 쯤) */
const ROW_GUESS = 420

/**
 * 목표 띠를 어디에 둘지. gap: 위쪽 코인 칸과 버튼 줄 사이 빈 틈 (컴퓨터, 폰 가로).
 * 폰 가로는 좁은 화면이지만 버튼 줄 아래(102)에 두면 왼쪽 채팅과 겹쳐서, 채팅은 코인 칸 아래 폭으로 줄이고 띠는 위로 올린다.
 * below: 버튼 줄 아래 (폰 세로·좁은 창)
 */
export function goalTrackerMode({ touchUi, narrow, portrait }: { touchUi: boolean; narrow: boolean; portrait: boolean }): 'gap' | 'below' {
  if (touchUi) return portrait ? 'below' : 'gap'
  return narrow ? 'below' : 'gap'
}

export type GoalPlace = { kind: 'top'; left: number; width: number } | { kind: 'below' }

/**
 * 컴퓨터 화면의 목표 띠 자리. viewW: 화면 폭, rowW: 오른쪽 위 버튼 줄 폭 (오른쪽 16 에 붙어 있다).
 * 코인 칸과 버튼 줄 사이 빈 틈 안에서, 될 수 있으면 화면 가운데에 둔다 (900~1150 px 에서 🔊·가방을 덮지 않게).
 * 틈이 GOAL_MIN_WIDTH 보다 좁으면 below (버튼 줄 아래, 좁은 화면 자리)
 */
export function goalTrackerPlace(viewW: number, rowW: number): GoalPlace {
  const right = viewW - 16 - rowW - GOAL_ROW_GAP
  const room = right - GOAL_HUD_LEFT_END
  if (room < GOAL_MIN_WIDTH) return { kind: 'below' }
  const width = Math.min(GOAL_MAX_WIDTH, room)
  const left = Math.min(Math.max((viewW - width) / 2, GOAL_HUD_LEFT_END), right - width)
  return { kind: 'top', left, width }
}

/** 오른쪽 위 버튼 줄의 지금 폭 (Hud 가 재서 넣고 GoalTracker 가 읽는다) */
export const useTopRowStore = create<{ width: number; setWidth: (w: number) => void }>((set) => ({
  width: ROW_GUESS,
  setWidth: (w) => set({ width: w }),
}))

/** 버튼 줄에 붙이는 ref: 폭이 바뀔 때마다 useTopRowStore 에 넣는다 */
export function useMeasureTopRow() {
  return useCallback((el: HTMLDivElement | null) => {
    if (!el) return
    const ro = new ResizeObserver(() => useTopRowStore.getState().setWidth(el.offsetWidth))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
}
