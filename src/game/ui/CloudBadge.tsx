import { useTouchUi } from '../input/touchDevice'
import { useCloudStore } from '../stores/cloudStore'
import { useSessionStore } from '../stores/sessionStore'
import { safeLeft, safeBottom, safeTop } from './styles'

const TEXT = { syncing: '☁️ 저장 중…', saved: '☁️ 저장됨', pending: '☁️ 저장 대기 중' } as const

/**
 * 서버 저장 상태를 작게. 컴퓨터는 왼쪽 아래, 터치 화면은 왼쪽 아래에 조이스틱이 있어 왼쪽 맨 위(코인 글자 위)에 둔다.
 * 서버가 없으면(off) 안 보인다
 */
export function CloudBadge() {
  const status = useCloudStore((s) => s.status)
  const mode = useSessionStore((s) => s.mode)
  const touchUi = useTouchUi()
  if (status === 'off' || mode === 'cutscene' || mode === 'aquariumView') return null
  const place = touchUi ? { top: safeTop(1), fontSize: 11 } : { bottom: safeBottom(8), fontSize: 12 }
  return (
    <div style={{ position: 'absolute', left: safeLeft(touchUi ? 16 : 12), ...place, opacity: status === 'pending' ? 0.9 : 0.55, color: '#fff', textShadow: '0 1px 2px rgba(0,0,0,0.7)', pointerEvents: 'none', zIndex: 4 }}>
      {TEXT[status]}
    </div>
  )
}
