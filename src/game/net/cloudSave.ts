import { STARTUP_RETRY_MS, pushDelay, retryDelay, startupStep, type ServerSave } from '../logic/cloudSync'
import { makeCode, normalizeCode } from '../logic/recoveryCode'

/** 브라우저에 두는 서버 저장 정보: 복구 코드, 맞춘 번호, 안 올린 변경 있음 */
export const CLOUD_KEY = 'seommaeul-cloud-v1'
export type CloudStatus = 'off' | 'syncing' | 'saved' | 'pending'

export type CloudDeps = {
  /** https://…/save */
  base: string
  fetch: typeof fetch
  storage: Storage | null
  now: () => number
  /** 진행 사본(localStorage fishing-island-save-v1) 원문 */
  readSave: () => string | null
  writeSave: (raw: string) => void
  /** 사본을 다시 읽어 게임 상태에 넣기 (progressStore.persist.rehydrate) */
  rehydrate: () => Promise<void>
  /** 미뤄 둔 사본 저장을 지금 쓰기 (flushProgressSave) */
  flushLocal: () => void
  onStatus: (s: CloudStatus) => void
  notify: (text: string) => void
}

export type CloudSave = {
  start(): Promise<void>
  /** 사본이 바뀌었다 (progressStore 가 저장할 때마다) */
  markDirty(): void
  /** 탭을 숨기거나 닫는다 */
  hide(): void
  code(): string
  /** 코드로 이어 하기: 확인 창에 보일 그 코드의 저장 */
  preview(input: string): Promise<'bad' | 'none' | 'error' | ServerSave>
  /** 지금 진행을 지금 코드로 올려 두고, 코드를 바꿔 그 저장을 받는다 */
  /** 올려 두지 못했으면 false: 아무것도 바꾸지 않는다 */
  switchTo(code: string, save: ServerSave): Promise<boolean>
}

type Persisted = { code: string; syncedRev: number; dirty: boolean }

function readPersisted(storage: Storage | null): Persisted | null {
  try {
    const v = JSON.parse(storage?.getItem(CLOUD_KEY) ?? 'null') as Partial<Persisted> | null
    const code = typeof v?.code === 'string' ? normalizeCode(v.code) : null
    if (!code) return null
    return { code, syncedRev: Number.isInteger(v!.syncedRev) && v!.syncedRev! >= 0 ? v!.syncedRev! : 0, dirty: v!.dirty === true }
  } catch {
    return null
  }
}

