import { useState } from 'react'
import { BAITS, BAIT_MAX_QTY, getBait, type BaitId } from '../data/bait'
import { AQUARIUM } from '../data/balance'
import { GEAR } from '../data/gear'
import type { GearSlot } from '../data/types'
import { affordableQty } from '../logic/bait'
import { useProgressStore } from '../stores/progressStore'
import { ItemIcon } from './ItemIcon'
import { BigButton, Kiosk, KioskDetail, QtyStepper, type KioskCard } from './Kiosk'
import { useFlash } from './useFlash'

const SLOTS: GearSlot[] = ['line', 'reel', 'rod']

const VALUE_TEXT: Record<GearSlot, (value: number) => string> = {
  line: (v) => `최대 텐션 ${v}`,
  reel: (v) => `감기 속도 ${v}`,
  rod: (v) => `당김 충격 ${Math.round(v * 100)}%`,
}

type Tab = 'bait' | 'gear' | 'feed'
const TABS: { id: Tab; label: string }[] = [
  { id: 'bait', label: '미끼' },
  { id: 'gear', label: '장비' },
  { id: 'feed', label: '어항 사료' },
]
const FIRST: Record<Tab, string> = { bait: 'worm', gear: 'line', feed: 'feed' }

/** 낚시 용품점 키오스크: 미끼(수량 골라 사기) · 장비 업그레이드 · 어항 사료 */
export function GearShopPanel() {
  const coins = useProgressStore((s) => s.coins)
  const gear = useProgressStore((s) => s.gear)
  const bait = useProgressStore((s) => s.bait)
  const feed = useProgressStore((s) => s.feed)
  const [tab, setTab] = useState<Tab>('bait')
  const [selected, setSelected] = useState<string>(FIRST.bait)
  const [qty, setQty] = useState(1)
  const [toast, flash] = useFlash()

  const select = (id: string) => {
    if (id !== selected) setQty(1)
    setSelected(id)
  }

  let cards: KioskCard[]
  let detail
  if (tab === 'bait') {
    cards = BAITS.map((b) => ({ id: b.id, name: b.name, image: <ItemIcon id={b.id} size={64} />, price: `${b.price} 코인`, badge: `보유 ${bait[b.id]}`, dimmed: coins < b.price }))
    const def = getBait((selected as BaitId) in bait ? (selected as BaitId) : 'worm')
    const max = Math.max(1, affordableQty(coins, def.price, BAIT_MAX_QTY))
    const n = Math.min(qty, max)
    const total = def.price * n
    detail = (
      <KioskDetail image={<ItemIcon id={def.id} size={110} />} title={def.name} lines={[def.description, `1개 ${def.price} 코인 · 지금 ${bait[def.id]}개`, `낚시 중 ${def.key.replace('Digit', '')}번 키로 골라요`]}>
        <QtyStepper value={n} max={max} onChange={setQty} />
        <BigButton
          label="구매하기"
          sub={coins >= total ? `${n}개 · ${total} 코인` : '코인이 모자라요'}
          disabled={coins < total}
          onClick={() => {
            if (useProgressStore.getState().buyBait(def.id, n)) flash(`${def.name} ${n}개를 샀어요!`)
          }}
        />
      </KioskDetail>
    )
  } else if (tab === 'gear') {
    cards = SLOTS.map((slot) => {
      const level = gear[slot]
      const next = GEAR[slot].levels[level + 1]
      return {
        id: slot,
        name: GEAR[slot].name,
        image: <ItemIcon id={slot} level={level} size={64} />,
        sub: `지금 Lv${level + 1} ${GEAR[slot].levels[level].label}`,
        price: next ? `${next.price} 코인` : '최고 단계',
        dimmed: !next || coins < next.price,
      }
    })
    const slot = (SLOTS as string[]).includes(selected) ? (selected as GearSlot) : 'line'
    const def = GEAR[slot]
    const level = gear[slot]
    const current = def.levels[level]
    const next = def.levels[level + 1]
    detail = (
      <KioskDetail
        image={<ItemIcon id={slot} level={next ? level + 1 : level} size={110} />}
        title={def.name}
        lines={[def.description, `지금: Lv${level + 1} ${current.label} (${VALUE_TEXT[slot](current.value)})`, next ? `다음: Lv${level + 2} ${next.label} (${VALUE_TEXT[slot](next.value)})` : '이미 최고 단계예요']}
      >
        {next && (
          <BigButton
            label="업그레이드"
            sub={coins >= next.price ? `${next.price} 코인` : `코인이 모자라요 (${next.price})`}
            disabled={coins < next.price}
            onClick={() => {
              if (useProgressStore.getState().buyGear(slot)) flash(`${next.label}(으)로 바꿨어요!`)
            }}
          />
        )}
      </KioskDetail>
    )
  } else {
    cards = [{ id: 'feed', name: '어항 사료', image: <ItemIcon id="feed" size={64} />, price: `${AQUARIUM.feedPrice} 코인`, badge: `보유 ${feed}`, dimmed: coins < AQUARIUM.feedPrice }]
    const max = Math.max(1, affordableQty(coins, AQUARIUM.feedPrice, BAIT_MAX_QTY))
    const n = Math.min(qty, max)
    const total = AQUARIUM.feedPrice * n
    detail = (
      <KioskDetail image={<ItemIcon id="feed" size={110} />} title="어항 사료" lines={['어항 물고기 배를 채워 줘요', `1개 ${AQUARIUM.feedPrice} 코인 · 지금 ${feed}개`]}>
        <QtyStepper value={n} max={max} onChange={setQty} />
        <BigButton
          label="구매하기"
          sub={coins >= total ? `${n}개 · ${total} 코인` : '코인이 모자라요'}
          disabled={coins < total}
          onClick={() => {
            let bought = 0
            for (let i = 0; i < n; i++) if (useProgressStore.getState().buyFeed()) bought++
            if (bought > 0) flash(`사료 ${bought}개를 샀어요!`)
          }}
        />
      </KioskDetail>
    )
  }

  return (
    <Kiosk
      title="🎣 낚시 용품점"
      accent="#00897b"
      coins={coins}
      tabs={TABS}
      tab={tab}
      onTab={(id) => {
        setTab(id as Tab)
        setSelected(FIRST[id as Tab])
        setQty(1)
      }}
      cards={cards}
      selectedId={selected}
      onSelect={select}
      detail={detail}
      toast={toast}
    />
  )
}
