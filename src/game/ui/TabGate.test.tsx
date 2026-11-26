// @vitest-environment jsdom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { TabGate } from './TabGate'

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

describe('TabGate', () => {
  let root: Root
  let host: HTMLDivElement
  beforeEach(() => {
    host = document.createElement('div')
    root = createRoot(host)
  })
  afterEach(() => act(() => root.unmount()))

  it('잠금을 잡기 전에는 게임을 그리지 않고, 잡으면 그린다', async () => {
    let resolve!: (ok: boolean) => void
    const lock = new Promise<boolean>((r) => (resolve = r))
    act(() => root.render(<TabGate lock={lock}><p>게임</p></TabGate>))
    expect(host.textContent).not.toContain('게임')
    await act(async () => resolve(true))
    expect(host.textContent).toContain('게임')
  })

  it('다른 탭이 하고 있으면 게임 대신 안내', async () => {
    await act(async () => root.render(<TabGate lock={Promise.resolve(false)}><p>게임</p></TabGate>))
    expect(host.textContent).not.toContain('게임')
    expect(host.textContent).toContain('다른 탭에서 섬마을을 하고 있어요. 그 탭을 닫고 새로고침해 주세요.')
  })
})
