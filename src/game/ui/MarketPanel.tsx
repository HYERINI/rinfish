import { useState } from 'react'
import { COOK_LINES, COOK_SCENE } from '../data/cooking'
import { BUFF_LABEL, DISHES, DISH_CATEGORY_LABEL, type DishCategory, type DishDef } from '../data/dishes'
import { RARITY_COLOR, RARITY_LABEL, findSpecies } from '../data/fish'
import { MARKET } from '../data/market'
import { SNACKS, SNACK_MAX_QTY, getSnack, type SnackId } from '../data/snacks'
import type { FishInstance, FishSpecies, FoodId, Rarity } from '../data/types'
import { pressEat } from '../input/usePlayerActionKeys'
import { affordableQty } from '../logic/bait'
import { dishEffect, eligibleFish, ingredientsOk, menuVisible } from '../logic/cooking'
import { useProgressStore } from '../stores/progressStore'
import { useSessionStore } from '../stores/sessionStore'
import { FishImage } from './FishImage'
import { ItemIcon } from './ItemIcon'
import { BigButton, Kiosk, KioskDetail, QtyStepper } from './Kiosk'
import { useFlash } from './useFlash'

type Tab = 'snack' | DishCategory

/** 창을 닫고 캐릭터가 바로 먹는 모습을 보여 준다 */
function eatNow(food: FoodId, notice: string) {
  const session = useSessionStore.getState()
  session.notify(notice)
  session.setMode('explore')
  pressEat(food)
}

/** 보관함 물고기 + 종 정보 (요리 재료 후보) */
type Row = { fish: FishInstance; species: FishSpecies; id: string; speciesId: string; rarity: Rarity }

function useRows(): Row[] {
  const inventory = useProgressStore((s) => s.inventory)
  return inventory.flatMap((fish) => {
    const species = findSpecies(fish.speciesId)
    return species ? [{ fish, species, id: fish.id, speciesId: fish.speciesId, rarity: species.rarity }] : []
  })
}

/**
 * 찜 가게 미스터찜 키오스크 (사장님 배정빈)
 * - 간식: 코인만으로 김밥·컵라면·에너지 음료를 사서 바로 먹거나 가방에 담는다 (가방 간식은 HUD 에서 꺼내 먹는다)
 * - 찜·회·탕: 메뉴 → 재료 물고기 고르기 → 주문하면 사장님이 요리하는 연출 뒤 먹는다. 희귀한 물고기일수록 효과가 크다
 * - 비밀 메뉴: 보관함에 XXL배정빈이 있을 때만 나타난다
 */
