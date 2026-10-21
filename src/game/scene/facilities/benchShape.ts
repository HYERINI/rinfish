import type { SeatShape } from '../PlayerModel'

/**
 * 앉는 자리 기준점(FACILITY.bench = BENCH_SEAT.position, 바닥 y=0, 바다(+z)를 보는 방향)에서 잰 벤치 모양.
 * Bench 가 놓는 bench.glb(높이 0.9로 키우고 CENTER_SHIFT 만큼 옮김)의 꼭짓점에서 읽었다:
 * 앉는 판 윗면 y 0.46, 등받이는 z -0.19 ~ -0.115 라서 앞면이 -0.115
 */
export const BENCH_SEAT_SHAPE: SeatShape = { surfaceY: 0.46, backrestZ: -0.115 }
