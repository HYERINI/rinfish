/** 그래픽 품질. 휴대폰처럼 느린 기기에선 낮춰서 버벅이지 않게 한다 */
export type QualityLevel = 'low' | 'medium' | 'high'
/** 설정값: auto = 기기를 보고 고른다 */
export type QualitySetting = QualityLevel | 'auto'

export type QualityPreset = {
  /** 화면 해상도 배율 범위 [최소, 최대] (기기 픽셀 비율을 이 안으로 자른다) */
  dpr: [number, number]
  /** 그림자 맵 크기 (px) */
  shadowMapSize: number
  /** 풀 다발을 얼마나 남길까 (0~1) */
  grassRatio: number
}

/** high 는 지금까지의 데스크톱 기본값 그대로 (R3F 기본 dpr [1, 2], 그림자 2048, 풀 전부) */
export const QUALITY_PRESETS: Record<QualityLevel, QualityPreset> = {
  low: { dpr: [1, 1], shadowMapSize: 1024, grassRatio: 0.3 },
  medium: { dpr: [1, 1.5], shadowMapSize: 1024, grassRatio: 0.55 },
  high: { dpr: [1, 2], shadowMapSize: 2048, grassRatio: 1 },
}

export const QUALITY_SETTINGS: QualitySetting[] = ['auto', 'low', 'medium', 'high']

export const QUALITY_LABEL: Record<QualitySetting, string> = {
  auto: '자동',
  low: '낮음',
  medium: '보통',
  high: '높음',
}

/** 터치 기기 중 메모리(GB)·코어 수가 이 이하면 낮음을 고른다 */
export const LOW_END = { memoryGb: 4, cores: 4 }
