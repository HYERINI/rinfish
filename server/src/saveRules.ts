import { normalizeCode } from '../../src/game/logic/recoveryCode'

/** Save 객체 저장소의 'save' 칸. writeId: 이 저장을 만든 쓰기 요청 ID (응답을 못 받은 브라우저가 제 것인지 알아본다) */
export type StoredSave = { rev: number; data: Record<string, unknown>; savedAt: number; writeId?: string }
/** 진행 크기 한도 (바이트). 지금 저장본은 몇 KB */
export const SAVE_MAX_BYTES = 256 * 1024
/** 쓰기 요청 ID 최대 길이 */
const WRITE_ID_MAX = 64
/** 응답 상태·본문, 그리고 저장해야 하면 store */
export type SaveReply = { status: number; body: unknown; store?: StoredSave }

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)

function parsePut(text: string): { baseRev: number; data: Record<string, unknown>; writeId?: string } | null {
  let v: unknown
  try {
    v = JSON.parse(text)
  } catch {
    return null
  }
  if (!isRecord(v) || !Number.isInteger(v.baseRev) || (v.baseRev as number) < 0 || !isRecord(v.data)) return null
  if (v.writeId !== undefined && (typeof v.writeId !== 'string' || v.writeId.length > WRITE_ID_MAX)) return null
  return { baseRev: v.baseRev as number, data: v.data, ...(v.writeId !== undefined && { writeId: v.writeId as string }) }
}

/**
 * 저장 요청 하나를 판정한다. GET: 저장본. PUT {baseRev, data, writeId?}: baseRev 가 서버 번호와 같으면(저장이 없으면 무엇이든) 저장하고 번호 +1,
 * 다르면 그사이 다른 곳에서 저장한 것이라 409 와 서버 최신본. 1단계는 data 내용을 검사하지 않는다 (게임이 불러올 때 검증)
 */
export function handleSave(method: string, text: string, stored: StoredSave | null, now: number): SaveReply {
  if (method === 'GET') return stored ? { status: 200, body: stored } : { status: 404, body: {} }
  if (method !== 'PUT') return { status: 405, body: {} }
  if (new TextEncoder().encode(text).length > SAVE_MAX_BYTES) return { status: 413, body: {} }
  const req = parsePut(text)
  if (!req) return { status: 400, body: {} }
  if (stored && req.baseRev !== stored.rev) return { status: 409, body: stored }
  const next: StoredSave = { rev: (stored?.rev ?? 0) + 1, data: req.data, savedAt: now, ...(req.writeId !== undefined && { writeId: req.writeId }) }
  return { status: 200, body: { rev: next.rev }, store: next }
}

const PREVIEW = /^https:\/\/seommaeul(-[a-z0-9-]+)?\.vercel\.app$/
const LOCAL = /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/

/** 저장 요청을 받아 줄 게임 주소 (CORS). 아니면 null */
export function allowOrigin(origin: string | null): string | null {
  return origin && (PREVIEW.test(origin) || LOCAL.test(origin)) ? origin : null
}

/** Authorization: Bearer <복구 코드> 에서 코드를 꺼낸다. 허브 로그인 전환 때 이 자리를 토큰 검증으로 바꾼다 */
export function bearerCode(header: string | null): string | null {
  const m = header?.match(/^Bearer (.+)$/)
  return m ? normalizeCode(m[1]) : null
}

/** Content-Length 가 한도를 넘으면 true (본문을 읽기 전에 거절). 없거나 숫자가 아니면 false: 본문을 읽으며 다시 센다 */
export function contentTooLarge(header: string | null): boolean {
  const n = Number(header)
  return header !== null && Number.isFinite(n) && n > SAVE_MAX_BYTES
}

/** 본문을 max 바이트까지만 읽는다. 넘으면 그 자리에서 멈추고 null */
export async function readLimited(body: ReadableStream<Uint8Array> | null, max: number): Promise<string | null> {
  if (!body) return ''
  const reader = body.getReader()
  const chunks: Uint8Array[] = []
  let size = 0
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    size += value.byteLength
    if (size > max) {
      await reader.cancel().catch(() => {})
      return null
    }
    chunks.push(value)
  }
  const all = new Uint8Array(size)
  let at = 0
  for (const c of chunks) {
    all.set(c, at)
    at += c.byteLength
  }
  return new TextDecoder().decode(all)
}

/**
 * 누구의 Save 객체인지: 'code:' + 복구 코드의 sha256. 코드 원문은 남기지 않는다.
 * 허브 로그인 전환 때 이 함수만 'hub:' + 허브 유저 ID 로 바꾼다 (접두어가 달라 서로 겹치지 않는다)
 */
export async function saveObjectName(code: string): Promise<string> {
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(code))
  return 'code:' + [...new Uint8Array(hash)].map((b) => b.toString(16).padStart(2, '0')).join('')
}
