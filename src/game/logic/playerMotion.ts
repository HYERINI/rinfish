import { CAMERA_ZOOM, MOVE } from '../data/balance'
import { EMOTES, type EmoteId } from '../data/emotes'
import type { Mode } from './interaction'

/**
 * 플레이어 동작 상태 (감정 표현·점프). 캐릭터를 그리는 데 필요한 건 이 값과 수평 이동 속도뿐이다.
 * 나중에 여러 명이 같이 할 때 이 값만 주고받으면 다른 사람 캐릭터도 같은 코드로 그릴 수 있다
 * - emoteAt / jumpAt / landedAt: 그 일이 일어난 시각(초). 한 번도 없었으면 아주 오래전
 */
export type PlayerAction = { emote: EmoteId | null; emoteAt: number; airborne: boolean; jumpAt: number; landedAt: number }

/** 한 프레임의 입력. 키 입력(moving·sprint·jumpPressed·emotePressed)과 물리 판정(grounded) */
export type MotionInput = {
  moving: boolean
  sprint: boolean
  /** 이번 프레임에 새로 눌렀다 (꾹 누르고 있는 반복 입력은 아님) */
  jumpPressed: boolean
  emotePressed: EmoteId | null
  grounded: boolean
  mode: Mode
  now: number
}

/** "아주 오래전". JSON 으로 보내도 깨지지 않게 -Infinity 대신 쓴다 */
const LONG_AGO = -1e9

export const IDLE_ACTION: PlayerAction = { emote: null, emoteAt: LONG_AGO, airborne: false, jumpAt: LONG_AGO, landedAt: LONG_AGO }

const LOOPING = new Set(EMOTES.filter((e) => e.loop).map((e) => e.id))

/**
 * 다음 동작 상태. 바뀐 게 없으면 받은 값을 그대로 돌려준다.
 * - 땅에 닿으면 착지 (모드와 상관없이. 공중에서 낚시를 시작해도 점프 자세가 남지 않게)
 * - 탐험 모드가 아니면 감정 표현을 멈추고 점프·감정 표현 키는 무시한다
 * - 움직이거나 뛰어오르면 감정 표현을 멈춘다. 점프는 땅에 있을 때만
 * - 한 번짜리 감정 표현은 emoteLength(초)가 지나면 저절로 끝난다
 */
export function nextAction(action: PlayerAction, input: MotionInput, emoteLength: (id: EmoteId) => number): PlayerAction {
  const { now } = input
  let next = action
  const patch = (p: Partial<PlayerAction>) => (next = { ...next, ...p })

  if (next.airborne && input.grounded) patch({ airborne: false, landedAt: now })

  if (input.mode !== 'explore') {
    if (next.emote) patch({ emote: null })
    return next
  }

  if (next.emote && input.moving) patch({ emote: null })
  if (input.jumpPressed && input.grounded && !next.airborne) patch({ airborne: true, jumpAt: now, emote: null })
  if (input.emotePressed && !input.moving && input.grounded && !next.airborne) patch({ emote: input.emotePressed, emoteAt: now })
  if (next.emote && !LOOPING.has(next.emote) && now - next.emoteAt >= emoteLength(next.emote)) patch({ emote: null })
  return next
}

/** 수평 이동 속도 (m/s) */
export function moveSpeed(sprint: boolean): number {
  return sprint ? MOVE.sprintSpeed : MOVE.walkSpeed
}

/**
 * 3인칭 카메라 높이와 시선 높이 (발바닥 기준, m). 카메라 높이 = 시선 높이 + 거리 × 높이 비율.
 * closeFrom 보다 가까워질수록 높이 비율은 heightRatio → closeHeightRatio, 시선은 farLookAt → closeLookAt(키 대비)로 부드럽게 옮겨 간다
 */
export function cameraRig(distance: number, characterHeight: number): { height: number; lookAtY: number } {
  const { min, closeFrom } = CAMERA_ZOOM
  const k = Math.min(1, Math.max(0, (closeFrom - distance) / (closeFrom - min)))
  const t = k * k * (3 - 2 * k) // smoothstep: 양 끝에서 갑자기 꺾이지 않게
  const lookAtY = characterHeight * (CAMERA_ZOOM.farLookAt + (CAMERA_ZOOM.closeLookAt - CAMERA_ZOOM.farLookAt) * t)
  const ratio = CAMERA_ZOOM.heightRatio + (CAMERA_ZOOM.closeHeightRatio - CAMERA_ZOOM.heightRatio) * t
  return { height: lookAtY + distance * ratio, lookAtY }
}
