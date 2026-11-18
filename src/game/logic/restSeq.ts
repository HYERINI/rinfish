import { REST_FADE } from '../data/balance'

/** 화면이 어두워지는 일: 혼자 잠, 죽음(침대에서 깨어남), 같이 하는 방의 아침 */
export type SeqKind = 'sleep' | 'death' | 'morning'

/** 화면이 다 어두워져 상태를 바꾸는 때(시작부터 초) */
export function seqSwitchAt(kind: SeqKind): number {
  return REST_FADE[kind].fade
}

/** 다시 다 밝아져 끝나는 때(초) */
export function seqEnd(kind: SeqKind): number {
  return REST_FADE[kind].fade + REST_FADE[kind].hold + REST_FADE.out
}

/** 시작부터 t초 때 검은 화면 불투명도 (0~1) */
export function seqOpacity(kind: SeqKind, t: number): number {
  const { fade, hold } = REST_FADE[kind]
  if (t <= 0) return 0
  if (t < fade) return t / fade
  if (t < fade + hold) return 1
  return Math.max(0, 1 - (t - fade - hold) / REST_FADE.out)
}
