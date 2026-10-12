import { create } from 'zustand'

// 게임 진행 단계: 준비 → 플레이 중 → 결과
export type GamePhase = 'ready' | 'playing' | 'result'

type GameState = {
  phase: GamePhase
  score: number
  start: () => void
  addScore: (amount: number) => void
  finish: () => void
  reset: () => void
}

// zustand 스토어: React 컴포넌트(HTML UI)와 3D 씬 양쪽에서 같은 상태를 공유할 수 있다.
// 3D 쪽 useFrame 안에서는 리렌더 없이 useGameStore.getState()로 읽는 것이 좋다.
export const useGameStore = create<GameState>((set) => ({
  phase: 'ready',
  score: 0,
  start: () => set({ phase: 'playing', score: 0 }),
  addScore: (amount) => set((s) => ({ score: s.score + amount })),
  finish: () => set({ phase: 'result' }),
  reset: () => set({ phase: 'ready', score: 0 }),
}))
