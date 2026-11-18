import { Color, Vector3 } from 'three'
import { SKY_DAY } from '../data/meadow'

/**
 * 지금 하늘. MeadowLighting 이 매 프레임 은지 낮과 밤에 맞춰 고치고, 장면 배경과 바다 셰이더가 같은 객체를 그대로 쓴다.
 * 모듈 변수라 hook 값을 useFrame 에서 고치지 않는다 (react(immutability) 경고)
 * background: 장면 배경 (실내면 흰빛을 어둡게), sea: 바다에 비치는 바깥 하늘, sunDir: 세계 좌표 해(밤엔 달빛) 방향
 */
export const skyNow = {
  background: new Color(SKY_DAY),
  sea: new Color(SKY_DAY),
  sunDir: new Vector3(0, 18, -6).normalize(),
}
