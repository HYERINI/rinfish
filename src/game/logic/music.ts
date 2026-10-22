import type { Mode } from './interaction'
import { clampVolume } from './settings'

export type MusicTrack = 'island' | 'calm'

/** 실제 소리 크기(gain). 귀는 작은 소리에 민감해서 슬라이더 값을 제곱해 쓴다 */
export function musicGain(volume: number, muted: boolean): number {
  return muted ? 0 : clampVolume(volume) ** 2
}

/** 지금 틀 곡: 어항 크게 보기에서는 조용한 곡, 그 밖엔 섬 곡 */
export function musicTrackFor(mode: Mode): MusicTrack {
  return mode === 'aquariumView' ? 'calm' : 'island'
}
