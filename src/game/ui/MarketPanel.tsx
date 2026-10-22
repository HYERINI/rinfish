import { useState } from 'react'
import { BUFF_LABEL, DISHES, getDish } from '../data/dishes'
import { RARITY_COLOR, RARITY_LABEL, findSpecies } from '../data/fish'
import type { DishId } from '../data/types'
import { dishEffect } from '../logic/cooking'
import { useProgressStore } from '../stores/progressStore'
import { FishImage } from './FishImage'
import { ItemIcon } from './ItemIcon'
import { BigButton, Kiosk, KioskDetail } from './Kiosk'
import { useFlash } from './useFlash'

/** 어시장 키오스크: 요리(탭) → 재료 물고기(카드) → 먹기. 희귀한 물고기일수록 효과가 크다 */
export function MarketPanel() {
  const inventory = useProgressStore((s) => s.inventory)
  const coins = useProgressStore((s) => s.coins)
  const stamina = useProgressStore((s) => s.survival.stamina)
  const [dishId, setDishId] = useState<DishId>('sashimi')
  const [fishId, setFishId] = useState<string | null>(null)
  const [toast, flash] = useFlash()
  const dish = getDish(dishId)

  const rows = inventory.flatMap((fish) => {
    const species = findSpecies(fish.speciesId)
    return species ? [{ fish, species, effect: dishEffect(dish, species.rarity) }] : []
  })
  const chosen = rows.find((r) => r.fish.id === fishId) ?? rows[0] ?? null
  const affordable = coins >= dish.cookFee

  const effectText = (heal: number, buff: { kind: keyof typeof BUFF_LABEL; remaining: number } | null) => `체력 +${heal}${buff ? ` · ${BUFF_LABEL[buff.kind]} ${Math.round(buff.remaining)}초` : ''}`

  return (
    <Kiosk
      title={`🍲 어시장 · 체력 ${Math.ceil(stamina)}`}
      accent="#e53935"
      coins={coins}
      tabs={DISHES.map((d) => ({ id: d.id, label: `${d.name} ${d.cookFee}`, icon: <ItemIcon id={d.id} size={22} /> }))}
      tab={dishId}
      onTab={(id) => setDishId(id as DishId)}
      cards={rows.map(({ fish, species, effect }) => ({
        id: fish.id,
        name: species.name,
        image: <FishImage speciesId={species.id} width={112} />,
        sub: `${RARITY_LABEL[species.rarity]} · ${fish.weight}kg`,
        subColor: species.rarity === 'common' ? undefined : RARITY_COLOR[species.rarity],
        price: `체력 +${effect.heal}`,
      }))}
      selectedId={chosen?.fish.id ?? null}
      onSelect={setFishId}
      empty={
        <>
          <ItemIcon id={dish.id} size={96} />
          <p>요리할 물고기가 없어요. 낚시하러 가 볼까요?</p>
        </>
      }
      detail={
        chosen ? (
          <KioskDetail
            image={
              <div className="kiosk-combo">
                <ItemIcon id={dish.id} size={96} />
                <FishImage speciesId={chosen.species.id} width={120} />
              </div>
            }
            title={`${chosen.species.name} ${dish.name}`}
            lines={[dish.description, effectText(chosen.effect.heal, chosen.effect.buff), `조리비 ${dish.cookFee} 코인 · 물고기 1마리`]}
          >
            <BigButton
              label="먹기"
              sub={affordable ? `조리비 ${dish.cookFee} 코인` : '코인이 모자라요'}
              disabled={!affordable}
              onClick={() => {
                if (useProgressStore.getState().cookDish(dish.id, chosen.fish.id)) {
                  flash(`냠냠! ${effectText(chosen.effect.heal, chosen.effect.buff)}`)
                  setFishId(null)
                }
              }}
            />
          </KioskDetail>
        ) : (
          <KioskDetail image={<ItemIcon id={dish.id} size={110} />} title={dish.name} lines={[dish.description, `조리비 ${dish.cookFee} 코인`, '보관함에 물고기가 있어야 만들 수 있어요']} />
        )
      }
      toast={toast}
    />
  )
}
