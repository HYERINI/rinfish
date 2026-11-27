import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import { TANK_LEVELS, TANK_TYPES } from '../data/aquarium'
import { AQUARIUM, HUNGER, STAMINA } from '../data/balance'
import { BAIT_IDS, type BaitId } from '../data/bait'
import { SNACK_IDS, type SnackId } from '../data/snacks'
import { getDish } from '../data/dishes'
import { GEAR } from '../data/gear'
import { GUNS, MAX_RESERVE, type GunId } from '../data/guns'
import { findSpecies } from '../data/fish'
import { MEADOW_DOORS } from '../data/meadow'
import { MINE_WALLS } from '../data/mine'
import { ITEM_IDS, getRecipe, type ItemId, type MeadowDishId } from '../data/meadowItems'
import type { Buff, CharacterLook, DishId, FishInstance, GearLevels, GearSlot, TankTypeId, ZoneId } from '../data/types'
import { ZONES } from '../data/zones'
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
import { FULL_MAGS, START_ROUNDS, buyAmmoPacks, readRounds, reloadRounds, spendRound, type Rounds } from '../logic/ammo'
import { NO_BAIT, buyBait as buyBaitRule, consumeBait, type BaitCounts } from '../logic/bait'
import { normalizeLook } from '../logic/characterLook'
import { NO_SNACKS, buyAndEatSnack as buyAndEatSnackRule, buySnacks as buySnacksRule, eatSnackFromBag, type SnackCounts, type SnackEatResult } from '../logic/snacks'
import { cook, ingredientsOk } from '../logic/cooking'
import { NO_ITEMS, addItems, bestFood, consumeRecipe, eatBagFood, type BagFood, type ItemCounts } from '../logic/inventory'
import { FULL_STOCK, buyFromVendor, readStock, sellToVendor, type ClockSource, type VendorStock } from '../logic/meadowShop'
import type { VendorId } from '../data/meadowPrices'
import { buyGearUpgrade, sellPrice } from '../logic/economy'
import { makeId } from '../logic/id'
import { SAVE_VERSION, migrateSave } from '../logic/saveMigration'
import { unlockZone as unlockZoneRule } from '../logic/zoneUnlock'
import { FIRST_MORNING, readClock, type Clock } from '../logic/dayClock'
import { FRESH_SURVIVAL, faintPenalty, spendStamina, type Survival } from '../logic/stamina'
import { afterDeath, afterSleep, takeDamage, tickSurvival, type SurvivalTickContext } from '../logic/survival'
import { deferrableStorage } from './deferredSave'

export const SAVE_KEY = 'fishing-island-save-v1'

export type DexEntry = { count: number; maxWeight: number }

type ProgressData = {
  /** 플레이어 생김새. null 이면 아직 만들지 않았다 */
  look: CharacterLook | null
  coins: number
  gear: GearLevels
  /** 아직 팔지 않은 물고기 */
  inventory: FishInstance[]
  /** 종 id → 기록. 한 번이라도 잡으면 생긴다 */
  dex: Record<string, DexEntry>
  /** 누적 플레이 시간(초) */
  playTime: number
  /** 체력, 배고픔, 약화 유예 시간, 요리 버프 */
  survival: Survival
  /** 보유 사료 개수 */
  feed: number
  aquarium: AquariumState
  /** 미끼별 보유 개수 */
  bait: BaitCounts
  /** 낚시할 때 쓸 미끼. null 이면 미끼 없이 */
  selectedBait: BaitId | null
  /** 연 구역 (해변은 처음부터 열려 있어 넣지 않는다) */
  unlockedZones: ZoneId[]
  /** 가방 속 간식 개수 */
  snacks: SnackCounts
  /** 혼자 할 때 시계 (다시 들어오면 이어서). 같이 하는 동안엔 방 시계를 따르고 이 값은 건드리지 않는다 */
  clock: Clock
  /** 가방 속 은지 물건(재료·요리) 개수 */
  items: ItemCounts
  /** 은지 집 문이 열려 있나 (MEADOW_DOORS 순서). 처음엔 모두 닫힘 (은지 그대로) */
  doors: boolean[]
  /** 농산물 가게에서 오늘 산 수 (하루 수량). 없던 저장본은 가득 */
  stock: VendorStock
  /** 총마다 탄창에 든 탄 (없던 저장본은 가득) */
  ammo: Rounds
  /** 총마다 예비 탄약 (잡화점에서 산다. 없던 저장본은 은지 기본값) */
  reserve: Rounds
  /** 사격장 연습 게임 최고 점수 */
  rangeBest: number
  /** 광산에서 다 캔 광맥 수 (쌓인다. 금 간 벽이 나타나는 기준) */
  oreMined: number
  /** 무너뜨린 금 간 벽 (MINE_WALLS 순서). 열린 굴은 다음에 와도 열려 있다 */
  mineWalls: boolean[]
}


