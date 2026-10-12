import { useSessionStore } from '../stores/sessionStore'
import { Panel } from './Panel'
import { button } from './styles'

export function MenuPanel({ onExit }: { onExit?: () => void }) {
  const setMode = useSessionStore((s) => s.setMode)
  return (
    <Panel title="메뉴">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <button style={button} onClick={() => setMode('explore')}>
          계속하기
        </button>
        <button style={button} onClick={() => setMode('dex')}>
          도감
        </button>
        <button style={button} onClick={() => onExit?.()}>
          로비로 나가기
        </button>
      </div>
    </Panel>
  )
}
