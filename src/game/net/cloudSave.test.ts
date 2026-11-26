// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { BACKUP_KEY, CLOUD_KEY, createCloudSave, type CloudDeps, type CloudStatus } from './cloudSave'

type Call = { method: string; auth: string; body: unknown; keepalive: boolean }

type Stored = { rev: number; data: unknown; savedAt: number; writeId?: string }

/** 가짜 서버: 저장 번호 판정을 서버처럼 한다 (쓰기 요청 ID 도 보관해 돌려준다) */
function fakeServer() {
  const saves = new Map<string, Stored>()
  const calls: Call[] = []
  let down = false
  const handle = (init: RequestInit): Response => {
    const auth = (init.headers as Record<string, string>).Authorization
    const body = init.body ? JSON.parse(init.body as string) : undefined
    const cur = saves.get(auth)
    if (init.method === 'PUT') {
      if (cur && body.baseRev !== cur.rev) return new Response(JSON.stringify(cur), { status: 409 })
      const next: Stored = { rev: (cur?.rev ?? 0) + 1, data: body.data, savedAt: 0, ...(body.writeId && { writeId: body.writeId }) }
      saves.set(auth, next)
      return new Response(JSON.stringify({ rev: next.rev }), { status: 200 })
    }
    return cur ? new Response(JSON.stringify(cur), { status: 200 }) : new Response('{}', { status: 404 })
  }
  const fetch = vi.fn(async (_url: string, init: RequestInit) => {
    const auth = (init.headers as Record<string, string>).Authorization
    const body = init.body ? JSON.parse(init.body as string) : undefined
    calls.push({ method: init.method ?? 'GET', auth, body, keepalive: !!init.keepalive })
    if (down) throw new TypeError('network')
    return handle(init)
  })
  return { saves, calls, fetch, handle, setDown: (v: boolean) => (down = v) }
}

/** 다음 요청 하나는 답이 오지 않는다 (요청을 끊으면 AbortError) */
function hangNext(server: ReturnType<typeof fakeServer>) {
  server.fetch.mockImplementationOnce(
    ((_url: string, init: RequestInit) => {
      server.calls.push({ method: init.method ?? 'GET', auth: '', body: undefined, keepalive: false })
      return new Promise((_res, rej) => init.signal?.addEventListener('abort', () => rej(new DOMException('aborted', 'AbortError'))))
    }) as never,
  )
}

/** 다음 요청 하나는 서버에 반영되지만 응답을 잃는다 */
function loseNextReply(server: ReturnType<typeof fakeServer>) {
  server.fetch.mockImplementationOnce(
    (async (_url: string, init: RequestInit) => {
      server.calls.push({ method: init.method ?? 'GET', auth: '', body: JSON.parse(init.body as string), keepalive: false })
      server.handle(init)
      throw new TypeError('network')
    }) as never,
  )
}

/** 다음 요청 하나는 이 응답 */
function replyNext(server: ReturnType<typeof fakeServer>, status: number, body: unknown) {
  server.fetch.mockImplementationOnce((async () => new Response(JSON.stringify(body), { status })) as never)
}

