import { useSessionStore } from '../stores/sessionStore'
import { MenuPanel } from './MenuPanel'

/** 현재 mode에 맞는 패널 하나를 띄운다 */
export function Panels({ onExit }: { onExit?: () => void }) {
  const mode = useSessionStore((s) => s.mode)
  switch (mode) {
    case 'menu':
      return <MenuPanel onExit={onExit} />
    default:
      return null
  }
}
