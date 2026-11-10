import { describe, expect, it } from 'vitest'
import { hubRoomName, hubRoomPassword, readHubEntry } from './hubParams'

/** sessionStorage 대신 쓰는 간단한 저장소 */
const memory = () => {
  const m = new Map<string, string>()
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v) }
}

describe('readHubEntry', () => {
  it('허브에서 온 세 값을 읽는다', () => {
    const e = readHubEntry('?hub_return=https%3A%2F%2Fexample.com%2Flobby%3Fx%3D1&hub_name=%EC%B2%A0%EC%88%98&hub_room=abc234', memory())
    expect(e).toEqual({ back: 'https://example.com/lobby?x=1', name: '철수', room: 'abc234' })
  })

  it('아무것도 없으면 전부 null (혼자 실행)', () => {
    expect(readHubEntry('', memory())).toEqual({ back: null, name: null, room: null })
  })

  it('복귀 주소는 http(s) 만 받는다', () => {
    expect(readHubEntry('?hub_return=javascript%3Aalert(1)', memory()).back).toBeNull()
    expect(readHubEntry('?hub_return=%2Frelative', memory()).back).toBeNull()
    expect(readHubEntry('?hub_return=http%3A%2F%2Flocalhost%3A5173%2F', memory()).back).toBe('http://localhost:5173/')
  })

  it('복귀 주소는 고치지 않고 그대로 둔다', () => {
    const raw = 'https://Example.com/a/../b?q=%20#frag'
    expect(readHubEntry(`?hub_return=${encodeURIComponent(raw)}`, memory()).back).toBe(raw)
  })

  it('주소에서 빠져도 이번 탭에서 받아 둔 복귀 주소를 쓴다', () => {
    const store = memory()
    readHubEntry('?hub_return=https%3A%2F%2Fexample.com%2F', store)
    expect(readHubEntry('', store).back).toBe('https://example.com/')
  })

  it('저장소가 막혀 있어도 주소의 값은 쓴다', () => {
    const broken = {
      getItem: () => {
        throw new Error('blocked')
      },
      setItem: () => {
        throw new Error('blocked')
      },
    }
    expect(readHubEntry('?hub_return=https%3A%2F%2Fexample.com%2F', broken).back).toBe('https://example.com/')
    expect(readHubEntry('', null).back).toBeNull()
  })

  it('이름은 정리하고 닉네임 길이(10자)로 자른다, 비면 null', () => {
    expect(readHubEntry('?hub_name=%20%EA%B0%80%EB%82%98%EB%8B%A4%EB%9D%BC%EB%A7%88%EB%B0%94%EC%82%AC%EC%95%84%EC%9E%90%EC%B0%A8%20', memory()).name).toBe('가나다라마바사아자차')
    expect(readHubEntry('?hub_name=abcdefghijklmnop', memory()).name).toBe('abcdefghij')
    expect(readHubEntry('?hub_name=%20%20', memory()).name).toBeNull()
    expect(readHubEntry('?hub_name=%3Cb%3E%EC%B2%A0%EC%88%98%3C%2Fb%3E', memory()).name).toBe('<b>철수</b>')
  })

  it('방 코드는 허브 형식(6자, 헷갈리는 글자 없음)만 받는다', () => {
    expect(readHubEntry('?hub_room=..%2F..', memory()).room).toBeNull()
    expect(readHubEntry('?hub_room=abc23', memory()).room).toBeNull()
    expect(readHubEntry('?hub_room=abc230', memory()).room).toBeNull()
    expect(readHubEntry('?hub_room=ABC234', memory()).room).toBeNull()
  })
})

describe('허브 방', () => {
  it('방 코드로 낚시섬 방 이름·암호를 만든다 (방 이름·암호 규칙 안)', () => {
    expect(hubRoomName('abc234')).toBe('hub-abc234')
    expect(hubRoomPassword('abc234').length).toBeGreaterThanOrEqual(4)
    expect(hubRoomPassword('abc234')).not.toBe(hubRoomPassword('abc235'))
  })
})