function setup(server = fakeServer()) {
  let raw: string | null = JSON.stringify({ state: { coins: 1 }, version: 5 })
  const backups: unknown[] = []
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
    onBackup: (b) => backups.push(b),
  }
  const cloud = createCloudSave(deps)
  return { cloud, server, deps, statuses, notices, backups, rehydrate, getRaw: () => raw, setRaw: (t: string | null) => (raw = t) }
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
    expect(JSON.parse(localStorage.getItem(CLOUD_KEY)!)).toEqual({ code: t.cloud.code(), syncedRev: 1, dirty: false, pending: null })
    const put = t.server.calls.find((c) => c.method === 'PUT')!
    expect(put.auth).toBe(`Bearer ${t.cloud.code()}`)
    expect(put.body).toEqual({ baseRev: 0, data: { state: { coins: 1 }, version: 5 }, writeId: expect.any(String) })
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
    expect(puts[1].body).toEqual({ baseRev: 1, data: { state: { coins: 2 }, version: 5 }, writeId: expect.any(String) })
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

  it('거절(409)되면 지금 사본을 백업하고 서버 것을 받고 안내한다', async () => {
    const t = setup()
    await t.cloud.start()
    const auth = `Bearer ${t.cloud.code()}`
    t.server.saves.set(auth, { rev: 5, data: { state: { coins: 50 }, version: 5 }, savedAt: 0 })
    t.setRaw(JSON.stringify({ state: { coins: 2 }, version: 5 }))
    t.cloud.markDirty()
    await vi.advanceTimersByTimeAsync(3000)
    expect(JSON.parse(t.getRaw()!).state.coins).toBe(50)
    expect(t.notices).toEqual(['다른 곳에서 한 진행으로 바꿨어요. 이전 진행은 메뉴에서 되돌릴 수 있어요'])
    expect(JSON.parse(localStorage.getItem(CLOUD_KEY)!)).toMatchObject({ syncedRev: 5, dirty: false, pending: null })
    const backup = JSON.parse(localStorage.getItem(BACKUP_KEY)!)
    expect(JSON.parse(backup.raw).state.coins).toBe(2)
    expect(typeof backup.savedAt).toBe('number')
    expect(t.cloud.backup()).toEqual(backup)
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
    await t.cloud.switchTo('QX7K29PMH4TB8WNC5RDA')
    expect((t.server.saves.get(`Bearer ${oldCode}`)!.data as { state: { coins: number } }).state.coins).toBe(3)
    expect(t.cloud.code()).toBe('QX7K29PMH4TB8WNC5RDA')
    expect(JSON.parse(t.getRaw()!).state.coins).toBe(8)
    expect(JSON.parse(localStorage.getItem(CLOUD_KEY)!)).toEqual({ code: 'QX7K29PMH4TB8WNC5RDA', syncedRev: 4, dirty: false, pending: null })
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
    t.server.saves.set('Bearer QX7K29PMH4TB8WNC5RDA', { rev: 4, data: { state: { coins: 8 }, version: 5 }, savedAt: 0 })
    expect(await t.cloud.switchTo('QX7K29PMH4TB8WNC5RDA')).toBe(false)
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
    t.server.saves.set('Bearer QX7K29PMH4TB8WNC5RDA', other) // 확인할 때 다시 읽는다
    const p = t.cloud.switchTo('QX7K29PMH4TB8WNC5RDA')
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
    t.server.saves.set('Bearer QX7K29PMH4TB8WNC5RDA', other) // 확인할 때 다시 읽는다
    expect(await t.cloud.switchTo('QX7K29PMH4TB8WNC5RDA')).toBe(true)
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
  it('시작 맞추기가 끝나기 전에는 바꾸지 않고(false), 늦게 온 확인은 옛 코드대로 처리한다', async () => {
    const t = setup()
    let release!: () => void
    t.server.fetch.mockImplementationOnce(
      (async () => {
        await new Promise<void>((r) => (release = r))
        return new Response(JSON.stringify({ rev: 9, data: { state: { coins: 99 }, version: 5 }, savedAt: 0 }), { status: 200 })
      }) as never,
    )
    const started = t.cloud.start()
    const oldCode = t.cloud.code()
    const other = { rev: 4, data: { state: { coins: 8 }, version: 5 }, savedAt: 0 }
    t.server.saves.set('Bearer QX7K29PMH4TB8WNC5RDA', other)
    expect(await t.cloud.switchTo('QX7K29PMH4TB8WNC5RDA')).toBe(false)
    expect(t.cloud.code()).toBe(oldCode)
    release()
    await started
    await vi.advanceTimersByTimeAsync(60000)
    expect(t.cloud.code()).toBe(oldCode)
    expect(JSON.parse(t.getRaw()!).state.coins).toBe(99)
    expect(JSON.parse(localStorage.getItem(CLOUD_KEY)!)).toMatchObject({ code: oldCode, syncedRev: 9, dirty: false })
    expect(t.notices).toEqual([])
  })
})

