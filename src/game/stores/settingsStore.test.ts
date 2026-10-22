// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest'
import { DEFAULT_SETTINGS, MOUSE_LOOK } from '../data/settings'
import { SETTINGS_KEY, useSettingsStore } from './settingsStore'

const store = () => useSettingsStore.getState()

beforeEach(() => {
  localStorage.clear()
  useSettingsStore.setState({ ...DEFAULT_SETTINGS })
})

describe('settingsStore', () => {
  it('바꾼 설정이 따로 저장된다', () => {
    store().setLookSensitivity(0.004)
    store().toggleMusicMuted()
    const saved = JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? '{}')
    expect(saved.state).toEqual({ ...DEFAULT_SETTINGS, lookSensitivity: 0.004, musicMuted: true })
  })

  it('볼륨을 바꾸면 범위 안으로 자르고 음소거를 푼다', () => {
    store().toggleMusicMuted()
    store().setMusicVolume(3)
    expect(store().musicVolume).toBe(1)
    expect(store().musicMuted).toBe(false)
  })

  it('감도도 범위 안으로', () => {
    store().setLookSensitivity(-1)
    expect(store().lookSensitivity).toBe(MOUSE_LOOK.minSensitivity)
  })

  it('깨진 저장본을 불러와도 기본값으로 시작한다', async () => {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify({ state: { musicVolume: 'x', lookSensitivity: 0.003 }, version: 1 }))
    await useSettingsStore.persist.rehydrate()
    expect(store().musicVolume).toBe(DEFAULT_SETTINGS.musicVolume)
    expect(store().lookSensitivity).toBe(0.003)
  })
})
