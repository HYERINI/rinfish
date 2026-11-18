import { GUNS, GUN_IDS } from '../data/guns'
import { toolDef, type ToolId } from '../data/tools'
import { useProgressStore } from '../stores/progressStore'
import { useSessionStore } from '../stores/sessionStore'
import { Panel } from './Panel'
import { button } from './styles'

/** 선반에 걸린 무기 (은지 WEAPONS 순서: 총 4종 + 칼, 그리고 맨손) */
const RACK: ToolId[] = [...GUN_IDS, 'knife', 'fists']

/** 사격장 무기 선반 (E): 고르면 그 무기를 들고 창을 닫는다 (도구 칸에서 고른 것과 같다) */
export function RackPanel() {
  const tool = useSessionStore((s) => s.tool)
  const ammo = useProgressStore((s) => s.ammo)
  const reserve = useProgressStore((s) => s.reserve)
  const pick = (id: ToolId) => {
    const session = useSessionStore.getState()
    session.equip(id)
    session.setMode('explore')
  }
  return (
    <Panel title="🔫 무기 선반">
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 8 }}>
        {RACK.map((id) => {
          const def = toolDef(id)
          const gun = id in GUNS ? GUNS[id as keyof typeof GUNS] : null
          return (
            <button key={id} style={{ ...button, padding: '10px 12px', textAlign: 'left', background: id === tool ? '#ffd166' : '#f1f3f5' }} aria-pressed={id === tool} onClick={() => pick(id)}>
              <div style={{ fontSize: 16 }}>
                {def.icon} {def.name}
              </div>
              <div style={{ fontSize: 12, fontWeight: 400, opacity: 0.75 }}>{gun ? `탄창 ${ammo[gun.id]}/${gun.mag} · 예비 ${reserve[gun.id]}${gun.auto ? ' · 연사' : ''}${gun.zoom ? ' · 조준경' : ''}` : id === 'knife' ? '근접 · 베기·찌르기' : '근접 · 주먹'}</div>
            </button>
          )
        })}
      </div>
      <p style={{ fontSize: 12, opacity: 0.7, marginBottom: 0 }}>탄약은 마을 잡화점에서 사요 · 사격장 안에서 G 로 60초 연습 게임</p>
    </Panel>
  )
}