const CODE2 = 'QX7K29PMH4TB8WNC5RDA'
const coinsOf = (raw: string | null) => (JSON.parse(raw!) as { state: { coins: number } }).state.coins
const puts = (t: ReturnType<typeof setup>) => t.server.calls.filter((c) => c.method === 'PUT')
const persisted = () => JSON.parse(localStorage.getItem(CLOUD_KEY)!)

describe('쓰기 요청 ID (응답을 잃어도 제 쓰기를 알아본다)', () => {
  it('보내기 전에 pending 에 남기고, 성공하면 지운다', async () => {
    const t = setup()
    await t.cloud.start()
    const ctl = holdNextPut(t)
    t.cloud.markDirty()
    await vi.advanceTimersByTimeAsync(3000)
    const sent = puts(t).at(-1)
    expect(persisted().pending).toEqual({ id: expect.any(String), baseRev: 1 })
    ctl.release()
    await vi.advanceTimersByTimeAsync(0)
    expect(persisted().pending).toBeNull()
    expect(sent).toBeDefined()
  })

  it('서버엔 들어갔는데 응답을 잃은 뒤 더 플레이하면, 409 를 제 것으로 알아보고 받지 않고 다시 올린다', async () => {
    const t = setup()
    await t.cloud.start()
    loseNextReply(t.server)
    t.setRaw(JSON.stringify({ state: { coins: 2 }, version: 5 }))
    t.cloud.markDirty()
    await vi.advanceTimersByTimeAsync(3000)
    const auth = `Bearer ${t.cloud.code()}`
    expect(t.server.saves.get(auth)!.rev).toBe(2) // 서버엔 들어갔다
    expect(persisted()).toMatchObject({ syncedRev: 1, dirty: true })
    // 응답을 모른 채 더 플레이
    t.setRaw(JSON.stringify({ state: { coins: 7 }, version: 5 }))
    t.cloud.markDirty()
    await vi.advanceTimersByTimeAsync(20000)
    expect(coinsOf(t.getRaw())).toBe(7)
    expect(t.rehydrate).not.toHaveBeenCalled()
    expect(t.notices).toEqual([])
    expect((t.server.saves.get(auth)!.data as { state: { coins: number } }).state.coins).toBe(7)
    expect(t.server.saves.get(auth)!.rev).toBe(3)
    expect(persisted()).toMatchObject({ syncedRev: 3, dirty: false, pending: null })
    expect(localStorage.getItem(BACKUP_KEY)).toBeNull()
  })

  it('시작할 때 서버 저장이 내 pending 쓰기면 받지 않고 이어서 올린다', async () => {
    const server = fakeServer()
    localStorage.setItem(CLOUD_KEY, JSON.stringify({ code: CODE2, syncedRev: 1, dirty: true, pending: { id: 'w-abc', baseRev: 1 } }))
    server.saves.set(`Bearer ${CODE2}`, { rev: 2, data: { state: { coins: 1 }, version: 5 }, savedAt: 0, writeId: 'w-abc' })
    const t = setup(server)
    t.setRaw(JSON.stringify({ state: { coins: 4 }, version: 5 }))
    await t.cloud.start()
    expect(t.rehydrate).not.toHaveBeenCalled()
    expect(coinsOf(t.getRaw())).toBe(4)
    expect(puts(t).at(-1)!.body).toMatchObject({ baseRev: 2 })
    expect(persisted()).toMatchObject({ syncedRev: 3, dirty: false, pending: null })
    expect(t.notices).toEqual([])
  })
})

