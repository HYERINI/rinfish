import { describe, expect, it } from 'vitest'
import { QUALITY_PRESETS } from '../data/quality'
import { autoQuality, isQualitySetting, resolveQuality, thinOut } from './quality'

describe('autoQuality', () => {
  it('마우스 컴퓨터는 높음 (예전 기본값 그대로)', () => {
    expect(autoQuality({ touch: false, memoryGb: 2, cores: 2 })).toBe('high')
  })

  it('터치 기기는 보통, 메모리나 코어가 적으면 낮음', () => {
    expect(autoQuality({ touch: true })).toBe('medium')
    expect(autoQuality({ touch: true, memoryGb: 8, cores: 8 })).toBe('medium')
    expect(autoQuality({ touch: true, memoryGb: 4, cores: 8 })).toBe('low')
    expect(autoQuality({ touch: true, memoryGb: 8, cores: 4 })).toBe('low')
  })

  it('직접 고르면 그대로', () => {
    expect(resolveQuality('high', { touch: true })).toBe('high')
    expect(resolveQuality('auto', { touch: true })).toBe('medium')
  })

  it('높음은 데스크톱 예전 값 (dpr [1, 2], 그림자 2048, 풀 전부)', () => {
    expect(QUALITY_PRESETS.high).toEqual({ dpr: [1, 2], shadowMapSize: 2048, grassRatio: 1 })
  })

  it('설정값 검사', () => {
    expect(isQualitySetting('low')).toBe(true)
    expect(isQualitySetting('ultra')).toBe(false)
    expect(isQualitySetting(undefined)).toBe(false)
  })
})

describe('thinOut', () => {
  const list = Array.from({ length: 1000 }, (_, i) => i)

  it('비율만큼 고르게 남긴다', () => {
    const kept = thinOut(list, 0.3)
    expect(kept.length).toBe(300)
    // 앞쪽에 몰리지 않고 끝까지 고르게
    expect(kept[kept.length - 1]).toBeGreaterThan(990)
    expect(thinOut(list, 0.3)).toEqual(kept)
  })

  it('1 이상이면 그대로, 0 이하면 비운다', () => {
    expect(thinOut(list, 1)).toBe(list)
    expect(thinOut(list, 0)).toEqual([])
    expect(thinOut(list, Number.NaN)).toBe(list)
  })
})
