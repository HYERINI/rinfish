import { describe, expect, it } from 'vitest'
import { DEFAULT_SETTINGS, MOUSE_LOOK } from '../data/settings'
import { musicGain, musicTrackFor } from './music'
import { normalizeSettings, sensitivityToSlider, sliderToSensitivity } from './settings'

describe('normalizeSettings', () => {
  it('저장본이 없거나 깨졌으면 기본값', () => {
    expect(normalizeSettings(undefined)).toEqual(DEFAULT_SETTINGS)
    expect(normalizeSettings('oops')).toEqual(DEFAULT_SETTINGS)
    expect(normalizeSettings({ musicVolume: 'loud', musicMuted: 1, lookSensitivity: null, invertY: 'yes' })).toEqual(DEFAULT_SETTINGS)
  })

  it('맞는 값은 그대로, 범위를 넘으면 잘라낸다', () => {
    expect(normalizeSettings({ musicVolume: 0.3, musicMuted: true, lookSensitivity: 0.003, invertY: true })).toEqual({
      musicVolume: 0.3,
      musicMuted: true,
      lookSensitivity: 0.003,
      invertY: true,
      quality: 'auto',
    })
    const s = normalizeSettings({ musicVolume: 5, lookSensitivity: 1 })
    expect(s.musicVolume).toBe(1)
    expect(s.lookSensitivity).toBe(MOUSE_LOOK.maxSensitivity)
    expect(normalizeSettings({ musicVolume: -1 }).musicVolume).toBe(0)
    expect(normalizeSettings({ lookSensitivity: Number.NaN }).lookSensitivity).toBe(DEFAULT_SETTINGS.lookSensitivity)
  })

  it('그래픽 품질: 아는 값만 받고 나머지는 자동', () => {
    expect(normalizeSettings({ quality: 'low' }).quality).toBe('low')
    expect(normalizeSettings({ quality: 'ultra' }).quality).toBe('auto')
    expect(normalizeSettings({}).quality).toBe('auto')
  })
})

describe('감도 슬라이더', () => {
  it('양 끝은 최소·최대 감도', () => {
    expect(sliderToSensitivity(0)).toBeCloseTo(MOUSE_LOOK.minSensitivity)
    expect(sliderToSensitivity(100)).toBeCloseTo(MOUSE_LOOK.maxSensitivity)
    expect(sliderToSensitivity(500)).toBeCloseTo(MOUSE_LOOK.maxSensitivity)
  })

  it('슬라이더 ↔ 감도가 서로 되돌아간다', () => {
    const slider = sensitivityToSlider(MOUSE_LOOK.defaultSensitivity)
    expect(slider).toBeGreaterThan(0)
    expect(slider).toBeLessThan(100)
    expect(sliderToSensitivity(slider)).toBeCloseTo(MOUSE_LOOK.defaultSensitivity)
  })
})

describe('배경 음악', () => {
  it('음소거면 0, 아니면 볼륨의 제곱', () => {
    expect(musicGain(0.8, true)).toBe(0)
    expect(musicGain(0.5, false)).toBeCloseTo(0.25)
    expect(musicGain(2, false)).toBe(1)
  })

  it('어항 크게 보기에서만 조용한 곡', () => {
    expect(musicTrackFor('aquariumView')).toBe('calm')
    expect(musicTrackFor('explore')).toBe('island')
    expect(musicTrackFor('aquarium')).toBe('island')
  })
})
