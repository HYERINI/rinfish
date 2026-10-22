import { useEffect, useSyncExternalStore } from 'react'
import { create } from 'zustand'
import type { QualityLevel, QualityPreset } from '../data/quality'
import { qualityPreset, resolveQuality, type DeviceInfo } from '../logic/quality'
import { nextTouchUi } from '../logic/touchUi'
import { useSettingsStore } from '../stores/settingsStore'

function matches(query: string): boolean {
  return typeof matchMedia === 'function' && matchMedia(query).matches
}

/** 기기의 주 포인터가 손가락인가 (휴대폰·태블릿) */
export function isCoarsePointer(): boolean {
  return matches('(pointer: coarse)')
}

/**
 * 터치 조작 화면(조이스틱·버튼)을 보이는 중인가. 손가락 기기면 처음부터 켜고,
 * 그 밖에선 화면을 손가락으로 처음 누를 때 켠다 (터치 화면 노트북 등). 마우스를 다시 쓰면 끈다
 */
export const useTouchUiStore = create<{ touchUi: boolean }>(() => ({ touchUi: isCoarsePointer() }))

export function useTouchUi(): boolean {
  return useTouchUiStore((s) => s.touchUi)
}

export function useTouchUiTracking() {
  useEffect(() => {
    const coarse = isCoarsePointer()
    const onDown = (e: PointerEvent) => {
      const touchUi = nextTouchUi(useTouchUiStore.getState().touchUi, e.pointerType, coarse)
      if (touchUi !== useTouchUiStore.getState().touchUi) useTouchUiStore.setState({ touchUi })
    }
    // 버튼 등에서 먼저 막아도 알 수 있게 capture 로 듣는다
    window.addEventListener('pointerdown', onDown, true)
    return () => window.removeEventListener('pointerdown', onDown, true)
  }, [])
}

/** CSS 미디어 쿼리가 맞는지 (화면 방향 등). 바뀌면 다시 그린다 */
export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (onChange) => {
      if (typeof matchMedia !== 'function') return () => {}
      const list = matchMedia(query)
      list.addEventListener('change', onChange)
      return () => list.removeEventListener('change', onChange)
    },
    () => matches(query),
    () => false,
  )
}

/** 품질 자동 고르기에 쓰는 기기 정보. 손가락 기기인지는 처음 한 번만 본다 (도중에 품질이 바뀌지 않게) */
const device: DeviceInfo = {
  touch: isCoarsePointer(),
  memoryGb: typeof navigator !== 'undefined' ? (navigator as Navigator & { deviceMemory?: number }).deviceMemory : undefined,
  cores: typeof navigator !== 'undefined' ? navigator.hardwareConcurrency || undefined : undefined,
}

/** 지금 쓰는 그래픽 품질 (설정이 자동이면 기기를 보고 고른 값) */
export function useQualityLevel(): QualityLevel {
  return useSettingsStore((s) => resolveQuality(s.quality, device))
}

export function useQualityPreset(): QualityPreset {
  return qualityPreset(useQualityLevel())
}
