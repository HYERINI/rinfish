import { FIGHT, PATTERNS } from '../data/balance'
import type { BasicPattern, FightPattern, GearStats } from '../data/types'
import { lerpRange, type Rng } from './rng'

export type FightOutcome = 'fighting' | 'caught' | 'snapped' | 'escaped'

/** 요리 버프·체력 약화처럼 싸움에 곱해지는 보정값 (1차-B에서 사용) */
export type FightMods = { reelSpeedMul: number; tensionMul: number }
export const DEFAULT_MODS: FightMods = { reelSpeedMul: 1, tensionMul: 1 }

/** 물고기의 당김. active가 false면 timer는 다음 당김까지 남은 시간 */
export type Pull = { active: boolean; timer: number; intensity: number; pattern: BasicPattern }

export type FightState = {
  strength: number
  pattern: FightPattern
  gear: GearStats
  mods: FightMods
  distance: number
  tension: number
  /** 텐션이 너무 낮은 상태가 이어진 시간 */
  slackTime: number
  elapsed: number
  pull: Pull
  outcome: FightOutcome
}

export function createFight(
  fish: { strength: number; pattern: FightPattern },
  gear: GearStats,
  rng: Rng,
  mods: FightMods = DEFAULT_MODS,
): FightState {
  const state: FightState = {
    strength: fish.strength,
    pattern: fish.pattern,
    gear,
    mods,
    distance: FIGHT.startDistance,
    tension: FIGHT.startTension,
    slackTime: 0,
    elapsed: 0,
    pull: { active: false, timer: 0, intensity: 0, pattern: 'endurance' },
    outcome: 'fighting',
  }
  return { ...state, pull: scheduleNextPull(state, rng) }
}

/** 전설(mixed)은 남은 거리에 따라 패턴을 바꾼다 */
export function activePattern(state: FightState): BasicPattern {
  if (state.pattern !== 'mixed') return state.pattern
  const progress = state.distance / FIGHT.startDistance
  const [dasherAbove, enduranceAbove] = FIGHT.mixedPhaseThresholds
  if (progress > dasherAbove) return 'dasher'
  if (progress > enduranceAbove) return 'endurance'
  return 'erratic'
}

function scheduleNextPull(state: FightState, rng: Rng): Pull {
  const pattern = activePattern(state)
  return { active: false, timer: lerpRange(PATTERNS[pattern].interval, rng()), intensity: 0, pattern }
}

function startPull(state: FightState, rng: Rng): Pull {
  const config = PATTERNS[state.pull.pattern]
  return {
    active: true,
    timer: lerpRange(config.duration, rng()),
    intensity: lerpRange(config.intensity, rng()),
    pattern: state.pull.pattern,
  }
}

export function stepFight(state: FightState, input: { reeling: boolean }, rawDt: number, rng: Rng): FightState {
  if (state.outcome !== 'fighting') return state
  const dt = Math.min(rawDt, FIGHT.maxDt)
  const { gear, mods, pull, strength } = state

  const pullRate = pull.active
    ? strength * FIGHT.pullTensionPerStrength * pull.intensity * gear.shockAbsorb * mods.tensionMul
    : 0

  let tension = state.tension
  let distance = state.distance
  if (input.reeling) {
    tension += (FIGHT.reelTensionRate + pullRate) * dt
    distance -= gear.reelSpeed * mods.reelSpeedMul * (pull.active ? FIGHT.reelDuringPullFactor : 1) * dt
  } else {
    tension += (pullRate - FIGHT.relaxRate) * dt
    distance += (pull.active ? strength * FIGHT.pullDistancePerStrength * pull.intensity : FIGHT.driftSpeed) * dt
  }
  tension = Math.max(0, tension)
  distance = Math.max(0, distance)
  const slackTime = tension < FIGHT.slackThreshold ? state.slackTime + dt : 0

  const next: FightState = {
    ...state,
    tension,
    distance,
    slackTime,
    elapsed: state.elapsed + dt,
    pull: { ...pull, timer: pull.timer - dt },
  }
  if (next.pull.timer <= 0) {
    next.pull = pull.active ? scheduleNextPull(next, rng) : startPull(next, rng)
  }

  if (tension > gear.maxTension) next.outcome = 'snapped'
  else if (distance <= 0) next.outcome = 'caught'
  else if (distance >= FIGHT.escapeDistance || slackTime >= FIGHT.slackEscapeTime) next.outcome = 'escaped'
  return next
}
