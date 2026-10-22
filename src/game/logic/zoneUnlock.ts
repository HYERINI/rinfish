import type { ZoneId } from '../data/types'
import { FISHING_SPOTS, ZONES, type FishingSpot, type ZoneDef } from '../data/zones'

/** 구역을 열 수 있는지 판단할 때 보는 값. lineLevel 은 낚싯줄 단계(0부터, 화면 Lv 는 +1) */
export type UnlockContext = { coins: number; dexCount: number; lineLevel: number; unlocked: readonly ZoneId[] }

/**
 * - open: 이미 열려 있다
 * - ready: 지금 열 수 있다 (cost 코인을 낸다. 동굴은 0)
 * - short: 아직 못 연다. 코인이 모자라거나(missing 만큼) 동굴 조건이 모자란다(progress 로 진행도를 보여 준다)
 */
export type UnlockStatus =
  | { state: 'open' }
  | { state: 'ready'; cost: number }
  | { state: 'short'; reason: 'coins'; cost: number; missing: number }
  | { state: 'short'; reason: 'conditions'; progress: string }

/** 해변처럼 여는 방법이 없는 구역은 늘 열려 있다 */
export function isZoneOpen(id: ZoneId, unlocked: readonly ZoneId[]): boolean {
  const zone = ZONES.find((z) => z.id === id)
  return !zone?.unlock || unlocked.includes(id)
}

/** 열린 구역의 낚시 포인트만. 잠긴 구역 포인트는 보이지도, E 로 시작되지도 않는다 */
export function openFishingSpots(unlocked: readonly ZoneId[]): FishingSpot[] {
  return FISHING_SPOTS.filter((s) => isZoneOpen(s.zone, unlocked))
}

/** 동굴 조건 진행도. 예: "도감 5/8 · 낚싯줄 Lv2/3" */
export function clearProgress(minDex: number, minLineLevel: number, dexCount: number, lineLevel: number): string {
  return `도감 ${Math.min(dexCount, minDex)}/${minDex} · 낚싯줄 Lv${Math.min(lineLevel + 1, minLineLevel)}/${minLineLevel}`
}

export function unlockStatus(zone: ZoneDef, ctx: UnlockContext): UnlockStatus {
  if (isZoneOpen(zone.id, ctx.unlocked) || !zone.unlock) return { state: 'open' }
  const u = zone.unlock
  if (u.kind === 'repair') {
    return ctx.coins >= u.price ? { state: 'ready', cost: u.price } : { state: 'short', reason: 'coins', cost: u.price, missing: u.price - ctx.coins }
  }
  const met = ctx.dexCount >= u.minDex && ctx.lineLevel + 1 >= u.minLineLevel
  return met ? { state: 'ready', cost: 0 } : { state: 'short', reason: 'conditions', progress: clearProgress(u.minDex, u.minLineLevel, ctx.dexCount, ctx.lineLevel) }
}

export type UnlockResult = { ok: true; coins: number; unlocked: ZoneId[] } | { ok: false; status: UnlockStatus }

/** 구역 열기. 열 수 있으면 코인을 내고 열린 목록에 넣는다 */
export function unlockZone(zone: ZoneDef, ctx: UnlockContext): UnlockResult {
  const status = unlockStatus(zone, ctx)
  if (status.state !== 'ready') return { ok: false, status }
  return { ok: true, coins: ctx.coins - status.cost, unlocked: [...ctx.unlocked, zone.id] }
}

/** 입구마다 부르는 이름 (다리·보트·바위) */
function gateNoun(zone: ZoneDef): string {
  if (zone.unlock?.kind === 'repair') return zone.unlock.target === 'bridge' ? '다리' : '보트'
  return '바위'
}

/** 잠긴 문 이름표 둘째 줄: 어떻게 여는지와 지금 얼마나 모였는지. 열렸으면 null */
export function unlockHint(zone: ZoneDef, ctx: UnlockContext): string | null {
  const status = unlockStatus(zone, ctx)
  const noun = gateNoun(zone)
  if (status.state === 'open') return null
  if (status.state === 'ready') return status.cost > 0 ? `✅ 수리비 ${status.cost}코인 준비 완료! ${noun} 앞으로 가서 E` : `✅ 조건 달성! ${noun} 앞으로 가서 E`
  if (status.reason === 'coins') return `🔨 수리비 ${status.cost}코인 (지금 ${ctx.coins}/${status.cost}) · 모이면 ${noun} 앞에서 E`
  return `🪨 ${status.progress} 채우면 수리기사님이 ${noun}를 치워 줘요`
}

/** 다음 목표를 고르는 순서: 싼 다리 → 보트 → 동굴 */
const GOAL_ORDER: ZoneId[] = ['pond', 'reef', 'cave']

export type Goal = { zoneId: ZoneId; title: string; detail: string; ratio: number }

/**
 * 화면 위에 띄울 "다음 목표". 아직 안 열린 구역을 순서대로 보고 첫 번째 것의 할 일을 알려 준다.
 * 모두 열렸으면 null
 */
export function nextGoal(ctx: UnlockContext): Goal | null {
  for (const id of GOAL_ORDER) {
    const zone = ZONES.find((z) => z.id === id)
    if (!zone?.unlock) continue
    const status = unlockStatus(zone, ctx)
    if (status.state === 'open') continue
    const noun = gateNoun(zone)
    const u = zone.unlock
    if (u.kind === 'repair') {
      const ratio = Math.min(1, ctx.coins / u.price)
      if (status.state === 'ready') return { zoneId: id, title: `${zone.name} 열기`, detail: `${noun} 앞으로 가서 E → 수리비 ${u.price}코인 내기`, ratio }
      return { zoneId: id, title: `${zone.name} 열기`, detail: `물고기를 잡아 판매함에 팔고 코인 모으기 (${ctx.coins}/${u.price})`, ratio }
    }
    const ratio = (Math.min(ctx.dexCount, u.minDex) / u.minDex + Math.min(ctx.lineLevel + 1, u.minLineLevel) / u.minLineLevel) / 2
    if (status.state === 'ready') return { zoneId: id, title: `${zone.name} 열기`, detail: `${noun} 앞으로 가서 E → 수리기사님 부르기`, ratio: 1 }
    return { zoneId: id, title: `${zone.name} 열기`, detail: `${clearProgress(u.minDex, u.minLineLevel, ctx.dexCount, ctx.lineLevel)} (도감은 새 물고기, 낚싯줄은 장비 상점)`, ratio }
  }
  return null
}
