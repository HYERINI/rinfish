import { AIM_VIEW, DRY_FIRE_PAUSE, GUNS, GUN_SWAP, HEAT, RECOIL, isGun, type GunId } from '../data/guns'

/**
 * 총 쏘기 상태 (은지 WeaponSystem 의 cool·reloadT·heat). 시각은 초 (performance.now() 기준이라 게임을 다시 열어도 이어진다).
 * readyAt: 다음에 쏠 수 있는 때, reload: 장전 중인 총과 끝나는 때, heat·heatAt: 연사 열기와 그 값을 잰 때, firedAt: 마지막으로 쏜 때
 */
export type GunState = { readyAt: number; reload: { gun: GunId; until: number } | null; heat: number; heatAt: number; firedAt: number }

export const GUN_IDLE: GunState = { readyAt: -Infinity, reload: null, heat: 0, heatAt: 0, firedAt: -Infinity }

/** 지금 열기 (초당 HEAT.cool 씩 식는다) */
export function heatNow(s: GunState, now: number): number {
  return Math.max(0, s.heat - Math.max(0, now - s.heatAt) * HEAT.cool)
}

/** 퍼짐(rad): 조준하면 aimSpread, 연사 열기만큼 더 퍼진다 (은지 base) */
export function spreadOf(id: GunId, aiming: boolean, heat: number): number {
  const g = GUNS[id]
  return (aiming ? g.aimSpread : g.spread) + heat * HEAT.spread
}

/** 반동(rad): 조준하면 0.6배, 조준경으로 보면 0.5배 더 (은지 rig.kick) */
export function recoilOf(id: GunId, aiming: boolean, scoped: boolean): number {
  return GUNS[id].recoil * (aiming ? RECOIL.aim : 1) * (scoped ? RECOIL.scope : 1)
}

export type Trigger = { kind: 'fire' | 'empty' | 'busy'; state: GunState }

/**
 * 방아쇠. 아직 쏠 수 없거나(연사 간격·장전 중) → busy. 탄창이 비었으면 → empty (딸깍, 0.3초 쉰다. 장전은 부르는 쪽이).
 * 쏘면 다음 발까지 60/rpm 초, 연사 총은 열기가 오른다
 */
export function pullTrigger(s: GunState, id: GunId, now: number, rounds: number): Trigger {
  if (now < s.readyAt || s.reload) return { kind: 'busy', state: s }
  if (rounds <= 0) return { kind: 'empty', state: { ...s, readyAt: now + DRY_FIRE_PAUSE } }
  const g = GUNS[id]
  const heat = g.auto ? Math.min(1, heatNow(s, now) + HEAT.perShot) : heatNow(s, now)
  return { kind: 'fire', state: { ...s, readyAt: now + 60 / g.rpm, heat, heatAt: now, firedAt: now } }
}

/** 장전 시작 (R 또는 빈 탄창). 이미 장전 중이거나 할 수 없으면(canReload false) null */
export function startReload(s: GunState, id: GunId, now: number, canReload: boolean): GunState | null {
  if (s.reload || !canReload) return null
  return { ...s, reload: { gun: id, until: now + GUNS[id].reload } }
}

/** 장전이 끝났나: 끝났으면 그 총 (탄을 옮기는 건 부르는 쪽) 과 비운 상태 */
export function finishReload(s: GunState, now: number): { gun: GunId; state: GunState } | null {
  if (!s.reload || now < s.reload.until) return null
  return { gun: s.reload.gun, state: { ...s, reload: null } }
}

/** 장전 진행도 0..1 (장전 중이 아니면 -1) */
export function reloadProgress(s: GunState, now: number): number {
  if (!s.reload) return -1
  const total = GUNS[s.reload.gun].reload
  return Math.min(1, Math.max(0, 1 - (s.reload.until - now) / total))
}

/** 도구를 바꿨다: 장전·열기를 지우고 0.25초 뒤부터 쏜다 (은지 select) */
export function swapGun(s: GunState, now: number): GunState {
  return { ...s, reload: null, heat: 0, heatAt: now, readyAt: Math.max(s.readyAt, now + GUN_SWAP) }
}

/**
 * 3인칭 카메라를 오른쪽 어깨 너머로 비키는 거리(m). 총을 들고 돌아다니면 조준하지 않아도 비킨다 —
 * 가운데 그대로면 화면 가운데 조준점이 내 몸통에 겹친다. 조준하면 Player 가 거리만 더 당긴다
 */
export function cameraShoulder(mode: string, tool: string | null | undefined): number {
  return mode === 'explore' && isGun(tool) ? AIM_VIEW.shoulder : 0
}
