/** 0 이상 1 미만의 수를 돌려주는 난수 함수. 테스트에서는 고정값을 넣는다 */
export type Rng = () => number

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t
}

export function lerpRange([min, max]: [number, number], t: number): number {
  return lerp(min, max, t)
}

export function fixedRng(value: number): Rng {
  return () => value
}
