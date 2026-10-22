/** 먹이를 준 뒤 물고기들이 수면 가운데로 몰려드는 시간(초) */
export const FEEDING_SHOW_SECONDS = 5

export type SwimPose = { x: number; y: number; z: number; heading: number; tilt: number }

/**
 * 어항 안 8자 헤엄 경로. half: 어항 안쪽 절반 크기, seed: 물고기마다 다른 경로,
 * hungry: 바닥에 가라앉아 옆으로 눕는다, sinceFed: 먹이 준 뒤 지난 초 (짧으면 수면으로 몰려든다)
 */
export function swimPose(time: number, seed: number, half: [number, number, number], hungry: boolean, sinceFed: number): SwimPose {
  const t = time * (hungry ? 0.15 : 0.5) + seed * 2.1
  const [hx, hy, hz] = half
  let x = Math.sin(t) * hx * 0.75
  let z = Math.sin(t * 2) * hz * 0.5
  let y = Math.sin(t * 0.7 + seed) * hy * 0.4
  if (hungry) y = -hy * 0.8
  if (sinceFed < FEEDING_SHOW_SECONDS) {
    x *= 0.25
    z *= 0.25
    y = hy * 0.75
  }
  // 경로의 진행 방향을 바라보게 한다 (머리 +z)
  const heading = Math.atan2(Math.cos(t) * hx * 0.75, Math.cos(t * 2) * 2 * hz * 0.5)
  return { x, y, z, heading, tilt: hungry ? Math.PI / 2 : 0 }
}
