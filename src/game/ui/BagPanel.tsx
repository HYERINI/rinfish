import { useState } from 'react'
import { ITEMS, ITEM_IDS, RECIPES, TAGS, isMeadowDish, type Ingredient, type ItemId, type MeadowDishId, type Recipe } from '../data/meadowItems'
import { SNACKS, getSnack, type SnackId } from '../data/snacks'
import { bagFoodFill, canCook, dishFill, ingredientHave, type BagFood } from '../logic/inventory'
import { startStoveCook } from '../../meadow/meadowActions'
import { useProgressStore } from '../stores/progressStore'
import { useSessionStore } from '../stores/sessionStore'
import { eatFromBagNow } from './eatFromBag'
import { ItemIcon } from './ItemIcon'
import { BigButton, Kiosk, KioskDetail } from './Kiosk'

type Tab = 'items' | 'recipes'

/** 은지 물건 그림 (이모지) */
function Emoji({ icon, size }: { icon: string; size: number }) {
  return <span style={{ fontSize: size * 0.8, lineHeight: 1 }}>{icon}</span>
}

const isSnack = (id: string): id is SnackId => SNACKS.some((s) => s.id === id)

/** 가방 칸 하나: 은지 물건 또는 낚시섬 간식 */
type Row = { id: ItemId | SnackId; n: number }

const fillText = (id: BagFood) => {
  const { heal, hunger } = bagFoodFill(id)
  return `배고픔 +${hunger} · 체력 +${heal}`
}

/** 재료 한 줄 글 (🥩 아무 고기 1/2) */
function ingredientText(s: Ingredient, have: number): string {
  const { icon, name } = 'tag' in s ? TAGS[s.tag] : ITEMS[s.id]
  return `${icon} ${name} ${Math.min(have, s.n)}/${s.n}`
}

/**
 * 가방 (I): "가방" 탭은 은지 물건(재료·요리)과 낚시섬 간식, "요리법" 탭은 은지 배합법 13가지.
 * 요리·간식은 눌러 먹는다 (창이 닫히고 먹는 모습). 물고기는 판매함 그대로 (여기 섞지 않는다).
 * 가스레인지 앞에서 열면 요리법 탭부터, 재료가 있으면 "요리하기"
 */
export function BagPanel() {
  const coins = useProgressStore((s) => s.coins)
  const [tab, setTab] = useState<Tab>(() => (useSessionStore.getState().nearby?.kind === 'stove' ? 'recipes' : 'items'))
  const frame = {
    title: '🎒 가방',
    subtitle: '요리는 주방 가스레인지에서 · 고기·채집물은 마을 상인에게 팔아요',
    accent: '#8d6e63',
    coins,
    tabs: [
      { id: 'items', label: '가방' },
      { id: 'recipes', label: '요리법' },
    ],
    tab,
    onTab: (id: string) => setTab(id as Tab),
  }
  return tab === 'items' ? <ItemsTab frame={frame} /> : <RecipesTab frame={frame} />
}

type Frame = Pick<Parameters<typeof Kiosk>[0], 'title' | 'subtitle' | 'accent' | 'coins' | 'tabs' | 'tab' | 'onTab'>

function ItemsTab({ frame }: { frame: Frame }) {
  const items = useProgressStore((s) => s.items)
  const snacks = useProgressStore((s) => s.snacks)
  const rows: Row[] = [...ITEM_IDS.filter((id) => items[id] > 0).map((id) => ({ id, n: items[id] })), ...SNACKS.filter((s) => snacks[s.id] > 0).map((s) => ({ id: s.id, n: snacks[s.id] }))]
  const [selected, setSelected] = useState<string | null>(null)
  const row = rows.find((r) => r.id === selected) ?? rows[0]
  const image = (id: Row['id'], size: number) => (isSnack(id) ? <ItemIcon id={id} size={size} /> : <Emoji icon={ITEMS[id].icon} size={size} />)
  const name = (id: Row['id']) => (isSnack(id) ? getSnack(id).name : ITEMS[id].name)
  const edible = (id: Row['id']): id is BagFood => isSnack(id) || isMeadowDish(id)
  return (
    <Kiosk
      {...frame}
      cards={rows.map((r) => ({ id: r.id, name: name(r.id), image: image(r.id, 56), badge: `×${r.n}`, sub: edible(r.id) ? fillText(r.id) : '재료' }))}
      selectedId={row?.id ?? null}
      onSelect={setSelected}
      empty="가방이 비어 있어요. 버섯·호박을 따거나 마을 상인에게 사 보세요"
      detail={
        row && (
          <KioskDetail
            image={image(row.id, 96)}
            title={name(row.id)}
            lines={[isSnack(row.id) ? getSnack(row.id).description : ITEMS[row.id].desc, edible(row.id) ? fillText(row.id) : '요리 재료예요', `가방에 ${row.n}개`]}
          >
            {edible(row.id) && <BigButton label="먹기" sub={fillText(row.id)} onClick={() => edible(row.id) && eatFromBagNow(row.id)} />}
          </KioskDetail>
        )
      }
    />
  )
}

function RecipesTab({ frame }: { frame: Frame }) {
  const items = useProgressStore((s) => s.items)
  const nearStove = useSessionStore((s) => s.nearby?.kind === 'stove')
  const cooking = useSessionStore((s) => s.stoveCook !== null)
  const [selected, setSelected] = useState<MeadowDishId>(RECIPES[0].id)
  const recipe: Recipe = RECIPES.find((r) => r.id === selected) ?? RECIPES[0]
  const ready = canCook(items, recipe)
  const { heal, hunger } = dishFill(recipe.result)
  return (
    <Kiosk
      {...frame}
      cards={RECIPES.map((r) => ({
        id: r.id,
        name: r.name,
        image: <Emoji icon={ITEMS[r.result].icon} size={56} />,
        sub: canCook(items, r) ? '재료가 다 있어요' : '재료가 모자라요',
        subColor: canCook(items, r) ? '#2e7d32' : '#c62828',
        price: `${r.time}초`,
        dimmed: !canCook(items, r),
      }))}
      selectedId={recipe.id}
      onSelect={(id) => setSelected(id as MeadowDishId)}
      detail={
        <KioskDetail
          image={<Emoji icon={ITEMS[recipe.result].icon} size={96} />}
          title={recipe.name}
          lines={[ITEMS[recipe.result].desc, `배고픔 +${hunger} · 체력 +${heal} · ${recipe.time}초`, ...recipe.ingredients.map((s) => ingredientText(s, ingredientHave(items, s)))]}
        >
          {nearStove ? (
            <BigButton
              label="요리하기"
              sub={cooking ? '가스레인지에서 요리하는 중이에요' : ready ? `${recipe.time}초 뒤 가방에 들어와요` : '재료가 모자라요'}
              disabled={!ready || cooking}
              onClick={() => startStoveCook(recipe.id)}
            />
          ) : (
            <p className="kiosk-note" style={{ color: ready ? '#2e7d32' : undefined }}>
              {ready ? '재료가 다 있어요. 주방 가스레인지에서 요리해요' : '재료가 모자라요'}
            </p>
          )}
        </KioskDetail>
      }
    />
  )
}
