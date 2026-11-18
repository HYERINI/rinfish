import { Vector3, type Group, type Mesh } from 'three'
import { buildWeaponModel } from '../../../meadow/vendor/weapons.js'
import { VIEW_MODEL } from '../../data/guns'
import type { ToolId } from '../../data/tools'

/** 1인칭에 붙이는 무기 (주먹은 은지 맨손 모델). 낚싯대·빈손은 없다 */
export type ViewTool = Exclude<ToolId, 'rod'>

/** 1인칭 무기 모델 (은지 buildView): 그림자 없이, 벽에 파묻혀도 위에 그린다 */
export function buildViewModel(id: ViewTool): Group {
  const g = buildWeaponModel(id, { shadows: false })
  g.traverse((o) => {
    o.frustumCulled = false
    if ((o as Mesh).isMesh) o.renderOrder = 10
  })
  return g
}

/**
 * 카메라 기준 무기 자리 (은지 animateView). 총은 허리 → 조준하면 가늠쇠(sight)가 화면 가운데 (눈 앞 eyeDist), 칼·주먹은 제자리
 */
export function viewModelRest(id: ViewTool, aiming: boolean, ud: { sight?: Vector3; eyeDist?: number }, out: Vector3): Vector3 {
  if (id === 'fists') return out.fromArray(VIEW_MODEL.fists)
  if (id === 'knife') return out.fromArray(VIEW_MODEL.knife)
  if (aiming && ud.sight && ud.eyeDist !== undefined) return out.set(-ud.sight.x, -ud.sight.y, -ud.eyeDist - ud.sight.z)
  return out.fromArray(VIEW_MODEL.hip)
}
