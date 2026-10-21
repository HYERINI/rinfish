import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import { TANK_LEVELS, TANK_TYPES } from '../data/aquarium'
import { AQUARIUM, STAMINA } from '../data/balance'
import { getDish } from '../data/dishes'
import { GEAR } from '../data/gear'
import { findSpecies } from '../data/fish'
import type { Buff, DishId, FishInstance, GearLevels, GearSlot, TankTypeId } from '../data/types'
import {
  EMPTY_AQUARIUM,
  buyExpansion,
  buyTankType as buyTankTypeRule,
  claimIncome,
  displayFish as displayFishRule,
  feedAquarium,
  removeFromDisplay,
  selectTankType as selectTankTypeRule,
  tickAquarium,
  type AquariumEvent,
  type AquariumState,
} from '../logic/aquarium'
import { cook } from '../logic/cooking'
import { buyGearUpgrade, sellPrice } from '../logic/economy'
import { makeId } from '../logic/id'
import { FRESH_SURVIVAL, faintPenalty, spendStamina, tickSurvival, type Survival, type SurvivalTickContext } from '../logic/stamina'

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
  /** 체력, 약화 유예 시간, 요리 버프 */
  survival: Survival
  /** 보유 사료 개수 */
  feed: number
  aquarium: AquariumState
}


export type TickEvents = { fainted: boolean; aquarium: AquariumEvent[] }

type ProgressActions = {
  addPlayTime: (seconds: number) => void
  addCatch: (speciesId: string, weight: number) => FishInstance
  /** 판 금액을 돌려준다 */
  sellFish: (ids: string[]) => number
  buyGear: (slot: GearSlot) => boolean
  resetProgress: () => void
  spendCastStamina: () => void
  /** 1초 안팎마다 호출. 플레이 시간·체력·어항 시간을 함께 진행하고 생긴 일을 돌려준다 */
  tick: (seconds: number, ctx: SurvivalTickContext) => TickEvents
  cookDish: (dishId: DishId, fishId: string) => boolean
  displayFish: (fishId: string) => boolean
  undisplayFish: (fishId: string) => boolean
  buyFeed: () => boolean
  feedWithPellet: () => boolean
  /** 보관함의 잡어 1마리를 먹이로 준다 */
  feedWithJunk: (fishId: string) => boolean
  /** 받은 코인을 돌려준다 */
  claimAquariumIncome: () => number
  buyAquariumExpansion: () => boolean
  buyTankType: (typeId: TankTypeId) => boolean
  selectTankType: (typeId: TankTypeId) => void
}