export function createCloudSave(deps: CloudDeps): CloudSave {
  const saved = readPersisted(deps.storage)
  let st: Persisted = saved ?? { code: makeCode(), syncedRev: 0, dirty: false }
  /** 변경마다 1 씩: 올리는 도중 바뀌었는지 가린다 */
  let writeSeq = 0
  let firstDirtyAt: number | null = null
  let lastChangeAt = 0
  let timer: ReturnType<typeof setTimeout> | null = null
  let inflight: Promise<boolean> | null = null
  /** 시작 때 서버와 맞추는 일이 끝났다 (그 전에는 올리기를 잡지 않는다) */
  let ready = false
  let startTimer: ReturnType<typeof setTimeout> | null = null
  let failures = 0
  /** 서버 것을 받는 중 (그 사이 persist 저장은 변경으로 치지 않는다) */
  let applying = false

  const persist = () => {
    try {
      deps.storage?.setItem(CLOUD_KEY, JSON.stringify(st))
    } catch {
      // 저장소를 못 쓰면 이번 탭에서만 기억한다
    }
  }
  /** 누구인지 알리는 머리말. 허브 로그인 전환 때 이 함수를 허브 토큰으로 바꾼다 */
  const authHeader = (code: string) => `Bearer ${code}`
  const request = (code: string, init: RequestInit = {}) =>
    deps.fetch(deps.base, { ...init, headers: { Authorization: authHeader(code), 'Content-Type': 'application/json' } })

  const clearTimer = () => {
    if (timer !== null) clearTimeout(timer)
    timer = null
  }
  const schedule = (ms: number) => {
    clearTimer()
    timer = setTimeout(() => {
      timer = null
      if (st.dirty) void push()
    }, ms)
  }

  async function getSave(code: string): Promise<ServerSave | null | 'error'> {
    try {
      const res = await request(code)
      if (res.status === 404) return null
      if (!res.ok) return 'error'
      return (await res.json()) as ServerSave
    } catch {
      return 'error'
    }
  }

  async function adopt(save: ServerSave) {
    clearTimer()
    applying = true
    try {
      // 미뤄 둔 사본 저장이 받은 것을 덮어쓰지 않게 먼저 쓴다
      deps.flushLocal()
      deps.writeSave(JSON.stringify(save.data))
      await deps.rehydrate()
    } finally {
      applying = false
    }
    st = { ...st, syncedRev: save.rev, dirty: false }
    firstDirtyAt = null
    persist()
    deps.onStatus('saved')
  }

  function push(keepalive = false): Promise<boolean> {
    clearTimer()
    if (inflight) return inflight
    const raw = deps.readSave()
    if (!raw) return Promise.resolve(false)
    const seq = writeSeq
    const code = st.code
    deps.onStatus('syncing')
    inflight = (async () => {
      let ok = false
      try {
        const res = await request(code, { method: 'PUT', body: JSON.stringify({ baseRev: st.syncedRev, data: JSON.parse(raw) }), keepalive })
        if (res.status === 409) {
          await adopt((await res.json()) as ServerSave)
          deps.notify('다른 곳에서 한 진행으로 바꿨어요')
        } else if (res.status === 401) {
          // 저장된 코드가 깨졌다: 새 코드로 처음부터 올린다
          st = { code: makeCode(), syncedRev: 0, dirty: true }
          persist()
          schedule(0)
        } else if (res.status === 413) {
          console.warn('[cloudSave] 진행이 너무 커서 올리지 못했어요')
          deps.onStatus('pending')
        } else if (!res.ok) {
          throw new Error(`save ${res.status}`)
        } else {
          const { rev } = (await res.json()) as { rev: number }
          failures = 0
          const changed = writeSeq !== seq
          st = { ...st, syncedRev: rev, dirty: changed }
          if (!changed) firstDirtyAt = null
          persist()
          deps.onStatus('saved')
          if (changed) schedule(pushDelay(firstDirtyAt ?? deps.now(), lastChangeAt, deps.now()))
          ok = true
        }
      } catch {
        deps.onStatus('pending')
        schedule(retryDelay(failures++))
      } finally {
        inflight = null
      }
      return ok
    })()
    return inflight
  }

  /** 맞추기가 끝났다: 그 사이 바뀐 게 남았으면 이제 올리기를 잡는다 */
  function finishStart() {
    ready = true
    if (st.dirty && !inflight && timer === null) {
      const now = deps.now()
      schedule(pushDelay(firstDirtyAt ?? now, lastChangeAt, now))
    }
  }

  async function start() {
    persist()
    deps.onStatus('syncing')
    // 확인하는 사이 코드가 바뀌면(switchTo) 옛 코드의 결과는 버리고, 올리기만 열어 둔다
    const code = st.code
    const server = await getSave(code)
    if (st.code !== code) return finishStart()
    if (server === 'error') {
      deps.onStatus('pending')
      if (startTimer !== null) clearTimeout(startTimer)
      startTimer = setTimeout(() => {
        startTimer = null
        void start()
      }, STARTUP_RETRY_MS)
      return
    }
    const step = startupStep(server, st.syncedRev)
    if (step.kind === 'adopt') {
      await adopt(server!)
      if (st.code !== code) return finishStart()
      finishStart()
      return
    }
    st = { ...st, syncedRev: step.baseRev }
    persist()
    if (step.always || st.dirty) await push()
    else deps.onStatus('saved')
    if (st.code !== code) return finishStart()
    finishStart()
  }

  return {
    start,
    markDirty() {
      if (applying) return
      writeSeq++
      const now = deps.now()
      firstDirtyAt ??= now
      lastChangeAt = now
      if (!st.dirty) {
        st = { ...st, dirty: true }
        persist()
      }
      deps.onStatus('pending')
      if (ready && !inflight) schedule(pushDelay(firstDirtyAt, lastChangeAt, now))
    },
    hide() {
      deps.flushLocal()
      if (!ready) return
      if (inflight) void inflight.then(() => st.dirty && push(true))
      else if (st.dirty) void push(true)
    },
    code: () => st.code,
    async preview(input) {
      const code = normalizeCode(input)
      if (!code) return 'bad'
      const save = await getSave(code)
      return save === null ? 'none' : save
    },
    async switchTo(code, save) {
      deps.flushLocal()
      // 지금 코드로 다 올려 둔 뒤에만 바꾼다 (올리는 도중 바뀐 것까지)
      for (;;) {
        if (inflight) await inflight
        if (!st.dirty || !deps.readSave()) break
        if (!(await push())) return false
      }
      st = { code, syncedRev: 0, dirty: false }
      persist()
      await adopt(save)
      return true
    },
  }
}
