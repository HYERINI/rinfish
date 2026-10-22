import { EAT } from '../data/balance'
import { JUMP_POSE, SPRINT_MIN_SPEED, type CharacterClip } from '../data/characters'
import type { FishingState } from './fishingSession'
import { EMOTES, type EmoteId } from '../data/emotes'
import { IDLE_ACTION, type PlayerAction } from './playerMotion'

/**
 * 캐릭터 자세 고르기. 이동 속도·낚시 상태·동작 상태(점프·감정 표현)만 보고 정한다 (애니메이션 재생은 scene 쪽 일)
 * - aim: 두 손으로 낚싯대를 쥐고 낚싯대 각도에 맞춰 팔을 올리고 내린다
 * - tug: aim 자세 그대로 뒤로 젖혀 버틴다 (상체 젖힘은 scene 에서 덧입힌다)
 * - dragged: 물고기가 당기면 앞으로 끌려가며 허우적댄다
 * - eat: 서서 오른손에 든 음식을 입으로 가져가 먹는다 (서 있기 클립 위에 팔을 덧돌린다. eatArm 참고)
 */
export type CharacterPose =
  | 'idle'
  | 'walk'
  | 'run'
  | 'sprint'
  | 'aim'
  | 'tug'
  | 'dragged'
  | 'celebrate'
  | 'fallBack'
  | 'dejected'
  | 'sit'
  | 'standUp'
  | 'jumpStart'
  | 'jumpLoop'
  | 'jumpLand'
  | 'eat'
  | EmoteId

export const CHARACTER_POSES: CharacterPose[] = [
  'idle',
  'walk',
  'run',
  'sprint',
  'aim',
  'tug',
  'dragged',
  'celebrate',
  'fallBack',
  'dejected',
  'sit',
  'standUp',
  'jumpStart',
  'jumpLoop',
  'jumpLand',
  'eat',
  ...EMOTES.map((e) => e.id),
]

/** 이 속도(m/s)보다 느리면 서 있는다 */
export const WALK_MIN_SPEED = 0.3
/** 이 속도부터 뛴다 */
export const RUN_MIN_SPEED = 2.5
/** 애니메이션 원본이 한 바퀴 동안 나아가는 속도(m/s). 발이 미끄러지지 않게 재생 속도를 맞춘다 */
const WALK_CLIP_SPEED = 0.97
const RUN_CLIP_SPEED = 5.36
const SPRINT_CLIP_SPEED = 8

/** 낚싯대 각도(Player 의 rodAngle)별로 팔이 가장 잘 맞는 조준 자세 */
const AIM_UP_ANGLE = -1.3
const AIM_NEUTRAL_ANGLE = 0.5
const AIM_DOWN_ANGLE = 1.3

/**
 * resting: 벤치에 앉아 쉬는 중. standingUp: 막 일어나는 중(일어나기 클립 재생 시간 동안).
 * action·now: 점프·감정 표현 상태와 지금 시각. 앉기 → 낚시 → 점프 → 감정 표현 → 착지 → 이동 순으로 먼저 정해진다
 */
export function characterPose(fishing: FishingState | null, speed: number, resting = false, standingUp = false, action: PlayerAction = IDLE_ACTION, now = 0): CharacterPose {
  if (resting) return 'sit'
  if (!fishing) {
    if (action.airborne) return now - action.jumpAt < JUMP_POSE.startTime ? 'jumpStart' : 'jumpLoop'
    if (action.emote) return action.emote
    if (action.eat) return 'eat'
    if (speed < WALK_MIN_SPEED) {
      if (now - action.landedAt < JUMP_POSE.landTime) return 'jumpLand'
      return standingUp ? 'standUp' : 'idle'
    }
    if (speed < RUN_MIN_SPEED) return 'walk'
    return speed < SPRINT_MIN_SPEED ? 'run' : 'sprint'
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

/** 자세 하나를 이루는 클립과 비율. sitEntering: 앉기 시작 클립이 아직 끝나지 않았다 */
export function poseClips(pose: CharacterPose, rodAngle: number, sitEntering = false): [CharacterClip, number][] {
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
    case 'sit':
      return [[sitEntering ? 'sitEnter' : 'sitIdle', 1]]
    case 'standUp':
      return [['sitExit', 1]]
    case 'eat':
      return [['idle', 1]]
    default:
      return [[pose, 1]]
  }
}

/**
 * 먹는 동안 오른팔: raise 는 음식을 입으로 올린 정도(0~1, 처음·끝 raiseTime 동안 부드럽게 오르내린다),
 * chew 는 한 입 베어 무는 들썩임(0~1, biteEvery 마다). 먹고 있지 않으면 둘 다 0
 */
export function eatArm(action: PlayerAction, now: number): { raise: number; chew: number } {
  if (!action.eat) return { raise: 0, chew: 0 }
  const t = now - action.eatAt
  if (t < 0 || t >= EAT.duration) return { raise: 0, chew: 0 }
  const k = Math.min(1, t / EAT.raiseTime, (EAT.duration - t) / EAT.raiseTime)
  const raise = k * k * (3 - 2 * k)
  const chew = raise >= 1 ? 0.5 - 0.5 * Math.cos(((t - EAT.raiseTime) / EAT.biteEvery) * Math.PI * 2) : 0
  return { raise, chew }
}

/**
 * 지금 몇 번째 한 입인지 (0부터). 손이 입에 다 올라간 뒤 biteEvery 마다 하나씩 늘고,
 * 손을 올리는 중·내리는 중·안 먹을 때는 -1
 */
export function chewBite(action: PlayerAction, now: number): number {
  if (!action.eat) return -1
  const t = now - action.eatAt
  if (t < EAT.raiseTime || t >= EAT.duration - EAT.raiseTime) return -1
  return Math.floor((t - EAT.raiseTime) / EAT.biteEvery)
}

/** 클립 재생 속도. 걷기·뛰기는 실제 이동 속도에 맞추고, 나머지는 과장되게 빠르거나 느리게 */
export function clipTimeScale(clip: CharacterClip, speed: number): number {
  switch (clip) {
    case 'walk':
      return Math.min(2, Math.max(0.6, speed / WALK_CLIP_SPEED))
    case 'run':
      return Math.min(1.6, Math.max(0.6, speed / RUN_CLIP_SPEED))
    case 'sprint':
      return Math.min(1.8, Math.max(0.8, speed / SPRINT_CLIP_SPEED))
    case 'dragged':
      return 1.8 // 허둥지둥
    case 'celebrate':
    case 'dance':
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
