import { describe, expect, it } from 'vitest'
import { WHEEL_IDLE, wheelStep, wheelTool } from './wheelTool'

describe('휠로 무기 바꾸기', () => {
  it('아래로 굴리면 다음 칸, 위로 굴리면 이전 칸 (도구 칸 순서)', () => {
    expect(wheelTool('fists', 1)).toBe('knife')
    expect(wheelTool('knife', -1)).toBe('fists')
    expect(wheelTool('pistol', 1)).toBe('rifle')
  })
  it('끝에서 처음으로 돈다', () => {
    expect(wheelTool('sniper', 1)).toBe('rod')
    expect(wheelTool('rod', -1)).toBe('sniper')
  })
  it('빈손이면 아래로는 첫 칸, 위로는 마지막 칸', () => {
    expect(wheelTool(null, 1)).toBe('rod')
    expect(wheelTool(null, -1)).toBe('sniper')
  })
})

describe('휠 한 칸 세기 (트랙패드처럼 잘게 오는 값도 한 칸씩)', () => {
  it('마우스 휠 한 번(100)이면 바로 한 칸', () => {
    expect(wheelStep(WHEEL_IDLE, 100, 1).step).toBe(1)
    expect(wheelStep(WHEEL_IDLE, -100, 1).step).toBe(-1)
  })
  it('잘게 오는 값은 모아서 넘으면 한 칸', () => {
    let s = wheelStep(WHEEL_IDLE, 15, 1)
    expect(s.step).toBe(0)
    s = wheelStep(s.state, 15, 1.02)
    expect(s.step).toBe(0)
    s = wheelStep(s.state, 15, 1.04)
    expect(s.step).toBe(1)
  })
  it('한 칸 넘긴 직후 잠깐은 더 넘기지 않는다 (트랙패드 관성)', () => {
    const a = wheelStep(WHEEL_IDLE, 100, 1)
    expect(wheelStep(a.state, 100, 1.05).step).toBe(0)
    expect(wheelStep(a.state, 100, 1.2).step).toBe(1)
  })
  it('오래 쉬면 모아 둔 값은 버린다', () => {
    const a = wheelStep(WHEEL_IDLE, 30, 1)
    expect(wheelStep(a.state, 15, 2).step).toBe(0)
  })
  it('이상한 값은 무시', () => {
    expect(wheelStep(WHEEL_IDLE, Number.NaN, 1).step).toBe(0)
  })
})