export function MarketPanel() {
  const coins = useProgressStore((s) => s.coins)
  const stamina = useProgressStore((s) => s.survival.stamina)
  const rows = useRows()
  const [tab, setTab] = useState<Tab>('snack')
  const secret = DISHES.some((d) => d.category === 'secret' && menuVisible(d, rows))
  const categories: DishCategory[] = secret ? ['steam', 'raw', 'secret'] : ['steam', 'raw']
  // 탭마다 고른 상태가 따로라서 탭 내용을 다른 컴포넌트로 그린다
  const frame: Frame = {
    title: `🍲 ${MARKET.name} · ${MARKET.owner}`,
    subtitle: `“${MARKET.greeting}” · 내 체력 ${Math.ceil(stamina)}`,
    accent: '#e53935',
    coins,
    tabs: [
      { id: 'snack', label: '간식', icon: <ItemIcon id="gimbap" size={22} /> },
      ...categories.map((c) => ({ id: c, label: c === 'secret' ? '🤫 비밀 메뉴' : DISH_CATEGORY_LABEL[c], icon: c === 'secret' ? undefined : <ItemIcon id={c === 'steam' ? 'fishSteam' : 'stew'} size={22} /> })),
    ],
    tab,
    onTab: (id) => setTab(id as Tab),
  }
  return tab === 'snack' ? <SnackTab frame={frame} /> : <MenuTab key={tab} frame={frame} category={tab} rows={rows} />
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

/** 내올 때 사장님 한마디: 요리마다 정해진 말(비밀 메뉴) 또는 아무거나 하나 */
function chefLine(dish: DishDef): string {
  return dish.chefLine ?? COOK_LINES[Math.floor(Math.random() * COOK_LINES.length)]
}

/** 재료 조건 글 */
function needsText(dish: DishDef): string {
  const { count, rarities, speciesId } = dish.needs
  if (speciesId) return `${findSpecies(speciesId)?.name ?? speciesId} ${count}마리`
  if (rarities?.length === 1) return `${RARITY_LABEL[rarities[0]]} 물고기 ${count}마리`
  if (rarities) return `${RARITY_LABEL[rarities[0]]} 이상 물고기 ${count}마리`
  return `아무 물고기 ${count}마리`
}

const effectText = (heal: number, buff: { kind: keyof typeof BUFF_LABEL; remaining: number } | null) => `체력 +${heal}${buff ? ` · ${BUFF_LABEL[buff.kind]} ${Math.round(buff.remaining)}초` : ''}`

/** 메뉴 탭: 메뉴 카드 → 재료 물고기 칩 고르기 → 주문 → 사장님 요리 연출 → 먹기 */
function MenuTab({ frame, category, rows }: { frame: Frame; category: DishCategory; rows: Row[] }) {
  const { coins } = frame
  const dishes = DISHES.filter((d) => d.category === category && menuVisible(d, rows))
  const [dishId, setDishId] = useState(dishes[0]?.id ?? null)
  const [picked, setPicked] = useState<string[]>([])
  const dish = dishes.find((d) => d.id === dishId) ?? dishes[0]
  if (!dish) return <Kiosk {...frame} cards={[]} selectedId={null} onSelect={() => {}} detail={null} />
  const candidates = eligibleFish(dish, rows)
  // 아직 안 골랐으면 앞에서부터 필요한 만큼 골라 둔다
  const chosenIds = picked.filter((id) => candidates.some((c) => c.id === id))
  const chosen = (chosenIds.length > 0 ? chosenIds : candidates.slice(0, dish.needs.count).map((c) => c.id)).map((id) => candidates.find((c) => c.id === id)!)
  const ready = ingredientsOk(dish, chosen)
  const effect = dishEffect(dish, chosen.length > 0 ? chosen.map((c) => c.rarity) : ['common'])
  const affordable = coins >= dish.cookFee

  const togglePick = (id: string) => {
    const current = chosen.map((c) => c.id)
    if (current.includes(id)) setPicked(current.filter((x) => x !== id))
    else setPicked(dish.needs.count === 1 ? [id] : [...current, id].slice(-dish.needs.count))
  }

  const order = () => {
    const ids = chosen.map((c) => c.id)
    if (!useProgressStore.getState().cookDish(dish.id, ids)) return
    const line = chefLine(dish)
    const session = useSessionStore.getState()
    session.notify(`${dish.name} 주문! ${effectText(effect.heal, effect.buff)}`)
    session.requestTeleport(COOK_SCENE.watchFrom)
    // 창이 닫히고 사장님이 요리하는 모습을 보여 준 뒤 먹는다 (값은 지금 이미 반영됐다)
    session.startCooking(dish.id, line)
  }

  return (
    <Kiosk
      {...frame}
      cards={dishes.map((d) => {
        const have = eligibleFish(d, rows).length
        return {
          id: d.id,
          name: d.name,
          image: <ItemIcon id={d.id} size={64} />,
          sub: needsText(d),
          subColor: have >= d.needs.count ? undefined : '#c62828',
          price: `${d.cookFee} 코인`,
          badge: `재료 ${Math.min(have, d.needs.count)}/${d.needs.count}`,
          dimmed: have < d.needs.count || coins < d.cookFee,
        }
      })}
      selectedId={dish.id}
      onSelect={(id) => {
        setDishId(id as DishDef['id'])
        setPicked([])
      }}
      detail={
        <KioskDetail
          image={<ItemIcon id={dish.id} size={100} />}
          title={dish.name}
          lines={[dish.description, `${effectText(effect.heal, effect.buff)} · 조리비 ${dish.cookFee} 코인`, `재료: ${needsText(dish)}${dish.needs.count > 1 ? ' (눌러서 고르기)' : ''}`]}
        >
          {candidates.length === 0 ? (
            <p className="kiosk-note">맞는 물고기가 보관함에 없어요. 낚시하러 가 볼까요?</p>
          ) : (
            <div className="kiosk-chips">
              {candidates.map((c) => (
                <button key={c.id} className={`kiosk-chip${chosen.some((x) => x.id === c.id) ? ' on' : ''}`} onClick={() => togglePick(c.id)}>
                  <FishImage speciesId={c.speciesId} width={64} />
                  <span style={{ color: c.rarity === 'common' ? undefined : RARITY_COLOR[c.rarity] }}>{c.species.name}</span>
                </button>
              ))}
            </div>
          )}
          <BigButton
            label="주문하기"
            sub={!ready ? `재료를 ${dish.needs.count}마리 골라요` : affordable ? `조리비 ${dish.cookFee} 코인 · 사장님이 바로 만들어요` : '코인이 모자라요'}
            disabled={!ready || !affordable}
            onClick={order}
          />
        </KioskDetail>
      }
    />
  )
}
