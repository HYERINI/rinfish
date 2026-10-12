import { describe, expect, it } from 'vitest'
import { createBite, hook, stepBite } from './bite'
import { fixedRng } from './rng'

const rng = fixedRng(0)

describe('bite', () => {
  it('rng가 0이면 2초 대기, 페이크 1번으로 시작한다', () => {
    expect(createBite(rng)).toEqual({ phase: 'waiting', timer: 2, nibblesLeft: 1 })
  })

  it('대기 → 페이크 → 대기 → 진짜 입질 순서로 진행된다', () => {
    let s = createBite(rng)
    s = stepBite(s, 2, rng)
    expect(s.phase).toBe('nibble')
    s = stepBite(s, 0.3, rng)
    expect(s.phase).toBe('waiting')
    s = stepBite(s, 0.5, rng)
    expect(s.phase).toBe('bite')
  })

  it('진짜 입질 때 챔질하면 걸린다', () => {
    let s = createBite(rng)
    s = stepBite(s, 2, rng)
    s = stepBite(s, 0.3, rng)
    s = stepBite(s, 0.5, rng)
    expect(hook(s).phase).toBe('hooked')
  })

  it('페이크에 속아 챔질하면 놓친다', () => {
    let s = createBite(rng)
    s = stepBite(s, 2, rng)
    expect(s.phase).toBe('nibble')
    expect(hook(s).phase).toBe('missed')
  })

  it('입질 전에 챔질해도 놓친다', () => {
    expect(hook(createBite(rng)).phase).toBe('missed')
  })

  it('진짜 입질을 그냥 보내면 놓친다', () => {
    let s = createBite(rng)
    s = stepBite(s, 2, rng)
    s = stepBite(s, 0.3, rng)
    s = stepBite(s, 0.5, rng)
    s = stepBite(s, 0.8, rng)
    expect(s.phase).toBe('missed')
  })

  it('끝난 상태는 더 진행되지 않는다', () => {
    const missed = hook(createBite(rng))
    expect(stepBite(missed, 10, rng)).toBe(missed)
    expect(hook(missed)).toBe(missed)
  })
})
