import { describe, expect, it } from 'vitest'
import { seqEnd, seqOpacity, seqSwitchAt } from './restSeq'

describe('잠·죽음 화면 어두워지기', () => {
  it('혼자 잠: 1초 어두워지고 0.4초 머문 뒤 1초 밝아진다', () => {
    expect(seqSwitchAt('sleep')).toBe(1)
    expect(seqEnd('sleep')).toBeCloseTo(2.4)
    expect(seqOpacity('sleep', 0.5)).toBeCloseTo(0.5)
    expect(seqOpacity('sleep', 1.2)).toBe(1)
    expect(seqOpacity('sleep', 1.9)).toBeCloseTo(0.5)
    expect(seqOpacity('sleep', 3)).toBe(0)
  })
  it('죽음: 1.6초 어두워지고 1.4초 머문다 (스펙: 3초쯤 뒤 깨어남)', () => {
    expect(seqSwitchAt('death')).toBe(1.6)
    expect(seqOpacity('death', 2.9)).toBe(1)
    expect(seqEnd('death')).toBeCloseTo(4)
  })
  it('시작 전엔 0', () => {
    expect(seqOpacity('morning', 0)).toBe(0)
    expect(seqOpacity('morning', -1)).toBe(0)
  })
})
