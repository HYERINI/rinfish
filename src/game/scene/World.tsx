import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import type { Mesh } from 'three'

// 임시 씬: 테마가 정해지면 이 파일 내용을 실제 게임 오브젝트로 교체한다.
export function World() {
  return (
    <>
      {/* 주변광: 모든 방향에서 균일하게 비추는 약한 빛 (그림자 없음) */}
      <ambientLight intensity={0.4} />

      {/* 방향광: 태양처럼 한 방향으로 비추는 빛. castShadow로 그림자를 만든다 */}
      <directionalLight
        position={[5, 8, 5]}
        intensity={1.5}
        castShadow
        shadow-mapSize={[1024, 1024]}
      />

      <SpinningBox />

      {/*
        바닥: mesh = geometry(모양) + material(재질).
        planeGeometry는 기본적으로 세로로 서 있으므로 x축으로 -90도 눕힌다.
        receiveShadow: 다른 물체의 그림자를 받는다.
      */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[20, 20]} />
        <meshStandardMaterial color="#556070" />
      </mesh>

      {/* 마우스 드래그로 카메라 회전/줌 (drei 제공 헬퍼) */}
      <OrbitControls makeDefault />
    </>
  )
}

function SpinningBox() {
  // ref로 실제 three.js Mesh 객체에 직접 접근한다
  const ref = useRef<Mesh>(null)

  // useFrame: 매 프레임(보통 초당 60번) 호출되는 콜백.
  // delta = 이전 프레임 이후 지난 시간(초). delta를 곱하면 FPS와 무관하게 같은 속도로 움직인다.
  // 주의: 여기서는 setState 대신 ref로 값을 직접 바꿔야 성능이 좋다.
  useFrame((_state, delta) => {
    if (!ref.current) return
    ref.current.rotation.y += delta
    ref.current.rotation.x += delta * 0.5
  })

  return (
    <mesh ref={ref} position={[0, 1, 0]} castShadow>
      <boxGeometry args={[1, 1, 1]} />
      <meshStandardMaterial color="orange" />
    </mesh>
  )
}
