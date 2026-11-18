// @vitest-environment jsdom
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

// 모델 파일은 테스트에서 받지 않는다 (로딩 실패는 allSettled 로 넘긴다)
beforeAll(() => vi.stubGlobal('fetch', () => Promise.reject(new Error('offline'))))
afterAll(() => vi.unstubAllGlobals())

describe('은지 맵 복사본', () => {
  it('createWorld 가 사격장·동물·상인·거울 파일 없이 만들어지고 충돌 상자가 땅 안에 있다', async () => {
    const { createWorld } = await import('./vendor/world.js')
    const { GROUND } = await import('./vendor/outdoor.js')
    const w = createWorld()
    await Promise.allSettled([w.furnitureReady, w.outdoor.ready, w.town.ready])
    const boxes = w.allColliders()
    expect(boxes.length).toBeGreaterThan(10)
    for (const b of boxes) {
      if (!Number.isFinite(b.min.x)) continue
      expect(b.min.x).toBeGreaterThanOrEqual(GROUND.minX - 1)
      expect(b.max.z).toBeLessThanOrEqual(GROUND.maxZ + 1)
    }
    expect(w.lights.sun.isDirectionalLight).toBe(true)
  })

  it('모델을 못 받아도 들판·마을 ready 는 거절하지 않는다 (나머지를 다 기다린다)', async () => {
    const { createWorld } = await import('./vendor/world.js')
    const w = createWorld()
    await expect(w.outdoor.ready).resolves.toBeDefined()
    await expect(w.town.ready).resolves.toBeDefined()
    // 가구 받기(실패)도 기다린다 (테스트가 끝난 뒤 진짜 fetch 로 가지 않게)
    await Promise.allSettled([w.furnitureReady])
  })

  it('모델 주소는 meadow/ 아래', async () => {
    const { asset } = await import('./vendor/paths.js')
    expect(asset('models/kenney/desk.glb')).toBe('/meadow/models/kenney/desk.glb')
  })
})
