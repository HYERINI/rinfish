import type { RawItemId } from '../data/meadowItems'
import { NET } from '../data/net'
import { herdAt, pushHerd, type HerdSample } from '../logic/animalInterp'
import { calmHerd, herdViews, newHerd, type AnimalView, type Herd } from '../logic/animalSim'
import { dropLoot, type Loot } from '../logic/loot'

/**
 * 들판 동물과 전리품. 매 프레임 읽고 바뀌는 값이라 React 상태가 아닌 모듈 객체에 둔다 (net/remoteRig 와 같은 방식).
 * - 혼자: 내 화면이 무리(solo)를 돌린다 (scene/animals/HerdRunner). 저장하지 않는다 (은지 그대로)
 * - 같이: 서버가 보낸 목록(들판 근처 사람이 있으면 5Hz)을 쌓아 두고 다른 사람처럼 NET.interpDelay 늦게 이어 그린다
 * 전리품은 잡은 사람 화면에만 있다 (혼자든 같이든)
 */

/** 장면에 그려 둔 동물 수 (scene/animals/Animals 가 매 프레임 적는다. 헤드리스 점검이 모델이 붙었는지 본다) */
export const herdDrawn = { count: 0 }

/** 혼자 할 때 시뮬레이션 속 내 id */
export const ME = 'me'

let solo: Herd | null = null
let room: HerdSample[] = []
let loot: Loot[] = []
let lootKey = 1

/** 혼자 할 때 무리 (처음 부를 때 만든다) */
export function soloHerd(): Herd {
  solo ??= newHerd()
  return solo
}

export function setSoloHerd(h: Herd) {
  solo = h
}

/** 죽어 침대에서 깨어날 때: 나를 쫓던 동물을 진정시킨다 (같이 하기에선 실내 침대로 옮겨져 서버 동물이 포기한다) */
export function calmSolo() {
  if (solo) solo = calmHerd(solo, ME)
}

/** 서버가 보낸 동물 목록 (now: 받은 때, netNow 초) */
export function receiveAnimals(list: AnimalView[], now: number) {
  room = pushHerd(room, { at: now, list }, NET.bufferSize)
}

/** 방을 나오거나 새로 들어가면 받은 동물을 지운다 */
export function forgetRoomAnimals() {
  room = []
}

/** 그릴(그리고 때릴) 동물. online: 같이 하는 중 (받은 목록을 늦게 이어 그린다), now: netNow 초 */
export function animalViews(online: boolean, now: number): AnimalView[] {
  if (online) return herdAt(room, now - NET.interpDelay)
  return solo ? herdViews(solo) : []
}

/** 전리품을 떨어뜨린다 (now: netNow 초. 쓰러진 동물이 사라질 때 보인다) */
export function spawnLoot(items: readonly RawItemId[], x: number, z: number, now: number) {
  const drops = dropLoot(items, x, z, now, lootKey)
  lootKey += drops.length
  loot = [...loot, ...drops]
}

export function lootList(): readonly Loot[] {
  return loot
}

/** 줍기: 목록에서 빼고 돌려준다 (이미 없으면 null) */
export function takeLoot(key: number): Loot | null {
  const l = loot.find((x) => x.key === key) ?? null
  if (l) loot = loot.filter((x) => x !== l)
  return l
}

/** 맞았을 때 할 일 (scene/animals/HerdRunner 가 붙인다: 체력을 깎고 죽음). 서버 hurt 와 혼자 시뮬레이션이 같이 쓴다 */
let hurtHandler: (dmg: number) => void = () => {}
export function setHurtHandler(f: (dmg: number) => void) {
  hurtHandler = f
}
export function receiveHurt(dmg: number) {
  hurtHandler(dmg)
}

/** 테스트용: 다 지운다 */
export function resetAnimalRig() {
  solo = null
  room = []
  loot = []
  lootKey = 1
  hurtHandler = () => {}
}
