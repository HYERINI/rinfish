import { useState } from 'react'
import { DISHES, BUFF_LABEL } from '../data/dishes'
import { RARITY_COLOR, RARITY_LABEL, findSpecies } from '../data/fish'
import type { DishId } from '../data/types'
import { dishEffect } from '../logic/cooking'
import { useProgressStore } from '../stores/progressStore'
import { Panel } from './Panel'
import { button, disabledButton } from './styles'

export function MarketPanel() {
  const inventory = useProgressStore((s) => s.inventory)
  const coins = useProgressStore((s) => s.coins)
  const stamina = useProgressStore((s) => s.survival.stamina)
  const cookDish = useProgressStore((s) => s.cookDish)
  const [dishId, setDishId] = useState<DishId>('sashimi')
  const dish = DISHES.find((d) => d.id === dishId) ?? DISHES[0]

  const rows = inventory.flatMap((fish) => {
    const species = findSpecies(fish.speciesId)
    return species ? [{ fish, species, effect: dishEffect(dish, species.rarity) }] : []
  })
  const affordable = coins >= dish.cookFee

  return (
    <Panel title={`어시장 · 코인 ${coins} · 체력 ${Math.ceil(stamina)}`}>
      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        {DISHES.map((d) => (
          <button key={d.id} style={{ ...button, flex: 1, opacity: d.id === dishId ? 1 : 0.55 }} onClick={() => setDishId(d.id)}>
            {d.name}
            <div style={{ fontSize: 11, fontWeight: 400 }}>조리비 {d.cookFee}</div>
          </button>
        ))}
      </div>
      <p style={{ margin: '0 0 12px', fontSize: 14, opacity: 0.85 }}>{dish.description}. 희귀한 물고기일수록 효과가 커요.</p>
      {rows.length === 0 ? (
        <p>요리할 물고기가 없어요. 낚시하러 가 볼까요?</p>
      ) : (
        rows.map(({ fish, species, effect }) => (
          <div key={fish.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', borderBottom: '1px solid #333' }}>
            <span style={{ color: RARITY_COLOR[species.rarity], flex: 1 }}>
              {species.name} <span style={{ fontSize: 12, opacity: 0.7 }}>{RARITY_LABEL[species.rarity]}</span>
            </span>
            <span style={{ fontSize: 13, width: 170, textAlign: 'right' }}>
              체력 +{effect.heal}
              {effect.buff && ` · ${BUFF_LABEL[effect.buff.kind]} ${Math.round(effect.buff.remaining)}초`}
            </span>
            <button
              style={affordable ? button : disabledButton}
              disabled={!affordable}
              onClick={(e) => {
                cookDish(dish.id, fish.id)
                e.currentTarget.blur()
              }}
            >
              먹기
            </button>
          </div>
        ))
      )}
    </Panel>
  )
}
