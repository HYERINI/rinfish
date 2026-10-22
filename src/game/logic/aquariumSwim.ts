/** 먹이를 준 뒤 물고기들이 수면으로 몰려드는 시간(초) */
export const FEEDING_SHOW_SECONDS = 5

/** 어항 바닥 두께 */
export const TANK_FLOOR = 0.12

/** 수조 가운데 기준 바닥 윗면 높이 (h: 수조 높이) */
export const tankFloorY = (h: number) => -h / 2 + TANK_FLOOR

export type SwimPose = { x: number; y: number; z: number; heading: number; tilt: number }

/** 황금비의 소수 부분. 정수에 곱해 소수 부분만 남기면 0~1 사이에 고르게 흩어진다 (피보나치 해싱) */
const GOLDEN = 0.6180339887498949

/**
 * 물고기 id 로 헤엄 경로를 정하는 값(0 이상 1 미만). 전시 순서(index)가 아니라 id 로 정하므로
 * 다른 물고기를 빼도 경로가 갑자기 바뀌지 않는다. id 를 FNV-1a 로 정수로 바꾼 뒤 황금비를 곱해 고르게 흩는다
 */
export function swimSeed(id: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i)
    h = Math.imul(h, 0x01000193) >>> 0
  }
  const k = h * GOLDEN
  return k - Math.floor(k)
}

/** seed 에서 서로 다른 0~1 값을 여러 개 뽑는다 (같은 seed 면 늘 같은 값). seed 가 조금만 달라도 값이 크게 달라지게 정수 해시로 섞는다 */
function seedPart(seed: number, n: number): number {
  let h = Math.floor(seed * 4294967296) ^ Math.imul(n, 0x9e3779b9)
  h = Math.imul(h ^ (h >>> 16), 0x85ebca6b)
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35)
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296
}

/**
 * 어항 안 8자 헤엄 경로.
 * half: 헤엄 범위의 절반 크기 [x, y, z], seed: swimSeed(id) 값 (물고기마다 다른 경로),
 * hungry: 바닥에 가라앉아 옆으로 눕는다, sinceFed: 먹이 준 뒤 지난 초 (짧으면 수면으로 몰려든다),
 * restY: 배고플 때 가라앉는 높이 (바닥 + 몸 두께의 절반 + 여유. 없으면 범위 아래쪽)
 */
export function swimPose(
  time: number,
  seed: number,
  half: [number, number, number],
  hungry: boolean,
  sinceFed: number,
  restY = -half[1] * 0.8,
): SwimPose {
  const [hx, hy, hz] = half
  // 물고기마다 속도·폭·앞뒤 줄(lane)·8자 모양을 조금씩 다르게 해서 둘이 같은 길을 겹쳐 돌지 않게 한다
  const speed = (0.32 + 0.32 * seedPart(seed, 1)) * (hungry ? 0.3 : 1)
  const ax = 0.6 + 0.3 * seedPart(seed, 2) // x 폭 (half 대비)
  const lane = (seedPart(seed, 3) - 0.5) * 0.9 // 앞뒤 줄 가운데 (−0.45~0.45)
  const az = 0.95 - Math.abs(lane) - 0.1 * seedPart(seed, 4) // z 폭: 줄 + 폭이 0.95 를 넘지 않게
  const twist = seedPart(seed, 5) * Math.PI * 2 // 8자의 z 위상
  const t = time * speed + seedPart(seed, 0) * Math.PI * 2

  let x = Math.sin(t) * hx * ax
  let z = (lane + Math.sin(2 * t + twist) * az * 0.5) * hz
  // 위아래는 x·z 와 따로 도는 느린 물결이라, 앞뒤 경로가 비슷한 두 마리도 높이가 갈린다
  let y = Math.sin(time * (0.2 + 0.25 * seedPart(seed, 7)) + seedPart(seed, 8) * Math.PI * 2) * hy * 0.55
  // 진행 방향 = 위치를 t 로 미분한 값. sin(2t) 의 미분은 2·cos(2t) 라서 z 쪽에 2 가 붙는다 (머리 +z)
  let heading = Math.atan2(Math.cos(t) * hx * ax, 2 * Math.cos(2 * t + twist) * az * 0.5 * hz)

  if (hungry) y = restY
  if (sinceFed < FEEDING_SHOW_SECONDS) {
    // 수면 가까이 물고기마다 다른 자리(고리 위)에 모여서 천천히 맴돈다
    const angle = seed * Math.PI * 2 + time * 0.4
    const radius = 0.3 + 0.45 * seedPart(seed, 6)
    x = Math.cos(angle) * hx * radius
    z = Math.sin(angle) * hz * radius * 1.2
    y = hy * (0.68 + 0.14 * seedPart(seed, 9) + 0.06 * Math.sin(time * 3 + seed * 20))
    // 고리를 따라 도는 방향 (x, z 를 angle 로 미분)
    heading = Math.atan2(-Math.sin(angle) * hx, Math.cos(angle) * hz * 1.2)
  }
  return { x, y, z, heading, tilt: hungry ? Math.PI / 2 : 0 }
}
