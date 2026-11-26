// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { CLOUD_KEY, createCloudSave, type CloudDeps, type CloudStatus } from './cloudSave'

type Call = { method: string; auth: string; body: unknown; keepalive: boolean }

/** 가짜 서버: 저장 번호 판정을 서버처럼 한다 */
function fakeServer() {
  const saves = new Map<string, { rev: number; data: unknown; savedAt: number }>()
  const calls: Call[] = []
  let down = false
  const fetch = vi.fn(async (_url: string, init: RequestInit) => {
    const auth = (init.headers as Record<string, string>).Authorization
    const body = init.body ? JSON.parse(init.body as string) : undefined
    calls.push({ method: init.method ?? 'GET', auth, body, keepalive: !!init.keepalive })
    if (down) throw new TypeError('network')
    const cur = saves.get(auth)
    if (init.method === 'PUT') {
      if (cur && body.baseRev !== cur.rev) return new Response(JSON.stringify(cur), { status: 409 })
      const next = { rev: (cur?.rev ?? 0) + 1, data: body.data, savedAt: 0 }
      saves.set(auth, next)
      return new Response(JSON.stringify({ rev: next.rev }), { status: 200 })
    }
    return cur ? new Response(JSON.stringify(cur), { status: 200 }) : new Response('{}', { status: 404 })
  })
  return { saves, calls, fetch, setDown: (v: boolean) => (down = v) }
}

function setup(server = fakeServer()) {
  let raw: string | null = JSON.stringify({ state: { coins: 1 }, version: 5 })
  const statuses: CloudStatus[] = []
  const notices: string[] = []
  const rehydrate = vi.fn(async () => {})
  const deps: CloudDeps = {
    base: 'https://x/save',
    fetch: server.fetch as unknown as typeof fetch,
    storage: localStorage,
    now: () => Date.now(),
    readSave: () => raw,
    writeSave: (t) => (raw = t),
    rehydrate,
    flushLocal: vi.fn(),
    onStatus: (s) => statuses.push(s),
    notify: (t) => notices.push(t),
  }
  const cloud = createCloudSave(deps)
  return { cloud, server, deps, statuses, notices, rehydrate, getRaw: () => raw, setRaw: (t: string) => (raw = t) }
}

beforeEach(() => {
  localStorage.clear()
  vi.useFakeTimers()
})
afterEach(() => vi.useRealTimers())

describe('start', () => {
  it('코드를 만들어 저장하고, 서버에 없으면 지금 사본을 0번으로 올린다', async () => {
    const t = setup()
    await t.cloud.start()
    expect(t.cloud.code()).toHaveLength(20)
    expect(JSON.parse(localStorage.getItem(CLOUD_KEY)!)).toEqual({ code: t.cloud.code(), syncedRev: 1, dirty: false })
    const put = t.server.calls.find((c) => c.method === 'PUT')!
    expect(put.auth).toBe(`Bearer ${t.cloud.code()}`)
    expect(put.body).toEqual({ baseRev: 0, data: { state: { coins: 1 }, version: 5 } })
    expect(t.statuses.at(-1)).toBe('saved')
  })

  it('서버가 더 최신이면 서버 것을 사본에 쓰고 다시 읽는다', async () => {
    const server = fakeServer()
    localStorage.setItem(CLOUD_KEY, JSON.stringify({ code: 'QX7K29PMH4TB8WNC5RDA', syncedRev: 1, dirty: false }))
    server.saves.set('Bearer QX7K29PMH4TB8WNC5RDA', { rev: 3, data: { state: { coins: 99 }, version: 5 }, savedAt: 0 })
    const t = setup(server)
    await t.cloud.start()
    expect(JSON.parse(t.getRaw()!).state.coins).toBe(99)
    expect(t.rehydrate).toHaveBeenCalledOnce()
    expect(JSON.parse(localStorage.getItem(CLOUD_KEY)!).syncedRev).toBe(3)
    expect(t.server.calls.some((c) => c.method === 'PUT')).toBe(false)
  })

  it('서버에 못 닿으면 pending 이고 30초 뒤 다시 시도한다', async () => {
    const t = setup()
    t.server.setDown(true)
    await t.cloud.start()
    expect(t.statuses.at(-1)).toBe('pending')
    t.server.setDown(false)
    await vi.advanceTimersByTimeAsync(30000)
    expect(t.statuses.at(-1)).toBe('saved')
  })
})

