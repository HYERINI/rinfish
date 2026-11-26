import { describe, expect, it } from 'vitest'
import { GET_TIMEOUT_MS, PUT_TIMEOUT_MS, parsePutReply, parseServerSave, pushDelay, retryDelay, saveUrl, startupStep, summarize } from './cloudSync'
import { SAVE_VERSION } from './saveMigration'
import { INITIAL_PROGRESS } from '../stores/progressStore'

describe('saveUrl', () => {
  it('웹소켓 주소를 http 저장 주소로', () => {
    expect(saveUrl('wss://rinfish-rooms.x.workers.dev')).toBe('https://rinfish-rooms.x.workers.dev/save')
    expect(saveUrl('ws://127.0.0.1:8787')).toBe('http://127.0.0.1:8787/save')
    expect(saveUrl('wss://a.dev/')).toBe('https://a.dev/save')
  })
})

describe('startupStep', () => {
  const s = (rev: number) => ({ rev, data: {}, savedAt: 0 })
  it('서버에 없으면 0번부터 꼭 올린다 (기존 진행이 서버로 옮겨짐)', () => {
    expect(startupStep(null, 0)).toEqual({ kind: 'push', baseRev: 0, always: true })
    expect(startupStep(null, 4)).toEqual({ kind: 'push', baseRev: 0, always: true })
  })
  it('서버가 더 최신이면 받는다', () => {
    expect(startupStep(s(5), 4)).toEqual({ kind: 'adopt' })
  })
  it('같으면 안 올린 변경이 있을 때만 올린다', () => {
    expect(startupStep(s(4), 4)).toEqual({ kind: 'push', baseRev: 4, always: false })
  })
  it('서버가 더 낡았으면(서버가 되돌아감) 서버 번호로 꼭 올린다', () => {
    expect(startupStep(s(2), 4)).toEqual({ kind: 'push', baseRev: 2, always: true })
  })
})

describe('pushDelay', () => {
  it('마지막 변경 뒤 3초', () => {
    expect(pushDelay(0, 0, 0)).toBe(3000)
    expect(pushDelay(0, 1000, 1000)).toBe(3000)
  })
  it('계속 바뀌어도 처음 변경 뒤 15초는 넘지 않는다', () => {
    expect(pushDelay(0, 14000, 14000)).toBe(1000)
    expect(pushDelay(0, 20000, 20000)).toBe(0)
  })
})

describe('retryDelay', () => {
  it('5 → 15 → 30초, 그 뒤로 30초', () => {
    expect([0, 1, 2, 3, 9].map(retryDelay)).toEqual([5000, 15000, 30000, 30000, 30000])
  })
})

describe('summarize', () => {
  it('저장본에서 코인·도감 수', () => {
    expect(summarize({ state: { coins: 12, dex: { a: {}, b: {} } }, version: 5 })).toEqual({ coins: 12, dex: 2 })
  })
  it('모양이 틀리면 null 이나 0', () => {
    expect(summarize(null)).toBeNull()
    expect(summarize({ state: {} })).toEqual({ coins: 0, dex: 0 })
  })
})

describe('제한 시간', () => {
  it('읽기 8초, 쓰기 10초', () => {
    expect(GET_TIMEOUT_MS).toBe(8000)
    expect(PUT_TIMEOUT_MS).toBe(10000)
  })
})

describe('parseServerSave (서버 응답 검사)', () => {
  const core = { coins: 1, gear: { line: 0, reel: 0, rod: 0 }, inventory: [], dex: {} }
  const data = { state: core, version: 5 }
  it('정수 rev ≥ 1 과 진행 모양(state 객체, 지원하는 version)인 data 만 받는다', () => {
    expect(parseServerSave({ rev: 3, data, savedAt: 9 })).toEqual({ rev: 3, data, savedAt: 9 })
    expect(parseServerSave({ rev: 3, data, savedAt: 9, writeId: 'w' })).toEqual({ rev: 3, data, savedAt: 9, writeId: 'w' })
    expect(parseServerSave({ rev: 3, data: { state: core, version: 1 } })).not.toBeNull()
  })
  it('savedAt 이 없으면 0', () => {
    expect(parseServerSave({ rev: 1, data })).toEqual({ rev: 1, data, savedAt: 0 })
  })
  it('모양이 틀리면 null', () => {
    expect(parseServerSave(null)).toBeNull()
    expect(parseServerSave({})).toBeNull()
    expect(parseServerSave({ rev: 0, data })).toBeNull()
    expect(parseServerSave({ rev: 1.5, data })).toBeNull()
    expect(parseServerSave({ rev: '2', data })).toBeNull()
    expect(parseServerSave({ rev: 2, data: null })).toBeNull()
    expect(parseServerSave({ rev: 2, data: [1] })).toBeNull()
    expect(parseServerSave({ rev: 2, data, writeId: 5 })).toBeNull()
  })
  it('진행 모양이 아니면 null (빈 객체, state 없음, version 없음·소수)', () => {
    expect(parseServerSave({ rev: 2, data: {} })).toBeNull()
    expect(parseServerSave({ rev: 2, data: { version: 5 } })).toBeNull()
    expect(parseServerSave({ rev: 2, data: { state: [], version: 5 } })).toBeNull()
    expect(parseServerSave({ rev: 2, data: { state: {} } })).toBeNull()
    expect(parseServerSave({ rev: 2, data: { state: {}, version: 4.5 } })).toBeNull()
  })
  it('핵심 필드(코인·장비·가방·도감)가 빠졌거나 타입이 틀리면 null', () => {
    expect(parseServerSave({ rev: 2, data: { state: {}, version: 5 } })).toBeNull()
    for (const k of Object.keys(core)) {
      const { [k]: _, ...rest } = core as Record<string, unknown>
      expect(parseServerSave({ rev: 2, data: { state: rest, version: 5 } })).toBeNull()
    }
    expect(parseServerSave({ rev: 2, data: { state: { ...core, coins: '5' }, version: 5 } })).toBeNull()
    expect(parseServerSave({ rev: 2, data: { state: { ...core, coins: NaN }, version: 5 } })).toBeNull()
    expect(parseServerSave({ rev: 2, data: { state: { ...core, gear: [] }, version: 5 } })).toBeNull()
    expect(parseServerSave({ rev: 2, data: { state: { ...core, inventory: {} }, version: 5 } })).toBeNull()
    expect(parseServerSave({ rev: 2, data: { state: { ...core, dex: null }, version: 5 } })).toBeNull()
  })
  it('진행 초기화로 만든 저장(모든 값이 초기값)은 받는다', () => {
    expect(parseServerSave({ rev: 2, data: { state: INITIAL_PROGRESS, version: SAVE_VERSION } })).not.toBeNull()
  })
  it('이 게임보다 새 버전의 저장은 받지 않는다 (옛 탭이 새 저장을 덮지 않게)', () => {
    expect(parseServerSave({ rev: 2, data: { state: core, version: SAVE_VERSION + 1 } })).toBeNull()
    expect(parseServerSave({ rev: 2, data: { state: core, version: SAVE_VERSION } })).not.toBeNull()
  })
})

describe('parsePutReply', () => {
  it('정수 rev 만', () => {
    expect(parsePutReply({ rev: 4 })).toBe(4)
    expect(parsePutReply({ rev: '4' })).toBeNull()
    expect(parsePutReply({})).toBeNull()
    expect(parsePutReply(null)).toBeNull()
  })
})
