import { LOW_END, QUALITY_PRESETS, type QualityLevel, type QualityPreset, type QualitySetting } from '../data/quality'

/** 기기 정보. memoryGb·cores 는 브라우저가 알려 주지 않으면 undefined */
export type DeviceInfo = { touch: boolean; memoryGb?: number; cores?: number }

/**
 * 자동 품질: 마우스를 쓰는 컴퓨터는 지금까지처럼 높음.
 * 터치 기기는 보통, 그중 메모리나 코어가 적은 기기는 낮음
 */
export function autoQuality(device: DeviceInfo): QualityLevel {
  if (!device.touch) return 'high'
  const weakMemory = device.memoryGb !== undefined && device.memoryGb <= LOW_END.memoryGb
  const weakCpu = device.cores !== undefined && device.cores <= LOW_END.cores
  return weakMemory || weakCpu ? 'low' : 'medium'
}

export function resolveQuality(setting: QualitySetting, device: DeviceInfo): QualityLevel {
  return setting === 'auto' ? autoQuality(device) : setting
}

export function qualityPreset(level: QualityLevel): QualityPreset {
  return QUALITY_PRESETS[level]
}

export function isQualitySetting(v: unknown): v is QualitySetting {
  return v === 'auto' || v === 'low' || v === 'medium' || v === 'high'
}

/**
 * 배치 목록에서 ratio 만큼만 고르게 남긴다 (순서대로 솎아 냄, 늘 같은 결과).
 * 배치는 섬 전체에 흩어진 순서라 앞에서부터 자르지 않고 띄엄띄엄 고른다
 */
export function thinOut<T>(list: T[], ratio: number): T[] {
  if (!(ratio < 1)) return list
  if (!(ratio > 0)) return []
  return list.filter((_, i) => Math.floor((i + 1) * ratio) > Math.floor(i * ratio))
}
