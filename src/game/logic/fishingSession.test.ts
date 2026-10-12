import { describe, expect, it } from 'vitest'
import { startFishing, stepFishing, type FishingContext, type FishingState } from './fishingSession'
import { fixedRng } from './rng'

const ctx: FishingContext = {
  zone: 'beach',
  gear: { maxTension: 100, reelSpeed: 8, shockAbsorb: 1 },
  rng: fixedRng(0),
}
const idle = { pointerDown: false, pressed: false }
const hold = { pointerDown: true, pressed: false }
const click = { pointerDown: true, pressed: true }

/** 1.5초 누르고 떼서 최대 파워로 던진 상태 */
function cast(): FishingState {
  let s = startFishing()
  s = stepFishing(s, click, 0.75, ctx)
  s = stepFishing(s, hold, 0.75, ctx)
  return stepFishing(s, idle, 0.016, ctx)
}

/** 던진 뒤 진짜 입질 직전까지 진행 (rng 0: 대기 2초, 페이크 1번, 간격 0.5초) */
function untilBite(): FishingState {
  let s = cast()
  s = stepFishing(s, idle, 2, ctx)
  s = stepFishing(s, idle, 0.3, ctx)
  return stepFishing(s, idle, 0.5, ctx)
}

describe('stepFishing', () => {
  it('누르고 있다가 떼면 던져지고, 물고기가 미리 정해진다', () => {
    const s = cast()
    expect(s.stage).toBe('waiting')
    if (s.stage !== 'waiting') return
    expect(s.castPower).toBe(1)
    expect(s.speciesId).toBe('sleepy-sardine')
  })

  it('누르지 않으면 던지지 않는다', () => {
    const s = startFishing()
    expect(stepFishing(s, idle, 1, ctx)).toBe(s)
  })

  it('입질 전에 클릭하면 놓친다', () => {
    let s = cast()
    s = stepFishing(s, idle, 1, ctx)
    s = stepFishing(s, click, 0.01, ctx)
    expect(s).toMatchObject({ stage: 'done', result: 'missed' })
  })

  it('진짜 입질 때 클릭하면 싸움이 시작되고 무게가 정해진다', () => {
    const s = stepFishing(untilBite(), click, 0.01, ctx)
    expect(s.stage).toBe('fighting')
    if (s.stage !== 'fighting') return
    expect(s.weight).toBe(0.1)
  })

  it('싸움 중 계속 감기만 하면 줄이 끊겨 끝난다', () => {
    let s = stepFishing(untilBite(), click, 0.01, ctx)
    for (let i = 0; i < 2000 && s.stage === 'fighting'; i++) s = stepFishing(s, hold, 0.05, ctx)
    expect(s).toMatchObject({ stage: 'done', result: 'snapped', speciesId: 'sleepy-sardine' })
  })

  it('끝난 상태는 그대로 유지된다', () => {
    let s = cast()
    s = stepFishing(s, click, 0.01, ctx)
    expect(stepFishing(s, click, 1, ctx)).toBe(s)
  })
})