describe('플레이 중', () => {
  it('변경 뒤 3초 조용하면 맞춘 번호로 올린다', async () => {
    const t = setup()
    await t.cloud.start()
    t.setRaw(JSON.stringify({ state: { coins: 2 }, version: 5 }))
    t.cloud.markDirty()
    await vi.advanceTimersByTimeAsync(2900)
    expect(t.server.calls.filter((c) => c.method === 'PUT')).toHaveLength(1)
    await vi.advanceTimersByTimeAsync(200)
    const puts = t.server.calls.filter((c) => c.method === 'PUT')
    expect(puts).toHaveLength(2)
    expect(puts[1].body).toEqual({ baseRev: 1, data: { state: { coins: 2 }, version: 5 } })
    expect(JSON.parse(localStorage.getItem(CLOUD_KEY)!)).toMatchObject({ syncedRev: 2, dirty: false })
  })

  it('계속 바뀌어도 15초 안에는 올린다', async () => {
    const t = setup()
    await t.cloud.start()
    for (let i = 0; i < 16; i++) {
      t.cloud.markDirty()
      await vi.advanceTimersByTimeAsync(1000)
    }
    expect(t.server.calls.filter((c) => c.method === 'PUT').length).toBeGreaterThanOrEqual(2)
  })

  it('dirty 는 새로고침 뒤에도 남는다', async () => {
    const t = setup()
    await t.cloud.start()
    t.server.setDown(true)
    t.cloud.markDirty()
    expect(JSON.parse(localStorage.getItem(CLOUD_KEY)!).dirty).toBe(true)
    // 새로고침: 같은 저장소로 새로 만든다
    t.server.setDown(false)
    const again = setup(t.server)
    await again.cloud.start()
    const puts = t.server.calls.filter((c) => c.method === 'PUT')
    expect(puts.at(-1)!.body).toMatchObject({ baseRev: 1 })
    expect(JSON.parse(localStorage.getItem(CLOUD_KEY)!).dirty).toBe(false)
  })

  it('올리는 중 바뀌면 성공 뒤에도 dirty', async () => {
    const t = setup()
    await t.cloud.start()
    let release!: () => void
    t.server.fetch.mockImplementationOnce(
      (async () => {
        await new Promise<void>((r) => (release = r))
        return new Response(JSON.stringify({ rev: 2 }), { status: 200 })
      }) as never,
    )
    t.cloud.markDirty()
    await vi.advanceTimersByTimeAsync(3000)
    t.cloud.markDirty() // 올리는 도중 변경
    release()
    await vi.advanceTimersByTimeAsync(0)
    expect(JSON.parse(localStorage.getItem(CLOUD_KEY)!)).toMatchObject({ syncedRev: 2, dirty: true })
  })

  it('실패하면 pending, 5초 뒤 다시 시도한다', async () => {
    const t = setup()
    await t.cloud.start()
    t.server.setDown(true)
    t.cloud.markDirty()
    await vi.advanceTimersByTimeAsync(3000)
    expect(t.statuses.at(-1)).toBe('pending')
    t.server.setDown(false)
    await vi.advanceTimersByTimeAsync(5000)
    expect(t.statuses.at(-1)).toBe('saved')
  })

  it('거절(409)되면 서버 것을 받고 안내한다', async () => {
    const t = setup()
    await t.cloud.start()
    const auth = `Bearer ${t.cloud.code()}`
    t.server.saves.set(auth, { rev: 5, data: { state: { coins: 50 }, version: 5 }, savedAt: 0 })
    t.cloud.markDirty()
    await vi.advanceTimersByTimeAsync(3000)
    expect(JSON.parse(t.getRaw()!).state.coins).toBe(50)
    expect(t.notices).toContain('다른 곳에서 한 진행으로 바꿨어요')
    expect(JSON.parse(localStorage.getItem(CLOUD_KEY)!)).toMatchObject({ syncedRev: 5, dirty: false })
  })

  it('adopt 중 저장은 dirty 로 안 잡힌다', async () => {
    const t = setup()
    t.rehydrate.mockImplementation(async () => t.cloud.markDirty()) // persist 가 다시 쓰는 경우
    const auth = 'Bearer QX7K29PMH4TB8WNC5RDA'
    localStorage.setItem(CLOUD_KEY, JSON.stringify({ code: 'QX7K29PMH4TB8WNC5RDA', syncedRev: 0, dirty: false }))
    t.server.saves.set(auth, { rev: 2, data: { state: {}, version: 5 }, savedAt: 0 })
    await t.cloud.start()
    expect(JSON.parse(localStorage.getItem(CLOUD_KEY)!).dirty).toBe(false)
  })

  it('탭을 숨기면 사본을 먼저 쓰고 keepalive 로 바로 올린다', async () => {
    const t = setup()
    await t.cloud.start()
    t.cloud.markDirty()
    t.cloud.hide()
    expect(t.deps.flushLocal).toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(0)
    expect(t.server.calls.at(-1)).toMatchObject({ method: 'PUT', keepalive: true })
  })
})

