/** 연출 구간 하나: [이름, 길이(초)] */
export type Segment<P extends string> = readonly [P, number]

/** 구간들을 이어 붙인 전체 길이 */
export function timelineLength<P extends string>(segments: readonly Segment<P>[]): number {
  return segments.reduce((sum, [, d]) => sum + d, 0)
}

/**
 * 시각 t 가 어느 구간인지. k 는 그 구간 안에서 0 → 1, at 은 그 구간 시작부터 지난 초.
 * 마지막 구간을 넘으면 phase 'end' (k 1). t 가 음수면 첫 구간의 처음
 */
export function phaseAt<P extends string>(segments: readonly Segment<P>[], t: number): { phase: P | 'end'; k: number; at: number } {
  let start = 0
  for (const [phase, d] of segments) {
    if (t < start + d) {
      const at = Math.max(0, t - start)
      return { phase, k: d > 0 ? at / d : 1, at }
    }
    start += d
  }
  return { phase: 'end', k: 1, at: t - start }
}
