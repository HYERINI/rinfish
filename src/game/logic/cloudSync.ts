/** 서버 저장 판단 (순수). 설계: docs/superpowers/specs/2026-11-26-server-save-design.md */

import { SAVE_VERSION } from './saveMigration'

/** 서버에 있는 저장 (rev = 저장 번호, writeId = 그 저장을 만든 쓰기 요청 ID) */
export type ServerSave = { rev: number; data: unknown; savedAt: number; writeId?: string }
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
/** 서버 읽기·쓰기를 기다리는 최대 시간. 넘으면 실패로 보고 다시 시도한다 */
export const GET_TIMEOUT_MS = 8000
export const PUT_TIMEOUT_MS = 10000
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

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)

/**
 * 진행 저장본 모양: 이 게임이 읽을 수 있는 version 과, 처음부터 있던 핵심 필드(코인·장비·가방·도감)의 기본 타입.
 * 더 새 버전을 받으면 옛 탭이 모르는 필드를 버리고 덮는다. 진행 초기화도 모든 필드를 초기값으로 채우므로,
 * 핵심 필드가 빠진 저장은 망가진 것이다 (받으면 이 브라우저 사본을 덮고, 불러올 때 기본값으로 바뀐다)
 */
function isProgressSave(d: unknown): d is Record<string, unknown> {
  if (!isRecord(d) || !Number.isInteger(d.version) || (d.version as number) < 0 || (d.version as number) > SAVE_VERSION) return false
  const s = d.state
  return isRecord(s) && Number.isFinite(s.coins) && isRecord(s.gear) && Array.isArray(s.inventory) && isRecord(s.dex)
}

/** 서버가 준 저장본(읽기 200, 쓰기 409)을 쓰기 전에 검사한다. 모양이 틀리면 null */
export function parseServerSave(v: unknown): ServerSave | null {
  if (!isRecord(v) || !Number.isInteger(v.rev) || (v.rev as number) < 1 || !isProgressSave(v.data)) return null
  if (v.writeId !== undefined && typeof v.writeId !== 'string') return null
  return { rev: v.rev as number, data: v.data, savedAt: typeof v.savedAt === 'number' ? v.savedAt : 0, ...(v.writeId !== undefined && { writeId: v.writeId as string }) }
}

/** 쓰기 성공(200) 응답의 새 저장 번호. 모양이 틀리면 null */
export function parsePutReply(v: unknown): number | null {
  return isRecord(v) && Number.isInteger(v.rev) ? (v.rev as number) : null
}
