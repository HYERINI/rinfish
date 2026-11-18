import { MELEE_IDLE, type MeleeState } from '../logic/melee'

/**
 * 내 휘두르기 (scene/melee/MeleeController 가 매 프레임 고치고 Player 가 팔·방향을 그린다). 시각은 R3F 시계(초).
 * yaw: 휘두르기 시작할 때 카메라 방향 (그쪽을 보고 휘두른다, 판정도 그쪽)
 */
export const meleeRig: MeleeState & { yaw: number } = { ...MELEE_IDLE, yaw: 0 }

/** 처음으로 (MeleeController 가 붙고 뗄 때. 시각은 캔버스 시계라 Game 을 다시 그리면 0부터 다시 센다) */
export function resetMeleeRig() {
  Object.assign(meleeRig, MELEE_IDLE)
}
