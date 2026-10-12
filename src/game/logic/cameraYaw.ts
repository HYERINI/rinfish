/**
 * 카메라 yaw 계산. 카메라는 플레이어 + (sin yaw, cos yaw) × 거리 위치에서 플레이어를 바라본다.
 * 따라서 시선 방향은 (-sin yaw, -cos yaw) 이다.
 */

/** 시선이 facing([dx, dz])과 같아지는 yaw (플레이어 등 뒤에서 물 쪽을 바라본다). facing (0,1) → π */
export function yawForFacing(facing: [number, number]): number {
  const [fx, fz] = facing
  // fx가 0일 때 -0이 되어 atan2가 -π를 돌려주는 것을 막기 위해 + 0
  return Math.atan2(-fx + 0, -fz + 0)
}

/** from → to 로 가는 가장 짧은 각도 차이 (-π ~ π). 카메라가 먼 쪽으로 돌지 않게 한다 */
export function shortestAngleDelta(from: number, to: number): number {
  const twoPi = Math.PI * 2
  const d = (((to - from) % twoPi) + twoPi + Math.PI) % twoPi - Math.PI
  return d
}
