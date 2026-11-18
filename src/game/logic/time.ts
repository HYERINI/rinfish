import { MAX_FRAME_DELTA } from '../data/balance'
import type { Mode } from './interaction'
import type { SeqKind } from './restSeq'

/** 프레임 delta를 0 ~ MAX_FRAME_DELTA 로 제한 */
export function clampDelta(delta: number): number {
  if (!Number.isFinite(delta) || delta < 0) return 0
  return Math.min(delta, MAX_FRAME_DELTA)
}

/** 이 화면을 열어 둔 동안은 게임 시간(배고픔·체력·혼자 시계)이 흐르지 않는다: 메뉴·꾸미기·로비 */
export function timeStops(mode: Mode): boolean {
  return mode === 'menu' || mode === 'wardrobe' || mode === 'lobby'
}

/** 게임 시간(혼자 시계·배고픔·체력)이 멈추나: timeStops 화면이거나 잠·죽음으로 화면이 어두워지는 중 (방 아침은 흐른다) */
export function restStops(mode: Mode, seq: SeqKind | null | undefined): boolean {
  return timeStops(mode) || seq === 'sleep' || seq === 'death'
}
