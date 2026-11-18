import type { Group, Mesh, Object3D, Vector3 } from 'three'

/** 은지 무기 표 (총 4종 + 칼). 숫자는 우리 TS 복사본 data/guns.ts 와 같은지 테스트에서만 비교한다 */
export const WEAPONS: { id: string; name: string; type: 'gun' | 'melee'; auto?: boolean; rpm: number; mag?: number; reload?: number; pellets?: number; dmg?: number; spread?: number; aimSpread?: number; recoil?: number; aimFov?: number; zoom?: { label: string; mag: number }[] }[]

/**
 * 은지 무기 모델 (기본 도형). 총열은 -Z, 손잡이는 -Y.
 * userData.muzzle: 총구, sight: 조준할 때 화면 가운데에 올 점, eyeDist: 눈 ~ sight 거리, lens·reticle·lensRadius: 조준경 렌즈 (소총·저격총)
 */
export function buildWeaponModel(
  id: string,
  opts?: { shadows?: boolean },
): Group & { userData: { muzzle: Object3D; sight?: Vector3; eyeDist?: number; lens?: Mesh; reticle?: Mesh; lensRadius?: number; left?: Group; right?: Group } }
