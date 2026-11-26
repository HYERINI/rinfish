import { GET_TIMEOUT_MS, PUT_TIMEOUT_MS, STARTUP_RETRY_MS, parsePutReply, parseServerSave, pushDelay, retryDelay, startupStep, type ServerSave } from '../logic/cloudSync'
import { makeCode, normalizeCode } from '../logic/recoveryCode'

/** 브라우저에 두는 서버 저장 정보: 복구 코드, 맞춘 번호, 안 올린 변경 있음, 결과를 모르는 쓰기 */
export const CLOUD_KEY = 'seommaeul-cloud-v1'
/** 서버 것으로 덮어쓰기 전 이 브라우저 사본 (한 칸, 새것이 이긴다). 그 코드에서만 되돌린다 */
export const BACKUP_KEY = 'seommaeul-cloud-backup-v1'
export type CloudStatus = 'off' | 'syncing' | 'saved' | 'pending'
export type CloudBackup = { code: string; savedAt: number; raw: string }

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
  /** 덮어쓰기 전 백업이 생기거나 없어졌다 (메뉴 표시용) */
  onBackup?: (b: CloudBackup | null) => void
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
  /** 지금 진행을 지금 코드로 올려 두고, 코드를 바꿔 그 저장을 (확인하는 지금 다시 읽어) 받는다 */
  /** 시작 맞추기 전이거나, 올려 두지 못했거나, 그 저장을 다시 읽지 못했으면 false: 코드는 그대로 */
  switchTo(code: string): Promise<boolean>
  /** 서버 것으로 덮어쓰기 전 백업 (지금 코드 것만) */
  backup(): CloudBackup | null
  /** 백업을 사본으로 되돌리고 가장 새 변경으로 올린다. 백업이 없으면 false */
  restoreBackup(): Promise<boolean>
  clearBackup(): void
}

/** 보낸 뒤 결과를 모르는 쓰기: 쓰기 요청 ID 와 그때 맞춘 번호 */
type Pending = { id: string; baseRev: number }
type Persisted = { code: string; syncedRev: number; dirty: boolean; pending: Pending | null }

const CONFLICT = '다른 곳에서 한 진행으로 바꿨어요'
const CONFLICT_BACKUP = `${CONFLICT}. 이전 진행은 메뉴에서 되돌릴 수 있어요`

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)

function readPending(v: unknown): Pending | null {
  if (!isRecord(v) || typeof v.id !== 'string' || v.id.length === 0 || v.id.length > 64) return null
  return Number.isInteger(v.baseRev) && (v.baseRev as number) >= 0 ? { id: v.id, baseRev: v.baseRev as number } : null
}

function readPersisted(storage: Storage | null): Persisted | null {
  try {
    const v = JSON.parse(storage?.getItem(CLOUD_KEY) ?? 'null') as Partial<Persisted> | null
    const code = typeof v?.code === 'string' ? normalizeCode(v.code) : null
    if (!code) return null
    return { code, syncedRev: Number.isInteger(v!.syncedRev) && v!.syncedRev! >= 0 ? v!.syncedRev! : 0, dirty: v!.dirty === true, pending: readPending(v!.pending) }
  } catch {
    return null
  }
}

/** 그 코드의 백업. 다른 코드 것을 되돌리면 그 코드의 진행을 덮으니 없는 것으로 본다 */
function readBackup(storage: Storage | null, code: string): CloudBackup | null {
  try {
    const v = JSON.parse(storage?.getItem(BACKUP_KEY) ?? 'null') as unknown
    return isRecord(v) && v.code === code && typeof v.savedAt === 'number' && typeof v.raw === 'string' ? { code, savedAt: v.savedAt, raw: v.raw } : null
  } catch {
    return null
  }
}

