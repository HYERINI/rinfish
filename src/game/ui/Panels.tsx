import type { HubHint } from '../Game'
import { useProgressStore } from '../stores/progressStore'
import { useSessionStore } from '../stores/sessionStore'
import { AquariumPanel } from './AquariumPanel'
import { AquariumView } from './AquariumView'
import { CharacterCreator } from './CharacterCreator'
import { DexPanel } from './DexPanel'
import { GearShopPanel } from './GearShopPanel'
import { Lobby } from './Lobby'
import { MarketPanel } from './MarketPanel'
import { MenuPanel } from './MenuPanel'
import { SellPanel } from './SellPanel'
import { UnlockPanel } from './UnlockPanel'

/** 현재 mode에 맞는 패널 하나를 띄운다 */
export function Panels({ onExit, hub }: { onExit?: () => void; hub?: HubHint }) {
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
    case 'aquariumView':
      return <AquariumView />
    case 'unlock':
      return <UnlockPanel />
    case 'lobby':
      return <Lobby onExit={onExit} hub={hub} />
    case 'wardrobe':
      return <CharacterCreator firstTime={!look} />
    default:
      return null
  }
}
