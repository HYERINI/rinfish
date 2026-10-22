import type { BaitId } from '../data/bait'
import { getSpecies } from '../data/fish'
import type { GearStats, ZoneId } from '../data/types'
import { createBite, hook, stepBite, type BiteState } from './bite'
import { castPowerFromHold } from './cast'
import { rollSpecies, rollWeight } from './catchTable'
import { createFight, stepFight, type FightMods, type FightState } from './fight'
import type { Rng } from './rng'

export type FishingResult = 'caught' | 'snapped' | 'escaped' | 'missed'

export type FishingState =
  | { stage: 'aiming'; holding: boolean; holdTime: number }
  | { stage: 'waiting'; castPower: number; speciesId: string; bite: BiteState }
  | { stage: 'fighting'; castPower: number; speciesId: string; weight: number; fight: FightState }
  | { stage: 'done'; result: 'missed'; castPower: number }
  | { stage: 'done'; result: 'caught' | 'snapped' | 'escaped'; castPower: number; speciesId: string; weight: number }

export type FishingInput = {
  /** 마우스를 누르고 있는지 */
  pointerDown: boolean
  /** 이번 프레임에 새로 눌렀는지 (챔질) */
  pressed: boolean
}

/** bait: 던질 때 쓰는 미끼 (없으면 미끼 없이). 미끼를 줄이는 일은 스토어가 한다 */
export type FishingContext = { zone: ZoneId; gear: GearStats; mods?: FightMods; rng: Rng; bait?: BaitId | null }

export function startFishing(): FishingState {
  return { stage: 'aiming', holding: false, holdTime: 0 }
}

export function stepFishing(state: FishingState, input: FishingInput, dt: number, ctx: FishingContext): FishingState {
  switch (state.stage) {
    case 'aiming': {
      if (input.pointerDown) return { stage: 'aiming', holding: true, holdTime: state.holdTime + dt }
      if (!state.holding) return state
      // 손을 뗀 순간 던진다. 어떤 물고기가 올지는 이때 정해진다
      const castPower = castPowerFromHold(state.holdTime)
      const species = rollSpecies(ctx.zone, castPower, ctx.rng, ctx.bait ?? null)
      return { stage: 'waiting', castPower, speciesId: species.id, bite: createBite(ctx.rng) }
    }
    case 'waiting': {
      let bite = stepBite(state.bite, dt, ctx.rng)
      if (input.pressed) bite = hook(bite)
      if (bite.phase === 'missed') return { stage: 'done', result: 'missed', castPower: state.castPower }
      if (bite.phase === 'hooked') {
        const species = getSpecies(state.speciesId)
        return {
          stage: 'fighting',
          castPower: state.castPower,
          speciesId: state.speciesId,
          weight: rollWeight(species, ctx.rng),
          fight: createFight(species, ctx.gear, ctx.rng, ctx.mods),
        }
      }
      return { ...state, bite }
    }
    case 'fighting': {
      // 약화·버프는 싸움 도중에도 바뀌므로 매 스텝 최신 보정값을 쓴다
      const current = ctx.mods ? { ...state.fight, mods: ctx.mods } : state.fight
      const fight = stepFight(current, { reeling: input.pointerDown }, dt, ctx.rng)
      if (fight.outcome === 'fighting') return { ...state, fight }
      return {
        stage: 'done',
        result: fight.outcome,
        castPower: state.castPower,
        speciesId: state.speciesId,
        weight: state.weight,
      }
    }
    case 'done':
      return state
  }
}
