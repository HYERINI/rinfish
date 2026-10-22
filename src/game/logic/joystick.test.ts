import { describe, expect, it } from 'vitest'
import { TOUCH } from '../data/touch'
import { moveInput, NO_MOVE, stickFromDrag } from './joystick'

const config = TOUCH.joystick
const noKeys = { forward: false, back: false, left: false, right: false }

describe('stickFromDrag', () => {
  it('화면 위로 끌면 앞(+y), 오른쪽은 +x. 반지름 대비 길이', () => {
    expect(stickFromDrag(0, -29, 58)).toEqual({ x: 0, y: 0.5 })
    expect(stickFromDrag(58, 0, 58)).toEqual({ x: 1, y: -0 })
  })

  it('반지름 밖으로 나가면 가장자리에 붙는다', () => {
    const s = stickFromDrag(300, -400, 58)
    expect(Math.hypot(s.x, s.y)).toBeCloseTo(1)
    expect(s.x).toBeCloseTo(0.6)
    expect(s.y).toBeCloseTo(0.8)
  })

  it('이상한 값이면 가운데', () => {
    expect(stickFromDrag(Number.NaN, 0, 58)).toEqual({ x: 0, y: 0 })
    expect(stickFromDrag(10, 10, 0)).toEqual({ x: 0, y: 0 })
  })
})

describe('moveInput', () => {
  it('키보드: WASD 그대로, 대각선은 길이 1로 맞추고 속도 배율 1 (달리기는 Shift 가 정한다)', () => {
    expect(moveInput({ ...noKeys, forward: true }, { x: 0, y: 0 }, config)).toEqual({ forward: 1, right: 0, scale: 1, sprint: false })
    const diag = moveInput({ ...noKeys, forward: true, right: true }, { x: 0, y: 0 }, config)
    expect(Math.hypot(diag.forward, diag.right)).toBeCloseTo(1)
    expect(moveInput({ ...noKeys, forward: true, back: true }, { x: 0, y: 0 }, config)).toEqual(NO_MOVE)
  })

  it('키보드를 누르고 있으면 조이스틱보다 먼저', () => {
    expect(moveInput({ ...noKeys, left: true }, { x: 0, y: 1 }, config)).toEqual({ forward: 0, right: -1, scale: 1, sprint: false })
  })

  it('조이스틱 데드존 안이면 멈춘다', () => {
    expect(moveInput(noKeys, { x: 0.05, y: 0.05 }, config)).toEqual(NO_MOVE)
  })

  it('조이스틱: 방향은 길이 1, 조금 밀면 천천히(최소 걷기), sprintAt 에서 걷기 최고 속도', () => {
    const slow = moveInput(noKeys, { x: 0, y: config.deadzone + 0.01 }, config)
    expect(slow.forward).toBeCloseTo(1)
    expect(slow.scale).toBe(config.minWalk)
    expect(slow.sprint).toBe(false)
    const mid = moveInput(noKeys, { x: 0.5, y: 0 }, config)
    expect(mid.right).toBeCloseTo(1)
    expect(mid.scale).toBeGreaterThan(config.minWalk)
    expect(mid.scale).toBeLessThan(1)
    const edge = moveInput(noKeys, { x: 0, y: config.sprintAt - 0.001 }, config)
    expect(edge.scale).toBeCloseTo(1, 2)
    expect(edge.sprint).toBe(false)
  })

  it('조이스틱을 sprintAt 넘게 밀면 달린다', () => {
    const run = moveInput(noKeys, { x: -0.6, y: -0.8 }, config)
    expect(run.sprint).toBe(true)
    expect(run.scale).toBe(1)
    expect(run.right).toBeCloseTo(-0.6)
    expect(run.forward).toBeCloseTo(-0.8)
  })
})
