import type { Group, Mesh, Vector3 } from 'three'
import type { EunjiRoom } from './world.js'

export const RANGE_ROOM: EunjiRoom
/** 연습 게임 시간 (초) */
export const GAME_TIME: number

/** 표적 하나 (레인 1~3). pivot 이 넘어지고 좌우로 움직인다. board: 과녁판 (총알 자국을 붙인다) */
export type EunjiTarget = { lane: number; pivot: Group; board: Mesh; down: boolean; timer: number; homeZ: number; phase: number }

/** 연습 게임: idle → countdown(3초) → running(60초) → over */
export type EunjiRangeGame = { state: 'idle' | 'countdown' | 'running' | 'over'; total: number; time: number; score: number; hits: number; shots: number; best: number; isBest: boolean; lastBeep: number }

export type EunjiRange = {
  targets: EunjiTarget[]
  /** 무기 선반 (E 기준점, 은지 좌표) */
  rack: { center: Vector3; label: string }
  /** 표적 명중: 링 점수 1~10 (넘어져 있으면 0) */
  hit(target: EunjiTarget, point: Vector3, meleeScore?: number): number
  update(dt: number): void
  game: EunjiRangeGame
  startGame(): void
  stopGame(): void
  dismissGame(): void
  onShot(): void
  onHit(score: number): void
}

export function buildRange(ctx: { group: Group; std: unknown; box: unknown; shootables: unknown[] }): EunjiRange
