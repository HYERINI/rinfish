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
  switchTo(code: string, save: ServerSave): Promise<void>
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
  let inflight: Promise<void> | null = null
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
    timer = setTimeout(() => void push(), ms)
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
    applying = true
    try {
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

  function push(keepalive = false): Promise<void> {
    clearTimer()
    if (inflight) return inflight
    const raw = deps.readSave()
    if (!raw) return Promise.resolve()
    const seq = writeSeq
    const code = st.code
    deps.onStatus('syncing')
    inflight = (async () => {
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
        }
      } catch {
        deps.onStatus('pending')
        schedule(retryDelay(failures++))
      } finally {
        inflight = null
      }
    })()
    return inflight
  }

  async function start() {
    persist()
    deps.onStatus('syncing')
    const server = await getSave(st.code)
    if (server === 'error') {
      deps.onStatus('pending')
      clearTimer()
      timer = setTimeout(() => void start(), STARTUP_RETRY_MS)
      return
    }
    const step = startupStep(server, st.syncedRev)
    if (step.kind === 'adopt') return adopt(server!)
    st = { ...st, syncedRev: step.baseRev }
    persist()
    if (step.always || st.dirty) return push()
    deps.onStatus('saved')
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
      if (!inflight) schedule(pushDelay(firstDirtyAt, lastChangeAt, now))
    },
    hide() {
      deps.flushLocal()
      if (st.dirty) void push(true)
    },
    code: () => st.code,
    async preview(input) {
      const code = normalizeCode(input)
      if (!code) return 'bad'
      const save = await getSave(code)
      return save === null ? 'none' : save
    },
    async switchTo(code, save) {
      if (st.dirty) await push()
      await inflight
      st = { code, syncedRev: 0, dirty: false }
      persist()
      await adopt(save)
    },
  }
}
