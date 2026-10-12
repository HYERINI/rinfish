import type { GearSlot } from './types'

export type GearLevelDef = {
  label: string
  /** 0단계는 기본 장비라 0 */
  price: number
  /** line=maxTension, reel=reelSpeed, rod=shockAbsorb */
  value: number
}

export type GearDef = {
  name: string
  description: string
  levels: GearLevelDef[]
}

export const GEAR: Record<GearSlot, GearDef> = {
  line: {
    name: '낚싯줄',
    description: '끊어지기 전까지 버티는 최대 텐션',
    levels: [
      { label: '면 낚싯줄', price: 0, value: 100 },
      { label: '나일론 낚싯줄', price: 150, value: 140 },
      { label: '강철 낚싯줄', price: 450, value: 190 },
    ],
  },
  reel: {
    name: '릴',
    description: '감는 속도',
    levels: [
      { label: '나무 릴', price: 0, value: 8 },
      { label: '스피닝 릴', price: 120, value: 11 },
      { label: '전동 릴', price: 400, value: 15 },
    ],
  },
  rod: {
    name: '낚싯대',
    description: '물고기가 확 당길 때 텐션이 치솟는 정도를 줄여 준다',
    levels: [
      { label: '대나무 낚싯대', price: 0, value: 1 },
      { label: '카본 낚싯대', price: 120, value: 0.75 },
      { label: '티타늄 낚싯대', price: 400, value: 0.55 },
    ],
  },
}
