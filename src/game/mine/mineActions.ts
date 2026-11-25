import { ITEMS } from '../data/meadowItems'
import { MINE_ARRIVE_Y, MINE_ENTRANCE, MINE_EXIT, ORES, ORE_NODES } from '../data/mine'
import { hitOre } from '../logic/mining'
import { useProgressStore } from '../stores/progressStore'
import { useSessionStore } from '../stores/sessionStore'
import { mineRig } from './mineRig'

/** 입구의 빛나는 자리에서 E: 광산 안으로 */
export function enterMine() {
  const session = useSessionStore.getState()
  session.clearNearby({ kind: 'mineEntrance' })
  session.requestTeleport([MINE_EXIT.arrive[0], MINE_EXIT.arrive[1], MINE_ARRIVE_Y])
  session.notify('⛏️ 광산에 들어왔어요 · 8번 곡괭이를 들고 광맥을 클릭하거나 E 로 캐요')
}

/** 광산 안의 빛나는 자리에서 E: 입구 앞으로 */
export function leaveMine() {
  const session = useSessionStore.getState()
  session.clearNearby({ kind: 'mineExit' })
  session.requestTeleport(MINE_ENTRANCE.out)
}

/** 광맥 앞에서 E: 곡괭이를 들고(다른 걸 들고 있었으면 바꾼다) 그 광맥을 한 번 내려친다. 실제 휘두르기는 MineController 가 다음 프레임에 */
export function requestPick(index: number) {
  const session = useSessionStore.getState()
  if (session.tool !== 'pickaxe') session.equip('pickaxe')
  mineRig.want = index
}

/**
 * 곡괭이가 광맥에 꽂혔다 (now: performance.now() 초). 다 캤으면 광석을 가방에 넣고 알린다.
 * 캤으면 true (소리는 부르는 쪽이)
 */
export function strikeOre(index: number, now: number): boolean {
  const spot = ORE_NODES[index]
  const state = mineRig.nodes[index]
  if (!spot || !state || state.left <= 0) return false
  const r = hitOre(state, spot.ore, now)
  mineRig.nodes = mineRig.nodes.map((s, i) => (i === index ? r.state : s))
  if (r.mined) {
    const n = ORES[spot.ore].n
    useProgressStore.getState().addItem(spot.ore, n)
    const { icon, name } = ITEMS[spot.ore]
    useSessionStore.getState().notify(`${icon} ${name} +${n} (가방 ${useProgressStore.getState().items[spot.ore]}개)`)
  }
  return true
}
