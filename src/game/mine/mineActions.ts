import { ITEMS } from '../data/meadowItems'
import { MINE_ARRIVE_Y, MINE_ENTRANCE, MINE_EXIT, MINE_WALLS, ORES, ORE_NODES } from '../data/mine'
import { hitOre, wallStage, type WallStage } from '../logic/mining'
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
    const progress = useProgressStore.getState()
    progress.addItem(spot.ore, n)
    // 캔 수를 센다: 금 간 벽의 need 를 막 넘겼으면 금이 갔다고 알린다
    const before = progress.oreMined
    const after = progress.countOreMined()
    const cracked = MINE_WALLS.some((w, i) => before < w.need && after >= w.need && !progress.mineWalls[i])
    const { icon, name } = ITEMS[spot.ore]
    useSessionStore.getState().notify(cracked ? `${icon} ${name} +${n} · 쩌적! 동쪽 벽에 금이 갔어요. 곡괭이로 부숴 봐요` : `${icon} ${name} +${n} (가방 ${useProgressStore.getState().items[spot.ore]}개)`)
  }
  return true
}

/** 금 간 벽의 지금 상태 (멀쩡함·금이 감·무너짐) */
export function mineWallStage(index: number): WallStage {
  const w = MINE_WALLS[index]
  const p = useProgressStore.getState()
  return w ? wallStage(p.oreMined, w.need, p.mineWalls[index] === true) : 'solid'
}

/** 금 간 벽 앞에서 E: 곡괭이를 들고 그 벽을 한 번 내려친다 (requestPick 과 같다) */
export function requestPickWall(index: number) {
  const session = useSessionStore.getState()
  if (session.tool !== 'pickaxe') session.equip('pickaxe')
  mineRig.want = { wall: index }
}

/**
 * 곡괭이가 금 간 벽에 꽂혔다. 남은 수를 줄이고, 다 쳤으면 무너뜨려 통로를 연다 (저장).
 * 쳤으면 true (금이 안 갔거나 이미 무너졌으면 false)
 */
export function strikeWall(index: number): boolean {
  if (mineWallStage(index) !== 'cracked') return false
  const left = (mineRig.walls[index] ?? 0) - 1
  mineRig.walls[index] = left
  if (left > 0) return true
  useProgressStore.getState().openMineWall(index)
  useSessionStore.getState().notify('💥 벽이 무너졌어요! 깊은 굴이 열렸어요 · 귀한 광석이 많아요')
  return true
}
