import { create } from 'zustand'
import { CAMERA_ZOOM, NEAR_VIEW } from '../data/balance'
import { isGun, type GunId } from '../data/guns'
import type { MeadowDishId } from '../data/meadowItems'
import type { VendorId } from '../data/meadowPrices'
import type { ToolId } from '../data/tools'
import type { DishId, ZoneId } from '../data/types'
import type { BoatDir } from '../logic/boatRoute'
import { MEADOW_ZOOM, nextZoom, pinchZoom } from '../logic/cameraZoom'
import { isSameInteractable, type Interactable, type Mode } from '../logic/interaction'
import { IDLE_ACTION, type PlayerAction } from '../logic/playerMotion'
import type { ViewMode } from '../logic/view'

type SessionState = {
  mode: Mode
  /** 플레이어가 지금 서 있는 상호작용 영역 */
  nearby: Interactable | null
  /** 화면 위쪽에 잠깐 띄우는 알림. id가 바뀌면 새 알림 */
  notice: { id: number; text: string } | null
  /** 다음 프레임에 플레이어를 옮길 위치 [x, z] (쓰러진 뒤 진료소로) 또는 [x, z, y] (광산 안: 몸 가운데 높이. 없으면 지상 1) */
  teleport: [number, number] | [number, number, number] | null
  /** 섬 카메라 거리 (휠·두 손가락 줌). 서 있던 자리(Place)와 함께 저장한다 */
  zoom: number
  /** 초원 카메라 거리. 섬과 따로 기억한다 (초원은 은지처럼 가까이서 본다) */
  meadowZoom: number
  /** 카메라가 초원 쪽에 있나 (휠이 어느 줌을 바꿀지). Player 가 바뀔 때만 고친다 */
  inMeadow: boolean
  setInMeadow: (inMeadow: boolean) => void
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
  /**
   * 미스터찜 요리 연출 (사장님 배정빈이 요리하는 모습). 요리 값(체력·코인)은 주문할 때 이미 반영됐고 연출은 보여 주기만 한다.
   * line: 내올 때 사장님이 하는 말. 진행은 cookTimeline(지금 - startedAt)
   */
  cooking: { dish: DishId; startedAt: number; line: string } | null
  startCooking: (dish: DishId, line: string) => void
  endCooking: () => void
  /** 배 타고 건너는 중. startedAt: 탄 시각(performance.now() 초). 진행은 boatProgress(지금 - startedAt). 저장하지 않는다 */
  boat: { dir: BoatDir; startedAt: number } | null
  startBoat: (dir: BoatDir) => void
  endBoat: () => void
  /** 큰 지도 열기 (mode 'map'). 탐험·배 타기·메뉴에서만 연다 (낚시·패널 중엔 무시) */
  openMap: () => void
  /** 큰 지도 닫기. 배 타는 중이면 배 모드로 돌아간다 */
  closeMap: () => void
  /**
   * 초원 가스레인지 요리 중 (재료는 시작할 때 이미 뺐다). startedAt: performance.now() 초. 은지처럼 요리하는 동안 돌아다녀도 된다.
   * 저장하지 않는다 (새로고침하면 재료와 함께 사라진다, 은지 그대로)
   */
  stoveCook: { recipe: MeadowDishId; startedAt: number } | null
  setStoveCook: (cook: { recipe: MeadowDishId; startedAt: number } | null) => void
  /** 사고팔기 창을 연 마을 상인 (mode 'vendor') */
  vendor: VendorId | null
  openVendor: (id: VendorId) => void
  /** 손에 든 도구 (도구 칸). null = 빈손. 저장하지 않는다 (다시 들어오면 낚싯대) */
  tool: ToolId | null
  /** 마지막에 든 총 (폰 도구 칸의 총 한 칸). 저장하지 않는다 */
  lastGun: GunId
  equip: (tool: ToolId | null) => void
  /** 카메라 시점 (V: 1인칭/3인칭). 저장하지 않는다 */
  view: ViewMode
  toggleView: () => void
  /** 마지막으로 맞은 때 (performance.now() 초. 화면 가장자리가 빨갛게 번쩍인다, ui/HurtFlash). 저장하지 않는다 */
  hurtAt: number | null
  flashHurt: () => void
  setPlayerAction: (action: PlayerAction) => void
  setMode: (mode: Mode) => void
  zoomBy: (deltaY: number) => void
  /** 두 손가락 벌리기·오므리기 (손가락 사이 거리 px: 전 → 지금) */
  pinchZoom: (prevSpan: number, span: number) => void
  setNearby: (target: Interactable) => void
  /** 영역을 벗어날 때 호출. 다른 영역에 이미 들어가 있으면 지우지 않는다 */
  clearNearby: (target: Interactable) => void
  notify: (text: string) => void
  requestTeleport: (pos: [number, number] | [number, number, number]) => void
  clearTeleport: () => void
  resetSession: () => void
}

