import { create } from 'zustand'
import { CAMERA_ZOOM } from '../data/balance'
import type { ZoneId } from '../data/types'
import { nextZoom } from '../logic/cameraZoom'
import { isSameInteractable, type Interactable, type Mode } from '../logic/interaction'
import { IDLE_ACTION, type PlayerAction } from '../logic/playerMotion'

type SessionState = {
  mode: Mode
  /** 플레이어가 지금 서 있는 상호작용 영역 */
  nearby: Interactable | null
  /** 화면 위쪽에 잠깐 띄우는 알림. id가 바뀌면 새 알림 */
  notice: { id: number; text: string } | null
  /** 다음 프레임에 플레이어를 옮길 위치 [x, z] (쓰러진 뒤 진료소로) */
  teleport: [number, number] | null
  /** 카메라 거리 (휠 줌). 저장하지 않는다 */
  zoom: number
  /**
   * 플레이어 동작 상태 (감정 표현·점프). Player 가 매 프레임 nextAction 으로 갱신하고 캐릭터 모델은 이 값과 속도로만 그린다.
   * 나중에 여러 명이 같이 할 때 이 값을 주고받으면 다른 사람 캐릭터도 같은 코드로 그린다. 저장하지 않는다
   */
  playerAction: PlayerAction
  /**
   * 수리기사님 연출. startedAt: 시작 시각(performance.now() 초). 진행은 repairTimeline(지금 - startedAt)으로만 정한다.
   * 구역은 이미 열린 뒤라 새로고침 등으로 연출이 사라져도 괜찮다. 저장하지 않는다
   */
  cutscene: { zoneId: ZoneId; startedAt: number } | null
  /** 연출 시작: 조작을 막고(mode 'cutscene') 카메라를 연출 자리로 */
  startCutscene: (zoneId: ZoneId) => void
  endCutscene: () => void
  setPlayerAction: (action: PlayerAction) => void
  setMode: (mode: Mode) => void
  zoomBy: (deltaY: number) => void
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
  zoom: CAMERA_ZOOM.initial,
  playerAction: IDLE_ACTION,
  cutscene: null,
  startCutscene: (zoneId) => set({ cutscene: { zoneId, startedAt: performance.now() / 1000 }, mode: 'cutscene', nearby: null }),
  endCutscene: () => set((s) => ({ cutscene: null, mode: s.mode === 'cutscene' ? 'explore' : s.mode })),
  setPlayerAction: (playerAction) => set({ playerAction }),
  setMode: (mode) => set({ mode }),
  zoomBy: (deltaY) => set((s) => ({ zoom: nextZoom(s.zoom, deltaY) })),
  setNearby: (target) => set({ nearby: target }),
  clearNearby: (target) => {
    if (isSameInteractable(get().nearby, target)) set({ nearby: null })
  },
  notify: (text) => set((s) => ({ notice: { id: (s.notice?.id ?? 0) + 1, text } })),
  requestTeleport: (pos) => set({ teleport: pos }),
  clearTeleport: () => set({ teleport: null }),
  resetSession: () => set({ mode: 'explore', nearby: null, notice: null, teleport: null, zoom: CAMERA_ZOOM.initial, playerAction: IDLE_ACTION, cutscene: null }),
}))
