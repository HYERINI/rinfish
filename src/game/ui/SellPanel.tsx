import { useState } from 'react'
import { RARITY_COLOR, RARITY_LABEL, findSpecies } from '../data/fish'
import type { Rarity } from '../data/types'
import { sellPrice } from '../logic/economy'
import { useProgressStore } from '../stores/progressStore'
import { FishImage } from './FishImage'
import { BigButton, Kiosk, KioskDetail } from './Kiosk'
import { useFlash } from './useFlash'

type Tab = 'all' | Rarity
const TAB_ORDER: Rarity[] = ['junk', 'common', 'rare', 'epic', 'legendary']

/** 판매함 키오스크: 물고기 카드를 눌러 여러 마리 고르고 팔기, 또는 모두 팔기 */
export function SellPanel() {
  const inventory = useProgressStore((s) => s.inventory)
  const coins = useProgressStore((s) => s.coins)
  const sellFish = useProgressStore((s) => s.sellFish)
  const [tab, setTab] = useState<Tab>('all')
  const [checked, setChecked] = useState<Set<string>>(() => new Set())
  const [focus, setFocus] = useState<string | null>(null)
  const [toast, flash] = useFlash()

  const rows = inventory.flatMap((fish) => {
    const species = findSpecies(fish.speciesId)
    return species ? [{ fish, species, price: sellPrice(species, fish.weight) }] : []
  })
  const shown = tab === 'all' ? rows : rows.filter((r) => r.species.rarity === tab)
  const tabs = [{ id: 'all', label: `전체 ${rows.length}` }, ...TAB_ORDER.filter((r) => rows.some((x) => x.species.rarity === r)).map((r) => ({ id: r, label: `${RARITY_LABEL[r]} ${rows.filter((x) => x.species.rarity === r).length}` }))]
  // 팔려서 없어진 물고기는 고른 목록에서 뺀다
  const picked = rows.filter((r) => checked.has(r.fish.id))
  const pickedTotal = picked.reduce((s, r) => s + r.price, 0)
  const allTotal = rows.reduce((s, r) => s + r.price, 0)
  const focused = rows.find((r) => r.fish.id === focus) ?? picked[picked.length - 1] ?? null

  const toggle = (id: string) => {
    setChecked((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
    setFocus(id)
  }
  const sell = (ids: string[]) => {
    const earned = sellFish(ids)
    if (earned > 0) flash(`${ids.length}마리를 팔아서 +${earned} 코인!`)
    setChecked(new Set())
    setFocus(null)
  }

  return (
    <Kiosk
      title="🐟 물고기 판매함"
      accent="#1e88e5"
      coins={coins}
      tabs={rows.length > 0 ? tabs : undefined}
      tab={tab}
      onTab={(id) => setTab(id as Tab)}
      cards={shown.map(({ fish, species, price }) => ({
        id: fish.id,
        name: species.name,
        image: <FishImage speciesId={species.id} width={112} />,
        sub: `${RARITY_LABEL[species.rarity]} · ${fish.weight}kg`,
        subColor: species.rarity === 'common' ? undefined : RARITY_COLOR[species.rarity],
        price: `${price} 코인`,
        checked: checked.has(fish.id),
      }))}
      selectedId={focused?.fish.id ?? null}
      onSelect={toggle}
      empty={<p>팔 물고기가 없어요. 낚시하러 가 볼까요?</p>}
      detail={
        <KioskDetail
          image={focused ? <FishImage speciesId={focused.species.id} width={220} /> : <div style={{ fontSize: 13, color: '#66737f', padding: 20 }}>카드를 눌러 팔 물고기를 고르세요</div>}
          title={focused ? focused.species.name : '고른 물고기 없음'}
          tag={focused && <span style={{ color: RARITY_COLOR[focused.species.rarity], fontSize: 13, textShadow: '0 0 1px #000' }}>{RARITY_LABEL[focused.species.rarity]}</span>}
          lines={focused ? [`${focused.fish.weight}kg · ${focused.price} 코인`, `고른 물고기 ${picked.length}마리 · 합계 ${pickedTotal} 코인`] : [`보관함 ${rows.length}마리 · 모두 팔면 ${allTotal} 코인`]}
        >
          <BigButton label="팔기" sub={picked.length > 0 ? `${picked.length}마리 · +${pickedTotal} 코인` : '먼저 물고기를 골라요'} tone="sell" disabled={picked.length === 0} onClick={() => sell(picked.map((r) => r.fish.id))} />
          <BigButton label={`모두 팔기 +${allTotal}`} tone="plain" disabled={rows.length === 0} onClick={() => sell(rows.map((r) => r.fish.id))} />
        </KioskDetail>
      }
      toast={toast}
    />
  )
}
