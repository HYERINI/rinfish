import { describe, expect, it } from 'vitest'
import { cleanText, lobbyErrors, normalizeNick, normalizeRoomName, passHashFor, readRoomParam, roomIdFor, sha256Hex, textLength } from './roomKey'

describe('글자 정리', () => {
  it('줄바꿈·제어문자를 지우고 앞뒤 공백을 자른다', () => {
    expect(cleanText('  안녕\n하세요\u0007 ')).toBe('안녕하세요')
  })
  it('방 이름은 소문자로, 닉네임은 그대로', () => {
    expect(normalizeRoomName('  Study 방 ')).toBe('study 방')
    expect(normalizeNick(' 혜린A ')).toBe('혜린A')
  })
  it('글자 수는 이모지도 한 글자', () => {
    expect(textLength('🎣낚시')).toBe(3)
  })
})

describe('lobbyErrors', () => {
  it('범위를 벗어난 칸만 알려 준다', () => {
    expect(lobbyErrors({ room: '스터디', password: '1234', nick: '혜린' })).toEqual([])
    expect(lobbyErrors({ room: '  ', password: '123', nick: '열한글자닉네임입니다요' })).toEqual(['room', 'password', 'nick'])
    expect(lobbyErrors({ room: 'a'.repeat(21), password: 'p'.repeat(33), nick: 'x' })).toEqual(['room', 'password'])
  })
})

describe('방 키', () => {
  it('sha256 16진수', async () => {
    expect(await sha256Hex('abc')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad')
  })
  it('방 id 는 정리한 이름에서 만든 32자, 대소문자·공백이 달라도 같다', async () => {
    const a = await roomIdFor('Study')
    expect(a).toMatch(/^[0-9a-f]{32}$/)
    expect(await roomIdFor('  study ')).toBe(a)
    expect(await roomIdFor('other')).not.toBe(a)
  })
  it('암호 해시는 방마다 다르고 대소문자를 구분한다', async () => {
    const h = await passHashFor('r1', 'Secret')
    expect(h).toMatch(/^[0-9a-f]{64}$/)
    expect(await passHashFor('r2', 'Secret')).not.toBe(h)
    expect(await passHashFor('r1', 'secret')).not.toBe(h)
  })
})

describe('readRoomParam', () => {
  it('?room= 값을 정리해서 돌려준다', () => {
    expect(readRoomParam('?room=%EC%8A%A4%ED%84%B0%EB%94%94')).toBe('스터디')
    expect(readRoomParam('?x=1')).toBe('')
  })
})
