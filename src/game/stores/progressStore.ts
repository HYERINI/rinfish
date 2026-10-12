import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import { GEAR } from '../data/gear'
import { findSpecies } from '../data/fish'
import type { FishInstance, GearLevels, GearSlot } from '../data/types'
import { buyGearUpgrade, sellPrice } from '../logic/economy'
import { makeId } from '../logic/id'

export const SAVE_KEY = 'fishing-island-save-v1'

export type DexEntry = { count: number; maxWeight: number }

type ProgressData = {
  coins: number
  gear: GearLevels
  /** 아직 팔지 않은 물고기 */
  inventory: FishInstance[]
  /** 종 id → 기록. 한 번이라도 잡으면 생긴다 */
  dex: Record<string, DexEntry>
  /** 누적 플레이 시간(초) */
  playTime: number
}

type ProgressActions = {
  addPlayTime: (seconds: number) => void
  addCatch: (speciesId: string, weight: number) => FishInstance
  /** 판 금액을 돌려준다 */
  sellFish: (ids: string[]) => number
  buyGear: (slot: GearSlot) => boolean
  resetProgress: () => void
}

export const INITIAL_PROGRESS: ProgressData = {
  coins: 0,
  gear: { line: 0, reel: 0, rod: 0 },
  inventory: [],
  dex: {},
  playTime: 0,
}

// --- 저장본 검증: 타입이 틀린 값은 버리고 초기값을 쓴다 ---

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)
const isFiniteNumber = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)

function readNonNegative(v: unknown, fallback: number): number {
  return isFiniteNumber(v) && v >= 0 ? v : fallback
}

function readGear(v: unknown, fallback: GearLevels): GearLevels {
  if (!isRecord(v)) return fallback
  const gear = { ...fallback }
  for (const slot of Object.keys(GEAR) as GearSlot[]) {
    const level = v[slot]
    if (Number.isInteger(level) && (level as number) >= 0 && (level as number) < GEAR[slot].levels.length) {
      gear[slot] = level as number
    }
  }
  return gear
}

function isValidFish(v: unknown): v is FishInstance {
  return (
    isRecord(v) &&
    typeof v.id === 'string' &&
    typeof v.speciesId === 'string' &&
    findSpecies(v.speciesId) !== undefined &&
    isFiniteNumber(v.weight) &&
    isFiniteNumber(v.caughtAtPlayTime)
  )
}

function readInventory(v: unknown, fallback: FishInstance[]): FishInstance[] {
  return Array.isArray(v) ? v.filter(isValidFish) : fallback
}

function readDex(v: unknown, fallback: Record<string, DexEntry>): Record<string, DexEntry> {
  if (!isRecord(v)) return fallback
  const dex: Record<string, DexEntry> = {}
  for (const [speciesId, entry] of Object.entries(v)) {
    if (findSpecies(speciesId) && isRecord(entry) && isFiniteNumber(entry.count) && isFiniteNumber(entry.maxWeight)) {
      dex[speciesId] = { count: entry.count, maxWeight: entry.maxWeight }
    }
  }
  return dex
}

// persist: 상태를 localStorage에 자동 저장하고, 새로고침하면 다시 불러온다
export const useProgressStore = create<ProgressData & ProgressActions>()(
  persist(
    (set, get) => ({
      ...INITIAL_PROGRESS,

      addPlayTime: (seconds) => set((s) => ({ playTime: s.playTime + seconds })),

      addCatch: (speciesId, weight) => {
        const fish: FishInstance = { id: makeId(), speciesId, weight, caughtAtPlayTime: get().playTime }
        set((s) => {
          const prev = s.dex[speciesId]
          return {
            inventory: [...s.inventory, fish],
            dex: {
              ...s.dex,
              [speciesId]: { count: (prev?.count ?? 0) + 1, maxWeight: Math.max(prev?.maxWeight ?? 0, weight) },
            },
          }
        })
        return fish
      },

      sellFish: (ids) => {
        const toSell = new Set(ids)
        let earned = 0
        const keep: FishInstance[] = []
        for (const fish of get().inventory) {
          const species = findSpecies(fish.speciesId)
          if (toSell.has(fish.id) && species) earned += sellPrice(species, fish.weight)
          else keep.push(fish)
        }
        if (earned > 0) set((s) => ({ inventory: keep, coins: s.coins + earned }))
        return earned
      },

      buyGear: (slot) => {
        const result = buyGearUpgrade(get().coins, get().gear, slot)
        if (!result.ok) return false
        set({ coins: result.coins, gear: result.levels })
        return true
      },

      resetProgress: () => set({ ...INITIAL_PROGRESS }),
    }),
    {
      name: SAVE_KEY,
      version: 1,
      storage: createJSONStorage(() => localStorage),
      // 저장본의 각 필드를 검증해서, 틀린 값은 기본값을 쓰고 지금은 없는 물고기는 버린다
      merge: (persisted, current) => {
        const saved = isRecord(persisted) ? persisted : {}
        return {
          ...current,
          coins: readNonNegative(saved.coins, current.coins),
          playTime: readNonNegative(saved.playTime, current.playTime),
          gear: readGear(saved.gear, current.gear),
          inventory: readInventory(saved.inventory, current.inventory),
          dex: readDex(saved.dex, current.dex),
        }
      },
    },
  ),
)
