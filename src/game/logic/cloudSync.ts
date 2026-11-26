/** 서버 저장 판단 (순수). 설계: docs/superpowers/specs/2026-11-26-server-save-design.md */

/** 서버에 있는 저장 (rev = 저장 번호) */
export type ServerSave = { rev: number; data: unknown; savedAt: number }
/** 시작할 때 할 일: 서버 것 받기, 또는 baseRev 로 올리기 (always 가 아니면 안 올린 변경이 있을 때만) */
export type StartupStep = { kind: 'adopt' } | { kind: 'push'; baseRev: number; always: boolean }

/** 마지막 변경 뒤 이만큼 조용하면 올린다 */
export const PUSH_QUIET_MS = 3000
/** 계속 바뀌어도 처음 변경 뒤 이만큼이면 올린다 */
export const PUSH_MAX_WAIT_MS = 15000
/** 로딩 화면이 서버 응답을 기다리는 최대 시간 */
export const STARTUP_WAIT_MS = 3000
/** 시작할 때 서버에 못 닿으면 다시 시도하는 간격 */
export const STARTUP_RETRY_MS = 30000
const RETRY_MS = [5000, 15000, 30000]

/** 방 서버 주소(wss://…)에서 저장 주소(https://…/save) */
export function saveUrl(roomServer: string): string {
  return roomServer.replace(/\/+$/, '').replace(/^ws(s?):\/\//, 'http$1://') + '/save'
}

/** syncedRev: 이 브라우저가 서버와 마지막으로 맞춘 번호 */
export function startupStep(server: ServerSave | null, syncedRev: number): StartupStep {
  if (!server) return { kind: 'push', baseRev: 0, always: true }
  if (server.rev > syncedRev) return { kind: 'adopt' }
  return { kind: 'push', baseRev: server.rev, always: server.rev < syncedRev }
}

/** 지금부터 올리기까지 기다릴 시간(ms) */
export function pushDelay(firstDirtyAt: number, lastChangeAt: number, now: number): number {
  return Math.max(0, Math.min(lastChangeAt + PUSH_QUIET_MS, firstDirtyAt + PUSH_MAX_WAIT_MS) - now)
}

/** attempt 번째(0부터) 실패 뒤 다시 시도까지 */
export function retryDelay(attempt: number): number {
  return RETRY_MS[Math.min(attempt, RETRY_MS.length - 1)]
}

/** 확인 창에 보일 요약. 저장본({state, version})이 아니면 null */
export function summarize(data: unknown): { coins: number; dex: number } | null {
  if (typeof data !== 'object' || data === null) return null
  const state = (data as { state?: unknown }).state
  if (typeof state !== 'object' || state === null) return null
  const { coins, dex } = state as { coins?: unknown; dex?: unknown }
  return {
    coins: typeof coins === 'number' && coins >= 0 ? coins : 0,
    dex: typeof dex === 'object' && dex !== null ? Object.keys(dex).length : 0,
  }
}
