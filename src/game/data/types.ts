export type ZoneId = 'beach' | 'pond' | 'reef' | 'cave'
export type Rarity = 'junk' | 'common' | 'rare' | 'epic' | 'legendary'
export type FightPattern = 'dasher' | 'endurance' | 'erratic' | 'mixed'
/** mixed(전설)는 이 세 가지를 번갈아 쓴다 */
export type BasicPattern = Exclude<FightPattern, 'mixed'>

export type FishSpecies = {
  id: string
  name: string
  description: string
  zones: ZoneId[]
  rarity: Rarity
  pattern: FightPattern
  /** 1~10. 클수록 당기는 힘이 세다 */
  strength: number
  /** kg 단위 [최소, 최대] */
  weightRange: [number, number]
  /** 무게가 범위의 중간값일 때 판매가 */
  basePrice: number
  /** 3D 모델이 생기기 전까지 쓰는 대표 색 */
  color: string
}

export type GearSlot = 'line' | 'reel' | 'rod'
/** 장비 단계. 0부터 시작하고 화면에는 Lv1~Lv3로 보여 준다 */
export type GearLevels = Record<GearSlot, number>
export type GearStats = {
  /** 이 텐션을 넘으면 줄이 끊긴다 (낚싯줄) */
  maxTension: number
  /** 초당 감는 거리 (릴) */
  reelSpeed: number
  /** 물고기 당김으로 오르는 텐션에 곱하는 값. 작을수록 좋다 (낚싯대) */
  shockAbsorb: number
}

/** 잡은 물고기 한 마리. 판매·요리·전시가 모두 이 단위로 다룬다 */
export type FishInstance = {
  id: string
  speciesId: string
  weight: number
  caughtAtPlayTime: number
}
