import { normalizeCode } from '../../src/game/logic/recoveryCode'

/** Save 객체 저장소의 'save' 칸 */
export type StoredSave = { rev: number; data: Record<string, unknown>; savedAt: number }
/** 진행 크기 한도 (바이트). 지금 저장본은 몇 KB */
export const SAVE_MAX_BYTES = 256 * 1024
/** 응답 상태·본문, 그리고 저장해야 하면 store */
export type SaveReply = { status: number; body: unknown; store?: StoredSave }

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)

function parsePut(text: string): { baseRev: number; data: Record<string, unknown> } | null {
  let v: unknown
  try {
    v = JSON.parse(text)
  } catch {
    return null
  }
  if (!isRecord(v) || !Number.isInteger(v.baseRev) || (v.baseRev as number) < 0 || !isRecord(v.data)) return null
  return { baseRev: v.baseRev as number, data: v.data }
}

/**
 * 저장 요청 하나를 판정한다. GET: 저장본. PUT {baseRev, data}: baseRev 가 서버 번호와 같으면(저장이 없으면 무엇이든) 저장하고 번호 +1,
 * 다르면 그사이 다른 곳에서 저장한 것이라 409 와 서버 최신본. 1단계는 data 내용을 검사하지 않는다 (게임이 불러올 때 검증)
 */
export function handleSave(method: string, text: string, stored: StoredSave | null, now: number): SaveReply {
  if (method === 'GET') return stored ? { status: 200, body: stored } : { status: 404, body: {} }
  if (method !== 'PUT') return { status: 405, body: {} }
  if (new TextEncoder().encode(text).length > SAVE_MAX_BYTES) return { status: 413, body: {} }
  const req = parsePut(text)
  if (!req) return { status: 400, body: {} }
  if (stored && req.baseRev !== stored.rev) return { status: 409, body: stored }
  const next: StoredSave = { rev: (stored?.rev ?? 0) + 1, data: req.data, savedAt: now }
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
