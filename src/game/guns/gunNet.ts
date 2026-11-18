import type { GunId } from '../data/guns'
import { MAX_SHOT_ID, type Vec3 } from '../logic/netProtocol'

/**
 * 남이 쏜 것 (같이 하기 shot): 궤적·불꽃·소리를 그릴 처리기. scene/guns/GunController 가 붙인다 (벽에 닿는 곳을 Rapier 로 찾는다).
 * 스토어(stores/*)는 장면을 import 하지 않아서 이 모듈로 넘긴다 (hunt/animalRig 의 hurt 처리기와 같은 방식)
 */
let shotHandler: (o: Vec3, d: Vec3, w: GunId) => void = () => {}

export function setShotHandler(f: (o: Vec3, d: Vec3, w: GunId) => void) {
  shotHandler = f
}

/** 한 발 번호 (같이 하기 animalHit·pvpHit shot): 한 발이 여럿을 맞히면 같은 번호로 보내 서버가 모두 받는다 */
let shotSeq = 0

export function newShotId(): number {
  shotSeq = (shotSeq % MAX_SHOT_ID) + 1
  return shotSeq
}

export function receiveShot(o: Vec3, d: Vec3, w: GunId) {
  shotHandler(o, d, w)
}
