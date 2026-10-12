/**
 * 바다 물결 높이. 셰이더(scene/Ocean.tsx)와 같은 식을 써서
 * 찌가 실제로 보이는 물결을 따라 오르내리게 한다. 식을 바꾸면 두 곳을 함께 바꾼다
 */
export const WAVES: readonly { dirX: number; dirZ: number; length: number; amp: number; speed: number }[] = [
  { dirX: 1, dirZ: 0.3, length: 14, amp: 0.09, speed: 1.1 },
  { dirX: -0.4, dirZ: 1, length: 9, amp: 0.06, speed: 1.4 },
  { dirX: 0.7, dirZ: -0.7, length: 5, amp: 0.03, speed: 2.0 },
]

export function waveHeight(x: number, z: number, time: number): number {
  let h = 0
  for (const w of WAVES) {
    const len = Math.hypot(w.dirX, w.dirZ)
    const k = (2 * Math.PI) / w.length
    h += w.amp * Math.sin(k * ((w.dirX * x + w.dirZ * z) / len) + w.speed * time)
  }
  return h
}
