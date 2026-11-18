// @vitest-environment jsdom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { takeActionPresses } from '../input/usePlayerActionKeys'
import { useInteractionKeys } from '../input/useInteractionKeys'
import { useSessionStore } from '../stores/sessionStore'
import { EmoteWheel } from './EmoteWheel'

// Game 처럼 바퀴(자식)의 키 듣기가 useInteractionKeys(부모)보다 먼저 붙는다
function Harness() {
  useInteractionKeys()
  return <EmoteWheel />
}

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
const press = (code: string, type: 'keydown' | 'keyup' = 'keydown') => act(() => void window.dispatchEvent(new KeyboardEvent(type, { code, cancelable: true })))

describe('T 바퀴 숫자 키', () => {
  let root: Root
  beforeEach(() => {
    useSessionStore.getState().resetSession()
    takeActionPresses()
    root = createRoot(document.createElement('div'))
    act(() => root.render(<Harness />))
  })
  afterEach(() => act(() => root.unmount()))

  it('바퀴가 열린 채 2 를 누르면 수다만 하고 도구는 그대로', () => {
    press('KeyT')
    expect(useSessionStore.getState().mode).toBe('emote')
    press('Digit2')
    expect(useSessionStore.getState().mode).toBe('explore')
    expect(takeActionPresses().emotePressed).toBe('chat')
    expect(useSessionStore.getState().tool).toBe('rod')
  })

  it('바퀴가 닫혀 있으면 2 는 도구 칸 (주먹)', () => {
    press('Digit2')
    expect(useSessionStore.getState().tool).toBe('fists')
    expect(takeActionPresses().emotePressed).toBeNull()
  })
})