describe('시작 때 첫 올리기', () => {
  it('서버에 없어서 올리다 실패하면 dirty 로 남겨 다시 시도한다', async () => {
    const t = setup()
    t.server.fetch.mockImplementationOnce((async () => new Response('{}', { status: 404 })) as never)
    t.server.fetch.mockImplementationOnce((async () => {
      throw new TypeError('network')
    }) as never)
    await t.cloud.start()
    expect(persisted().dirty).toBe(true)
    expect(t.statuses.at(-1)).toBe('pending')
    await vi.advanceTimersByTimeAsync(5000)
    expect(t.statuses.at(-1)).toBe('saved')
    expect(persisted()).toMatchObject({ syncedRev: 1, dirty: false })
  })
})

describe('제한 시간', () => {
  it('시작 읽기가 답이 없으면 8초 뒤 실패로 보고 30초 뒤 다시 시도한다', async () => {
    const t = setup()
    hangNext(t.server)
    const started = t.cloud.start()
    await vi.advanceTimersByTimeAsync(8000)
    await started
    expect(t.statuses.at(-1)).toBe('pending')
    await vi.advanceTimersByTimeAsync(30000)
    expect(t.statuses.at(-1)).toBe('saved')
  })

  it('올리기가 답이 없으면 10초 뒤 실패로 보고 다시 시도한다', async () => {
    const t = setup()
    await t.cloud.start()
    hangNext(t.server)
    t.cloud.markDirty()
    await vi.advanceTimersByTimeAsync(3000 + 9999)
    expect(t.statuses.at(-1)).toBe('syncing')
    await vi.advanceTimersByTimeAsync(1)
    expect(t.statuses.at(-1)).toBe('pending')
    await vi.advanceTimersByTimeAsync(5000)
    expect(t.statuses.at(-1)).toBe('saved')
    expect(persisted()).toMatchObject({ syncedRev: 2, dirty: false })
  })
})

describe('늦게 온 시작 확인', () => {
  it('확인 중 플레이해서 바뀌었는데 서버가 더 최신이면, 백업하고 받은 뒤 안내한다', async () => {
    const server = fakeServer()
    localStorage.setItem(CLOUD_KEY, JSON.stringify({ code: CODE2, syncedRev: 1, dirty: false }))
    server.saves.set(`Bearer ${CODE2}`, { rev: 3, data: { state: { coins: 99 }, version: 5 }, savedAt: 0 })
    const t = setup(server)
    let release!: () => void
    t.server.fetch.mockImplementationOnce(
      (async (_u: string, init: RequestInit) => {
        await new Promise<void>((r) => (release = r))
        return t.server.handle(init)
      }) as never,
    )
    const started = t.cloud.start()
    t.setRaw(JSON.stringify({ state: { coins: 5 }, version: 5 }))
    t.cloud.markDirty()
    release()
    await started
    expect(coinsOf(t.getRaw())).toBe(99)
    expect(coinsOf(t.cloud.backup()!.raw)).toBe(5)
    expect(t.notices).toEqual(['다른 곳에서 한 진행으로 바꿨어요. 이전 진행은 메뉴에서 되돌릴 수 있어요'])
  })

  it('안 올린 변경(dirty)을 들고 시작했는데 서버가 더 최신이어도 백업한다', async () => {
    const server = fakeServer()
    localStorage.setItem(CLOUD_KEY, JSON.stringify({ code: CODE2, syncedRev: 1, dirty: true }))
    server.saves.set(`Bearer ${CODE2}`, { rev: 3, data: { state: { coins: 99 }, version: 5 }, savedAt: 0 })
    const t = setup(server)
    await t.cloud.start()
    expect(coinsOf(t.getRaw())).toBe(99)
    expect(coinsOf(t.cloud.backup()!.raw)).toBe(1)
  })

  it('바뀐 게 없으면 백업도 안내도 없이 받는다', async () => {
    const server = fakeServer()
    localStorage.setItem(CLOUD_KEY, JSON.stringify({ code: CODE2, syncedRev: 1, dirty: false }))
    server.saves.set(`Bearer ${CODE2}`, { rev: 3, data: { state: { coins: 99 }, version: 5 }, savedAt: 0 })
    const t = setup(server)
    await t.cloud.start()
    expect(coinsOf(t.getRaw())).toBe(99)
    expect(t.cloud.backup()).toBeNull()
    expect(t.notices).toEqual([])
  })
})

