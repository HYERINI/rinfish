import type { EunjiArea } from './outdoor.js'
export const TOWN: EunjiArea
export const TOWN_LAYOUT: {
  square: EunjiArea
  fountain: { x: number; z: number; r: number }
  stalls: { x: number; z: number; color: string }[]
  houses: { x: number; z: number; half: number }[]
}
