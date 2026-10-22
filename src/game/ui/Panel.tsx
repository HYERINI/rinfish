import type { ReactNode } from 'react'
import { useTouchUi } from '../input/touchDevice'
import { useSessionStore } from '../stores/sessionStore'
import { button, panelBox } from './styles'

export function Panel({ title, children }: { title: string; children: ReactNode }) {
  const setMode = useSessionStore((s) => s.setMode)
  const touchUi = useTouchUi()
  return (
    <div style={panelBox}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h2 style={{ margin: 0, fontSize: 20 }}>{title}</h2>
        <button style={button} onClick={() => setMode('explore')}>
          {touchUi ? '닫기' : '닫기 (ESC)'}
        </button>
      </div>
      {children}
    </div>
  )
}