describe('덮어쓰기 전 진행으로 되돌리기', () => {
  async function overwritten() {
    const t = setup()
    await t.cloud.start()
    t.server.saves.set(`Bearer ${t.cloud.code()}`, { rev: 5, data: { state: { coins: 50 }, version: 5 }, savedAt: 0 })
    t.setRaw(JSON.stringify({ state: { coins: 2 }, version: 5 }))
    t.cloud.markDirty()
    await vi.advanceTimersByTimeAsync(3000)
    return t
  }

  it('백업을 사본에 쓰고 다시 읽은 뒤, 최신으로 올리고 백업을 지운다', async () => {
    const t = await overwritten()
    expect(t.backups.at(-1)).toMatchObject({ raw: expect.any(String) })
    expect(await t.cloud.restoreBackup()).toBe(true)
    expect(coinsOf(t.getRaw())).toBe(2)
    expect(t.rehydrate).toHaveBeenCalledTimes(2)
    expect(t.notices.at(-1)).toBe('덮어쓰기 전 진행으로 되돌렸어요')
    expect(localStorage.getItem(BACKUP_KEY)).toBeNull()
    expect(t.backups.at(-1)).toBeNull()
    expect(persisted().dirty).toBe(true)
    await vi.advanceTimersByTimeAsync(3000)
    const s = t.server.saves.get(`Bearer ${t.cloud.code()}`)!
    expect(s.rev).toBe(6)
    expect((s.data as { state: { coins: number } }).state.coins).toBe(2)
    expect(persisted()).toMatchObject({ syncedRev: 6, dirty: false })
  })

  it('백업 지우기', async () => {
    const t = await overwritten()
    t.cloud.clearBackup()
    expect(t.cloud.backup()).toBeNull()
    expect(t.backups.at(-1)).toBeNull()
    expect(await t.cloud.restoreBackup()).toBe(false)
  })

  it('사본이 서버 것과 같으면 백업하지 않고 짧게 안내한다', async () => {
    const t = setup()
    await t.cloud.start()
    t.server.saves.set(`Bearer ${t.cloud.code()}`, { rev: 5, data: { state: { coins: 1 }, version: 5 }, savedAt: 0 })
    t.cloud.markDirty()
    await vi.advanceTimersByTimeAsync(3000)
    expect(t.cloud.backup()).toBeNull()
    expect(t.notices).toEqual(['다른 곳에서 한 진행으로 바꿨어요'])
  })

  it('다른 코드의 백업은 보이지도 되돌려지지도 않고, 그 코드로 돌아가면 다시 보인다', async () => {
    const t = await overwritten()
    const oldCode = t.cloud.code()
    t.server.saves.set(`Bearer ${CODE2}`, { rev: 4, data: { state: { coins: 8 }, version: 5 }, savedAt: 0 })
    expect(await t.cloud.switchTo(CODE2)).toBe(true)
    expect(t.cloud.backup()).toBeNull()
    expect(t.backups.at(-1)).toBeNull()
    expect(await t.cloud.restoreBackup()).toBe(false)
    expect(coinsOf(t.getRaw())).toBe(8)
    expect(t.server.saves.get(`Bearer ${CODE2}`)!.rev).toBe(4)
    expect(await t.cloud.switchTo(oldCode)).toBe(true)
    expect(coinsOf(t.cloud.backup()!.raw)).toBe(2)
    expect(coinsOf((t.backups.at(-1) as { raw: string }).raw)).toBe(2)
  })

  it('백업을 쓰지 못하면(저장 공간 부족) 덮어쓰지 않고 이 브라우저 진행을 지킨다', async () => {
    const t = setup()
    await t.cloud.start()
    t.server.saves.set(`Bearer ${t.cloud.code()}`, { rev: 5, data: { state: { coins: 50 }, version: 5 }, savedAt: 0 })
    t.setRaw(JSON.stringify({ state: { coins: 2 }, version: 5 }))
    const setItem = Storage.prototype.setItem
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (this: Storage, k: string, v: string) {
      if (k === BACKUP_KEY) throw new DOMException('full', 'QuotaExceededError')
      return setItem.call(this, k, v)
    })
    try {
      t.cloud.markDirty()
      await vi.advanceTimersByTimeAsync(3000)
      expect(coinsOf(t.getRaw())).toBe(2)
      expect(t.cloud.backup()).toBeNull()
      expect(persisted().dirty).toBe(true)
      expect(t.statuses.at(-1)).toBe('pending')
      expect(t.notices).toEqual(['저장 공간이 부족해 다른 곳에서 한 진행을 받지 못했어요. 이 브라우저 진행은 그대로예요'])
      // 다시 충돌해도 안내는 한 번만
      t.cloud.markDirty()
      await vi.advanceTimersByTimeAsync(3000)
      expect(t.notices).toHaveLength(1)
      // 코드 바꾸기도 지금 진행을 못 올렸으니 바꾸지 않는다
      t.server.saves.set(`Bearer ${CODE2}`, { rev: 1, data: { state: { coins: 8 }, version: 5 }, savedAt: 0 })
      const oldCode = t.cloud.code()
      expect(await t.cloud.switchTo(CODE2)).toBe(false)
      expect(t.cloud.code()).toBe(oldCode)
      expect(coinsOf(t.getRaw())).toBe(2)
    } finally {
      spy.mockRestore()
    }
  })

  it('망가진 백업은 없는 것으로 본다', () => {
    localStorage.setItem(BACKUP_KEY, '{망가짐')
    expect(setup().cloud.backup()).toBeNull()
    localStorage.setItem(BACKUP_KEY, JSON.stringify({ savedAt: 'x', raw: 3 }))
    expect(setup().cloud.backup()).toBeNull()
    // 어느 코드의 백업인지 없으면 되돌리지 않는다
    localStorage.setItem(BACKUP_KEY, JSON.stringify({ savedAt: 1, raw: '{}' }))
    expect(setup().cloud.backup()).toBeNull()
  })
})

