import type { EunjiArea } from './outdoor.js'
export const TOWN: EunjiArea
export const TOWN_LAYOUT: {
  square: EunjiArea
  fountain: { x: number; z: number; r: number }
  stalls: { x: number; z: number; color: string }[]
  houses: { x: number; z: number; half: number }[]
}
/** 노점 상인 (우리는 data/meadow MEADOW_VENDORS 로 옮겨 쓴다. 같은지 테스트에서만 비교) */
export const VENDORS: { id: string; name: string; x: number; z: number }[]
export const VENDOR_DIST: number
