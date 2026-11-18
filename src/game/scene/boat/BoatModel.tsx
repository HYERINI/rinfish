const WOOD = '#8d6e63'
const DARK = '#5d4037'

/** 기본 도형으로 만든 작은 나무배. 원점 = 물 높이, 앞 = +z, 길이 3.2m 폭 1.4m */
export function BoatModel() {
  return (
    <group>
      {/* 바닥 */}
      <mesh position={[0, 0.05, 0]} castShadow receiveShadow>
        <boxGeometry args={[1.2, 0.2, 2.8]} />
        <meshStandardMaterial color={WOOD} />
      </mesh>
      {/* 양옆 */}
      {[-0.65, 0.65].map((x) => (
        <mesh key={x} position={[x, 0.3, 0]} castShadow>
          <boxGeometry args={[0.1, 0.4, 2.8]} />
          <meshStandardMaterial color={WOOD} />
        </mesh>
      ))}
      {/* 뒤판과 뾰족한 앞 */}
      <mesh position={[0, 0.3, -1.4]} castShadow>
        <boxGeometry args={[1.4, 0.4, 0.1]} />
        <meshStandardMaterial color={WOOD} />
      </mesh>
      <mesh position={[0, 0.3, 1.55]} rotation-y={Math.PI / 4} castShadow>
        <boxGeometry args={[0.95, 0.4, 0.95]} />
        <meshStandardMaterial color={WOOD} />
      </mesh>
      {/* 앉는 가로대 */}
      <mesh position={[0, 0.4, -0.1]} castShadow>
        <boxGeometry args={[1.2, 0.06, 0.35]} />
        <meshStandardMaterial color={DARK} />
      </mesh>
    </group>
  )
}