describe('코드 바꾸기: 확인할 때 다시 읽기와 409', () => {
  it('미리보기 뒤 대상 저장이 바뀌었으면 새 것을 받는다', async () => {
    const t = setup()
    await t.cloud.start()
    t.server.saves.set(`Bearer ${CODE2}`, { rev: 4, data: { state: { coins: 8 }, version: 5 }, savedAt: 0 })
    expect(await t.cloud.preview(CODE2)).toMatchObject({ rev: 4 })
    t.server.saves.set(`Bearer ${CODE2}`, { rev: 5, data: { state: { coins: 9 }, version: 5 }, savedAt: 0 })
    expect(await t.cloud.switchTo(CODE2)).toBe(true)
    expect(coinsOf(t.getRaw())).toBe(9)
    expect(persisted()).toMatchObject({ code: CODE2, syncedRev: 5 })
  })

  it('대상 저장이 없어졌거나 읽지 못하면 false 이고 바꾸지 않는다', async () => {
    const t = setup()
    await t.cloud.start()
    const oldCode = t.cloud.code()
    expect(await t.cloud.switchTo(CODE2)).toBe(false)
    expect(t.cloud.code()).toBe(oldCode)
    expect(coinsOf(t.getRaw())).toBe(1)
  })

  it('옛 코드로 올리다 409 면 백업하고 받은 뒤 이어서 바꾼다 (true)', async () => {
    const t = setup()
    await t.cloud.start()
    const oldCode = t.cloud.code()
    t.server.saves.set(`Bearer ${oldCode}`, { rev: 5, data: { state: { coins: 50 }, version: 5 }, savedAt: 0 })
    t.server.saves.set(`Bearer ${CODE2}`, { rev: 4, data: { state: { coins: 8 }, version: 5 }, savedAt: 0 })
    t.setRaw(JSON.stringify({ state: { coins: 3 }, version: 5 }))
    t.cloud.markDirty()
    expect(await t.cloud.switchTo(CODE2)).toBe(true)
    expect(t.cloud.code()).toBe(CODE2)
    expect(coinsOf(t.getRaw())).toBe(8)
    // 백업은 옛 코드 것이라 지금 코드에서는 안 보인다
    expect(t.cloud.backup()).toBeNull()
    expect(JSON.parse(localStorage.getItem(BACKUP_KEY)!)).toMatchObject({ code: oldCode })
    expect(coinsOf(JSON.parse(localStorage.getItem(BACKUP_KEY)!).raw)).toBe(3)
  })
})

