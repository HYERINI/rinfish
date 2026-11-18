import { getBait } from '../data/bait'
import { isGun } from '../data/guns'
import { HOTBAR, toolDef, touchHotbar, type ToolId } from '../data/tools'
import { TOUCH } from '../data/touch'
import { useMediaQuery, useTouchUi } from '../input/touchDevice'
import { useProgressStore } from '../stores/progressStore'
import { useSessionStore } from '../stores/sessionStore'
import { safeBottom } from './styles'

const corner = { position: 'absolute' as const, fontSize: 10, fontWeight: 800 }

/**
 * 화면 아래 가운데 도구 칸 (탐험 중). 숫자 키 1~9 와 같고, 눌러서도 바꾼다(폰).
 * 낚싯대 칸에는 고른 미끼 개수를, 총 칸에는 탄창에 든 탄을 적는다. 폰은 좁아서 빈 칸을 그리지 않고 총은 한 칸만 (마지막에 든 총)
 */
export function Hotbar() {
  const mode = useSessionStore((s) => s.mode)
  const tool = useSessionStore((s) => s.tool)
  const lastGun = useSessionStore((s) => s.lastGun)
  const bait = useProgressStore((s) => s.selectedBait)
  const baitCount = useProgressStore((s) => (s.selectedBait ? (s.bait[s.selectedBait] ?? 0) : 0))
  const ammo = useProgressStore((s) => s.ammo)
  const touchUi = useTouchUi()
  const portrait = useMediaQuery('(orientation: portrait)')
  if (mode !== 'explore') return null
  // 컴퓨터: 아래 조작 안내가 좁은 창에서 두 줄이 되어도 겹치지 않게 띄운다
  // 폰 세로 화면에서 총·칼을 들면 무기 버튼이 한 줄 더라 그 위로
  const weaponRows = isGun(tool) || tool === 'knife'
  const bottom = touchUi ? TOUCH.hotbarBottom[portrait ? (weaponRows ? 'portraitWeapon' : 'portrait') : 'landscape'] : 44
  const slots: { id: ToolId | null; key: number }[] = touchUi ? touchHotbar(lastGun).map((id) => ({ id, key: HOTBAR.indexOf(id) })) : HOTBAR.map((id, key) => ({ id, key }))
  return (
    <div style={{ position: 'absolute', left: '50%', bottom: safeBottom(bottom), transform: 'translateX(-50%)', display: 'flex', gap: 4, pointerEvents: 'auto', zIndex: 1000 }} aria-label="도구 칸">
      {slots.map(({ id, key }) => {
        const def = id ? toolDef(id) : undefined
        const on = id !== null && id === tool
        return (
          <button
            key={key}
            disabled={!id}
            title={def ? `${key + 1} ${def.name}` : undefined}
            aria-label={def ? `${def.name} 들기` : `빈 칸 ${key + 1}`}
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
            <span style={{ position: 'absolute', top: 2, left: 4, fontSize: 10, opacity: 0.8 }}>{key + 1}</span>
            {def?.short && <span style={{ ...corner, top: 2, right: 3, fontWeight: 600, opacity: 0.9 }}>{def.short}</span>}
            {def?.icon}
            {id === 'rod' && (
              <span style={{ ...corner, bottom: 1, right: 3 }} title={bait ? `${getBait(bait).name} ${baitCount}개` : '미끼 없이'}>
                {bait ? baitCount : '–'}
              </span>
            )}
            {isGun(id) && <span style={{ ...corner, bottom: 1, right: 3, color: ammo[id] === 0 ? '#ff8a80' : undefined }}>{ammo[id]}</span>}
          </button>
        )
      })}
    </div>
  )
}
