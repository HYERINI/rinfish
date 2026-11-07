import type { Object3D } from 'three'

/**
 * 낚시 연출끼리 주고받는 값. FishingVisuals가 단계가 바뀌는 순간을 기록하고
 * Player(낚싯대 휘두르기)가 읽는다. 시각은 clock.elapsedTime 기준, 아직 없으면 -1
 */
export const fishingFx = {
  /** 찌를 던진 시각 */
  castAt: -1,
  /** 결과(done)가 나온 시각 */
  doneAt: -1,
  /** 던지기 직전 낚싯대를 뒤로 젖힌 각도 (Player가 기록) */
  windup: 0.5,
  /** 찌 mesh (FishingVisuals 가 넣는다). 같이 하기가 보일 때 위치를 읽어 보낸다 */
  bobber: null as Object3D | null,
}