/** 큰 지도를 열 수 있는 모드 */
const MAP_FROM: Mode[] = ['explore', 'boat', 'menu']

// 저장하지 않는 "이번 판" 상태
export const useSessionStore = create<SessionState>((set, get) => ({
  mode: 'explore',
  nearby: null,
  notice: null,
  teleport: null,
  zoom: CAMERA_ZOOM.initial,
  meadowZoom: NEAR_VIEW.meadowInitial,
  inMeadow: false,
  setInMeadow: (inMeadow) => set({ inMeadow }),
  playerAction: IDLE_ACTION,
  cutscene: null,
  startCutscene: (zoneId) => set({ cutscene: { zoneId, startedAt: performance.now() / 1000 }, mode: 'cutscene', nearby: null }),
  endCutscene: () => set((s) => ({ cutscene: null, mode: s.mode === 'cutscene' && !s.cooking ? 'explore' : s.mode })),
  cooking: null,
  startCooking: (dish, line) => set({ cooking: { dish, startedAt: performance.now() / 1000, line }, mode: 'cutscene', nearby: null }),
  boat: null,
  startBoat: (dir) => set({ boat: { dir, startedAt: performance.now() / 1000 }, mode: 'boat', nearby: null }),
  endBoat: () => set((s) => ({ boat: null, mode: s.mode === 'boat' ? 'explore' : s.mode })),
  endCooking: () => set((s) => ({ cooking: null, mode: s.mode === 'cutscene' && !s.cutscene ? 'explore' : s.mode })),
  // 가까운 대상(nearby)은 지우지 않는다: 닫았을 때 선착장 등 안내가 그대로 남도록 (지도 중엔 E 를 받지 않는다)
  openMap: () => set((s) => (MAP_FROM.includes(s.mode) ? { mode: 'map' } : {})),
  closeMap: () => {
    if (get().mode === 'map') get().setMode('explore')
  },
  vendor: null,
  openVendor: (vendor) => set({ vendor, mode: 'vendor' }),
  stoveCook: null,
  setStoveCook: (stoveCook) => set({ stoveCook }),
  tool: 'rod',
  lastGun: 'pistol',
  equip: (tool) => set(isGun(tool) ? { tool, lastGun: tool } : { tool }),
  view: 'third',
  toggleView: () => set((s) => ({ view: s.view === 'first' ? 'third' : 'first' })),
  hurtAt: null,
  flashHurt: () => set({ hurtAt: performance.now() / 1000 }),
  setPlayerAction: (playerAction) => set({ playerAction }),
  // 배 타는 중엔 탐험으로 돌려도(로비 닫기 등) 도착할 때까지 배 모드를 지킨다
  // 상인 창이 아닌 모드로 가면 연 상인을 지운다
  setMode: (mode) => set((s) => ({ mode: s.boat && mode === 'explore' ? 'boat' : mode, ...(mode !== 'vendor' && s.vendor ? { vendor: null } : {}) })),
  // 초원에선 초원 줌만, 섬에선 섬 줌만 바꾼다
  zoomBy: (deltaY) => set((s) => (s.inMeadow ? { meadowZoom: nextZoom(s.meadowZoom, deltaY, MEADOW_ZOOM) } : { zoom: nextZoom(s.zoom, deltaY) })),
  pinchZoom: (prevSpan, span) =>
    set((s) => (s.inMeadow ? { meadowZoom: pinchZoom(s.meadowZoom, prevSpan, span, MEADOW_ZOOM) } : { zoom: pinchZoom(s.zoom, prevSpan, span) })),
  setNearby: (target) => set({ nearby: target }),
  clearNearby: (target) => {
    if (isSameInteractable(get().nearby, target)) set({ nearby: null })
  },
  notify: (text) => set((s) => ({ notice: { id: (s.notice?.id ?? 0) + 1, text } })),
  // 순간이동(쓰러져 진료소로 등)하면 타던 배에서 내린다
  requestTeleport: (pos) => set((s) => ({ teleport: pos, boat: null, mode: s.mode === 'boat' ? 'explore' : s.mode })),
  clearTeleport: () => set({ teleport: null }),
  resetSession: () => set({ mode: 'explore', nearby: null, notice: null, teleport: null, zoom: CAMERA_ZOOM.initial, meadowZoom: NEAR_VIEW.meadowInitial, playerAction: IDLE_ACTION, cutscene: null, cooking: null, boat: null, tool: 'rod', lastGun: 'pistol', stoveCook: null, vendor: null, hurtAt: null, view: 'third' }),
}))
