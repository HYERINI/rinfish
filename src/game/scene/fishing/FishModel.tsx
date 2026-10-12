import { forwardRef } from 'react'
import type { Group } from 'three'

/**
 * 임시 물고기 모델 (도형). 머리가 +z 쪽. 에셋으로 바꿀 때 이 파일만 교체한다.
 * 크기·색은 부모가 group.scale 과 color 로 정한다
 */
export const FishModel = forwardRef<Group, { color: string }>(function FishModel({ color }, ref) {
  return (
    <group ref={ref}>
      {/* 몸통 */}
      <mesh scale={[0.35, 0.55, 1]} castShadow>
        <sphereGeometry args={[0.5, 16, 12]} />
        <meshStandardMaterial color={color} roughness={0.35} />
      </mesh>
      {/* 꼬리 */}
      <mesh position={[0, 0, -0.62]} rotation-x={Math.PI / 2} scale={[0.15, 1, 1]}>
        <coneGeometry args={[0.3, 0.35, 12]} />
        <meshStandardMaterial color={color} roughness={0.35} />
      </mesh>
      {/* 등지느러미 */}
      <mesh position={[0, 0.3, -0.05]} scale={[0.08, 1, 1]}>
        <coneGeometry args={[0.18, 0.25, 8]} />
        <meshStandardMaterial color={color} roughness={0.35} />
      </mesh>
      {/* 눈 */}
      {[-1, 1].map((side) => (
        <mesh key={side} position={[side * 0.15, 0.08, 0.3]}>
          <sphereGeometry args={[0.06, 8, 8]} />
          <meshBasicMaterial color="#111" />
        </mesh>
      ))}
    </group>
  )
})
