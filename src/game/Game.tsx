import { Suspense, useEffect, useRef, type CSSProperties } from 'react'
import { Canvas } from '@react-three/fiber'
import { Physics } from '@react-three/rapier'
import { GRAVITY } from './data/balance'
import { useInteractionKeys } from './input/useInteractionKeys'
import { usePlayerActionKeys } from './input/usePlayerActionKeys'
import { useWheelZoom } from './input/useWheelZoom'
import { useKeyboardTracking } from './input/keys'
import { pressPointer, usePointerTracking } from './input/pointer'
import { useQualityPreset, useTouchUiTracking } from './input/touchDevice'
import { usePointerLock } from './input/pointerLock'
import { useBackgroundMusic } from './audio/backgroundMusic'
import { World } from './scene/World'
import { useFishingStore } from './stores/fishingStore'
import { useProgressStore } from './stores/progressStore'
import { usePlaceStore } from './stores/placeStore'
import { useSessionStore } from './stores/sessionStore'
import { normalizePlace } from './logic/place'
import { FishingOverlay } from './ui/FishingOverlay'
import { GoalTracker } from './ui/GoalTracker'
import { Hud, NoticeLayer } from './ui/Hud'
import { LoadingScreen } from './ui/LoadingScreen'
import { WeaknessOverlay } from './ui/WeaknessOverlay'
import { Panels } from './ui/Panels'
import { TouchControls } from './ui/TouchControls'

/**
 * 게임 화면 전체: 길게 눌러 글자 선택·확대경이 뜨지 않게 하고, 두 번 톡톡 확대를 막는다(manipulation).
 * 패널은 손가락으로 스크롤·확대할 수 있게 그대로 둔다 (캔버스·터치 버튼만 touch-action: none)
 */
const rootStyle: CSSProperties = {
  position: 'relative',
  width: '100%',
  height: '100%',
  touchAction: 'manipulation',
  userSelect: 'none',
  WebkitUserSelect: 'none',
  WebkitTouchCallout: 'none',
  WebkitTapHighlightColor: 'transparent',
}

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
  usePointerTracking()
  useTouchUiTracking()
  useInteractionKeys()
  usePlayerActionKeys()
  const canvasArea = useRef<HTMLDivElement>(null)
  useWheelZoom(canvasArea)
  usePointerLock(canvasArea)
  useBackgroundMusic()
  const { dpr } = useQualityPreset()

  // 진행 상황(progressStore)은 저장된 것을 이어 쓰고, 이번 판 상태만 초기화한다
  useEffect(() => {
    useSessionStore.getState().resetSession()
    useFishingStore.getState().end()
    // 아직 캐릭터를 만들지 않았으면 꾸미기 화면부터
    if (!useProgressStore.getState().look) useSessionStore.getState().setMode('wardrobe')
    else {
      // 지난번 카메라 거리와, 벤치에 앉아 있었으면 앉은 채로 이어서 (자리·방향은 Player 가 읽는다)
      const place = normalizePlace(usePlaceStore.getState().place, useProgressStore.getState().unlockedZones)
      useSessionStore.setState({ zoom: place.zoom })
      if (place.resting) useSessionStore.getState().setMode('rest')
    }
  }, [])

  return (
    <div style={rootStyle}>
      {/* 캔버스 영역 클릭만 게임 입력으로 받는다 (UI 버튼 클릭은 제외). 손가락으로 끌어도 페이지가 움직이거나 확대되지 않게 막는다 */}
      <div ref={canvasArea} style={{ position: 'absolute', inset: 0, touchAction: 'none' }} onPointerDown={pressPointer} onContextMenu={(e) => e.preventDefault()}>
        <Canvas shadows dpr={dpr} camera={{ position: [0, 8, 25], fov: 50 }}>
          {/* Rapier는 물리 엔진(wasm)을 비동기로 불러오므로 Suspense가 필요하다 */}
          <Suspense fallback={null}>
            <Physics gravity={[0, -GRAVITY, 0]}>
              <World />
            </Physics>
          </Suspense>
        </Canvas>
      </div>
      <WeaknessOverlay />
      <Hud />
      <GoalTracker />
      <FishingOverlay />
      <TouchControls />
      <Panels onExit={onExit} />
      <NoticeLayer />
      <LoadingScreen />
    </div>
  )
}
