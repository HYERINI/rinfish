import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import { DEFAULT_SETTINGS } from '../data/settings'
import { clampSensitivity, clampVolume, normalizeSettings, type Settings } from '../logic/settings'

/** 진행 저장본(fishing-island-save-v1)과 따로 둔다: 설정을 바꿔도 진행이 흔들리지 않고, 진행을 지워도 설정은 남는다 */
export const SETTINGS_KEY = 'fishing-island-settings-v1'

type SettingsState = Settings & {
  setMusicVolume: (volume: number) => void
  toggleMusicMuted: () => void
  setLookSensitivity: (sensitivity: number) => void
  setInvertY: (invertY: boolean) => void
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      ...DEFAULT_SETTINGS,
      // 볼륨을 올리면 음소거도 푼다
      setMusicVolume: (volume) => set({ musicVolume: clampVolume(volume), musicMuted: false }),
      toggleMusicMuted: () => set((s) => ({ musicMuted: !s.musicMuted })),
      setLookSensitivity: (sensitivity) => set({ lookSensitivity: clampSensitivity(sensitivity) }),
      setInvertY: (invertY) => set({ invertY }),
    }),
    {
      name: SETTINGS_KEY,
      version: 1,
      storage: createJSONStorage(() => localStorage),
      partialize: (s): Settings => ({ musicVolume: s.musicVolume, musicMuted: s.musicMuted, lookSensitivity: s.lookSensitivity, invertY: s.invertY }),
      // 저장본이 깨졌거나 예전 형식이어도 검증해서 쓴다
      merge: (persisted, current) => ({ ...current, ...normalizeSettings(persisted) }),
    },
  ),
)
