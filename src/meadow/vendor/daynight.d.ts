import type { Color, DirectionalLight, HemisphereLight, Light, Vector3 } from 'three'
export class DayNight {
  constructor(lights: { sun: DirectionalLight; hemi: HemisphereLight; lamps?: Light[] })
  /** 하루 진행도 0~1 (0 = 06:00, 0.25 = 정오) */
  t: number
  day: number
  /** 0 (밤) ~ 1 (낮). update 가 정한다 */
  light: number
  /** 플레이어에서 해까지 (은지 좌표). update 가 정한다 */
  offset: Vector3
  update(dt: number, playerPos: Vector3): void
  skyFor(outdoor: boolean): { color: Color; fog: number }
}
