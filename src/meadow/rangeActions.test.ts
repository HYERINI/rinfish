// @vitest-environment jsdom
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { stubCanvas2d } from './canvasStub'
import { Vector3 } from 'three'
import { INITIAL_PROGRESS, useProgressStore } from '../game/stores/progressStore'
import { useSessionStore } from '../game/stores/sessionStore'

// 모델 파일은 테스트에서 받지 않는다
let restoreCanvas = () => {}
beforeAll(() => {
  vi.stubGlobal('fetch', () => Promise.reject(new Error('offline')))
  // 사격장 글씨·과녁 그림 (jsdom 엔 2D 캔버스가 없다)
  restoreCanvas = stubCanvas2d()
})
afterAll(async () => {
  // 모델 받기(실패)를 다 기다린 뒤 되돌린다 (테스트가 끝난 뒤 진짜 fetch 로 가지 않게)
  await (await import('./meadowSingleton')).meadowReady()
  vi.unstubAllGlobals()
  restoreCanvas()
})

beforeEach(() => {
  localStorage.clear()
  useProgressStore.setState({ ...INITIAL_PROGRESS })
  useSessionStore.getState().resetSession()
})

const at = async (x: number, z: number) => (await import('../game/scene/Player')).playerRig.position.set(x, 1, z)

describe('사격장 연습 게임 (G)', () => {
  it('사격장 밖에선 시작하지 않고 알린다, 안에선 3초 카운트다운 → 60초', async () => {
    const { toggleRangeGame, stepRange } = await import('./rangeActions')
    const { meadowRange } = await import('./meadowSingleton')
    await at(160, -12)
    toggleRangeGame()
    expect(meadowRange().game.state).toBe('idle')
    expect(useSessionStore.getState().notice?.text).toContain('사격장 안에서')
    await at(152, 0)
    toggleRangeGame()
    expect(meadowRange().game.state).toBe('countdown')
    stepRange(3.01, 0)
    expect(meadowRange().game.state).toBe('running')
    toggleRangeGame()
    expect(meadowRange().game.state).toBe('over')
    stepRange(0.016, 100)
    stepRange(0.016, 106)
    expect(meadowRange().game.state).toBe('idle')
  })

  it('시간이 멈추는 화면(메뉴 등)이 열린 동안은 게임 시간이 가지 않는다', async () => {
    const { toggleRangeGame, stepRange, resetRangeGame } = await import('./rangeActions')
    const { meadowRange } = await import('./meadowSingleton')
    resetRangeGame()
    await at(152, 0)
    toggleRangeGame()
    stepRange(3.01, 0)
    const g = meadowRange().game
    expect(g.state).toBe('running')
    const left = g.time
    for (let i = 0; i < 100; i++) stepRange(0.1, i * 0.1, true)
    expect(g.time).toBe(left)
    stepRange(0.5, 11)
    expect(g.time).toBeCloseTo(left - 0.5)
  })

  it('게임을 다시 열면(resetRangeGame) 하던 게임을 점수 없이 지운다', async () => {
    const { toggleRangeGame, stepRange, resetRangeGame } = await import('./rangeActions')
    const { meadowRange } = await import('./meadowSingleton')
    resetRangeGame()
    await at(152, 0)
    toggleRangeGame()
    stepRange(3.01, 0)
    meadowRange().game.score = 40
    resetRangeGame()
    stepRange(0.016, 1)
    expect(meadowRange().game.state).toBe('idle')
    expect(useProgressStore.getState().rangeBest).toBe(0)
  })

  it('표적을 맞히면 점수, 끝나면 최고 점수를 저장한다 (더 높을 때만). 결과는 6초 뒤 닫힌다', async () => {
    const { toggleRangeGame, stepRange, countRangeShot, RANGE_RESULT_SECONDS } = await import('./rangeActions')
    const { meadowRange } = await import('./meadowSingleton')
    useProgressStore.setState({ rangeBest: 5 })
    await at(152, 0)
    toggleRangeGame()
    stepRange(3.01, 0)
    const range = meadowRange()
    const t = range.targets[0]
    t.board.updateWorldMatrix(true, false)
    const score = range.hit(t, t.board.localToWorld(new Vector3(0, 0, 0)), 0)
    expect(score).toBe(10)
    countRangeShot(score)
    countRangeShot(0)
    expect([range.game.score, range.game.hits, range.game.shots]).toEqual([10, 1, 2])
    stepRange(60, 10)
    expect(range.game.state).toBe('over')
    expect(range.game.isBest).toBe(true)
    expect(useProgressStore.getState().rangeBest).toBe(10)
    stepRange(0.016, 10 + RANGE_RESULT_SECONDS - 0.1)
    expect(range.game.state).toBe('over')
    stepRange(0.016, 10 + RANGE_RESULT_SECONDS)
    expect(range.game.state).toBe('idle')
  })

  it('사격장 밖에서 쏜 것은 세지 않는다', async () => {
    const { toggleRangeGame, stepRange, countRangeShot } = await import('./rangeActions')
    const { meadowRange } = await import('./meadowSingleton')
    await at(152, 0)
    toggleRangeGame()
    stepRange(3.01, 0)
    const before = meadowRange().game.shots
    await at(160, -12)
    countRangeShot(10)
    expect(meadowRange().game.shots).toBe(before)
    meadowRange().stopGame()
  })
})
