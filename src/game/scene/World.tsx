import { MeadowLighting } from '../../meadow/MeadowLighting'
import { MeadowInteractions } from '../../meadow/MeadowInteractions'
import { MeadowVendors } from '../../meadow/MeadowVendors'
import { MeadowWorld } from '../../meadow/MeadowWorld'
import { NetBridge } from '../net/NetBridge'
import { Docks } from './boat/Docks'
import { DayCycle } from './day/DayCycle'
import { FishingSpots } from './facilities/FishingSpots'
import { preloadFacilityAssets } from './assets'
import { Aquarium } from './facilities/Aquarium'
import { Bench } from './facilities/Bench'
import { Clinic } from './facilities/Clinic'
import { GearShop } from './facilities/GearShop'
import { Market } from './facilities/Market'
import { Wardrobe } from './facilities/Wardrobe'
import { SellBox } from './facilities/SellBox'
import { FishingController } from './fishing/FishingController'
import { FishingEdgeWatcher } from './fishing/FishingEdgeWatcher'
import { FishingVisuals } from './fishing/FishingVisuals'
import { Island } from './Island'
import { IslandDecor } from './decor/IslandDecor'
import { IslandLanterns } from './decor/IslandLanterns'
import { Player } from './Player'
import { RemotePlayers } from './RemotePlayers'
import { PlayTimeTicker } from './PlayTimeTicker'
import { RepairCutscene } from './zones/RepairCutscene'
import { ZoneGates } from './zones/ZoneGates'

preloadFacilityAssets()

export function World() {
  return (
    <>
      {/* 빛·하늘색은 은지 것 한 벌 (meadow/MeadowLighting) */}
      <MeadowLighting />
      <MeadowWorld />
      <MeadowInteractions />
      <MeadowVendors />
      <Docks />
      <Island />
      <IslandDecor />
      <IslandLanterns />
      <ZoneGates />
      <RepairCutscene />
      <Player />
      <NetBridge />
      <RemotePlayers />
      <FishingSpots />
      <SellBox />
      <GearShop />
      <Market />
      <Clinic />
      <Bench />
      <Wardrobe />
      <Aquarium />
      <FishingEdgeWatcher />
      <FishingController />
      <FishingVisuals />
      <PlayTimeTicker />
      <DayCycle />
    </>
  )
}
