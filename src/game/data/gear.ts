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
      { label: '다이아 합사', price: 1000, value: 250 },
      { label: '전설의 용 수염 낚싯줄', price: 2200, value: 320 },
    ],
  },
  reel: {
    name: '릴',
    description: '감는 속도',
    levels: [
      { label: '나무 릴', price: 0, value: 6 },
      { label: '스피닝 릴', price: 120, value: 8 },
      { label: '전동 릴', price: 400, value: 10 },
      { label: '다이아 릴', price: 900, value: 12 },
      { label: '전설의 용 릴', price: 2000, value: 14 },
    ],
  },
  rod: {
    name: '낚싯대',
    description: '물고기가 확 당길 때 텐션이 치솟는 정도를 줄여 준다',
    levels: [
      { label: '대나무 낚싯대', price: 0, value: 1 },
      { label: '카본 낚싯대', price: 120, value: 0.75 },
      { label: '티타늄 낚싯대', price: 400, value: 0.55 },
      { label: '다이아 낚싯대', price: 900, value: 0.42 },
      { label: '전설의 용 낚싯대', price: 2000, value: 0.32 },
    ],
  },
}
