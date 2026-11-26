import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { TAB_LOCK, holdTabLock } from './tabLock'

/** 한 브라우저의 Web Locks 흉내: 이름마다 하나만 잡힌다 */
function fakeLocks() {
  const held = new Set<string>()
  const requests: { name: string; options: LockOptions }[] = []
  const locks = {
    request: vi.fn((name: string, options: LockOptions, cb: (lock: Lock | null) => Promise<unknown> | unknown) => {
      requests.push({ name, options })
      if (held.has(name)) return Promise.resolve(cb(null))
      held.add(name)
      return Promise.resolve(cb({ name, mode: 'exclusive' } as Lock)).finally(() => held.delete(name))
    }),
  }
  return { locks: locks as unknown as LockManager, held, requests }
}

beforeEach(() => vi.useFakeTimers())
afterEach(() => vi.useRealTimers())

describe('holdTabLock (탭 하나만)', () => {
  it('잡히면 true 이고 페이지가 살아 있는 동안 놓지 않는다', async () => {
    const f = fakeLocks()
    expect(await holdTabLock(f.locks)).toBe(true)
    await vi.advanceTimersByTimeAsync(60000)
    expect(f.held.has(TAB_LOCK)).toBe(true)
    expect(f.requests[0]).toEqual({ name: 'seommaeul-game', options: { ifAvailable: true } })
  })

  it('다른 탭이 잡고 있으면 잠시 뒤 한 번 더 보고, 그래도 막히면 false', async () => {
    const f = fakeLocks()
    f.held.add(TAB_LOCK)
    const p = holdTabLock(f.locks)
    await vi.advanceTimersByTimeAsync(1000)
    expect(await p).toBe(false)
    expect(f.requests).toHaveLength(2)
  })

  it('새로고침 직후 옛 페이지가 곧 놓으면 두 번째에 잡는다', async () => {
    const f = fakeLocks()
    f.held.add(TAB_LOCK)
    const p = holdTabLock(f.locks)
    await vi.advanceTimersByTimeAsync(0)
    f.held.delete(TAB_LOCK)
    await vi.advanceTimersByTimeAsync(1000)
    expect(await p).toBe(true)
  })

  it('Web Locks 가 없는 브라우저는 잠금 없이 간다', async () => {
    expect(await holdTabLock(undefined)).toBe(true)
  })

  it('잠금 요청이 실패하면(막힌 환경) 잠금 없이 간다', async () => {
    const locks = { request: vi.fn(() => Promise.reject(new Error('SecurityError'))) } as unknown as LockManager
    expect(await holdTabLock(locks)).toBe(true)
  })
})
