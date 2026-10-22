import { CAVE_ROCK, HAMMER_TIMING, PUSH_TIMING, type RepairPlan, type Vec2 } from '../data/repair'

/** 기사님·요리사 자세. fix = 무릎 꿇고 망치질, push = 바위 밀기, cheer = 다 끝나고 신나서 수다, chop = 서서 칼질 */
export type WorkerPose = 'walk' | 'fix' | 'push' | 'cheer' | 'idle' | 'chop'

export type WorkerFrame = {
  x: number
  z: number
  /** 바라보는 각도 (0 = +z, Player 와 같은 기준) */
  facing: number
  pose: WorkerPose
  /** 머리 위 말풍선 */
  bubble: string | null
  /** 망치질 중: 한 번 내리치는 동안 0 → 1 (1 에서 쾅). 망치질이 아니면 null */
  swing: number | null
  /** 지금까지 내리친 횟수. 늘어날 때 먼지·"쾅" 을 띄운다 */
  strikes: number
}

export type RepairPhase = 'arrive' | 'work' | 'done' | 'leave' | 'end'

export type RepairFrame = {
  phase: RepairPhase
  /** 고친 모습(다리·보트)으로 바뀌었나 / 바위를 다 치웠나 */
  fixed: boolean
  /** 바위를 치운 정도 0 → 1 (push). hammer 는 고치면 1 */
  progress: number
  /** 바위 가운데 [x, z]와 굴러간 각도(라디안) (push). hammer 에선 site 그대로, 0 */
  rock: { x: number; z: number; roll: number }
  workers: WorkerFrame[]
}

/** 연출 전체 길이(초) */
export function repairDuration(kind: RepairPlan['kind']): number {
  if (kind === 'hammer') return HAMMER_TIMING.arrive + HAMMER_TIMING.work + HAMMER_TIMING.done + HAMMER_TIMING.leave
  return PUSH_TIMING.arrive + PUSH_TIMING.brace + PUSH_TIMING.push + PUSH_TIMING.done + PUSH_TIMING.leave
}

const clamp01 = (v: number) => Math.min(1, Math.max(0, v))
/** 천천히 시작해서 천천히 멈춘다 */
const ease = (v: number) => {
  const k = clamp01(v)
  return k * k * (3 - 2 * k)
}
const lerp2 = (a: Vec2, b: Vec2, k: number): Vec2 => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k]
/** a 에서 b 를 보는 각도 */
const heading = (a: Vec2, b: Vec2) => Math.atan2(b[0] - a[0], b[1] - a[1])

/** 걷기 구간 한 칸: from → to 를 k(0~1)만큼, to 쪽을 보며 */
function walking(from: Vec2, to: Vec2, k: number): Pick<WorkerFrame, 'x' | 'z' | 'facing' | 'pose'> {
  const [x, z] = lerp2(from, to, ease(k))
  return { x, z, facing: heading(from, to), pose: 'walk' }
}

const idle = { bubble: null, swing: null, strikes: 0 }

/**
 * 연출 시각 t(초) → 그 순간의 모습. 같은 t 면 늘 같은 결과라서, 시작 시각만 알면 어디서든 다시 그릴 수 있다.
 * t 가 전체 길이를 넘으면 phase 'end' (기사님은 from 자리, 다 고친 모습)
 */
export function repairTimeline(plan: RepairPlan, t: number): RepairFrame {
  return plan.kind === 'hammer' ? hammerFrame(plan, t) : pushFrame(plan, t)
}

