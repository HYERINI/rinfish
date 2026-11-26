import { describe, expect, it } from 'vitest'
import { CODE_ALPHABET, CODE_LENGTH, formatCode, makeCode, normalizeCode } from './recoveryCode'

describe('makeCode', () => {
  it('정한 글자로 20자를 만든다', () => {
    const code = makeCode()
    expect(code).toHaveLength(CODE_LENGTH)
    expect([...code].every((c) => CODE_ALPHABET.includes(c))).toBe(true)
  })

  it('240 이상 바이트는 버려 글자가 고르게 나온다', () => {
    const batches = [new Uint8Array(20).fill(250), Uint8Array.from({ length: 20 }, (_, i) => i)]
    let call = 0
    expect(makeCode(() => batches[call++])).toBe(CODE_ALPHABET.slice(0, 20))
  })

  it('두 번 만들면 다르다', () => {
    expect(makeCode()).not.toBe(makeCode())
  })
})

describe('normalizeCode', () => {
  const code = 'QX7K29PMH4TB8WNC5RDA'
  it('소문자·하이픈·공백을 정리한다', () => {
    expect(normalizeCode(' qx7k-29pm-h4tb 8wnc-5rda ')).toBe(code)
  })
  it('헷갈리는 글자(O, 0, 1, I, L, U)가 있으면 거절한다', () => {
    expect(normalizeCode('QX7K29PMH4TB8WNC5RD0')).toBeNull()
    expect(normalizeCode('QX7K29PMH4TB8WNC5RDO')).toBeNull()
    expect(normalizeCode('QX7K29PMH4TB8WNC5RDU')).toBeNull()
  })
  it('길이가 틀리면 거절한다', () => {
    expect(normalizeCode(code.slice(1))).toBeNull()
    expect(normalizeCode(code + 'A')).toBeNull()
    expect(normalizeCode('')).toBeNull()
  })
})

describe('formatCode', () => {
  it('4자씩 끊는다', () => {
    expect(formatCode('QX7K29PMH4TB8WNC5RDA')).toBe('QX7K-29PM-H4TB-8WNC-5RDA')
  })
})
