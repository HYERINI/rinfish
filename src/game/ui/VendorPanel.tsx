import { useState } from 'react'
import { GUNS, GUN_IDS, type GunId } from '../data/guns'
import { MEADOW_VENDORS } from '../data/meadow'
import { ITEMS, ITEM_IDS, type ItemId } from '../data/meadowItems'
import { AMMO_PACKS, BUY_PRICE, VENDOR_TRADE, sellPrice, type VendorId } from '../data/meadowPrices'
import { ammoPacksThatFit } from '../logic/ammo'
import { affordableQty } from '../logic/bait'
import { stockLeft } from '../logic/meadowShop'
import { useDayStore } from '../stores/dayStore'
import { useProgressStore } from '../stores/progressStore'
import { useSessionStore } from '../stores/sessionStore'
import { BigButton, Kiosk, KioskDetail, QtyStepper } from './Kiosk'
import { useFlash } from './useFlash'

type Tab = 'sell' | 'buy'
/** 한 번에 사는 최대 수 */
const BUY_MAX = 10

function Emoji({ id, size }: { id: ItemId; size: number }) {
  return <span style={{ fontSize: size * 0.8, lineHeight: 1 }}>{ITEMS[id].icon}</span>
}

/**
 * 마을 상인 (정육점·잡화점·농산물 가게) 키오스크: 왼쪽 탭 "팔기" (내 가방에서 이 상인이 사는 것), 오른쪽 탭 "사기" (이 상인이 파는 것).
 * 누가 무엇을 사고파는지와 값은 data/meadowPrices. 잡화점 "사기" 는 탄약 묶음 (예비 탄약에 더한다)
 */
export function VendorPanel() {
  const vendorId = useSessionStore((s) => s.vendor)
  const coins = useProgressStore((s) => s.coins)
  const [tab, setTab] = useState<Tab>('sell')
  const vendor = MEADOW_VENDORS.find((v) => v.id === vendorId)
  if (!vendor) return null
  const frame = {
    title: `🛒 ${vendor.name}`,
    subtitle: vendor.greet,
    accent: '#6d8b3a',
    coins,
    tabs: [
      { id: 'sell', label: '팔기' },
      { id: 'buy', label: '사기' },
    ],
    tab,
    onTab: (id: string) => setTab(id as Tab),
  }
  if (tab === 'sell') return <SellTab key={vendor.id} frame={frame} vendor={vendor.id} />
  return vendor.id === 'general' ? <AmmoTab frame={frame} /> : <BuyTab key={vendor.id} frame={frame} vendor={vendor.id} />
}

type Frame = Pick<Parameters<typeof Kiosk>[0], 'title' | 'subtitle' | 'accent' | 'coins' | 'tabs' | 'tab' | 'onTab'>

function SellTab({ frame, vendor }: { frame: Frame; vendor: VendorId }) {
  const items = useProgressStore((s) => s.items)
  const rows = ITEM_IDS.filter((id) => items[id] > 0 && VENDOR_TRADE[vendor].buys(id))
  const [selected, setSelected] = useState<ItemId | null>(null)
  const [qty, setQty] = useState(1)
  const [toast, flash] = useFlash()
  const id = rows.find((r) => r === selected) ?? rows[0]
  const have = id ? items[id] : 0
  const n = Math.max(1, Math.min(qty, have))
  return (
    <Kiosk
      {...frame}
      cards={rows.map((r) => ({ id: r, name: ITEMS[r].name, image: <Emoji id={r} size={56} />, badge: `×${items[r]}`, price: `${sellPrice(r)} 코인` }))}
      selectedId={id ?? null}
      onSelect={(r) => {
        setSelected(r as ItemId)
        setQty(1)
      }}
      empty="이 가게에 팔 물건이 가방에 없어요"
      detail={
        id && (
          <KioskDetail image={<Emoji id={id} size={96} />} title={ITEMS[id].name} lines={[ITEMS[id].desc, `1개 ${sellPrice(id)} 코인 · 가방에 ${have}개`]}>
            <QtyStepper value={n} max={have} onChange={setQty} />
            <BigButton
              tone="sell"
              label={`${n}개 팔기`}
              sub={`+${sellPrice(id) * n} 코인`}
              onClick={() => {
                const earned = useProgressStore.getState().sellItem(vendor, id, n)
                if (earned > 0) flash(`${ITEMS[id].name} ${n}개를 팔았어요! +${earned} 코인`)
                setQty(1)
              }}
            />
          </KioskDetail>
        )
      }
      toast={toast}
    />
  )
}

