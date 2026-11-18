// @vitest-environment jsdom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { holdTrigger, isTriggerHeld, takeAttackPress } from '../input/pointer'
import { useSessionStore } from '../stores/sessionStore'
import { FireButton } from './WeaponTouchControls'

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

describe('폰 쏘기 버튼', () => {
  let root: Root
  let host: HTMLDivElement
  beforeEach(() => {
    useSessionStore.getState().resetSession()
    holdTrigger(false)
    host = document.createElement('div')
    document.body.appendChild(host)
    root = createRoot(host)
    act(() => root.render(<FireButton />))
  })
  afterEach(() => {
    act(() => root.unmount())
    host.remove()
    holdTrigger(false)
  })

  it('누른 채 버튼이 사라지면(쓰러짐·창 열림·무기 바꿈) 방아쇠를 놓는다 (다시 나타난 소총이 저절로 쏘지 않게)', () => {
    const btn = host.querySelector('button')!
    act(() => void btn.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerId: 3, clientX: 10, clientY: 10 })))
    takeAttackPress()
    expect(isTriggerHeld()).toBe(true)
    act(() => root.render(<></>))
    expect(isTriggerHeld()).toBe(false)
  })
})
