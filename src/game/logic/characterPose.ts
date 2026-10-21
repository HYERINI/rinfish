import type { CharacterClip } from '../data/characters'
import type { FishingState } from './fishingSession'

/**
 * 캐릭터 자세 고르기. 이동 속도와 낚시 상태만 보고 정한다 (애니메이션 재생은 scene 쪽 일)
 * - aim: 두 손으로 낚싯대를 쥐고 낚싯대 각도에 맞춰 팔을 올리고 내린다
 * - tug: aim 자세 그대로 뒤로 젖혀 버틴다 (상체 젖힘은 scene 에서 덧입힌다)
 * - dragged: 물고기가 당기면 앞으로 끌려가며 허우적댄다
 */
export type CharacterPose = 'idle' | 'walk' | 'run' | 'aim' | 'tug' | 'dragged' | 'celebrate' | 'fallBack' | 'dejected'

export const CHARACTER_POSES: CharacterPose[] = ['idle', 'walk', 'run', 'aim', 'tug', 'dragged', 'celebrate', 'fallBack', 'dejected']

/** 이 속도(m/s)보다 느리면 서 있는다 */
export const WALK_MIN_SPEED = 0.3
/** 이 속도부터 뛴다 */
export const RUN_MIN_SPEED = 2.5
/** 애니메이션 원본이 한 바퀴 동안 나아가는 속도(m/s). 발이 미끄러지지 않게 재생 속도를 맞춘다 */
const WALK_CLIP_SPEED = 0.97
const RUN_CLIP_SPEED = 5.36

/** 낚싯대 각도(Player 의 rodAngle)별로 팔이 가장 잘 맞는 조준 자세 */
const AIM_UP_ANGLE = -1.3
const AIM_NEUTRAL_ANGLE = 0.5
const AIM_DOWN_ANGLE = 1.3

export function characterPose(fishing: FishingState | null, speed: number): CharacterPose {
  if (!fishing) {
    if (speed < WALK_MIN_SPEED) return 'idle'
    return speed < RUN_MIN_SPEED ? 'walk' : 'run'
  }
  switch (fishing.stage) {
    case 'aiming':
    case 'waiting':
      return 'aim'
    case 'fighting':
      return fishing.fight.pull.active ? 'dragged' : 'tug'
    case 'done':
      if (fishing.result === 'caught') return 'celebrate'
      if (fishing.result === 'snapped') return 'fallBack'
      return 'dejected'
  }
}

/** 낚싯대 각도 → 위/가운데/아래 조준 자세 비율 (합 1). 젖힐수록 팔을 머리 위로 든다 */
export function aimWeights(rodAngle: number): { up: number; neutral: number; down: number } {
  if (rodAngle <= AIM_UP_ANGLE) return { up: 1, neutral: 0, down: 0 }
  if (rodAngle >= AIM_DOWN_ANGLE) return { up: 0, neutral: 0, down: 1 }
  if (rodAngle < AIM_NEUTRAL_ANGLE) {
    const k = (rodAngle - AIM_UP_ANGLE) / (AIM_NEUTRAL_ANGLE - AIM_UP_ANGLE)
    return { up: 1 - k, neutral: k, down: 0 }
  }
  const k = (rodAngle - AIM_NEUTRAL_ANGLE) / (AIM_DOWN_ANGLE - AIM_NEUTRAL_ANGLE)
  return { up: 0, neutral: 1 - k, down: k }
}

/** 자세 하나를 이루는 클립과 비율 */
export function poseClips(pose: CharacterPose, rodAngle: number): [CharacterClip, number][] {
  switch (pose) {
    case 'aim':
    case 'tug': {
      const w = aimWeights(rodAngle)
      return [
        ['aimUp', w.up],
        ['aimNeutral', w.neutral],
        ['aimDown', w.down],
      ]
    }
    default:
      return [[pose, 1]]
  }
}

/** 클립 재생 속도. 걷기·뛰기는 실제 이동 속도에 맞추고, 나머지는 과장되게 빠르거나 느리게 */
export function clipTimeScale(clip: CharacterClip, speed: number): number {
  switch (clip) {
    case 'walk':
      return Math.min(2, Math.max(0.6, speed / WALK_CLIP_SPEED))
    case 'run':
      return Math.min(1.6, Math.max(0.6, speed / RUN_CLIP_SPEED))
    case 'dragged':
      return 1.8 // 허둥지둥
    case 'celebrate':
      return 1.25
    case 'fallBack':
      return 1.3
    case 'dejected':
      return 0.6
    default:
      return 1
  }
}

/** 줄다리기 중 상체를 뒤로 젖히는 각도(라디안). 텐션이 높을수록 더 젖힌다. 그 밖의 자세는 0 */
export function leanBack(fishing: FishingState | null): number {
  if (!fishing || fishing.stage !== 'fighting' || fishing.fight.pull.active) return 0
  const f = fishing.fight
  return 0.3 + 0.45 * Math.min(f.tension / f.gear.maxTension, 1)
}
