// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { isTypingTarget } from './typing'

describe('isTypingTarget', () => {
  it('입력 칸·여러 줄·편집 가능 요소에서 누른 키', () => {
    expect(isTypingTarget(document.createElement('input'))).toBe(true)
    expect(isTypingTarget(document.createElement('textarea'))).toBe(true)
    const div = document.createElement('div')
    div.setAttribute('contenteditable', 'true')
    expect(isTypingTarget(div)).toBe(true)
  })
  it('버튼·창·null 은 아니다', () => {
    expect(isTypingTarget(document.createElement('button'))).toBe(false)
    expect(isTypingTarget(window)).toBe(false)
    expect(isTypingTarget(null)).toBe(false)
  })
})
