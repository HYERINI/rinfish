import { BED_WAKE } from '../../data/meadow'
import { calmSolo } from '../../hunt/animalRig'
import { nextMorning } from '../../logic/dayClock'
import { seqEnd, seqSwitchAt, type SeqKind } from '../../logic/restSeq'
import { liveClock, useDayStore } from '../../stores/dayStore'
import { useFishingStore } from '../../stores/fishingStore'
import { useNetStore } from '../../stores/netStore'
import { useProgressStore } from '../../stores/progressStore'
import { useSessionStore } from '../../stores/sessionStore'

/** 같이 하기 눕기·일어나기 사이 최소 간격 (초). 서버는 sleep 을 초당 4번까지 센다 */
export const SLEEP_TOGGLE_GAP = 0.3
/** 마지막으로 눕기·일어나기를 보낸 때 (performance.now() 초) */
let lastToggle = -Infinity

const perfNow = () => performance.now() / 1000

/** 너무 빨리 또 눕거나 일어나면 무시한다 (now: performance.now() 초). 시각이 뒤로 가면(테스트) 새로 센다 */
function toggleTooSoon(now: number): boolean {
  if (now - lastToggle >= SLEEP_TOGGLE_GAP || now < lastToggle) {
    lastToggle = now
    return false
  }
  return true
}

/** 침대에서 E. 혼자면 화면이 어두워졌다 다음 날 아침, 같이 하면 잠 투표 (누워서 아침을 기다린다) */
export function startSleep(now = perfNow()) {
  const day = useDayStore.getState()
  const session = useSessionStore.getState()
  if (day.seq || day.voting) return
  const phase = useNetStore.getState().phase
  if (phase === 'online') {
    if (toggleTooSoon(now)) return
    day.setVoting(true)
    useNetStore.getState().sendSleep(true)
    session.setMode('sleep')
    return
  }
  // 다시 붙는 중: 방 시계라 혼자 자면 안 되고, 투표도 보낼 수 없다
  if (day.roomClock) {
    session.notify('연결이 끊겨 지금은 잘 수 없어요')
    return
  }
  day.startSeq('sleep')
  session.setMode('sleep')
}

/** 잠 투표를 그만두고 일어난다 (일어나기 버튼·E·ESC). 화면이 어두워지는 중엔 아무 일도 없다 */
export function wake(now = perfNow()) {
  const day = useDayStore.getState()
  if (!day.voting || day.seq) return
  if (toggleTooSoon(now)) return
  day.setVoting(false)
  useNetStore.getState().sendSleep(false)
  const session = useSessionStore.getState()
  if (session.mode === 'sleep') session.setMode('explore')
}

/**
 * 죽음 (굶주림, 3-3·3-4 의 동물·PvP). 화면이 1.6초 어두워진 뒤 침대 옆에서 깨어난다.
 * 낚시 중이면 그만두고, 잠 투표 중이면 깬 것으로 알린다. 배 타는 중이면 깨어날 때 순간이동이 배를 끝낸다
 */
export function startDeath() {
  const day = useDayStore.getState()
  if (day.seq?.kind === 'death') return
  if (day.voting) {
    day.setVoting(false)
    useNetStore.getState().sendSleep(false)
  }
  useFishingStore.getState().end()
  // 혼자: 나를 쫓던 동물이 진정한다 (같이: 침대가 실내라 서버 동물이 포기한다)
  calmSolo()
  day.startSeq('death')
  const session = useSessionStore.getState()
  session.setMode('sleep')
  session.notify('쓰러졌어요… 침대에서 깨어납니다')
}

/**
 * 동물(3-3)·PvP(3-4) 에게 맞았다: 체력을 깎고 화면 가장자리를 번쩍인다. 0 이 되면 죽음 (침대).
 * 잠·죽음으로 화면이 어두워지는 중엔 맞지 않는다 (은지 그대로). 피해가 0 이하·숫자가 아니면 아무것도 하지 않는다
 */
export function takeHit(dmg: number) {
  if (!(dmg > 0) || useDayStore.getState().seq) return
  const died = useProgressStore.getState().hurt(dmg)
  useSessionStore.getState().flashHurt()
  if (died) startDeath()
}

/** 다 어두워진 순간: 자고 일어나기 / 침대에서 깨어나기. 같이 하는 중엔 시계가 방 것이라 건드리지 않는다 */
function atDark(kind: SeqKind) {
  // 방 아침은 시계를 방이 이미 옮겼다. 어두워지는 중에 방을 나왔어도 혼자 시계를 하루 옮기지 않는다
  if (kind === 'morning') return
  const day = useDayStore.getState()
  const progress = useProgressStore.getState()
  const session = useSessionStore.getState()
  const morning = day.roomClock ? null : nextMorning(liveClock)
  if (morning) day.setSoloClock(morning)
  if (kind === 'sleep') {
    progress.sleepWell(morning)
    session.notify(`잘 잤어요. ${morning?.day ?? liveClock.day}일차 아침, 체력 회복!`)
  } else if (kind === 'death') {
    progress.reviveAtBed(morning)
    session.requestTeleport(BED_WAKE)
    session.notify(morning ? `${morning.day}일차 아침, 침대에서 깨어났어요. 가방은 그대로예요` : '침대에서 깨어났어요. 가방은 그대로예요')
  }
}

/** 매 프레임 (now: performance.now() 초). 다 어두워지면 잠·깨어나기를 하고, 다 밝아지면 끝내고 탐험으로 */
export function stepRest(now: number) {
  const day = useDayStore.getState()
  const seq = day.seq
  if (!seq) return
  const t = now - seq.startedAt
  if (!seq.switched && t >= seqSwitchAt(seq.kind)) {
    day.markSeqSwitched()
    atDark(seq.kind)
  }
  if (t < seqEnd(seq.kind)) return
  day.endSeq()
  const session = useSessionStore.getState()
  if (seq.kind !== 'morning' && session.mode === 'sleep' && !useDayStore.getState().voting) session.setMode('explore')
}
