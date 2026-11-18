import { getBait } from '../data/bait'
import { HOTBAR, TOOLS } from '../data/tools'
import { TOUCH } from '../data/touch'
import { useMediaQuery, useTouchUi } from '../input/touchDevice'
import { useProgressStore } from '../stores/progressStore'
import { useSessionStore } from '../stores/sessionStore'
import { safeBottom } from './styles'

/**
 * 화면 아래 가운데 도구 칸 (탐험 중). 숫자 키 1~9 와 같고, 눌러서도 바꾼다(폰).
 * 낚싯대 칸에는 고른 미끼 개수를 탄약처럼 적는다. 폰은 좁아서 빈 칸을 그리지 않는다
 */
export function Hotbar() {
  const mode = useSessionStore((s) => s.mode)
  const tool = useSessionStore((s) => s.tool)
  const bait = useProgressStore((s) => s.selectedBait)
  const baitCount = useProgressStore((s) => (s.selectedBait ? (s.bait[s.selectedBait] ?? 0) : 0))
  const touchUi = useTouchUi()
  const portrait = useMediaQuery('(orientation: portrait)')
  if (mode !== 'explore') return null
  // 컴퓨터: 아래 조작 안내가 좁은 창에서 두 줄이 되어도 겹치지 않게 띄운다
  const bottom = touchUi ? TOUCH.hotbarBottom[portrait ? 'portrait' : 'landscape'] : 44
  const slots = HOTBAR.map((id, i) => ({ id, i })).filter((s) => !touchUi || s.id)
  return (
    <div style={{ position: 'absolute', left: '50%', bottom: safeBottom(bottom), transform: 'translateX(-50%)', display: 'flex', gap: 4, pointerEvents: 'auto', zIndex: 1000 }} aria-label="도구 칸">
      {slots.map(({ id, i }) => {
        const def = id ? TOOLS.find((t) => t.id === id) : undefined
        const on = id !== null && id === tool
        return (
          <button
            key={i}
            disabled={!id}
            title={def ? `${i + 1} ${def.name}` : undefined}
            aria-label={def ? `${def.name} 들기` : `빈 칸 ${i + 1}`}
            aria-pressed={on}
            onClick={(e) => {
              e.currentTarget.blur()
              if (id) useSessionStore.getState().equip(on ? null : id)
            }}
            style={{
              position: 'relative',
              width: 46,
              height: 46,
              borderRadius: 10,
              border: on ? '3px solid #ffd166' : '2px solid rgba(255,255,255,0.35)',
              background: on ? 'rgba(255, 209, 102, 0.35)' : 'rgba(15, 20, 30, 0.55)',
              color: '#fff',
              cursor: id ? 'pointer' : 'default',
              padding: 0,
              fontSize: 24,
              lineHeight: 1,
            }}
          >
            <span style={{ position: 'absolute', top: 2, left: 4, fontSize: 10, opacity: 0.8 }}>{i + 1}</span>
            {def?.icon}
            {id === 'rod' && (
              <span style={{ position: 'absolute', bottom: 1, right: 3, fontSize: 10, fontWeight: 800 }} title={bait ? `${getBait(bait).name} ${baitCount}개` : '미끼 없이'}>
                {bait ? baitCount : '–'}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}
