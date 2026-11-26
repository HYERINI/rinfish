import { describe, expect, it } from 'vitest'
import { SAVE_MAX_BYTES, allowOrigin, bearerCode, handleSave, type StoredSave } from './saveRules'

const saved: StoredSave = { rev: 3, data: { state: { coins: 10 }, version: 5 }, savedAt: 100 }
const put = (baseRev: number, data: unknown = { state: { coins: 20 }, version: 5 }) => JSON.stringify({ baseRev, data })

describe('handleSave GET', () => {
  it('없으면 404', () => {
    expect(handleSave('GET', '', null, 0)).toEqual({ status: 404, body: {} })
  })
  it('있으면 200 과 저장본', () => {
    expect(handleSave('GET', '', saved, 0)).toEqual({ status: 200, body: saved })
  })
})

describe('handleSave PUT', () => {
  it('맞춘 번호가 같으면 저장하고 번호를 올린다', () => {
    const r = handleSave('PUT', put(3), saved, 500)
    expect(r.status).toBe(200)
    expect(r.body).toEqual({ rev: 4 })
    expect(r.store).toEqual({ rev: 4, data: { state: { coins: 20 }, version: 5 }, savedAt: 500 })
  })
  it('맞춘 번호가 다르면 409 와 서버 최신본, 저장하지 않는다', () => {
    const r = handleSave('PUT', put(2), saved, 500)
    expect(r).toEqual({ status: 409, body: saved })
  })
  it('첫 저장은 baseRev 0 으로 번호 1', () => {
    expect(handleSave('PUT', put(0), null, 7).store).toEqual({ rev: 1, data: { state: { coins: 20 }, version: 5 }, savedAt: 7 })
  })
  it('저장이 없으면 baseRev 와 상관없이 받는다 (서버가 비었으면 무엇이든 더 최신)', () => {
    const r = handleSave('PUT', put(5), null, 7)
    expect(r.status).toBe(200)
    expect(r.store?.rev).toBe(1)
  })
  it('너무 크면 413', () => {
    const big = put(3, { pad: 'x'.repeat(SAVE_MAX_BYTES) })
    expect(handleSave('PUT', big, saved, 0).status).toBe(413)
  })
  it('한글은 바이트로 센다', () => {
    const big = put(3, { pad: '가'.repeat(Math.ceil(SAVE_MAX_BYTES / 3)) })
    expect(handleSave('PUT', big, saved, 0).status).toBe(413)
  })
  it('JSON 이 아니거나 모양이 틀리면 400', () => {
    expect(handleSave('PUT', '{망가짐', saved, 0).status).toBe(400)
    expect(handleSave('PUT', JSON.stringify({ baseRev: 'a', data: {} }), saved, 0).status).toBe(400)
    expect(handleSave('PUT', JSON.stringify({ baseRev: 1, data: [1] }), saved, 0).status).toBe(400)
    expect(handleSave('PUT', JSON.stringify({ baseRev: -1, data: {} }), saved, 0).status).toBe(400)
    expect(handleSave('PUT', JSON.stringify({ baseRev: 1.5, data: {} }), saved, 0).status).toBe(400)
  })
})

describe('handleSave 그 밖', () => {
  it('다른 메서드는 405', () => {
    expect(handleSave('DELETE', '', saved, 0).status).toBe(405)
  })
})

describe('allowOrigin', () => {
  it('게임 주소·미리보기·로컬만', () => {
    expect(allowOrigin('https://seommaeul.vercel.app')).toBe('https://seommaeul.vercel.app')
    expect(allowOrigin('https://seommaeul-git-feat-x-hyerini.vercel.app')).toBe('https://seommaeul-git-feat-x-hyerini.vercel.app')
    expect(allowOrigin('http://localhost:5173')).toBe('http://localhost:5173')
    expect(allowOrigin('http://127.0.0.1:5190')).toBe('http://127.0.0.1:5190')
    expect(allowOrigin('https://evil.example')).toBeNull()
    expect(allowOrigin('https://seommaeul.vercel.app.evil.example')).toBeNull()
    expect(allowOrigin('http://seommaeul.vercel.app')).toBeNull()
    expect(allowOrigin(null)).toBeNull()
  })
})

describe('bearerCode', () => {
  it('Bearer 뒤 코드를 정리해 돌려준다', () => {
    expect(bearerCode('Bearer qx7k-29pm-h4tb-8wnc-5rda')).toBe('QX7K29PMH4TB8WNC5RDA')
  })
  it('없거나 틀리면 null', () => {
    expect(bearerCode(null)).toBeNull()
    expect(bearerCode('Basic QX7K29PMH4TB8WNC5RDA')).toBeNull()
    expect(bearerCode('Bearer short')).toBeNull()
  })
})
