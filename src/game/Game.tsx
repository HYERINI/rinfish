import { Suspense, useEffect, useRef } from 'react'
import { Canvas } from '@react-three/fiber'
import { Physics } from '@react-three/rapier'
import { useInteractionKeys } from './input/useInteractionKeys'
import { useWheelZoom } from './input/useWheelZoom'
import { useKeyboardTracking } from './input/keys'
import { pressPointer, usePointerRelease } from './input/pointer'
import { World } from './scene/World'
import { useFishingStore } from './stores/fishingStore'
import { useProgressStore } from './stores/progressStore'
import { useSessionStore } from './stores/sessionStore'
import { FishingOverlay } from './ui/FishingOverlay'
import { Hud } from './ui/Hud'
import { WeaknessOverlay } from './ui/WeaknessOverlay'
import { Panels } from './ui/Panels'

export type GameResult = { score: number }

export type GameProps = {
  /** 사용자가 게임을 나가려 할 때 (로비로 돌아가기) */
  onExit?: () => void
  /** 전설의 물고기를 처음 잡았을 때 결과 전달 (1차-B에서 연결) */
  onFinish?: (result: GameResult) => void
}

/**
 * 게임 전체를 감싸는 단일 컴포넌트. 로비 앱은 이것만 import 해서 쓰면 된다.
 * 부모 요소의 크기를 100% 채운다.
 */
export function Game({ onExit }: GameProps) {
  useKeyboardTracking()
  usePointerRelease()
  useInteractionKeys()
  const canvasArea = useRef<HTMLDivElement>(null)
  useWheelZoom(canvasArea)

  // 진행 상황(progressStore)은 저장된 것을 이어 쓰고, 이번 판 상태만 초기화한다
  useEffect(() => {
    useSessionStore.getState().resetSession()
    useFishingStore.getState().end()
    // 아직 캐릭터를 만들지 않았으면 꾸미기 화면부터
    if (!useProgressStore.getState().look) useSessionStore.getState().setMode('wardrobe')
  }, [])

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      {/* 캔버스 영역 클릭만 게임 입력으로 받는다 (UI 버튼 클릭은 제외) */}
      <div ref={canvasArea} style={{ position: 'absolute', inset: 0 }} onPointerDown={pressPointer} onContextMenu={(e) => e.preventDefault()}>
        <Canvas shadows camera={{ position: [0, 8, 25], fov: 50 }}>
          {/* Rapier는 물리 엔진(wasm)을 비동기로 불러오므로 Suspense가 필요하다 */}
          <Suspense fallback={null}>
            <Physics>
              <World />
            </Physics>
          </Suspense>
        </Canvas>
      </div>
      <WeaknessOverlay />
      <Hud />
      <FishingOverlay />
      <Panels onExit={onExit} />
    </div>
  )
}
