import { create } from 'zustand'
import { isSameInteractable, type Interactable, type Mode } from '../logic/interaction'

type SessionState = {
  mode: Mode
  /** 플레이어가 지금 서 있는 상호작용 영역 */
  nearby: Interactable | null
  /** 화면 위쪽에 잠깐 띄우는 알림. id가 바뀌면 새 알림 */
  notice: { id: number; text: string } | null
  /** 다음 프레임에 플레이어를 옮길 위치 [x, z] (쓰러진 뒤 진료소로) */
  teleport: [number, number] | null
  setMode: (mode: Mode) => void
  setNearby: (target: Interactable) => void
  /** 영역을 벗어날 때 호출. 다른 영역에 이미 들어가 있으면 지우지 않는다 */
  clearNearby: (target: Interactable) => void
  notify: (text: string) => void
  requestTeleport: (pos: [number, number]) => void
  clearTeleport: () => void
  resetSession: () => void
}

// 저장하지 않는 "이번 판" 상태
export const useSessionStore = create<SessionState>((set, get) => ({
  mode: 'explore',
  nearby: null,
  notice: null,
  teleport: null,
  setMode: (mode) => set({ mode }),
  setNearby: (target) => set({ nearby: target }),
  clearNearby: (target) => {
    if (isSameInteractable(get().nearby, target)) set({ nearby: null })
  },
  notify: (text) => set((s) => ({ notice: { id: (s.notice?.id ?? 0) + 1, text } })),
  requestTeleport: (pos) => set({ teleport: pos }),
  clearTeleport: () => set({ teleport: null }),
  resetSession: () => set({ mode: 'explore', nearby: null, notice: null, teleport: null }),
}))