describe('서버 응답 검사', () => {
  it('시작 읽기 응답 모양이 틀리면 받지 않고 실패로 본다', async () => {
    const t = setup()
    replyNext(t.server, 200, { rev: 'x', data: 1 })
    await t.cloud.start()
    expect(t.rehydrate).not.toHaveBeenCalled()
    expect(t.statuses.at(-1)).toBe('pending')
    expect(puts(t)).toHaveLength(0)
  })

  it('409 본문이 틀리면 받지 않고 다시 시도한다', async () => {
    const t = setup()
    await t.cloud.start()
    replyNext(t.server, 409, {})
    t.setRaw(JSON.stringify({ state: { coins: 2 }, version: 5 }))
    t.cloud.markDirty()
    await vi.advanceTimersByTimeAsync(3000)
    expect(coinsOf(t.getRaw())).toBe(2)
    expect(t.rehydrate).not.toHaveBeenCalled()
    expect(t.statuses.at(-1)).toBe('pending')
    await vi.advanceTimersByTimeAsync(5000)
    expect(persisted()).toMatchObject({ syncedRev: 2, dirty: false })
  })

  it('성공(200)인데 rev 가 없으면 실패로 보고 맞춘 번호를 그대로 둔다', async () => {
    const t = setup()
    await t.cloud.start()
    replyNext(t.server, 200, { ok: true })
    t.cloud.markDirty()
    await vi.advanceTimersByTimeAsync(3000)
    expect(persisted()).toMatchObject({ syncedRev: 1, dirty: true })
    expect(t.statuses.at(-1)).toBe('pending')
  })
})

describe('너무 큼(413)', () => {
  it('한 번만 안내하고, 다시 시도하지 않고 대기 중', async () => {
    const t = setup()
    await t.cloud.start()
    replyNext(t.server, 413, {})
    t.cloud.markDirty()
    await vi.advanceTimersByTimeAsync(3000)
    expect(t.statuses.at(-1)).toBe('pending')
    const n = puts(t).length
    await vi.advanceTimersByTimeAsync(60000)
    expect(puts(t)).toHaveLength(n)
    replyNext(t.server, 413, {})
    t.cloud.markDirty()
    await vi.advanceTimersByTimeAsync(3000)
    expect(t.notices).toEqual(['진행이 너무 커서 서버에 저장하지 못했어요'])
  })
})

describe('상태 표시', () => {
  it('올릴 사본이 없으면 저장됨', async () => {
    const t = setup()
    t.setRaw(null)
    await t.cloud.start()
    expect(t.statuses.at(-1)).toBe('saved')
  })

  it('올리는 중 바뀌었으면 성공 뒤에도 대기 중', async () => {
    const t = setup()
    await t.cloud.start()
    const ctl = holdNextPut(t)
    t.cloud.markDirty()
    await vi.advanceTimersByTimeAsync(3000)
    t.cloud.markDirty()
    ctl.release()
    await vi.advanceTimersByTimeAsync(0)
    expect(t.statuses.at(-1)).toBe('pending')
  })
})