export function createCloudSave(deps: CloudDeps): CloudSave {
  const saved = readPersisted(deps.storage)
  let st: Persisted = saved ?? { code: makeCode(), syncedRev: 0, dirty: false, pending: null }
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
  /** 너무 큼(413) 안내는 한 번만 */
  let tooBigNoticed = false

  const persist = () => {
    try {
      deps.storage?.setItem(CLOUD_KEY, JSON.stringify(st))
    } catch {
      // 저장소를 못 쓰면 이번 탭에서만 기억한다
    }
  }
  /** 누구인지 알리는 머리말. 허브 로그인 전환 때 이 함수를 허브 토큰으로 바꾼다 */
  const authHeader = (code: string) => `Bearer ${code}`
  /** 요청 하나: ms 안에 응답(본문까지)이 안 오면 끊고 실패(throw) */
  async function send(code: string, init: RequestInit, ms: number): Promise<{ status: number; body: unknown }> {
    const ctl = new AbortController()
    const t = setTimeout(() => ctl.abort(), ms)
    try {
      const res = await deps.fetch(deps.base, { ...init, signal: ctl.signal, headers: { Authorization: authHeader(code), 'Content-Type': 'application/json' } })
      const body: unknown = await res.json().catch(() => null)
      return { status: res.status, body }
    } finally {
      clearTimeout(t)
    }
  }

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

  /** 읽기. 없으면 null, 못 닿거나 모양이 틀리면 'error' */
  async function getSave(code: string): Promise<ServerSave | null | 'error'> {
    try {
      const res = await send(code, {}, GET_TIMEOUT_MS)
      if (res.status === 404) return null
      if (res.status < 200 || res.status >= 300) return 'error'
      return parseServerSave(res.body) ?? 'error'
    } catch {
      return 'error'
    }
  }

  const setBackup = (b: CloudBackup | null) => {
    try {
      if (b) deps.storage?.setItem(BACKUP_KEY, JSON.stringify(b))
      else deps.storage?.removeItem(BACKUP_KEY)
    } catch {
      // 저장소를 못 쓰면 백업도 없다
    }
    deps.onBackup?.(b)
  }

  /** 서버 것을 받는다. keepLocal: 안 올린 진행이 있어 지금 사본을 먼저 백업한다. 백업했으면 true */
  async function adopt(save: ServerSave, keepLocal: boolean): Promise<boolean> {
    clearTimer()
    applying = true
    let backedUp = false
    try {
      // 미뤄 둔 사본 저장이 받은 것을 덮어쓰지 않게 먼저 쓴다
      deps.flushLocal()
      const next = JSON.stringify(save.data)
      const raw = keepLocal ? deps.readSave() : null
      if (raw && raw !== next) {
        setBackup({ code: st.code, savedAt: deps.now(), raw })
        backedUp = true
      }
      deps.writeSave(next)
      await deps.rehydrate()
    } finally {
      applying = false
    }
    st = { ...st, syncedRev: save.rev, dirty: false, pending: null }
    firstDirtyAt = null
    persist()
    deps.onStatus('saved')
    return backedUp
  }

  function push(keepalive = false): Promise<boolean> {
    clearTimer()
    if (inflight) return inflight
    const raw = deps.readSave()
    if (!raw) {
      // 올릴 사본이 없다: 안 올린 것도 없다
      if (st.dirty) {
        st = { ...st, dirty: false }
        persist()
      }
      deps.onStatus('saved')
      return Promise.resolve(false)
    }
    const seq = writeSeq
    const code = st.code
    // 결과를 모르는 앞 쓰기가 있으면 같은 ID 로 다시 보낸다 (들어갔으면 409 에 그 ID 가 온다)
    const pending = st.pending?.baseRev === st.syncedRev ? st.pending : { id: makeCode(), baseRev: st.syncedRev }
    st = { ...st, pending }
    persist()
    deps.onStatus('syncing')
    inflight = (async () => {
      let ok = false
      let again = false
      try {
        const res = await send(code, { method: 'PUT', body: JSON.stringify({ baseRev: pending.baseRev, data: JSON.parse(raw), writeId: pending.id }), keepalive }, PUT_TIMEOUT_MS)
        if (res.status === 409) {
          const server = parseServerSave(res.body)
          if (!server) throw new Error('bad 409')
          if (server.writeId === pending.id) {
            // 앞서 보낸 내 쓰기가 들어가 있었다 (응답만 잃었다): 그 번호에 맞추고 지금 사본을 다시 올린다
            st = { ...st, syncedRev: server.rev, dirty: true, pending: null }
            persist()
            failures = 0
            again = true
          } else {
            deps.notify((await adopt(server, true)) ? CONFLICT_BACKUP : CONFLICT)
          }
          ok = true
        } else if (res.status === 401) {
          // 저장된 코드가 깨졌다: 새 코드로 처음부터 올린다
          st = { code: makeCode(), syncedRev: 0, dirty: true, pending: null }
          persist()
          schedule(0)
        } else if (res.status === 413) {
          // 다시 보내도 같다: 안내만 하고 다음 변경을 기다린다
          st = { ...st, pending: null }
          persist()
          if (!tooBigNoticed) deps.notify('진행이 너무 커서 서버에 저장하지 못했어요')
          tooBigNoticed = true
          deps.onStatus('pending')
        } else if (res.status < 200 || res.status >= 300) {
          throw new Error(`save ${res.status}`)
        } else {
          const rev = parsePutReply(res.body)
          if (rev === null) throw new Error('bad reply')
          failures = 0
          const changed = writeSeq !== seq
          st = { ...st, syncedRev: rev, dirty: changed, pending: null }
          if (!changed) firstDirtyAt = null
          persist()
          deps.onStatus(changed ? 'pending' : 'saved')
          if (changed) schedule(pushDelay(firstDirtyAt ?? deps.now(), lastChangeAt, deps.now()))
          ok = true
        }
      } catch {
        // 못 닿음·시간 초과·서버 오류(429 포함): 결과를 모르는 쓰기는 pending 에 남겨 같은 ID 로 다시 보낸다
        deps.onStatus('pending')
        schedule(retryDelay(failures++))
      } finally {
        inflight = null
      }
      if (again) schedule(0)
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
    // 확인하는 사이 코드가 바뀌면 옛 코드의 결과는 버리고, 올리기만 열어 둔다
    const code = st.code
    // 확인하는 사이 플레이로 바뀌었는지 가린다
    const seq = writeSeq
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
    if (server && st.pending && server.writeId === st.pending.id && server.rev > st.syncedRev) {
      // 서버의 최신이 응답을 못 받은 내 쓰기다: 받지 않고 그 번호에 맞춘 뒤 지금 사본을 올린다
      st = { ...st, syncedRev: server.rev, dirty: true, pending: null }
      persist()
    }
    const step = startupStep(server, st.syncedRev)
    if (step.kind === 'adopt') {
      // 안 올린 진행이 있으면(이전에 남은 변경, 또는 확인하는 사이 플레이) 백업한 뒤 받는다
      if (await adopt(server!, st.dirty || writeSeq !== seq)) deps.notify(CONFLICT_BACKUP)
      return finishStart()
    }
    // 서버에 없거나 서버가 더 낡았으면 꼭 올린다. 실패해도 다시 시도하도록 안 올린 변경으로 표시해 둔다
    st = { ...st, syncedRev: step.baseRev, dirty: st.dirty || step.always }
    persist()
    if (st.dirty) await push()
    else deps.onStatus('saved')
    finishStart()
  }

  function markDirty() {
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
  }

  return {
    start,
    markDirty,
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
    async switchTo(code) {
      // 시작 맞추기 전에는 지금 진행이 서버에 있는지 모른다
      if (!ready) return false
      deps.flushLocal()
      for (;;) {
        // 지금 코드로 다 올려 둔 뒤에만 바꾼다 (올리는 도중 바뀐 것까지. 409 면 서버 것을 받고 백업한 뒤 이어 간다)
        for (;;) {
          if (inflight) await inflight
          if (!st.dirty || !deps.readSave()) break
          if (!(await push())) return false
        }
        // 미리보기 뒤 바뀌었을 수 있어 확인하는 지금 다시 읽는다
        const target = await getSave(code)
        if (target === null || target === 'error') return false
        deps.flushLocal()
        if (st.dirty && deps.readSave()) continue
        st = { code, syncedRev: 0, dirty: false, pending: null }
        persist()
        await adopt(target, false)
        // 메뉴의 되돌리기를 새 코드 것으로 (옛 코드 백업은 그 코드로 돌아오면 다시 보인다)
        deps.onBackup?.(readBackup(deps.storage, code))
        return true
      }
    },
    backup: () => readBackup(deps.storage, st.code),
    async restoreBackup() {
      const b = readBackup(deps.storage, st.code)
      if (!b) return false
      clearTimer()
      applying = true
      try {
        deps.flushLocal()
        deps.writeSave(b.raw)
        await deps.rehydrate()
      } finally {
        applying = false
      }
      setBackup(null)
      // 되돌린 진행을 새 변경으로 올린다 (서버 번호 다음 번호가 된다)
      markDirty()
      deps.notify('덮어쓰기 전 진행으로 되돌렸어요')
      return true
    },
    clearBackup: () => setBackup(null),
  }
}
