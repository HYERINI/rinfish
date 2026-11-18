import { useEffect, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import { Vector3 } from 'three'
import { MEADOW_POS, MEADOW_YAW, toMeadowLocal } from '../game/data/meadow'
import { useQualityPreset } from '../game/input/touchDevice'
import { playerRig } from '../game/scene/Player'
import { followMeadowSun, meadowRoomLamps, meadowSkyColor, meadowWorld, setMeadowShadowSize } from './meadowSingleton'

// 매 프레임 new 하지 않도록 재사용 (은지 좌표의 플레이어 위치)
const local = new Vector3()

function followPlayer() {
  const [x, z] = toMeadowLocal(playerRig.position.x, playerRig.position.z)
  local.set(x, playerRig.position.y, z)
  followMeadowSun(local)
}

/**
 * 세계 조명은 은지 것 한 벌: 해(그림자)·하늘빛·방 조명은 처음부터 여기 붙인다 (빛 개수가 첫 프레임부터 같다). 가로등은 숨겨 둔 채 은지 group 에 남는다.
 * 해와 그림자 범위(±22m)는 은지 DayNight 가 플레이어를 따라 옮긴다 (그래서 섬에서도 그림자가 생긴다)
 */
export function MeadowLighting() {
  const { sun, hemi } = meadowWorld().lights
  const { shadowMapSize } = useQualityPreset()
  const sky = useMemo(() => {
    followPlayer()
    return meadowSkyColor()
  }, [])

  // 그림자 지도 크기는 품질 설정을 따른다 (바뀌면 지도를 새로 만든다)
  useEffect(() => setMeadowShadowSize(shadowMapSize), [shadowMapSize])

  useFrame(followPlayer)

  return (
    <>
      {/* 하늘색: 은지 낮 하늘 */}
      <primitive object={sky} attach="background" />
      {/* 하늘빛은 세계 위치로 "위" 방향을 정한다. 변환 그룹 아래면 (200, 1, 0) 이라 옆을 비추므로 장면에 바로 둔다 */}
      <primitive object={hemi} />
      <group position={MEADOW_POS} rotation-y={MEADOW_YAW}>
        <primitive object={sun} />
        <primitive object={sun.target} />
        {meadowRoomLamps().map((l) => (
          <primitive key={l.uuid} object={l} />
        ))}
      </group>
    </>
  )
}
