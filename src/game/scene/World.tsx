import { Suspense } from 'react'
import { MeadowLighting } from '../../meadow/MeadowLighting'
import { MeadowInteractions } from '../../meadow/MeadowInteractions'
import { RangeRunner } from '../../meadow/RangeRunner'
import { MeadowVendors } from '../../meadow/MeadowVendors'
import { MeadowWorld } from '../../meadow/MeadowWorld'
import { NetBridge } from '../net/NetBridge'
import { Animals } from './animals/Animals'
import { HerdRunner } from './animals/HerdRunner'
import { LootItems } from './animals/LootItems'
import { MeleeController } from './melee/MeleeController'
import { Mine } from './mine/Mine'
import { MineController } from './mine/MineController'
import { GunController } from './guns/GunController'
import { GunEffects } from './guns/GunEffects'
import { FirstPersonView } from './guns/FirstPersonView'
import { Docks } from './boat/Docks'
import { DayCycle } from './day/DayCycle'
import { RenderProbe } from './debug/RenderProbe'
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

/** 그리기 측정: 주소 끝에 ?probe 를 붙이면 (예: .../?probe) 화면 위에 숫자를 띄운다. 개발 모드에서는 ?probe 없이도 window.__render 는 적는다 */
const PROBE_PANEL = new URLSearchParams(window.location.search).has('probe')
const PROBE = import.meta.env.DEV || PROBE_PANEL

preloadFacilityAssets()

export function World() {
  return (
    <>
      {/* 빛·하늘색은 은지 것 한 벌 (meadow/MeadowLighting) */}
      <MeadowLighting />
      <MeadowWorld />
      <MeadowInteractions />
      <RangeRunner />
      <MeadowVendors />
      <Docks />
      <Island />
      <IslandDecor />
      <IslandLanterns />
      <ZoneGates />
      <RepairCutscene />
      <Player />
      <FirstPersonView />
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
      <HerdRunner />
      {/* 동물 모델을 받는 동안 다른 것은 먼저 그린다 */}
      <Suspense fallback={null}>
        <Animals />
      </Suspense>
      <LootItems />
      <MeleeController />
      <Mine />
      <MineController />
      <GunController />
      <GunEffects />
      <DayCycle />
      {/* 개발 모드이거나 주소에 ?probe 가 붙었을 때: 드로우 콜 수를 window.__render 에 적는다 (tools/gun-fx-check.mjs 가 읽는다) */}
      {PROBE && <RenderProbe panel={PROBE_PANEL} />}
    </>
  )
}