describe('코드로 이어 하기', () => {
  it('모양이 틀리면 bad, 없으면 none, 있으면 저장본', async () => {
    const t = setup()
    await t.cloud.start()
    expect(await t.cloud.preview('abc')).toBe('bad')
    expect(await t.cloud.preview('QX7K-29PM-H4TB-8WNC-5RDA')).toBe('none')
    t.server.saves.set('Bearer QX7K29PMH4TB8WNC5RDA', { rev: 4, data: { state: { coins: 8 }, version: 5 }, savedAt: 0 })
    expect(await t.cloud.preview('qx7k29pmh4tb8wnc5rda')).toMatchObject({ rev: 4 })
  })

  it('바꾸기 전에 지금 진행을 지금 코드로 올리고, 코드를 바꾼 뒤 그 진행을 받는다', async () => {
    const t = setup()
    await t.cloud.start()
    const oldCode = t.cloud.code()
    t.setRaw(JSON.stringify({ state: { coins: 3 }, version: 5 }))
    t.cloud.markDirty()
    const other = { rev: 4, data: { state: { coins: 8 }, version: 5 }, savedAt: 0 }
    t.server.saves.set('Bearer QX7K29PMH4TB8WNC5RDA', other)
    await t.cloud.switchTo('QX7K29PMH4TB8WNC5RDA', other)
    expect((t.server.saves.get(`Bearer ${oldCode}`)!.data as { state: { coins: number } }).state.coins).toBe(3)
    expect(t.cloud.code()).toBe('QX7K29PMH4TB8WNC5RDA')
    expect(JSON.parse(t.getRaw()!).state.coins).toBe(8)
    expect(JSON.parse(localStorage.getItem(CLOUD_KEY)!)).toEqual({ code: 'QX7K29PMH4TB8WNC5RDA', syncedRev: 4, dirty: false })
  })
})

/** 첫 번째 PUT 응답을 손으로 풀어 줄 때까지 붙잡아 둔다 */
function holdNextPut(t: ReturnType<typeof setup>) {
  const ctl = { release: () => {} }
  t.server.fetch.mockImplementationOnce(
    (async (_url: string, init: RequestInit) => {
      await new Promise<void>((r) => (ctl.release = r))
      // 서버에도 반영해 둔다 (응답만 늦은 것)
      const body = JSON.parse(init.body as string)
      t.server.saves.set((init.headers as Record<string, string>).Authorization, { rev: 2, data: body.data, savedAt: 0 })
      return new Response(JSON.stringify({ rev: 2 }), { status: 200 })
    }) as never,
  )
  return ctl
}

describe('코드 바꾸기 보호', () => {
  it('올리지 못하면 false 이고 아무것도 바꾸지 않는다', async () => {
    const t = setup()
    await t.cloud.start()
    const oldCode = t.cloud.code()
    const before = JSON.parse(localStorage.getItem(CLOUD_KEY)!)
    t.setRaw(JSON.stringify({ state: { coins: 3 }, version: 5 }))
    t.cloud.markDirty()
    t.server.setDown(true)
    const other = { rev: 4, data: { state: { coins: 8 }, version: 5 }, savedAt: 0 }
    expect(await t.cloud.switchTo('QX7K29PMH4TB8WNC5RDA', other)).toBe(false)
    expect(t.cloud.code()).toBe(oldCode)
    expect(JSON.parse(t.getRaw()!).state.coins).toBe(3)
    expect(JSON.parse(localStorage.getItem(CLOUD_KEY)!)).toMatchObject({ code: oldCode, syncedRev: before.syncedRev })
  })

  it('올리는 중 바뀐 것도 옛 코드로 올린 뒤에 바꾼다', async () => {
    const t = setup()
    await t.cloud.start()
    const oldCode = t.cloud.code()
    const ctl = holdNextPut(t)
    t.cloud.markDirty()
    await vi.advanceTimersByTimeAsync(3000)
    t.setRaw(JSON.stringify({ state: { coins: 7 }, version: 5 }))
    t.cloud.markDirty()
    const other = { rev: 4, data: { state: { coins: 8 }, version: 5 }, savedAt: 0 }
    const p = t.cloud.switchTo('QX7K29PMH4TB8WNC5RDA', other)
    ctl.release()
    expect(await p).toBe(true)
    expect(t.deps.flushLocal).toHaveBeenCalled()
    expect((t.server.saves.get(`Bearer ${oldCode}`)!.data as { state: { coins: number } }).state.coins).toBe(7)
    expect(t.cloud.code()).toBe('QX7K29PMH4TB8WNC5RDA')
  })

  it('받기 전에 사본 저장을 먼저 쓰고, 바꾼 뒤에는 더 올리지 않는다', async () => {
    const t = setup()
    await t.cloud.start()
    const order: string[] = []
    ;(t.deps.flushLocal as ReturnType<typeof vi.fn>).mockImplementation(() => order.push('flush'))
    const write = t.deps.writeSave
    t.deps.writeSave = (r) => {
      order.push('write')
      write(r)
    }
    t.cloud.markDirty()
    const other = { rev: 4, data: { state: { coins: 8 }, version: 5 }, savedAt: 0 }
    expect(await t.cloud.switchTo('QX7K29PMH4TB8WNC5RDA', other)).toBe(true)
    expect(order.lastIndexOf('flush')).toBeLessThan(order.indexOf('write'))
    const putsBefore = t.server.calls.filter((c) => c.method === 'PUT').length
    await vi.advanceTimersByTimeAsync(60000)
    expect(t.server.calls.filter((c) => c.method === 'PUT')).toHaveLength(putsBefore)
    expect(t.server.calls.some((c) => c.method === 'PUT' && c.auth === 'Bearer QX7K29PMH4TB8WNC5RDA')).toBe(false)
  })
})

