// @vitest-environment jsdom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { BackupRow } from './CloudBackup'
import { copyCode } from './copyCode'

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

describe('copyCode', () => {
  it('복사되면 복사했다고', async () => {
    const notify = vi.fn()
    await copyCode('ABCD-EFGH', { writeText: vi.fn(async () => {}) }, notify)
    expect(notify).toHaveBeenCalledWith('복구 코드를 복사했어요')
  })
  it('복사가 막히거나 클립보드가 없으면 직접 적어 두라고', async () => {
    const notify = vi.fn()
    await copyCode('ABCD-EFGH', { writeText: vi.fn(async () => Promise.reject(new Error('denied'))) }, notify)
    await copyCode('ABCD-EFGH', undefined, notify)
    expect(notify.mock.calls).toEqual([['복사하지 못했어요. 코드를 직접 적어 두세요'], ['복사하지 못했어요. 코드를 직접 적어 두세요']])
  })
})

describe('BackupRow (덮어쓰기 전 진행으로 되돌리기)', () => {
  let root: Root
  let host: HTMLDivElement
  const backup = { savedAt: new Date(2026, 10, 26, 14, 5).getTime(), raw: JSON.stringify({ state: { coins: 42, dex: { a: {}, b: {} } }, version: 5 }) }
  const click = (text: string) => act(() => [...host.querySelectorAll('button')].find((b) => b.textContent!.includes(text))!.click())
  beforeEach(() => {
    host = document.createElement('div')
    root = createRoot(host)
  })
  afterEach(() => act(() => root.unmount()))

  it('백업의 코인·도감·시각을 보이고, 확인한 뒤에만 되돌린다', async () => {
    const onRestore = vi.fn(async () => true)
    act(() => root.render(<BackupRow backup={backup} onRestore={onRestore} onClear={vi.fn()} />))
    expect(host.textContent).toContain('덮어쓰기 전 진행으로 되돌리기 (코인 42, 도감 2종, 11월 26일 14:05)')
    click('덮어쓰기 전 진행으로 되돌리기')
    expect(onRestore).not.toHaveBeenCalled()
    await act(async () => click('되돌리기'))
    expect(onRestore).toHaveBeenCalledOnce()
  })

  it('확인 창에서 취소하면 되돌리지 않는다', () => {
    const onRestore = vi.fn(async () => true)
    act(() => root.render(<BackupRow backup={backup} onRestore={onRestore} onClear={vi.fn()} />))
    click('덮어쓰기 전 진행으로 되돌리기')
    click('취소')
    expect(onRestore).not.toHaveBeenCalled()
    expect(host.textContent).toContain('덮어쓰기 전 진행으로 되돌리기 (')
  })

  it('백업 지우기', () => {
    const onClear = vi.fn()
    act(() => root.render(<BackupRow backup={backup} onRestore={vi.fn(async () => true)} onClear={onClear} />))
    click('백업 지우기')
    expect(onClear).toHaveBeenCalledOnce()
  })
})
