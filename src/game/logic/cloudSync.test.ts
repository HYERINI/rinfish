import { describe, expect, it } from 'vitest'
import { pushDelay, retryDelay, saveUrl, startupStep, summarize } from './cloudSync'

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
