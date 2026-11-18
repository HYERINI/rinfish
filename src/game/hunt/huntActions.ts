import { speciesOf } from '../data/animals'
import { GUNS, type GunId } from '../data/guns'
import { ITEMS, rollDrops } from '../data/meadowItems'
import { MELEE, type MeleeId } from '../data/melee'
import { hitAnimal } from '../logic/animalSim'
import { netNow } from '../net/remoteRig'
import { useNetStore } from '../stores/netStore'
import { useProgressStore } from '../stores/progressStore'
import { useSessionStore } from '../stores/sessionStore'
import { ME, setSoloHerd, soloHerd, spawnLoot, takeLoot } from './animalRig'

/**
 * 내 휘두르기가 동물 id 에 맞았다. 같이 하면 서버에 알린다 (서버가 검사·체력·전리품). 혼자면 바로 때리고, 쓰러뜨리면 전리품을 떨어뜨린다
 */
export function strikeAnimal(id: number, kind: MeleeId) {
  const net = useNetStore.getState()
  if (net.phase !== 'off') {
    net.sendAnimalHit(id, MELEE[kind].dmg, kind)
    return
  }
  hitSolo(id, MELEE[kind].dmg)
}

/**
 * 내 총알 n 알(산탄총은 여러 알)이 동물 id 에 맞았다. 알마다 은지 피해(저격 3, 나머지 1).
 * 같이 하면 서버에 알리고 (서버가 검사·체력·전리품. shot: 한 발 번호), 혼자면 바로 때린다
 */
export function shootAnimal(id: number, gun: GunId, n: number, shot?: number) {
  const net = useNetStore.getState()
  if (net.phase !== 'off') {
    net.sendAnimalHit(id, GUNS[gun].dmg * n, gun, n, shot)
    return
  }
  hitSolo(id, GUNS[gun].dmg * n)
}

/** 혼자 할 때 때리기: 쓰러뜨리면 전리품 */
function hitSolo(id: number, dmg: number) {
  const r = hitAnimal(soloHerd(), id, dmg, ME)
  setSoloHerd(r.herd)
  if (r.result !== 'killed' || !r.animal) return
  spawnLoot(rollDrops(r.animal.sp), r.animal.x, r.animal.z, netNow())
  useSessionStore.getState().notify(`${speciesOf(r.animal.sp).name} 사냥 성공! 재료를 떨어뜨렸어요 (E 로 줍기)`)
}

/** E 로 전리품 줍기 → 가방 (은지 그대로 "🥩 소고기 획득 (3개)") */
export function pickLoot(key: number) {
  const l = takeLoot(key)
  if (!l) return
  const progress = useProgressStore.getState()
  progress.addItem(l.item)
  const { icon, name } = ITEMS[l.item]
  const session = useSessionStore.getState()
  session.clearNearby({ kind: 'loot', key, item: l.item })
  session.notify(`${icon} ${name} 획득 (${useProgressStore.getState().items[l.item]}개)`)
}
