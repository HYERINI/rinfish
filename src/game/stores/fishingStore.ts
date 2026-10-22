import { create } from 'zustand'
import type { FishInstance } from '../data/types'
import type { FishingPlace } from '../logic/fishingEdge'
import { startFishing, type FishingState } from '../logic/fishingSession'

type FishingStore = {
  /** 낚시하는 자리 (물가에서 E 를 누른 곳). 다시 던지기도 같은 자리에서 */
  spot: FishingPlace | null
  state: FishingState | null
  /** 이번 판에서 잡은 물고기 (결과 카드용) */
  caught: FishInstance | null
  begin: (spot: FishingPlace) => void
  update: (state: FishingState, caught?: FishInstance) => void
  end: () => void
}

// 진행 중인 낚시. 3D 연출과 UI가 함께 읽는다
export const useFishingStore = create<FishingStore>((set) => ({
  spot: null,
  state: null,
  caught: null,
  begin: (spot) => set({ spot, state: startFishing(), caught: null }),
  update: (state, caught) => set(caught ? { state, caught } : { state }),
  end: () => set({ spot: null, state: null, caught: null }),
}))
