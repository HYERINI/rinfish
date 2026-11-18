import { GUNS, GUN_IDS, MAX_RESERVE, START_RESERVE, type GunId } from '../data/guns'
import { AMMO_PACKS } from '../data/meadowPrices'

/** 총마다 탄 수 (탄창 안 · 예비) */
export type Rounds = Record<GunId, number>

/** 처음: 탄창 가득 */
export const FULL_MAGS: Rounds = Object.fromEntries(GUN_IDS.map((id) => [id, GUNS[id].mag])) as Rounds
/** 처음 예비 탄약 (은지 그대로) */
export const START_ROUNDS: Rounds = { ...START_RESERVE }

/** 한 발 쏜다. 탄창이 비었으면 null */
export function spendRound(mag: Rounds, id: GunId): Rounds | null {
  return mag[id] > 0 ? { ...mag, [id]: mag[id] - 1 } : null
}

/** 장전할 수 있나: 탄창이 덜 찼고 예비가 있다 (은지 reload 조건) */
export function canReload(mag: Rounds, reserve: Rounds, id: GunId): boolean {
  return mag[id] < GUNS[id].mag && reserve[id] > 0
}

/** 장전이 끝났다: 예비에서 모자란 만큼만 채운다. 못 하면 null */
export function reloadRounds(mag: Rounds, reserve: Rounds, id: GunId): { mag: Rounds; reserve: Rounds } | null {
  if (!canReload(mag, reserve, id)) return null
  const take = Math.min(GUNS[id].mag - mag[id], reserve[id])
  return { mag: { ...mag, [id]: mag[id] + take }, reserve: { ...reserve, [id]: reserve[id] - take } }
}

export type AmmoBuy = { ok: true; coins: number; reserve: Rounds } | { ok: false; reason: 'qty' | 'coins' | 'full' }

/** 예비 상한(MAX_RESERVE)을 넘지 않고 더 살 수 있는 묶음 수 (버려질 탄에 코인을 받지 않는다) */
export function ammoPacksThatFit(reserve: Rounds, id: GunId): number {
  return Math.max(0, Math.floor((MAX_RESERVE - reserve[id]) / AMMO_PACKS[id].n))
}

/** 잡화점에서 탄약 묶음 packs 개를 산다 (예비에 더한다). 상한을 넘는 만큼은 팔지 않는다 ('full') */
export function buyAmmoPacks(coins: number, reserve: Rounds, id: GunId, packs: number): AmmoBuy {
  if (!Number.isInteger(packs) || packs < 1) return { ok: false, reason: 'qty' }
  if (packs > ammoPacksThatFit(reserve, id)) return { ok: false, reason: 'full' }
  const { n, price } = AMMO_PACKS[id]
  if (coins < price * packs) return { ok: false, reason: 'coins' }
  return { ok: true, coins: coins - price * packs, reserve: { ...reserve, [id]: reserve[id] + n * packs } }
}

/** 저장본의 탄 수. 총마다 0 ~ max(id) 정수만 살리고 나머지는 fallback */
export function readRounds(v: unknown, fallback: Rounds, max: (id: GunId) => number): Rounds {
  const out = { ...fallback }
  if (typeof v !== 'object' || v === null) return out
  for (const id of GUN_IDS) {
    const n = (v as Record<string, unknown>)[id]
    if (typeof n === 'number' && Number.isInteger(n) && n >= 0 && n <= max(id)) out[id] = n
  }
  return out
}
