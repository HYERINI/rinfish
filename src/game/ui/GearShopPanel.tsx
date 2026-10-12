import { GEAR } from '../data/gear'
import type { GearSlot } from '../data/types'
import { useProgressStore } from '../stores/progressStore'
import { Panel } from './Panel'
import { button, disabledButton } from './styles'

const SLOTS: GearSlot[] = ['line', 'reel', 'rod']

const VALUE_TEXT: Record<GearSlot, (value: number) => string> = {
  line: (v) => `최대 텐션 ${v}`,
  reel: (v) => `감기 속도 ${v}`,
  rod: (v) => `당김 충격 ${Math.round(v * 100)}%`,
}

export function GearShopPanel() {
  const gear = useProgressStore((s) => s.gear)
  const coins = useProgressStore((s) => s.coins)
  const buyGear = useProgressStore((s) => s.buyGear)

  return (
    <Panel title={`장비 상점 · 코인 ${coins}`}>
      {SLOTS.map((slot) => {
        const def = GEAR[slot]
        const level = gear[slot]
        const current = def.levels[level]
        const next = def.levels[level + 1]
        const affordable = next !== undefined && coins >= next.price
        return (
          <div key={slot} style={{ padding: '10px 0', borderBottom: '1px solid #333' }}>
            <div>
              <strong>{def.name}</strong> <span style={{ opacity: 0.7, fontSize: 13 }}>{def.description}</span>
            </div>
            <div style={{ fontSize: 14, margin: '4px 0' }}>
              지금: Lv{level + 1} {current.label} ({VALUE_TEXT[slot](current.value)})
            </div>
            {next ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14 }}>
                <span style={{ flex: 1 }}>
                  다음: Lv{level + 2} {next.label} ({VALUE_TEXT[slot](next.value)})
                </span>
                <button style={affordable ? button : disabledButton} disabled={!affordable} onClick={(e) => {
                    buyGear(slot)
                    // 포커스가 남아 Space/Enter로 연달아 구매되는 것을 막는다
                    e.currentTarget.blur()
                  }}>
                  {next.price} 코인
                </button>
              </div>
            ) : (
              <div style={{ fontSize: 14, color: '#ffd166' }}>최고 단계</div>
            )}
          </div>
        )
      })}
    </Panel>
  )
}
