import type { SeatShape } from '../scene/PlayerModel'
import type { BoatDir } from '../logic/boatRoute'

/** 배 바닥 높이 (배 원점 = 물 높이에서, m). 캐릭터 발이 여기 놓인다 */
export const BOAT_FLOOR = 0.15
/** 배 가로대에 앉는 모양 (발 기준). 등받이가 없어 엉덩이가 가로대 가운데 오게 backrestZ 를 뒤로 둔다 */
export const BOAT_SEAT_SHAPE: SeatShape = { surfaceY: 0.3, backrestZ: -0.25 }

/** 배 타기 감지 상자 가운데 [x, z] 와 가는 방향. 선착장 뭍 쪽 (섬은 낚시 물가 띠 밖) */
export const BOAT_BOARD: { center: [number, number]; dir: BoatDir }[] = [
  { center: [88.5, -2], dir: 'toIsland' },
  { center: [0, 23.5], dir: 'toMeadow' },
]

/** 내리는 자리와 바라보는 각도 (0 = +z): 선착장 끝, 뭍 쪽을 본다 */
export const BOAT_ARRIVE = {
  island: { x: 0, z: 26.2, facing: Math.PI },
  meadow: { x: 85, z: -2, facing: Math.PI / 2 },
}
