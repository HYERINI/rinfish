/** 해 그림자 범위 (순수). 플레이어 둘레를 사방으로 똑같이 덮으면 카메라 뒤 물체 그림자까지 그리므로, 보는 쪽 앞으로 옮긴다 */

/** 그림자 범위 가운데를 플레이어에서 보는 쪽으로 얼마나 앞에 둘지 (m) */
export const SHADOW_AHEAD = 4
/** 그림자 범위 반 폭 (m). 앞 4m 로 옮겼으니 앞으로 24m, 뒤로 16m 를 덮는다 (전에는 사방 22m) */
export const SHADOW_HALF = 20

/**
 * 그림자 범위 가운데 (세계 x, z). 카메라 방향(dirX, dirZ: 길이 1 방향의 땅 위 성분)으로 SHADOW_AHEAD 앞.
 * 아래·위로 기울일수록 땅 위 성분이 짧아지는 만큼 덜 옮긴다 (바로 아래를 보면 플레이어 자리, 가운데가 덜컥 튀지 않는다)
 */
export function shadowFocus(px: number, pz: number, dirX: number, dirZ: number): [number, number] {
  const len = Math.hypot(dirX, dirZ)
  if (len < 1e-6) return [px, pz]
  const k = (SHADOW_AHEAD * Math.min(1, len)) / len
  return [px + dirX * k, pz + dirZ * k]
}