function BuyTab({ frame, vendor }: { frame: Frame; vendor: VendorId }) {
  const { coins } = frame
  const items = useProgressStore((s) => s.items)
  const stock = useProgressStore((s) => s.stock)
  const day = useDayStore((s) => s.day)
  // 혼자 시계와 방 시계는 하루 수량을 따로 센다 (오가며 다시 채우지 않게)
  const src = useDayStore((s) => s.roomClock) ? 'room' : 'solo'
  const sells = VENDOR_TRADE[vendor].sells
  const [selected, setSelected] = useState<ItemId | null>(null)
  const [qty, setQty] = useState(1)
  const [toast, flash] = useFlash()
  const id = sells.find((r) => r === selected) ?? sells[0]
  const price = id ? (BUY_PRICE[id] ?? 0) : 0
  // 오늘 남은 수량 (06:00 에 다시 채운다)
  const left = (r: ItemId) => stockLeft(stock, src, day, r)
  const limit = id ? Math.min(BUY_MAX, left(id)) : 0
  const max = Math.max(1, affordableQty(coins, price, limit))
  const n = Math.min(qty, max)
  const soldOut = !!id && left(id) < n
  const stockText = (r: ItemId) => (Number.isFinite(left(r)) ? ` · 오늘 남은 수량 ${left(r)}` : '')
  return (
    <Kiosk
      {...frame}
      cards={sells.map((r) => ({ id: r, name: ITEMS[r].name, image: <Emoji id={r} size={56} />, price: `${BUY_PRICE[r]} 코인`, badge: left(r) === 0 ? '오늘 다 팔림' : items[r] > 0 ? `가방 ${items[r]}` : undefined, dimmed: coins < (BUY_PRICE[r] ?? 0) || left(r) === 0 }))}
      selectedId={id ?? null}
      onSelect={(r) => {
        setSelected(r as ItemId)
        setQty(1)
      }}
      empty="이 가게는 파는 물건이 없어요"
      detail={
        id && (
          <KioskDetail image={<Emoji id={id} size={96} />} title={ITEMS[id].name} lines={[ITEMS[id].desc, `1개 ${price} 코인 · 가방에 ${items[id]}개${stockText(id)}`]}>
            <QtyStepper value={n} max={max} onChange={setQty} />
            <BigButton
              label={`${n}개 사기`}
              sub={soldOut ? '오늘은 다 팔렸어요 (06:00 에 채워요)' : coins >= price * n ? `${price * n} 코인` : '코인이 모자라요'}
              disabled={soldOut || coins < price * n}
              onClick={() => {
                if (useProgressStore.getState().buyItem(vendor, id, n, useDayStore.getState().roomClock ? 'room' : 'solo', useDayStore.getState().day)) flash(`${ITEMS[id].name} ${n}개를 샀어요!`)
                setQty(1)
              }}
            />
          </KioskDetail>
        )
      }
      toast={toast}
    />
  )
}

function Gun({ size }: { size: number }) {
  return <span style={{ fontSize: size * 0.8, lineHeight: 1 }}>🔫</span>
}

/** 잡화점 탄약 묶음 (권총 12발 80 · 소총 30발 150 · 산탄 6발 120 · 저격 5발 250). 산 탄은 예비 탄약으로 들어가 R 로 장전한다 */
function AmmoTab({ frame }: { frame: Frame }) {
  const { coins } = frame
  const reserve = useProgressStore((s) => s.reserve)
  const [selected, setSelected] = useState<GunId>('pistol')
  const [qty, setQty] = useState(1)
  const [toast, flash] = useFlash()
  const pack = AMMO_PACKS[selected]
  // 예비 상한에 들어가는 묶음까지만 (다 찼으면 0)
  const fit = ammoPacksThatFit(reserve, selected)
  const max = Math.max(1, Math.min(fit, affordableQty(coins, pack.price, BUY_MAX)))
  const n = Math.min(qty, max)
  return (
    <Kiosk
      {...frame}
      cards={GUN_IDS.map((id) => ({ id, name: `${GUNS[id].name} 탄약`, image: <Gun size={56} />, price: `${AMMO_PACKS[id].n}발 ${AMMO_PACKS[id].price} 코인`, badge: `예비 ${reserve[id]}`, dimmed: coins < AMMO_PACKS[id].price }))}
      selectedId={selected}
      onSelect={(id) => {
        setSelected(id as GunId)
        setQty(1)
      }}
      detail={
        <KioskDetail image={<Gun size={96} />} title={`${GUNS[selected].name} 탄약`} lines={[`한 묶음 ${pack.n}발 · ${pack.price} 코인`, `예비 탄약 ${reserve[selected]}발 · 총을 들고 R 로 장전`]}>
          <QtyStepper value={n} max={max} onChange={setQty} />
          <BigButton
            label={`${n}묶음 사기`}
            sub={fit < 1 ? '예비 탄약이 가득 찼어요' : coins >= pack.price * n ? `${pack.n * n}발 · ${pack.price * n} 코인` : '코인이 모자라요'}
            disabled={fit < 1 || coins < pack.price * n}
            onClick={() => {
              if (useProgressStore.getState().buyAmmo(selected, n)) flash(`${GUNS[selected].name} 탄약 ${pack.n * n}발을 샀어요!`)
              setQty(1)
            }}
          />
        </KioskDetail>
      }
      toast={toast}
    />
  )
}