/** fainted: 지쳐 쓰러짐 (진료소), died: 굶어 죽음 (침대 — 깨우는 건 dayActions 가 화면이 어두워진 뒤 reviveAtBed 로) */
export type TickEvents = { fainted: boolean; died: boolean; aquarium: AquariumEvent[] }

type ProgressActions = {
  addPlayTime: (seconds: number) => void
  addCatch: (speciesId: string, weight: number) => FishInstance
  /** 판 금액을 돌려준다 */
  sellFish: (ids: string[]) => number
  buyGear: (slot: GearSlot) => boolean
  resetProgress: () => void
  spendCastStamina: () => void
  /** 1초 안팎마다 호출. 플레이 시간·체력·배고픔·어항 시간을 함께 진행하고 생긴 일을 돌려준다. clock: 혼자 할 때 지금 시계 (같이 하는 중이면 null) */
  tick: (seconds: number, ctx: SurvivalTickContext, clock?: Clock | null) => TickEvents
  /** 자고 일어났다: 체력 가득, 배고픔 −15. clock 이 있으면(혼자) 그 시계로 */
  sleepWell: (clock: Clock | null) => void
  /** 죽었다 침대에서 깨어났다: 체력 가득, 배고픔 60. 가방·코인·물고기는 그대로. clock 이 있으면(혼자) 그 시계로 */
  reviveAtBed: (clock: Clock | null) => void
  /** 동물(3-3)·PvP(3-4) 에게 맞았다. 체력이 0 이 되면 true (죽음 → 침대, dayActions.startDeath) */
  hurt: (amount: number) => boolean
  /** 물고기(한 마리 또는 여러 마리)로 요리해 먹는다. 재료가 안 맞거나 코인이 모자라면 false */
  cookDish: (dishId: DishId, fishIds: string | string[]) => boolean
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
  setLook: (look: CharacterLook) => void
  /** qty 개를 산다. 코인이 모자라면 false */
  buyBait: (id: BaitId, qty: number) => boolean
  selectBait: (id: BaitId | null) => void
  /** 던질 때 미끼 1개를 쓴다 */
  spendBait: (id: BaitId) => void
  /** 구역 열기. 조건이 맞으면 코인을 내고 바로 저장한다(연출은 보여 주기만 한다). 못 열면 false */
  unlockZone: (id: ZoneId) => boolean
  /** 간식 qty 개를 사서 가방에 넣는다 */
  buySnacks: (id: SnackId, qty: number) => boolean
  /** 간식을 사서 바로 먹는다 (체력 회복) */
  buyAndEatSnack: (id: SnackId) => boolean
  /** 가방의 간식을 하나 꺼내 먹는다 */
  eatSnack: (id: SnackId) => boolean
  /** 은지 물건을 가방에 넣는다 (줍기·요리 완성·사기) */
  addItem: (id: ItemId, n?: number) => void
  /** 가방의 은지 요리나 간식을 하나 꺼내 먹는다. 없으면 false */
  eatFromBag: (id: BagFood) => boolean
  /** F: 배고픔을 가장 많이 채우는 것을 먹는다. 먹은 것, 먹을 게 없으면 null */
  eatBest: () => BagFood | null
  /** 가스레인지 요리 시작: 재료를 뺀다 (완성되면 addItem). 재료가 모자라면 false */
  startRecipe: (id: MeadowDishId) => boolean
  setDoorOpen: (index: number, open: boolean) => void
  /** 마을 상인에게 qty 개 판다. 받은 코인 (못 팔면 0) */
  sellItem: (vendor: VendorId, id: ItemId, qty: number) => number
  /** 마을 상인에게서 qty 개 산다. 코인이 모자라거나 안 파는 물건이면 false */
  /** src·day: 지금 시계(혼자·방)와 날짜. 농산물 가게 하루 수량을 시계마다 센다 */
  buyItem: (vendor: VendorId, id: ItemId, qty: number, src: ClockSource, day: number) => boolean
  /** 한 발 쏜다 (탄창에서 1). 탄창이 비었으면 false */
  fireRound: (id: GunId) => boolean
  /** 장전이 끝났다: 예비에서 탄창으로 모자란 만큼. 못 하면 false */
  reloadGun: (id: GunId) => boolean
  /** 잡화점에서 탄약 묶음 packs 개. 코인이 모자라면 false */
  buyAmmo: (id: GunId, packs: number) => boolean
  /** 사격장 최고 점수. 더 높을 때만 바꾸고 true */
  recordRangeScore: (score: number) => boolean
  /** 광맥 하나를 다 캤다. 지금까지 캔 수를 돌려준다 */
  countOreMined: () => number
  /** 금 간 벽을 무너뜨렸다 (index: MINE_WALLS 순서) */
  openMineWall: (index: number) => void
}

