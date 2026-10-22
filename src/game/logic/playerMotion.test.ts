import { describe, expect, it } from 'vitest'
import { CAMERA_ZOOM, MOVE } from '../data/balance'
import { IDLE_ACTION, cameraRig, moveSpeed, nextAction, type MotionInput, type PlayerAction } from './playerMotion'

const input = (over: Partial<MotionInput> = {}): MotionInput => ({
  moving: false,
  sprint: false,
  jumpPressed: false,
  emotePressed: null,
  grounded: true,
  mode: 'explore',
  now: 10,
  ...over,
})
/** 한 번짜리 감정 표현은 모두 1초짜리로 친다 */
const length = () => 1

describe('nextAction: 점프', () => {
  it('땅에서 Space 를 누르면 뛰어오른다', () => {
    const a = nextAction(IDLE_ACTION, input({ jumpPressed: true }), length)
    expect(a.airborne).toBe(true)
    expect(a.jumpAt).toBe(10)
  })

  it('공중에서 Space 를 연타해도 다시 뛰지 않는다', () => {
    let a = nextAction(IDLE_ACTION, input({ jumpPressed: true, now: 10 }), length)
    for (let t = 10.1; t < 11; t += 0.1) a = nextAction(a, input({ jumpPressed: true, grounded: false, now: t }), length)
    expect(a.airborne).toBe(true)
    expect(a.jumpAt).toBe(10)
  })

  it('땅에 닿으면 착지 시각을 남기고, 그 뒤엔 다시 뛸 수 있다', () => {
    const air: PlayerAction = { ...IDLE_ACTION, airborne: true, jumpAt: 10 }
    const landed = nextAction(air, input({ now: 11.2 }), length)
    expect(landed.airborne).toBe(false)
    expect(landed.landedAt).toBe(11.2)
    expect(nextAction(landed, input({ jumpPressed: true, now: 11.3 }), length).jumpAt).toBe(11.3)
  })

  it('뛰어오르면 감정 표현은 멈춘다', () => {
    const dancing: PlayerAction = { ...IDLE_ACTION, emote: 'dance', emoteAt: 9 }
    expect(nextAction(dancing, input({ jumpPressed: true }), length).emote).toBeNull()
  })

  it('아무 일도 없으면 같은 값을 그대로 돌려준다 (매 프레임 저장소를 흔들지 않게)', () => {
    expect(nextAction(IDLE_ACTION, input(), length)).toBe(IDLE_ACTION)
  })
})

describe('nextAction: 감정 표현', () => {
  it('숫자 키로 시작한다', () => {
    const a = nextAction(IDLE_ACTION, input({ emotePressed: 'chat' }), length)
    expect(a.emote).toBe('chat')
    expect(a.emoteAt).toBe(10)
  })

  it('이동 키를 누르면 바로 멈춘다', () => {
    const dancing: PlayerAction = { ...IDLE_ACTION, emote: 'dance', emoteAt: 9 }
    expect(nextAction(dancing, input({ moving: true }), length).emote).toBeNull()
  })

  it('움직이는 중이나 공중에서는 시작하지 않는다', () => {
    expect(nextAction(IDLE_ACTION, input({ moving: true, emotePressed: 'dance' }), length).emote).toBeNull()
    expect(nextAction(IDLE_ACTION, input({ grounded: false, emotePressed: 'dance' }), length).emote).toBeNull()
  })

  it('한 번짜리 감정 표현은 클립 길이가 지나면 저절로 끝나고, 반복 감정 표현은 계속된다', () => {
    const punching: PlayerAction = { ...IDLE_ACTION, emote: 'punch', emoteAt: 10 }
    expect(nextAction(punching, input({ now: 10.5 }), length).emote).toBe('punch')
    expect(nextAction(punching, input({ now: 11 }), length).emote).toBeNull()
    expect(nextAction(punching, input({ now: 11 }), () => 2).emote).toBe('punch')
    const dancing: PlayerAction = { ...IDLE_ACTION, emote: 'dance', emoteAt: 10 }
    expect(nextAction(dancing, input({ now: 100 }), length).emote).toBe('dance')
  })
})

describe('nextAction: 탐험 모드가 아닐 때', () => {
  it('낚시·패널·휴식 중엔 Space·숫자 키가 아무 일도 하지 않는다', () => {
    for (const mode of ['fishing', 'rest', 'menu', 'shop', 'wardrobe'] as const) {
      const a = nextAction(IDLE_ACTION, input({ mode, jumpPressed: true, emotePressed: 'dance' }), length)
      expect(a).toEqual(IDLE_ACTION)
    }
  })

  it('하던 감정 표현은 멈춘다', () => {
    const dancing: PlayerAction = { ...IDLE_ACTION, emote: 'dance', emoteAt: 9 }
    expect(nextAction(dancing, input({ mode: 'fishing' }), length).emote).toBeNull()
  })

  it('공중에서 낚시를 시작해도 착지는 기록한다 (점프 자세가 남지 않게)', () => {
    const air: PlayerAction = { ...IDLE_ACTION, airborne: true, jumpAt: 10 }
    expect(nextAction(air, input({ mode: 'fishing', now: 11 }), length).airborne).toBe(false)
  })
})

describe('moveSpeed', () => {
  it('Shift 를 누르면 질주 속도', () => {
    expect(moveSpeed(false)).toBe(MOVE.walkSpeed)
    expect(moveSpeed(true)).toBe(MOVE.sprintSpeed)
    expect(moveSpeed(true)).toBeGreaterThan(moveSpeed(false))
  })
})

describe('cameraRig', () => {
  it('closeFrom 보다 멀면 예전처럼 거리 × heightRatio 만큼 시선 위에 있다', () => {
    const r = cameraRig(10, 1.8)
    expect(r.lookAtY).toBeCloseTo(1.8 * CAMERA_ZOOM.farLookAt)
    expect(r.height - r.lookAtY).toBeCloseTo(10 * CAMERA_ZOOM.heightRatio)
  })

  it('가까울수록 카메라는 낮아지고 시선은 얼굴 높이로 올라간다', () => {
    let prev = cameraRig(CAMERA_ZOOM.closeFrom, 1.8)
    for (let d = CAMERA_ZOOM.closeFrom - 0.5; d >= CAMERA_ZOOM.min; d -= 0.5) {
      const r = cameraRig(d, 1.8)
      expect(r.height).toBeLessThan(prev.height)
      expect(r.lookAtY).toBeGreaterThanOrEqual(prev.lookAtY)
      prev = r
    }
  })

  it('가장 가까이 당기면 얼굴 높이를 보고, 카메라는 얼굴보다 조금 위에 있다', () => {
    for (const h of [1.8 * 0.75, 1.8 * 1.3]) {
      const r = cameraRig(CAMERA_ZOOM.min, h)
      expect(r.lookAtY).toBeCloseTo(h * CAMERA_ZOOM.closeLookAt)
      expect(r.height).toBeCloseTo(r.lookAtY + CAMERA_ZOOM.min * CAMERA_ZOOM.closeHeightRatio)
    }
  })
})
