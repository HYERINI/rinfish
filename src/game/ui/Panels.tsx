import { useSessionStore } from '../stores/sessionStore'
import { DexPanel } from './DexPanel'
import { GearShopPanel } from './GearShopPanel'
import { MarketPanel } from './MarketPanel'
import { MenuPanel } from './MenuPanel'
import { SellPanel } from './SellPanel'

/** 현재 mode에 맞는 패널 하나를 띄운다 */
export function Panels({ onExit }: { onExit?: () => void }) {
  const mode = useSessionStore((s) => s.mode)
  switch (mode) {
    case 'menu':
      return <MenuPanel onExit={onExit} />
    case 'dex':
      return <DexPanel />
    case 'sell':
      return <SellPanel />
    case 'shop':
      return <GearShopPanel />
    case 'market':
      return <MarketPanel />
    default:
      return null
  }
}
