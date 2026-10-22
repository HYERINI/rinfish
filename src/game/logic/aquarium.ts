import { SHOWCASE_FISH, TANK_LEVELS, getTankType } from '../data/aquarium'
import { AQUARIUM, VISITOR_INCOME_PER_MINUTE } from '../data/balance'
import { findSpecies } from '../data/fish'
import type { FishInstance, TankTypeId } from '../data/types'

export type AquariumState = {
  /** 확장 단계. 0부터 시작하고 화면에는 Lv1~Lv3 */
  level: number
  ownedTypes: TankTypeId[]
  activeType: TankTypeId
  displayed: FishInstance[]
  /** 마지막으로 먹이를 준 플레이 시간(초) */
  lastFedAt: number
  /** 아직 받지 않은 입장료. 소수점까지 쌓는다 */
  pendingIncome: number
}

export const EMPTY_AQUARIUM: AquariumState = {
  level: 0,
  ownedTypes: ['basic'],
  activeType: 'basic',
  displayed: [],
  /** -1 은 한 번도 먹이를 준 적(물고기를 넣은 적)이 없다는 뜻 */
  lastFedAt: -1,
  pendingIncome: 0,
}

export type AquariumEvent = 'hungry' | 'releaseWarning' | 'released'

export function slotCount(aq: AquariumState): number {
  return TANK_LEVELS[aq.level].slots
}

/**
 * 크게 보기에서 헤엄칠 물고기. 전시한 물고기가 있으면 그대로, 하나도 없으면 구경용 물고기(guest)를 대신 띄운다.
 * 구경용 물고기는 입장료·먹이에 들어가지 않으므로 화면에만 쓴다
 */
export function viewFishList(displayed: FishInstance[]): { fish: FishInstance[]; guest: boolean } {
  return displayed.length > 0 ? { fish: displayed, guest: false } : { fish: SHOWCASE_FISH, guest: true }
}

const hungryAt = (aq: AquariumState) => aq.lastFedAt + AQUARIUM.hungerAfter
const releaseAt = (aq: AquariumState) => hungryAt(aq) + AQUARIUM.releaseAfter

export function isHungry(aq: AquariumState, playTime: number): boolean {
  return aq.displayed.length > 0 && playTime >= hungryAt(aq)
}

/** 배부른 상태일 때 1초에 버는 입장료 */
export function incomePerSecond(aq: AquariumState): number {
  const type = getTankType(aq.activeType)
  let perMinute = 0
  for (const fish of aq.displayed) {
    const species = findSpecies(fish.speciesId)
    if (!species) continue
    const bonus = species.zones.some((z) => type.bonusZones.includes(z)) ? AQUARIUM.typeBonus : 1
    perMinute += VISITOR_INCOME_PER_MINUTE[species.rarity] * bonus
  }
  return (perMinute * TANK_LEVELS[aq.level].incomeMul) / 60
}

/** playTime: 이번 틱이 끝난 시점의 플레이 시간. dt: 이번 틱 길이 */
export function tickAquarium(aq: AquariumState, playTime: number, dt: number): { aquarium: AquariumState; events: AquariumEvent[] } {
  if (aq.displayed.length === 0) return { aquarium: aq, events: [] }
  if (playTime >= releaseAt(aq)) return { aquarium: { ...aq, displayed: [] }, events: ['released'] }

  const before = playTime - dt
  const crossed = (t: number) => before < t && playTime >= t
  const events: AquariumEvent[] = []
  if (crossed(hungryAt(aq))) events.push('hungry')
  if (crossed(releaseAt(aq) - AQUARIUM.releaseWarningBefore)) events.push('releaseWarning')

  // 배고픈 동안은 수입이 멈춘다. 틱 도중에 배고파졌다면 그 전까지만 번다
  const earning = Math.max(0, Math.min(playTime, hungryAt(aq)) - before)
  return { aquarium: { ...aq, pendingIncome: aq.pendingIncome + incomePerSecond(aq) * earning }, events }
}

export type DisplayResult = { ok: true; aquarium: AquariumState } | { ok: false; reason: 'full' }

export function displayFish(aq: AquariumState, fish: FishInstance, playTime: number): DisplayResult {
  if (aq.displayed.length >= slotCount(aq)) return { ok: false, reason: 'full' }
  // 한 번도 쓰지 않았거나, 물고기가 방생될 만큼 오래 비어 있던 어항은 막 밥을 먹은 상태로 시작한다.
  // 물고기를 잠깐 빼고 다시 넣는 것으로는 배고픔 시계를 되돌릴 수 없다
  const fresh = aq.lastFedAt < 0 || playTime - aq.lastFedAt >= AQUARIUM.hungerAfter + AQUARIUM.releaseAfter
  const lastFedAt = aq.displayed.length === 0 && fresh ? playTime : aq.lastFedAt
  return { ok: true, aquarium: { ...aq, displayed: [...aq.displayed, fish], lastFedAt } }
}

export function removeFromDisplay(aq: AquariumState, fishId: string): { aquarium: AquariumState; fish: FishInstance | null } {
  const fish = aq.displayed.find((f) => f.id === fishId) ?? null
  if (!fish) return { aquarium: aq, fish: null }
  return { aquarium: { ...aq, displayed: aq.displayed.filter((f) => f.id !== fishId) }, fish }
}

export function feedAquarium(aq: AquariumState, playTime: number): AquariumState {
  return { ...aq, lastFedAt: playTime }
}

export function claimIncome(aq: AquariumState): { aquarium: AquariumState; coins: number } {
  const coins = Math.floor(aq.pendingIncome)
  return { aquarium: { ...aq, pendingIncome: aq.pendingIncome - coins }, coins }
}

export type PurchaseResult = { ok: true; coins: number; aquarium: AquariumState } | { ok: false; reason: 'max' | 'coins' | 'owned' }

export function buyExpansion(coins: number, aq: AquariumState): PurchaseResult {
  const next = TANK_LEVELS[aq.level + 1]
  if (!next) return { ok: false, reason: 'max' }
  if (coins < next.price) return { ok: false, reason: 'coins' }
  return { ok: true, coins: coins - next.price, aquarium: { ...aq, level: aq.level + 1 } }
}

/** 사면 바로 그 종류로 바꾼다 */
export function buyTankType(coins: number, aq: AquariumState, typeId: TankTypeId): PurchaseResult {
  if (aq.ownedTypes.includes(typeId)) return { ok: false, reason: 'owned' }
  const price = getTankType(typeId).price
  if (coins < price) return { ok: false, reason: 'coins' }
  return { ok: true, coins: coins - price, aquarium: { ...aq, ownedTypes: [...aq.ownedTypes, typeId], activeType: typeId } }
}

export function selectTankType(aq: AquariumState, typeId: TankTypeId): AquariumState {
  if (!aq.ownedTypes.includes(typeId)) return aq
  return { ...aq, activeType: typeId }
}
