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
