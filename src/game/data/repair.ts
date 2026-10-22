import { NO_DYE } from './characterParts'
import type { CharacterLook, ZoneId } from './types'

/** [x, z] */
export type Vec2 = [number, number]

/**
 * 수리기사님 연출 자리. 모두 월드 좌표(바닥 y = 0)
 * - hammer: 걸어와서 무릎 꿇고 망치질 → 부서진 모습이 고친 모습으로 바뀜 → 걸어 나감 (다리·보트)
 * - push: 둘이 바위 뒤에 붙어 "영차영차" 밀어서 바위를 rockTo 로 굴려 치움 → 걸어 나감 (동굴)
 */
export type RepairPlan = {
  kind: 'hammer' | 'push'
  /** 고치는 물건(다리·보트·바위) 가운데 */
  site: Vec2
  /**
   * 기사님마다 from: 나타나고 사라지는 자리(연출 카메라 밖), work: 망치질하는 자리(hammer).
   * push 에선 바위 뒤 자리를 바위 위치에서 계산하므로 work 가 없다
   */
  workers: { from: Vec2; work?: Vec2 }[]
  /** 바위를 치운 뒤 자리 (push) */
  rockTo?: Vec2
  /** 연출 동안 카메라 자리와 보는 곳 [x, y, z] */
  camera: { position: [number, number, number]; lookAt: [number, number, number] }
  /** 연출 동안 플레이어가 비켜서서 구경하는 자리 */
  watchFrom: Vec2
}

/** 망치질 연출 시간(초). 걸어오기 → 망치질(fixAt 초에 고친 모습으로) → 다 됐다 → 걸어 나가기 */
export const HAMMER_TIMING = { arrive: 2.4, work: 4, fixAt: 3.2, done: 1.1, leave: 2.3, hitPeriod: 0.55 }
/** 바위 밀기 연출 시간(초). 걸어오기 → 자세 잡기 → 밀기 → 다 됐다 → 걸어 나가기. heavePeriod 마다 "영차!" */
export const PUSH_TIMING = { arrive: 2.4, brace: 0.7, push: 3.6, done: 1.1, leave: 2.3, heavePeriod: 0.6 }

/** 바위 반지름(m). 기사님은 바위 겉에서 pushGap 만큼 떨어져서, 서로 pushSpread 만큼 옆으로 벌려 선다 */
export const CAVE_ROCK = { radius: 1.9, pushGap: 0.45, pushSpread: 0.75 }

export const REPAIR_PLANS: Record<Exclude<ZoneId, 'beach'>, RepairPlan> = {
  pond: {
    kind: 'hammer',
    site: [-14, 5],
    workers: [
      { from: [-7.5, 11.5], work: [-14.8, 7.5] },
      { from: [-6.5, 10.5], work: [-13.1, 7.5] },
    ],
    // 진료소(-14, 10)가 가리지 않게 동쪽에서 비춘다
    camera: { position: [-8, 3.3, 8], lookAt: [-14.5, 0.6, 5.8] },
    watchFrom: [-17.6, 7.4],
  },
  reef: {
    kind: 'hammer',
    site: [18.9, 7.3],
    workers: [
      { from: [24, 15], work: [18.1, 8.8] },
      { from: [25.5, 13.5], work: [19.8, 8.8] },
    ],
    camera: { position: [14.5, 4.2, 14.5], lookAt: [18.6, 0.7, 7.2] },
    watchFrom: [22.6, 9.6],
  },
  cave: {
    kind: 'push',
    site: [0, 5.4],
    workers: [
      { from: [8.5, 13.5] },
      { from: [10, 11.5] },
    ],
    // 섬 꾸미기가 비워 둔 문 앞(문 ±3m, z 8.5 까지) 안쪽으로 굴린다
    rockTo: [-5.6, 7.1],
    camera: { position: [5.5, 4.6, 15], lookAt: [-2, 1, 6.6] },
    watchFrom: [-2.5, 11.8],
  },
}

/** 수리기사님 작업복: 주황 윗옷, 남색 바지, 갈색 신발. 머리카락은 안전모에 들어가게 짧게 */
export const WORKER_LOOKS: CharacterLook[] = [
  {
    gender: 'male',
    skinColor: '#d9a274',
    hair: 'buzzed',
    hairColor: '#2b2b2b',
    beard: true,
    top: 'peasant',
    bottom: 'peasant',
    shoes: 'peasant',
    hood: false,
    outfitColor: 'base',
    dye: { ...NO_DYE, top: '#ef6c00', bottom: '#283593', shoes: '#4e342e' },
    height: 1,
    body: { head: 1, shoulders: 1.15, chest: 1.1, belly: 1.3, armThickness: 1.2, armLength: 1, legThickness: 1.1, legLength: 1 },
  },
  {
    gender: 'female',
    skinColor: '#f7cfae',
    hair: 'buzzedFemale',
    hairColor: '#4a3020',
    beard: false,
    top: 'peasant',
    bottom: 'peasant',
    shoes: 'peasant',
    hood: false,
    outfitColor: 'base',
    dye: { ...NO_DYE, top: '#f57c00', bottom: '#283593', shoes: '#4e342e' },
    height: 0.95,
    body: { head: 1, shoulders: 1.05, chest: 1, belly: 1, armThickness: 1.1, armLength: 1, legThickness: 1, legLength: 1 },
  },
]

/** 오가는 동안은 종종걸음(뛰기 클립)으로. 재생 속도는 실제 빠르기(약 3m/s)에 맞춘다 */
export const WORKER_WALK_TIMESCALE = 0.65