function hammerFrame(plan: RepairPlan, t: number): RepairFrame {
  const T = HAMMER_TIMING
  const workEnd = T.arrive + T.work
  const doneEnd = workEnd + T.done
  const leaveEnd = doneEnd + T.leave
  const fixed = t >= T.arrive + T.fixAt
  const phase: RepairPhase = t < T.arrive ? 'arrive' : t < workEnd ? 'work' : t < doneEnd ? 'done' : t < leaveEnd ? 'leave' : 'end'
  const workers = plan.workers.map(({ from, work = plan.site }, i): WorkerFrame => {
    const face = heading(work, plan.site)
    switch (phase) {
      case 'arrive':
        return { ...walking(from, work, t / T.arrive), ...idle }
      case 'work': {
        // 두 분이 번갈아 내리친다 (반 박자 엇갈림)
        const beats = (t - T.arrive) / T.hitPeriod + i * 0.5
        const bubble = i === 0 && !fixed ? '뚝딱뚝딱!' : i === 1 && fixed ? '거의 다 됐어요!' : null
        return { x: work[0], z: work[1], facing: face, pose: 'fix', bubble, swing: beats % 1, strikes: Math.floor(beats) }
      }
      case 'done':
        return { x: work[0], z: work[1], facing: face, pose: 'cheer', bubble: i === 0 ? '다 고쳤어요!' : '튼튼해요!', swing: null, strikes: 0 }
      case 'leave':
        return { ...walking(work, from, (t - doneEnd) / T.leave), ...idle }
      case 'end':
        return { x: from[0], z: from[1], facing: heading(work, from), pose: 'walk', ...idle }
    }
  })
  return { phase, fixed, progress: fixed ? 1 : 0, rock: { x: plan.site[0], z: plan.site[1], roll: 0 }, workers }
}

/** 바위 미는 자리: 바위 가운데에서 미는 방향 반대쪽으로 반지름 + 틈만큼, 둘이 옆으로 벌려 선다 */
function pushSpots(plan: RepairPlan, rock: Vec2): Vec2[] {
  const to = plan.rockTo ?? plan.site
  const len = Math.hypot(to[0] - plan.site[0], to[1] - plan.site[1]) || 1
  const d: Vec2 = [(to[0] - plan.site[0]) / len, (to[1] - plan.site[1]) / len]
  const back = CAVE_ROCK.radius + CAVE_ROCK.pushGap
  return plan.workers.map((_, i) => {
    const side = (i - (plan.workers.length - 1) / 2) * 2 * CAVE_ROCK.pushSpread
    return [rock[0] - d[0] * back + d[1] * side, rock[1] - d[1] * back - d[0] * side]
  })
}

function pushFrame(plan: RepairPlan, t: number): RepairFrame {
  const T = PUSH_TIMING
  const braceEnd = T.arrive + T.brace
  const pushEnd = braceEnd + T.push
  const doneEnd = pushEnd + T.done
  const leaveEnd = doneEnd + T.leave
  const to = plan.rockTo ?? plan.site
  const progress = ease((t - braceEnd) / T.push)
  const rockAt = lerp2(plan.site, to, progress)
  const rolled = Math.hypot(rockAt[0] - plan.site[0], rockAt[1] - plan.site[1]) / CAVE_ROCK.radius
  const phase: RepairPhase = t < braceEnd ? 'arrive' : t < pushEnd ? 'work' : t < doneEnd ? 'done' : t < leaveEnd ? 'leave' : 'end'
  // 'arrive' 는 걸어오기 + 자세 잡기(brace). 걸어오는 동안만 걷기 자세다
  const startSpots = pushSpots(plan, plan.site)
  const nowSpots = pushSpots(plan, rockAt)
  const pushFacing = heading(plan.site, to)
  const heave = Math.floor(Math.max(0, t - braceEnd) / T.heavePeriod)
  const workers = plan.workers.map(({ from }, i): WorkerFrame => {
    if (t < T.arrive) return { ...walking(from, startSpots[i], t / T.arrive), ...idle }
    switch (phase) {
      case 'arrive':
        // 바위에 손을 대고 "하나, 둘, 셋!"
        return { x: startSpots[i][0], z: startSpots[i][1], facing: pushFacing, pose: 'push', bubble: i === 0 ? '하나, 둘, 셋!' : null, swing: null, strikes: 0 }
      case 'work':
        // 둘이 번갈아 "영차!"
        return { x: nowSpots[i][0], z: nowSpots[i][1], facing: pushFacing, pose: 'push', bubble: heave % 2 === i ? '영차!' : null, swing: null, strikes: heave }
      case 'done':
        return { x: nowSpots[i][0], z: nowSpots[i][1], facing: pushFacing, pose: 'cheer', bubble: i === 0 ? '휴~ 다 치웠다!' : '길이 열렸어요!', swing: null, strikes: 0 }
      case 'leave':
        return { ...walking(nowSpots[i], from, (t - doneEnd) / T.leave), ...idle }
      default:
        return { x: from[0], z: from[1], facing: heading(nowSpots[i], from), pose: 'walk', ...idle }
    }
  })
  return { phase, fixed: t >= pushEnd, progress, rock: { x: rockAt[0], z: rockAt[1], roll: rolled }, workers }
}
