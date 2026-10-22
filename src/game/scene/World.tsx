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
import { FishingVisuals } from './fishing/FishingVisuals'
import { Island } from './Island'
import { IslandDecor } from './decor/IslandDecor'
import { Player } from './Player'
import { PlayTimeTicker } from './PlayTimeTicker'
import { RepairCutscene } from './zones/RepairCutscene'
import { ZoneGates } from './zones/ZoneGates'

preloadFacilityAssets()

export function World() {
  return (
    <>
      {/* 하늘색 배경 */}
      <color attach="background" args={['#9fd8ff']} />
      <ambientLight intensity={0.6} />
      {/* 섬 전체에 그림자가 생기도록 그림자 카메라 범위를 넓힌다 */}
      <directionalLight
        position={[20, 30, 10]}
        intensity={1.6}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-40}
        shadow-camera-right={40}
        shadow-camera-top={40}
        shadow-camera-bottom={-40}
      />
      <Island />
      <IslandDecor />
      <ZoneGates />
      <RepairCutscene />
      <Player />
      <FishingSpots />
      <SellBox />
      <GearShop />
      <Market />
      <Clinic />
      <Bench />
      <Wardrobe />
      <Aquarium />
      <FishingController />
      <FishingVisuals />
      <PlayTimeTicker />
    </>
  )
}
