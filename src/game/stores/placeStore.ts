import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import { START_PLACE, type Place } from '../logic/place'

/**
 * 서 있던 자리 저장본. 진행(fishing-island-save-v1)과 따로 둔다: 자리는 자주 바뀌어서 진행 저장본을 매번 다시 쓰지 않게.
 * 탭을 닫거나 폰이 백그라운드 탭을 없앴다가 다시 열어도 그 자리에서 이어서 시작한다
 */
export const PLACE_KEY = 'fishing-island-place-v1'

type PlaceState = { place: Place; savePlace: (place: Place) => void }

export const usePlaceStore = create<PlaceState>()(
  persist(
    (set) => ({
      place: START_PLACE,
      savePlace: (place) => set({ place }),
    }),
    {
      name: PLACE_KEY,
      version: 1,
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({ place: s.place }),
      // 검증은 쓰는 쪽(Game)에서 열린 구역과 같이 한다 (normalizePlace)
    },
  ),
)
