import { create } from 'zustand'
import type { FishInstance } from '../data/types'
import { startFishing, type FishingState } from '../logic/fishingSession'

type FishingStore = {
  spotId: string | null
  state: FishingState | null
  /** 이번 판에서 잡은 물고기 (결과 카드용) */
  caught: FishInstance | null
  begin: (spotId: string) => void
  update: (state: FishingState, caught?: FishInstance) => void
  end: () => void
}

// 진행 중인 낚시. 3D 연출과 UI가 함께 읽는다
export const useFishingStore = create<FishingStore>((set) => ({
  spotId: null,
  state: null,
  caught: null,
  begin: (spotId) => set({ spotId, state: startFishing(), caught: null }),
  update: (state, caught) => set(caught ? { state, caught } : { state }),
  end: () => set({ spotId: null, state: null, caught: null }),
}))
