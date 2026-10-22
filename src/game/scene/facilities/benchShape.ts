import type { SeatShape } from '../PlayerModel'

/** 벤치(holiday-kit bench.glb, 원래 높이 0.7305)를 키울 높이. 앉는 판이 예전 벤치와 비슷한 높이(약 0.45)가 된다 */
export const BENCH_HEIGHT = 1
const SCALE = BENCH_HEIGHT / 0.7305

/**
 * 앉는 자리 기준점(FACILITY.bench = BENCH_SEAT.position = 벤치 원점, 바닥 y=0, 바다(+z)를 보는 방향)에서 잰 벤치 모양.
 * bench.glb 꼭짓점에서 읽었다 (원래 크기):
 * - 앉는 판 윗면 y 0.3295 (z -0.112 ~ 0.247)
 * - 등받이는 뒤로 기운 판 세 장이고, 맨 아래 판 앞 모서리가 y 0.396 에서 z -0.076 (엉덩이 높이의 등받이 앞면)
 */
export const BENCH_SEAT_SHAPE: SeatShape = { surfaceY: 0.3295 * SCALE, backrestZ: -0.076 * SCALE }
