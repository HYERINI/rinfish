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
      { label: '나일론 낚싯줄', price: 70, value: 120 },
      { label: '형광 나일론 낚싯줄', price: 150, value: 140 },
      { label: '카본 낚싯줄', price: 280, value: 165 },
      { label: '강철 낚싯줄', price: 450, value: 190 },
      { label: '합사 낚싯줄', price: 650, value: 220 },
      { label: '티타늄 합사', price: 900, value: 250 },
      { label: '다이아 합사', price: 1200, value: 275 },
      { label: '황금 합사', price: 1600, value: 300 },
      { label: '전설의 용 수염 낚싯줄', price: 2200, value: 320 },
    ],
  },
  reel: {
    name: '릴',
    description: '감는 속도',
    levels: [
      { label: '나무 릴', price: 0, value: 6 },
      { label: '플라스틱 릴', price: 60, value: 7 },
      { label: '스피닝 릴', price: 120, value: 8 },
      { label: '고급 스피닝 릴', price: 220, value: 9 },
      { label: '전동 릴', price: 380, value: 10 },
      { label: '베이트 릴', price: 550, value: 11 },
      { label: '고속 전동 릴', price: 800, value: 12 },
      { label: '다이아 릴', price: 1100, value: 12.7 },
      { label: '황금 릴', price: 1500, value: 13.4 },
      { label: '전설의 용 릴', price: 2000, value: 14 },
    ],
  },
  rod: {
    name: '낚싯대',
    description: '물고기가 확 당길 때 텐션이 치솟는 정도를 줄여 준다',
    levels: [
      { label: '대나무 낚싯대', price: 0, value: 1 },
      { label: '유리섬유 낚싯대', price: 60, value: 0.87 },
      { label: '카본 낚싯대', price: 120, value: 0.75 },
      { label: '고탄성 카본 낚싯대', price: 220, value: 0.65 },
      { label: '티타늄 낚싯대', price: 380, value: 0.55 },
      { label: '그라파이트 낚싯대', price: 550, value: 0.48 },
      { label: '보론 낚싯대', price: 800, value: 0.42 },
      { label: '다이아 낚싯대', price: 1100, value: 0.38 },
      { label: '황금 낚싯대', price: 1500, value: 0.35 },
      { label: '전설의 용 낚싯대', price: 2000, value: 0.32 },
    ],
  },
}

/** 5단계였던 저장본의 장비 단계 → 지금 10단계 중 같은 성능 자리 */
export const GEAR_LEVEL_FROM_V1 = [0, 2, 4, 6, 9]