export const INITIAL_PROGRESS: ProgressData = {
  look: null,
  coins: 0,
  gear: { line: 0, reel: 0, rod: 0 },
  inventory: [],
  dex: {},
  playTime: 0,
  survival: FRESH_SURVIVAL,
  feed: 0,
  aquarium: EMPTY_AQUARIUM,
  bait: NO_BAIT,
  selectedBait: null,
  unlockedZones: [],
  snacks: NO_SNACKS,
  clock: FIRST_MORNING,
  items: NO_ITEMS,
  doors: MEADOW_DOORS.map(() => false),
  stock: FULL_STOCK,
  ammo: FULL_MAGS,
  reserve: START_ROUNDS,
  rangeBest: 0,
  oreMined: 0,
  mineWalls: MINE_WALLS.map(() => false),
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
  const hunger = isFiniteNumber(v.hunger) && v.hunger >= 0 && v.hunger <= HUNGER.max ? v.hunger : fallback.hunger
  const graceLeft = isFiniteNumber(v.graceLeft) && v.graceLeft > 0 ? v.graceLeft : null
  const buffs = Array.isArray(v.buffs) ? v.buffs.filter(isValidBuff) : fallback.buffs
  return { stamina, hunger, graceLeft, buffs }
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

/** 켜고 끄는 값 목록 (길이는 fallback 그대로: 나중에 벽이 늘어도 옛 저장본은 앞의 것만 읽는다). 틀린 칸은 fallback */
function readFlags(v: unknown, fallback: boolean[]): boolean[] {
  if (!Array.isArray(v)) return fallback
  return fallback.map((f, i) => (typeof v[i] === 'boolean' ? v[i] : f))
}

function readCount(v: unknown, fallback: number): number {
  return Number.isInteger(v) && (v as number) >= 0 ? (v as number) : fallback
}

function readBait(v: unknown, fallback: BaitCounts): BaitCounts {
  if (!isRecord(v)) return fallback
  const counts = { ...fallback }
  for (const id of BAIT_IDS) counts[id] = readCount(v[id], fallback[id])
  return counts
}

const LOCKABLE_ZONES = ZONES.filter((z) => z.unlock).map((z) => z.id)

function readUnlockedZones(v: unknown): ZoneId[] {
  if (!Array.isArray(v)) return []
  return LOCKABLE_ZONES.filter((id) => v.includes(id))
}

function readSnacks(v: unknown, fallback: SnackCounts): SnackCounts {
  if (!isRecord(v)) return fallback
  const counts = { ...fallback }
  for (const id of SNACK_IDS) counts[id] = readCount(v[id], fallback[id])
  return counts
}

function readItems(v: unknown, fallback: ItemCounts): ItemCounts {
  if (!isRecord(v)) return fallback
  const counts = { ...fallback }
  for (const id of ITEM_IDS) counts[id] = readCount(v[id], fallback[id])
  return counts
}

function readDoors(v: unknown, fallback: boolean[]): boolean[] {
  return fallback.map((open, i) => (Array.isArray(v) && typeof v[i] === 'boolean' ? (v[i] as boolean) : open))
}

/** 간식 먹기 결과. 실패면 null */
function eaten(r: SnackEatResult): Pick<ProgressData, 'coins' | 'snacks' | 'survival'> | null {
  return r.ok ? { coins: r.coins, snacks: r.snacks, survival: r.survival } : null
}

function readSelectedBait(v: unknown): BaitId | null {
  return BAIT_IDS.includes(v as BaitId) ? (v as BaitId) : null
}

/** 쏠 때 줄어든 탄은 이만큼(ms) 안에 한 번만 저장한다 (다른 저장·탭 숨김·닫기 때는 바로) */
const AMMO_SAVE_DELAY = 1000
/** 사본(localStorage)에 쓸 때마다 부를 것 (서버 저장이 "안 올린 변경" 을 표시한다) */
const savedListeners = new Set<() => void>()
export function onProgressSaved(listener: () => void): () => void {
  savedListeners.add(listener)
  return () => savedListeners.delete(listener)
}
const local = createJSONStorage<ProgressData & ProgressActions>(() => localStorage)
const saves = deferrableStorage<ProgressData & ProgressActions>(
  local && {
    ...local,
    setItem: (name, value) => {
      const r = local.setItem(name, value)
      savedListeners.forEach((f) => f())
      return r
    },
  },
  AMMO_SAVE_DELAY,
)

/** 미룬 저장(쏜 탄)을 지금 쓴다 */
export function flushProgressSave() {
  saves.flush()
}

// 탭을 숨기거나 닫을 때 미룬 저장을 바로 쓴다 (폰은 백그라운드 탭을 언제든 없앨 수 있다)
if (typeof window !== 'undefined') {
  window.addEventListener('pagehide', flushProgressSave)
  document.addEventListener('visibilitychange', () => document.hidden && flushProgressSave())
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

      tick: (seconds, ctx, clock = null) => {
        const s = get()
        const playTime = s.playTime + seconds
        const survivalTick = tickSurvival(s.survival, seconds, ctx)
        const aquariumTick = tickAquarium(s.aquarium, playTime, seconds)
        const time = clock ? { clock } : {}
        if (survivalTick.fainted) {
          // 쓰러짐: 팔지 않은 물고기를 잃고 진료비를 낸다. 어항·장비·도감·배고픔은 그대로
          set({
            ...time,
            playTime,
            aquarium: aquariumTick.aquarium,
            survival: { ...FRESH_SURVIVAL, hunger: survivalTick.survival.hunger },
            inventory: [],
            coins: s.coins - faintPenalty(s.coins),
          })
        } else {
          set({ ...time, playTime, aquarium: aquariumTick.aquarium, survival: survivalTick.survival })
        }
        return { fainted: survivalTick.fainted, died: survivalTick.died, aquarium: aquariumTick.events }
      },

      sleepWell: (clock) => set((s) => ({ survival: afterSleep(s.survival), ...(clock ? { clock } : {}) })),

      reviveAtBed: (clock) => set({ survival: afterDeath(), ...(clock ? { clock } : {}) }),

      hurt: (amount) => {
        const r = takeDamage(get().survival, amount)
        if (r.survival !== get().survival) set({ survival: r.survival })
        return r.died
      },

      cookDish: (dishId, fishIds) => {
        const s = get()
        const ids = Array.isArray(fishIds) ? fishIds : [fishIds]
        const picked = ids.flatMap((id) => {
          const fish = s.inventory.find((f) => f.id === id)
          const species = fish && findSpecies(fish.speciesId)
          return fish && species ? [{ id: fish.id, speciesId: fish.speciesId, rarity: species.rarity }] : []
        })
        const dish = getDish(dishId)
        if (picked.length !== ids.length || !ingredientsOk(dish, picked)) return false
        const result = cook(s.coins, s.survival, dish, picked.map((f) => f.rarity))
        if (!result.ok) return false
        const used = new Set(ids)
        set({ coins: result.coins, survival: result.survival, inventory: s.inventory.filter((f) => !used.has(f.id)) })
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

      setLook: (look) => set({ look: normalizeLook(look) }),

      buyBait: (id, qty) => {
        const result = buyBaitRule(get().coins, get().bait, id, qty)
        if (!result.ok) return false
        set({ coins: result.coins, bait: result.counts })
        return true
      },

      selectBait: (id) => set({ selectedBait: id }),

      spendBait: (id) => set((s) => ({ bait: consumeBait(s.bait, id) })),

      buySnacks: (id, qty) => {
        const r = buySnacksRule(get().coins, get().snacks, id, qty)
        if (!r.ok) return false
        set({ coins: r.coins, snacks: r.snacks })
        return true
      },

      buyAndEatSnack: (id) => {
        const s = get()
        const next = eaten(buyAndEatSnackRule(s.coins, s.snacks, s.survival, id))
        if (next) set(next)
        return next !== null
      },

      eatSnack: (id) => {
        const s = get()
        const next = eaten(eatSnackFromBag(s.coins, s.snacks, s.survival, id))
        if (next) set(next)
        return next !== null
      },

      addItem: (id, n = 1) => set((s) => ({ items: addItems(s.items, id, n) })),

      eatFromBag: (id) => {
        const s = get()
        const meal = eatBagFood({ items: s.items, snacks: s.snacks, survival: s.survival }, id)
        if (meal) set(meal)
        return meal !== null
      },

      eatBest: () => {
        const s = get()
        const id = bestFood(s.items, s.snacks)
        return id && get().eatFromBag(id) ? id : null
      },

      startRecipe: (id) => {
        const items = consumeRecipe(get().items, getRecipe(id))
        if (items) set({ items })
        return items !== null
      },

      sellItem: (vendor, id, qty) => {
        const s = get()
        const r = sellToVendor(s.coins, s.items, vendor, id, qty)
        if (!r.ok) return 0
        set({ coins: r.coins, items: r.items })
        return r.coins - s.coins
      },

      buyItem: (vendor, id, qty, src, day) => {
        const s = get()
        const r = buyFromVendor(s.coins, s.items, s.stock, src, day, vendor, id, qty)
        if (r.ok) set({ coins: r.coins, items: r.items, stock: r.stock })
        return r.ok
      },

      fireRound: (id) => {
        const ammo = spendRound(get().ammo, id)
        // 쏠 때마다 쓰지 않고 1초 안에 한 번 (탭을 숨기거나 닫으면 바로)
        if (ammo) saves.defer(() => set({ ammo }))
        return ammo !== null
      },

      reloadGun: (id) => {
        const r = reloadRounds(get().ammo, get().reserve, id)
        if (r) set({ ammo: r.mag, reserve: r.reserve })
        return r !== null
      },

      buyAmmo: (id, packs) => {
        const r = buyAmmoPacks(get().coins, get().reserve, id, packs)
        if (r.ok) set({ coins: r.coins, reserve: r.reserve })
        return r.ok
      },

      recordRangeScore: (score) => {
        if (!(Number.isInteger(score) && score > get().rangeBest)) return false
        set({ rangeBest: score })
        return true
      },

      countOreMined: () => {
        const oreMined = get().oreMined + 1
        set({ oreMined })
        return oreMined
      },

      openMineWall: (index) => set((s) => (index >= 0 && index < s.mineWalls.length ? { mineWalls: s.mineWalls.map((o, i) => (i === index ? true : o)) } : {})),

      setDoorOpen: (index, open) => set((s) => (index >= 0 && index < s.doors.length ? { doors: s.doors.map((o, i) => (i === index ? open : o)) } : {})),

      unlockZone: (id) => {
        const s = get()
        const zone = ZONES.find((z) => z.id === id)
        if (!zone) return false
        const result = unlockZoneRule(zone, { coins: s.coins, dexCount: Object.keys(s.dex).length, lineLevel: s.gear.line, unlocked: s.unlockedZones })
        if (!result.ok) return false
        set({ coins: result.coins, unlockedZones: result.unlocked })
        return true
      },

      resetProgress: () => set({ ...INITIAL_PROGRESS }),
    }),
    {
      name: SAVE_KEY,
      // 2: 장비·어항이 5단계 → 10단계. 3: 배고픔(survival.hunger)·혼자 시계(clock) 추가. 4: 은지 가방(items)·문(doors)·농산물 하루 수량(stock) 추가.
      // 5: 탄창(ammo)·예비 탄약(reserve)·사격장 최고 점수(rangeBest) 추가 (3~5 는 필드만 늘어 옮길 것 없다)
      version: SAVE_VERSION,
      migrate: (persisted, version) => migrateSave(persisted, version) as ProgressData & ProgressActions,
      storage: saves.storage,
      // 저장본의 각 필드를 검증해서, 틀린 값은 기본값을 쓰고 지금은 없는 물고기는 버린다
      merge: (persisted, current) => {
        const saved = isRecord(persisted) ? persisted : {}
        return {
          ...current,
          look: normalizeLook(saved.look),
          coins: readNonNegative(saved.coins, current.coins),
          playTime: readNonNegative(saved.playTime, current.playTime),
          gear: readGear(saved.gear, current.gear),
          inventory: readInventory(saved.inventory, current.inventory),
          dex: readDex(saved.dex, current.dex),
          survival: readSurvival(saved.survival, current.survival),
          feed: readCount(saved.feed, current.feed),
          aquarium: readAquarium(saved.aquarium, current.aquarium),
          bait: readBait(saved.bait, current.bait),
          selectedBait: readSelectedBait(saved.selectedBait),
          unlockedZones: readUnlockedZones(saved.unlockedZones),
          snacks: readSnacks(saved.snacks, current.snacks),
          clock: readClock(saved.clock) ?? current.clock,
          items: readItems(saved.items, current.items),
          doors: readDoors(saved.doors, current.doors),
          stock: readStock(saved.stock),
          ammo: readRounds(saved.ammo, current.ammo, (id) => GUNS[id].mag),
          reserve: readRounds(saved.reserve, current.reserve, () => MAX_RESERVE),
          rangeBest: readCount(saved.rangeBest, current.rangeBest),
          oreMined: readCount(saved.oreMined, current.oreMined),
          mineWalls: readFlags(saved.mineWalls, current.mineWalls),
        }
      },
    },
  ),
)
