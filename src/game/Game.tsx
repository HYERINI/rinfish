import { useEffect } from 'react'
import { Canvas } from '@react-three/fiber'
import { World } from './scene/World'
import { Hud } from './ui/Hud'
import { useGameStore } from './store'

export type GameResult = { score: number }

export type GameProps = {
  /** 사용자가 게임을 나가려 할 때 (로비로 돌아가기 등) */
  onExit?: () => void
  /** 게임이 끝났을 때 결과 전달 */
  onFinish?: (result: GameResult) => void
}

/**
 * 게임 전체를 감싸는 단일 컴포넌트. 로비 앱은 이것만 import 해서 쓰면 된다.
 * 부모 요소의 크기를 100% 채우므로, 로비 쪽에서 감싸는 div 크기만 정해주면 된다.
 */
export function Game({ onExit, onFinish }: GameProps) {
  // 스토어는 전역이므로, 로비에서 게임을 다시 열 때 이전 판 상태가 남지 않도록 마운트 시 초기화
  useEffect(() => {
    useGameStore.getState().reset()
  }, [])

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      {/*
        <Canvas>: R3F가 three.js의 Scene / Camera / WebGLRenderer를 자동으로 만들어준다.
        - shadows: 그림자 렌더링 켜기
        - camera: 기본 원근(Perspective) 카메라의 위치와 시야각(fov)
      */}
      <Canvas shadows camera={{ position: [4, 4, 6], fov: 50 }}>
        <World />
      </Canvas>

      {/* 캔버스 위에 겹쳐지는 일반 HTML UI 레이어 */}
      <Hud onExit={onExit} onFinish={onFinish} />
    </div>
  )
}
