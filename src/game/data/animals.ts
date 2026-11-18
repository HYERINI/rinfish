import { areaToWorld, type EunjiArea, type Rect } from './meadow'

/**
 * 초원 들판 동물 (은지 animals.js 값 그대로, Kenney Cube Pets CC0).
 * 서버(같이 하기)와 내 화면(혼자)이 같은 시뮬레이션(logic/animalSim)으로 움직이므로 그래픽 없는 TS 값으로 둔다
 */
export type SpeciesId = 'cow' | 'pig' | 'deer' | 'hog' | 'bunny' | 'fox' | 'chick'

/** scale: 모델 배율, hp: 맞아야 하는 횟수, speed·run: 걷기·달리기 (m/s), meat: 은지 표시용, dmg: 들이받는 피해 (0 이면 도망만) */
export type Species = { id: SpeciesId; name: string; scale: number; hp: number; speed: number; run: number; meat: number; dmg: number }

export const SPECIES: Species[] = [
  { id: 'cow', name: '소', scale: 0.8, hp: 3, speed: 1.0, run: 3.0, meat: 3, dmg: 15 },
  { id: 'pig', name: '돼지', scale: 0.6, hp: 2, speed: 1.1, run: 3.2, meat: 2, dmg: 8 },
  { id: 'deer', name: '사슴', scale: 0.8, hp: 2, speed: 1.4, run: 5.0, meat: 2, dmg: 10 },
  { id: 'hog', name: '멧돼지', scale: 0.65, hp: 3, speed: 1.2, run: 4.0, meat: 2, dmg: 14 },
  { id: 'bunny', name: '토끼', scale: 0.3, hp: 1, speed: 1.6, run: 5.0, meat: 1, dmg: 0 },
  { id: 'fox', name: '여우', scale: 0.45, hp: 1, speed: 1.6, run: 5.0, meat: 1, dmg: 6 },
  { id: 'chick', name: '병아리', scale: 0.25, hp: 1, speed: 0.8, run: 2.5, meat: 1, dmg: 0 },
]
export const SPECIES_IDS: SpeciesId[] = SPECIES.map((s) => s.id)
const BY_ID = Object.fromEntries(SPECIES.map((s) => [s.id, s])) as Record<SpeciesId, Species>
export const speciesOf = (id: SpeciesId): Species => BY_ID[id]

/** 은지 animals.js 숫자들 (거리 m, 시간 초) */
export const ANIMAL = {
  /** 동시에 있는 동물 수 */
  count: 12,
  /** 죽은 뒤 새 동물이 나오기까지 */
  respawn: 25,
  /** 이 거리 안에 사람이 오면 달아난다 */
  fleeDist: 7,
  /** 이만큼 멀어지면 다시 어슬렁거린다 */
  calmDist: 14,
  /** 이 거리 안에서 들이받는다 */
  attackDist: 1.5,
  /** 들이받는 간격 */
  attackCool: 1.3,
  /** 맞고 반격을 시작할 때 첫 들이받기까지 */
  firstAttack: 0.5,
  /** 이만큼 쫓다가 포기한다 */
  giveUp: 14,
  /** 이만큼 멀어지면 포기 */
  loseDist: 30,
  /** 쓰러져 있다가 사라지기까지 (사라질 때 전리품이 보인다) */
  corpse: 1.4,
  /** 옆으로 넘어지는 시간 */
  fall: 0.5,
  /** 맞으면 빨갛게 번쩍이는 시간 */
  flash: 0.15,
  /** 전리품 줍는 거리 (E) */
  pickDist: 1.6,
  /** 들판 가장자리에서 이만큼 안쪽에 태어난다 / 가장자리에 몰리면 비스듬히 튼다 */
  edge: 2,
}

/** 은지 들판 (은지 outdoor.js ANIMAL_ZONE, 은지 좌표. 같은지 테스트) */
export const EUNJI_ANIMAL_ZONE: EunjiArea = { minX: -6, maxX: 34, minZ: 26, maxZ: 52 }
/** 동물이 돌아다니는 들판 (세계 좌표: x 166..206, z -52..-26) */
export const ANIMAL_FIELD: Rect = areaToWorld(EUNJI_ANIMAL_ZONE)
/** 쫓아올 때 움직일 수 있는 곳: 들판보다 넓게, 울타리 바로 바깥까지 (은지 AGGRO_ZONE. 세계 x 156..216, z -58..-24) */
export const ANIMAL_CHASE: Rect = areaToWorld({ minX: EUNJI_ANIMAL_ZONE.minX - 10, maxX: EUNJI_ANIMAL_ZONE.maxX + 10, minZ: 24, maxZ: EUNJI_ANIMAL_ZONE.maxZ + 6 })

/**
 * 판정 원 반지름 (m). 은지는 메시에 광선을 쐈지만 우리는 바닥의 원으로 본다:
 * 큐브 동물 몸통 반폭(배율 1 에서 약 0.65) × 배율, 병아리처럼 아주 작은 동물도 0.35 는 된다
 */
export function hitRadius(id: SpeciesId): number {
  return Math.max(0.35, 0.65 * speciesOf(id).scale)
}
