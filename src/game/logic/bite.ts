import { BITE } from '../data/balance'
import { lerp, type Rng } from './rng'

export type BitePhase = 'waiting' | 'nibble' | 'bite' | 'missed' | 'hooked'

export type BiteState = {
  phase: BitePhase
  /** 현재 단계가 끝날 때까지 남은 시간(초) */
  timer: number
  /** 진짜 입질 전에 남은 페이크 횟수 */
  nibblesLeft: number
}

export function createBite(rng: Rng): BiteState {
  return {
    phase: 'waiting',
    timer: lerp(BITE.waitMin, BITE.waitMax, rng()),
    nibblesLeft: Math.floor(lerp(BITE.nibbleMin, BITE.nibbleMax + 1, rng())),
  }
}

export function stepBite(state: BiteState, dt: number, rng: Rng): BiteState {
  if (state.phase === 'missed' || state.phase === 'hooked') return state
  const timer = state.timer - dt
  if (timer > 0) return { ...state, timer }

  switch (state.phase) {
    case 'waiting':
      if (state.nibblesLeft > 0) {
        return { phase: 'nibble', timer: BITE.nibbleDuration, nibblesLeft: state.nibblesLeft - 1 }
      }
      return { ...state, phase: 'bite', timer: BITE.biteWindow }
    case 'nibble':
      return { ...state, phase: 'waiting', timer: lerp(BITE.gapMin, BITE.gapMax, rng()) }
    case 'bite':
      return { ...state, phase: 'missed', timer: 0 }
  }
}

/** 챔질(클릭). 진짜 입질일 때만 성공 */
export function hook(state: BiteState): BiteState {
  if (state.phase === 'bite') return { ...state, phase: 'hooked' }
  if (state.phase === 'waiting' || state.phase === 'nibble') return { ...state, phase: 'missed' }
  return state
}
