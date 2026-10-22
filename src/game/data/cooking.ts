import { NO_DYE } from './characterParts'
import type { CharacterLook } from './types'
import { FACILITY } from './zones'

/** 요리 연출 단계: 주문 받기 → 도마에서 썰기 → 냄비로 가져가기 → 퐁당 → 보글보글 → 내오기 */
export type CookPhase = 'take' | 'chop' | 'carry' | 'drop' | 'boil' | 'serve'

/** 단계별 길이(초). 합이 연출 전체 길이 (약 7초) */
export const COOK_TIMING: readonly (readonly [CookPhase, number])[] = [
  ['take', 0.9],
  ['chop', 1.8],
  ['carry', 0.7],
  ['drop', 0.6],
  ['boil', 1.6],
  ['serve', 1.6],
]

/** 칼질 한 번 길이(초) */
export const CHOP_PERIOD = 0.3
/** 내오는 단계에서 걸어오는 비율 (그 뒤에 접시를 놓고 한마디) */
export const SERVE_WALK = 0.35

/** 가게(Market 그룹) 안쪽 좌표 [x, z]. 요리사는 조리대 뒤에 서서 +z(손님 쪽)를 본다 */
export const STALL = {
  board: [-0.6, -0.75] as [number, number],
  pot: [1.1, -0.75] as [number, number],
  serve: [0.1, -0.75] as [number, number],
  /** 도마 위·냄비 위·접시 자리 [x, y, z] */
  boardTop: [-0.6, 1.07, 0] as [number, number, number],
  potTop: [1.1, 1.36, 0] as [number, number, number],
  plate: [0.1, 1.0, 0.25] as [number, number, number],
}

const [MX, MZ] = FACILITY.market
/**
 * 연출 카메라와 플레이어 구경 자리 (월드 좌표). 가게는 (MX, MZ)에서 y 축으로 -90° 돌아 있어
 * 가게 안쪽 (x, z) 가 월드 (MX - z, MZ + x) 다 → 가게 앞 4.2m 위에서 조리대를 내려다본다
 */
export const COOK_SCENE = {
  site: [MX, MZ] as [number, number],
  camera: { position: [MX - 4.8, 3.1, MZ + 0.2] as [number, number, number], lookAt: [MX + 0.3, 1.3, MZ + 0.2] as [number, number, number] },
  watchFrom: [MX - 2.4, MZ - 2.7] as [number, number],
}

/** 내올 때 사장님이 하는 말 (아무거나 하나) */
export const COOK_LINES = [
  '미스터찜의 비법은... 비밀입니다',
  '손님 이건 서비스예요 (아님)',
  '맛없으면 환불... 은 안 돼요',
  '오늘 찜은 특히 잘 쪄졌네요~',
  '뜨거우니까 후후 불어 드세요!',
  '사장님이 직접 잡은 건 아니에요',
]

/** 사장님 배정빈: 흰 조리복, 짙은 바지, 넉넉한 배 */
export const CHEF_LOOK: CharacterLook = {
  gender: 'male',
  skinColor: '#eab892',
  hair: 'buzzed',
  hairColor: '#2b2b2b',
  beard: true,
  top: 'peasant',
  bottom: 'peasant',
  shoes: 'peasant',
  hood: false,
  outfitColor: 'base',
  dye: { ...NO_DYE, top: '#fafafa', bottom: '#37474f', shoes: '#3e2723' },
  height: 1.05,
  body: { head: 1.05, shoulders: 1.15, chest: 1.3, belly: 1.8, armThickness: 1.3, armLength: 1, legThickness: 1.2, legLength: 0.95 },
}
