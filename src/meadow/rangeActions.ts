import { inRangeRoom } from '../game/data/meadow'
import { playerRig } from '../game/scene/Player'
import { useProgressStore } from '../game/stores/progressStore'
import { useSessionStore } from '../game/stores/sessionStore'
import { meadowRange } from './meadowSingleton'

/** 연습 게임 결과를 띄워 두는 시간(초). 그 뒤 저절로 닫는다 (은지는 결과 창 닫기 버튼) */
export const RANGE_RESULT_SECONDS = 6

/** G (또는 사격장 안 "연습 게임" 버튼): 하는 중이면 그만, 아니면 사격장 안에서만 시작 (은지 toggleGame) */
export function toggleRangeGame() {
  const range = meadowRange()
  const session = useSessionStore.getState()
  if (range.game.state === 'running' || range.game.state === 'countdown') {
    range.stopGame()
    session.notify('연습 게임을 그만했어요')
    return
  }
  if (!inRangeRoom(playerRig.position.x, playerRig.position.z)) {
    session.notify('연습 게임은 사격장 안에서 G 로 시작해요 (은지 집 거실 오른쪽 문)')
    return
  }
  // 은지 최고 기록은 저장본 값에서 (신기록 판정이 같은 값을 본다)
  range.game.best = Math.max(range.game.best, useProgressStore.getState().rangeBest)
  range.startGame()
}

let lastState = 'idle'
let overAt = 0

/**
 * 매 프레임 (dt 초, now: performance.now() 초): 표적이 넘어지고 움직이고 게임 시간이 간다.
 * 게임이 끝나면 점수를 최고 기록으로 저장하고(더 높을 때만) 결과를 RANGE_RESULT_SECONDS 보인 뒤 닫는다.
 * paused: 게임 시간이 멈추는 때(메뉴 등 restStops). 표적도 게임 시간도 그대로 둔다
 */
export function stepRange(dt: number, now: number, paused = false) {
  if (paused) return
  const range = meadowRange()
  range.update(dt)
  const g = range.game
  if (g.state === 'over' && lastState !== 'over') {
    overAt = now
    useProgressStore.getState().recordRangeScore(g.score)
  }
  if (g.state === 'over' && now - overAt >= RANGE_RESULT_SECONDS) range.dismissGame()
  lastState = g.state
}

/** 게임을 다시 열 때 (RangeRunner 가 붙을 때): 은지 사격장·이 모듈 상태는 남으므로 하던 연습 게임을 점수 없이 지운다 */
export function resetRangeGame() {
  const g = meadowRange().game
  if (g.state !== 'idle') {
    g.state = 'idle'
    g.time = 0
  }
  lastState = 'idle'
  overAt = 0
}

/** 사격장 안에서 쏜 한 발 (게임 중이면 쏜 수에 센다). best: 이번 발에서 가장 높은 표적 점수 (못 맞혔으면 0) */
export function countRangeShot(best: number) {
  if (!inRangeRoom(playerRig.position.x, playerRig.position.z)) return
  const range = meadowRange()
  range.onShot()
  if (best > 0) range.onHit(best)
}
