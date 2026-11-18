import type { Object3D, Vector3 } from 'three'

/** 총알 효과 (scene/guns/GunEffects 가 붙인다): 궤적 선, 총알 자국, 총구 불꽃. 그리는 곳이 없으면(장면 밖·테스트) 아무 일도 없다 */
export type GunFx = {
  tracer(from: Vector3, to: Vector3): void
  /** 자국: parent 를 주면(사격장 표적판) 그 판에 붙어 같이 움직인다 */
  hole(point: Vector3, normal: Vector3, parent?: Object3D | null): void
  flash(at: Vector3): void
}

let current: GunFx | null = null

export function setGunFx(fx: GunFx | null) {
  current = fx
}

export const gunFx: GunFx = {
  tracer: (from, to) => current?.tracer(from, to),
  hole: (point, normal, parent) => current?.hole(point, normal, parent),
  flash: (at) => current?.flash(at),
}