describe('시작과 올리기 겹침', () => {
  it('시작 확인 중 바뀌어도 확인이 끝나기 전에는 올리지 않는다', async () => {
    const t = setup()
    let release!: () => void
    t.server.fetch.mockImplementationOnce(
      (async () => {
        await new Promise<void>((r) => (release = r))
        return new Response('{}', { status: 404 })
      }) as never,
    )
    const started = t.cloud.start()
    t.cloud.markDirty()
    await vi.advanceTimersByTimeAsync(10000)
    expect(t.server.calls.filter((c) => c.method === 'PUT')).toHaveLength(0)
    release()
    await started
    await vi.advanceTimersByTimeAsync(10000)
    const puts = t.server.calls.filter((c) => c.method === 'PUT')
    expect(puts).toHaveLength(1)
    expect(puts[0].body).toMatchObject({ baseRev: 0 })
    expect(t.notices).toEqual([])
  })
})

describe('숨길 때 올리는 중', () => {
  it('올리는 중에 숨기면 끝난 뒤 남은 변경을 keepalive 로 올린다', async () => {
    const t = setup()
    await t.cloud.start()
    const ctl = holdNextPut(t)
    t.cloud.markDirty()
    await vi.advanceTimersByTimeAsync(3000)
    t.cloud.markDirty()
    t.cloud.hide()
    ctl.release()
    await vi.advanceTimersByTimeAsync(0)
    expect(t.server.calls.at(-1)).toMatchObject({ method: 'PUT', keepalive: true })
  })
})

describe('시작 확인 중 코드 바꾸기', () => {
  it('옛 코드의 확인이 늦게 와도 새 코드의 진행을 건드리지 않는다', async () => {
    const t = setup()
    let release!: () => void
    t.server.fetch.mockImplementationOnce(
      (async () => {
        await new Promise<void>((r) => (release = r))
        return new Response(JSON.stringify({ rev: 9, data: { state: { coins: 99 }, version: 5 }, savedAt: 0 }), { status: 200 })
      }) as never,
    )
    const started = t.cloud.start()
    const other = { rev: 4, data: { state: { coins: 8 }, version: 5 }, savedAt: 0 }
    t.server.saves.set('Bearer QX7K29PMH4TB8WNC5RDA', other)
    expect(await t.cloud.switchTo('QX7K29PMH4TB8WNC5RDA', other)).toBe(true)
    release()
    await started
    await vi.advanceTimersByTimeAsync(60000)
    expect(t.cloud.code()).toBe('QX7K29PMH4TB8WNC5RDA')
    expect(JSON.parse(t.getRaw()!).state.coins).toBe(8)
    expect(JSON.parse(localStorage.getItem(CLOUD_KEY)!)).toEqual({ code: 'QX7K29PMH4TB8WNC5RDA', syncedRev: 4, dirty: false })
    expect(t.server.calls.some((c) => c.method === 'PUT')).toBe(false)
    expect(t.notices).toEqual([])
  })
})
