import { useEffect, useState, type ReactNode } from 'react'

/** 이 탭이 게임 잠금을 잡은 뒤에만 게임을 그린다. 다른 탭이 하고 있으면 안내만 */
export function TabGate({ lock, children }: { lock: Promise<boolean>; children: ReactNode }) {
  const [state, setState] = useState<'wait' | 'held' | 'blocked'>('wait')
  useEffect(() => {
    let live = true
    void lock.then((ok) => live && setState(ok ? 'held' : 'blocked'))
    return () => {
      live = false
    }
  }, [lock])
  if (state === 'wait') return null
  if (state === 'blocked') {
    return (
      <div style={{ position: 'fixed', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, boxSizing: 'border-box', background: '#14202d', color: '#fff', fontSize: 18, lineHeight: 1.6, textAlign: 'center', wordBreak: 'keep-all' }}>
        <p style={{ margin: 0, maxWidth: 480 }}>🏝️ 다른 탭에서 섬마을을 하고 있어요. 그 탭을 닫고 새로고침해 주세요.</p>
      </div>
    )
  }
  return children
}
