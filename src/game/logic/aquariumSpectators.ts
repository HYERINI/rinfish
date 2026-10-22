import { SPECTATOR } from '../data/aquariumVisitors'
import { hash01 } from './aquariumVisitors'
import { lerpRange } from './rng'

/**
 * 어항 크게 보기 유리 앞을 지나가는 관람객 그림자 (순수 계산).
 * 줄(lane)마다 period 초에 한 명씩 화면 한쪽에서 들어와 걷다가, 가끔 멈춰 물고기를 보거나(look)
 * 가리키거나(point) 유리에 손을 대고(glass) 다시 반대쪽으로 나간다. 같은 시각이면 늘 같은 모습이다
 */

export type SpectatorAct = 'walk' | 'look' | 'point' | 'glass'

export type SpectatorPose = {
  visible: boolean
  /** 가로 자리 (화면 폭 비율. 0 = 왼쪽 끝, 1 = 오른쪽 끝, 밖으로 조금 나갈 수 있다) */
  x: number
  /** 걷는 방향 (1 = 오른쪽으로) */
  dir: 1 | -1
  act: SpectatorAct
  /** 걸음 위상(라디안). 다리·팔 흔들기에 쓴다. 서 있으면 0 */
  step: number
  /** 팔을 올린 정도 0~1 (가리키기·유리에 손 대기) */
  lift: number
  kid: boolean
  /** 모양 갈래 (머리 모양·가방 등) 0~3 */
  variant: number
  /** 몇 번째 관람객인지 */
  visit: number
}

/** 줄 하나의 한 바퀴 길이(초) */
export const spectatorPeriod = (lane: number) => SPECTATOR.period + lane * SPECTATOR.periodStep

/** 한 관람객의 계획 */
export type SpectatorPlan = {
  dir: 1 | -1
  kid: boolean
  variant: number
  speed: number
  /** 멈추는 자리 (화면 폭 비율). 지나가기만 하면 null */
  stopAt: number | null
  stopFor: number
  act: Exclude<SpectatorAct, 'walk'>
  /** 들어와서 멈출 때까지 / 멈춘 뒤 나갈 때까지 걷는 초 */
  walkIn: number
  walkOut: number
}

export function spectatorPlan(seed: number, lane: number, visit: number): SpectatorPlan {
  const r = (n: number) => hash01(seed + 101, lane, visit, n)
  const dir = r(1) < 0.5 ? 1 : -1
  const kid = r(2) < SPECTATOR.kidChance
  const variant = Math.floor(r(3) * 4)
  const speed = lerpRange(SPECTATOR.walkSpeed, r(4)) * (kid ? SPECTATOR.kidSpeedMul : 1)
  const passBy = r(5) < SPECTATOR.passByChance
  // 들어오는 쪽에서 본 멈출 자리. 오른쪽에서 들어오면 거꾸로 센다
  const stopFrac = lerpRange(SPECTATOR.stopRange, r(6))
  const stopAt = passBy ? null : dir === 1 ? stopFrac : 1 - stopFrac
  const stopFor = passBy ? 0 : lerpRange(SPECTATOR.stopSeconds, r(7))
  // 아이는 유리에 손을 대는 일이 많다
  const a = r(8)
  const act = kid ? (a < 0.55 ? 'glass' : a < 0.85 ? 'point' : 'look') : a < 0.4 ? 'look' : a < 0.75 ? 'point' : 'glass'
  const start = -SPECTATOR.edge
  const end = 1 + SPECTATOR.edge
  const total = (end - start) / speed
  const walkIn = stopAt === null ? total : Math.abs((dir === 1 ? stopAt - start : end - stopAt) / speed)
  return { dir, kid, variant, speed, stopAt, stopFor, act, walkIn, walkOut: total - walkIn }
}

/** 시각 time 에 lane 관람객의 모습 */
export function spectatorPose(seed: number, lane: number, time: number): SpectatorPose {
  const period = spectatorPeriod(lane)
  const shifted = time + hash01(seed + 101, lane) * period
  const visit = Math.floor(shifted / period)
  const t = shifted - visit * period
  const plan = spectatorPlan(seed, lane, visit)
  const { dir, kid, variant, speed, stopFor } = plan
  const from = dir === 1 ? -SPECTATOR.edge : 1 + SPECTATOR.edge
  const base = { dir, kid, variant, visit }
  const walking = (walked: number): SpectatorPose => ({
    ...base,
    visible: true,
    x: from + dir * walked * speed,
    act: 'walk',
    step: walked * SPECTATOR.stepRate * (kid ? 1.25 : 1),
    lift: 0,
  })

  if (t < plan.walkIn) return walking(t)
  if (t < plan.walkIn + stopFor) {
    const at = t - plan.walkIn
    const lift = plan.act === 'look' ? 0 : Math.max(0, Math.min(1, at / SPECTATOR.liftSeconds, (stopFor - at) / SPECTATOR.liftSeconds))
    return { ...base, visible: true, x: from + dir * plan.walkIn * speed, act: plan.act, step: 0, lift }
  }
  const walked = t - stopFor
  if (walked < plan.walkIn + plan.walkOut) return walking(walked)
  return { ...base, visible: false, x: from + dir * (plan.walkIn + plan.walkOut) * speed, act: 'walk', step: 0, lift: 0 }
}