export const INITIAL_PROGRESS: ProgressData = {
  coins: 0,
  gear: { line: 0, reel: 0, rod: 0 },
  inventory: [],
  dex: {},
  playTime: 0,
  survival: FRESH_SURVIVAL,
  feed: 0,
  aquarium: EMPTY_AQUARIUM,
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

const BUFF_KINDS: Buff['kind'][] = ['reel', 'tension']
const TANK_TYPE_IDS = TANK_TYPES.map((t) => t.id)

function isValidBuff(v: unknown): v is Buff {
  return (
    isRecord(v) &&
    BUFF_KINDS.includes(v.kind as Buff['kind']) &&
    isFiniteNumber(v.mul) &&
    v.mul > 0 &&
    isFiniteNumber(v.remaining) &&
    v.remaining > 0
  )
}

function readSurvival(v: unknown, fallback: Survival): Survival {
  if (!isRecord(v)) return fallback
  const stamina = isFiniteNumber(v.stamina) && v.stamina >= 0 && v.stamina <= STAMINA.max ? v.stamina : fallback.stamina
  const graceLeft = isFiniteNumber(v.graceLeft) && v.graceLeft > 0 ? v.graceLeft : null
  const buffs = Array.isArray(v.buffs) ? v.buffs.filter(isValidBuff) : fallback.buffs
  return { stamina, graceLeft, buffs }
}

function readAquarium(v: unknown, fallback: AquariumState): AquariumState {
  if (!isRecord(v)) return fallback
  const level = Number.isInteger(v.level) && (v.level as number) >= 0 && (v.level as number) < TANK_LEVELS.length ? (v.level as number) : fallback.level
  const savedTypes = Array.isArray(v.ownedTypes) ? v.ownedTypes.filter((t): t is TankTypeId => TANK_TYPE_IDS.includes(t as TankTypeId)) : []
  // 기본 어항은 항상 갖고 있다
  const ownedTypes = TANK_TYPE_IDS.filter((id) => id === 'basic' || savedTypes.includes(id))
  const activeType = ownedTypes.includes(v.activeType as TankTypeId) ? (v.activeType as TankTypeId) : 'basic'
  const displayed = Array.isArray(v.displayed) ? v.displayed.filter(isValidFish).slice(0, TANK_LEVELS[level].slots) : fallback.displayed
  return {
    level,
    ownedTypes,
    activeType,
    displayed,
    lastFedAt: readNonNegative(v.lastFedAt, fallback.lastFedAt),
    pendingIncome: readNonNegative(v.pendingIncome, fallback.pendingIncome),
  }
}

function readCount(v: unknown, fallback: number): number {
  return Number.isInteger(v) && (v as number) >= 0 ? (v as number) : fallback
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

      spendCastStamina: () => set((s) => ({ survival: spendStamina(s.survival, STAMINA.castCost) })),

      tick: (seconds, ctx) => {
        const s = get()
        const playTime = s.playTime + seconds
        const survivalTick = tickSurvival(s.survival, seconds, ctx)
        const aquariumTick = tickAquarium(s.aquarium, playTime, seconds)
        if (survivalTick.fainted) {
          // 쓰러짐: 팔지 않은 물고기를 잃고 진료비를 낸다. 어항·장비·도감은 그대로
          set({
            playTime,
            aquarium: aquariumTick.aquarium,
            survival: FRESH_SURVIVAL,
            inventory: [],
            coins: s.coins - faintPenalty(s.coins),
          })
        } else {
          set({ playTime, aquarium: aquariumTick.aquarium, survival: survivalTick.survival })
        }
        return { fainted: survivalTick.fainted, aquarium: aquariumTick.events }
      },

      cookDish: (dishId, fishId) => {
        const s = get()
        const fish = s.inventory.find((f) => f.id === fishId)
        const species = fish && findSpecies(fish.speciesId)
        if (!species) return false
        const result = cook(s.coins, s.survival, getDish(dishId), species.rarity)
        if (!result.ok) return false
        set({ coins: result.coins, survival: result.survival, inventory: s.inventory.filter((f) => f.id !== fishId) })
        return true
      },

      displayFish: (fishId) => {
        const s = get()
        const fish = s.inventory.find((f) => f.id === fishId)
        if (!fish) return false
        const result = displayFishRule(s.aquarium, fish, s.playTime)
        if (!result.ok) return false
        set({ aquarium: result.aquarium, inventory: s.inventory.filter((f) => f.id !== fishId) })
        return true
      },

      undisplayFish: (fishId) => {
        const s = get()
        const { aquarium, fish } = removeFromDisplay(s.aquarium, fishId)
        if (!fish) return false
        set({ aquarium, inventory: [...s.inventory, fish] })
        return true
      },

      buyFeed: () => {
        const s = get()
        if (s.coins < AQUARIUM.feedPrice) return false
        set({ coins: s.coins - AQUARIUM.feedPrice, feed: s.feed + 1 })
        return true
      },

      feedWithPellet: () => {
        const s = get()
        if (s.feed <= 0 || s.aquarium.displayed.length === 0) return false
        set({ feed: s.feed - 1, aquarium: feedAquarium(s.aquarium, s.playTime) })
        return true
      },

      feedWithJunk: (fishId) => {
        const s = get()
        const fish = s.inventory.find((f) => f.id === fishId)
        if (!fish || findSpecies(fish.speciesId)?.rarity !== 'junk' || s.aquarium.displayed.length === 0) return false
        set({ inventory: s.inventory.filter((f) => f.id !== fishId), aquarium: feedAquarium(s.aquarium, s.playTime) })
        return true
      },

      claimAquariumIncome: () => {
        const s = get()
        const { aquarium, coins } = claimIncome(s.aquarium)
        if (coins > 0) set({ aquarium, coins: s.coins + coins })
        return coins
      },

      buyAquariumExpansion: () => {
        const result = buyExpansion(get().coins, get().aquarium)
        if (!result.ok) return false
        set({ coins: result.coins, aquarium: result.aquarium })
        return true
      },

      buyTankType: (typeId) => {
        const result = buyTankTypeRule(get().coins, get().aquarium, typeId)
        if (!result.ok) return false
        set({ coins: result.coins, aquarium: result.aquarium })
        return true
      },

      selectTankType: (typeId) => set((s) => ({ aquarium: selectTankTypeRule(s.aquarium, typeId) })),

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
          survival: readSurvival(saved.survival, current.survival),
          feed: readCount(saved.feed, current.feed),
          aquarium: readAquarium(saved.aquarium, current.aquarium),
        }
      },
    },
  ),
)
