import { useState } from 'react'
import { BUFF_LABEL, DISHES, getDish } from '../data/dishes'
import { RARITY_COLOR, RARITY_LABEL, findSpecies } from '../data/fish'
import { MARKET } from '../data/market'
import { SNACKS, SNACK_MAX_QTY, getSnack, type SnackId } from '../data/snacks'
import type { DishId, FoodId } from '../data/types'
import { pressEat } from '../input/usePlayerActionKeys'
import { affordableQty } from '../logic/bait'
import { dishEffect } from '../logic/cooking'
import { useProgressStore } from '../stores/progressStore'
import { useSessionStore } from '../stores/sessionStore'
import { FishImage } from './FishImage'
import { ItemIcon } from './ItemIcon'
import { BigButton, Kiosk, KioskDetail, QtyStepper } from './Kiosk'
import { useFlash } from './useFlash'

type Tab = 'snack' | DishId

/** 창을 닫고 캐릭터가 바로 먹는 모습을 보여 준다 */
function eatNow(food: FoodId, notice: string) {
  const session = useSessionStore.getState()
  session.notify(notice)
  session.setMode('explore')
  pressEat(food)
}

/**
 * 찜 가게 미스터찜 키오스크 (사장님 배정빈)
 * - 간식 탭: 코인만으로 김밥·컵라면·에너지 음료를 사서 바로 먹거나 가방에 담는다 (가방 간식은 HUD 에서 꺼내 먹는다)
 * - 요리 탭: 요리 → 재료 물고기(카드) → 먹기. 희귀한 물고기일수록 효과가 크다
 */
export function MarketPanel() {
  const coins = useProgressStore((s) => s.coins)
  const stamina = useProgressStore((s) => s.survival.stamina)
  const [tab, setTab] = useState<Tab>('snack')
  // 탭마다 고른 상태가 따로라서 탭 내용을 다른 컴포넌트로 그린다 (요리 탭끼리는 key 로 새로 만든다)
  const frame: Frame = {
    title: `🍲 ${MARKET.name} · ${MARKET.owner}`,
    subtitle: `“${MARKET.greeting}” · 내 체력 ${Math.ceil(stamina)}`,
    accent: '#e53935',
    coins,
    tabs: [{ id: 'snack', label: '간식', icon: <ItemIcon id="gimbap" size={22} /> }, ...DISHES.map((d) => ({ id: d.id, label: `${d.name} ${d.cookFee}`, icon: <ItemIcon id={d.id} size={22} /> }))],
    tab,
    onTab: (id) => setTab(id as Tab),
  }
  return tab === 'snack' ? <SnackTab frame={frame} /> : <DishTab key={tab} frame={frame} dishId={tab} />
}

/** 탭과 상관없는 키오스크 머리 부분 */
type Frame = Pick<Parameters<typeof Kiosk>[0], 'title' | 'subtitle' | 'accent' | 'coins' | 'tabs' | 'tab' | 'onTab'>

/** 간식 탭 */
function SnackTab({ frame }: { frame: Frame }) {
  const { coins } = frame
  const snacks = useProgressStore((s) => s.snacks)
  const [selected, setSelected] = useState<SnackId>('gimbap')
  const [qty, setQty] = useState(1)
  const [toast, flash] = useFlash()
  const snack = getSnack(selected)
  const max = Math.max(1, affordableQty(coins, snack.price, SNACK_MAX_QTY))
  const n = Math.min(qty, max)
  return (
    <Kiosk
      {...frame}
      cards={SNACKS.map((s) => ({
        id: s.id,
        name: s.name,
        image: <ItemIcon id={s.id} size={64} />,
        sub: `체력 +${s.heal}`,
        price: `${s.price} 코인`,
        badge: snacks[s.id] > 0 ? `가방 ${snacks[s.id]}` : undefined,
        dimmed: coins < s.price,
      }))}
      selectedId={selected}
      onSelect={(id) => {
        setSelected(id as SnackId)
        setQty(1)
      }}
      detail={
        <KioskDetail
          image={<ItemIcon id={snack.id} size={110} />}
          title={snack.name}
          lines={[snack.description, `체력 +${snack.heal} · ${snack.price} 코인`, `가방에 ${snacks[snack.id]}개 · 가방 간식은 화면 왼쪽 위에서 꺼내 먹어요`]}
        >
          <BigButton
            label="사서 바로 먹기"
            sub={coins >= snack.price ? `${snack.price} 코인 · 체력 +${snack.heal}` : '코인이 모자라요'}
            disabled={coins < snack.price}
            onClick={() => {
              if (useProgressStore.getState().buyAndEatSnack(snack.id)) eatNow(snack.id, `냠냠! ${snack.name} · 체력 +${snack.heal}`)
            }}
          />
          <QtyStepper value={n} max={max} onChange={setQty} />
          <BigButton
            tone="plain"
            label={`가방에 ${n}개 담기 · ${snack.price * n} 코인`}
            disabled={coins < snack.price * n}
            onClick={() => {
              if (useProgressStore.getState().buySnacks(snack.id, n)) flash(`${snack.name} ${n}개를 가방에 담았어요!`)
            }}
          />
        </KioskDetail>
      }
      toast={toast}
    />
  )
}

function DishTab({ frame, dishId }: { frame: Frame; dishId: DishId }) {
  const { coins } = frame
  const inventory = useProgressStore((s) => s.inventory)
  const [fishId, setFishId] = useState<string | null>(null)
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
      {...frame}
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
          <p>요리할 물고기가 없어요. 간식 탭에서 코인으로 사 먹을 수도 있어요.</p>
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
                if (useProgressStore.getState().cookDish(dish.id, chosen.fish.id)) eatNow(dish.id, `냠냠! ${chosen.species.name} ${dish.name} · ${effectText(chosen.effect.heal, chosen.effect.buff)}`)
              }}
            />
          </KioskDetail>
        ) : (
          <KioskDetail image={<ItemIcon id={dish.id} size={110} />} title={dish.name} lines={[dish.description, `조리비 ${dish.cookFee} 코인`, '보관함에 물고기가 있어야 만들 수 있어요']} />
        )
      }
    />
  )
}
