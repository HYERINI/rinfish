import { useProgressStore } from '../stores/progressStore'
import { useSessionStore } from '../stores/sessionStore'
import { AquariumPanel } from './AquariumPanel'
import { CharacterCreator } from './CharacterCreator'
import { DexPanel } from './DexPanel'
import { GearShopPanel } from './GearShopPanel'
import { MarketPanel } from './MarketPanel'
import { MenuPanel } from './MenuPanel'
import { SellPanel } from './SellPanel'

/** 현재 mode에 맞는 패널 하나를 띄운다 */
export function Panels({ onExit }: { onExit?: () => void }) {
  const mode = useSessionStore((s) => s.mode)
  const look = useProgressStore((s) => s.look)
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
    case 'aquarium':
      return <AquariumPanel />
    case 'wardrobe':
      return <CharacterCreator firstTime={!look} />
    default:
      return null
  }
}
