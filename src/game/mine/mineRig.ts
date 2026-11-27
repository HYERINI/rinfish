import { MINE_WALLS, ORE_NODES } from '../data/mine'
import { PICK_IDLE, freshNodes, type OreNodeState, type PickState } from '../logic/mining'

/**
 * 광산 상태 (scene/mine/MineController 가 매 프레임 고치고 Player·광맥 그림이 읽는다). 저장하지 않는다 (버섯처럼 내 화면만, 새로 고치면 가득).
 * nodes: 광맥마다 남은 곡괭이질·다시 생길 때 (performance.now() 초), hitAt: 광맥마다 마지막으로 맞은 때 (흔들림, R3F 시계 초),
 * swing·readyAt: 내 곡괭이질 (R3F 시계 초), facing: 곡괭이질하는 동안 몸이 보는 각도,
 * want: E 나 클릭으로 들어온 곡괭이질 요청 (번호 = 그 광맥을 노린다, 'front' = 보는 쪽 앞, { wall } = 그 금 간 벽),
 * walls: 금 간 벽마다 무너지기까지 남은 곡괭이질 (저장하지 않는다. 무너진 것은 progressStore mineWalls 에 저장), wallHitAt: 벽마다 마지막으로 맞은 때
 */
export type PickWant = number | 'front' | { wall: number }
export const mineRig: PickState & { nodes: readonly OreNodeState[]; hitAt: number[]; facing: number; want: PickWant | null; walls: number[]; wallHitAt: number[] } = {
  ...PICK_IDLE,
  nodes: freshNodes(ORE_NODES),
  hitAt: ORE_NODES.map(() => -Infinity),
  facing: 0,
  want: null,
  walls: MINE_WALLS.map((w) => w.hits),
  wallHitAt: MINE_WALLS.map(() => -Infinity),
}

/** 곡괭이질만 처음으로 (MineController 가 붙고 뗄 때. 시각이 캔버스 시계라 Game 을 다시 그리면 0부터 센다) */
export function resetPickRig() {
  Object.assign(mineRig, PICK_IDLE, { want: null, hitAt: ORE_NODES.map(() => -Infinity), wallHitAt: MINE_WALLS.map(() => -Infinity) })
}
