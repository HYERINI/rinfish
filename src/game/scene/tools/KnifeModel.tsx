/** 손에 든 칼 (원점이 주먹 가운데, 칼날이 위로). 내 캐릭터와 다른 사람이 같이 쓴다 */
export function KnifeModel() {
  return (
    <group>
      <mesh castShadow>
        <cylinderGeometry args={[0.018, 0.02, 0.12, 8]} />
        <meshStandardMaterial color="#5d4037" />
      </mesh>
      <mesh position={[0, 0.065, 0]}>
        <boxGeometry args={[0.07, 0.012, 0.025]} />
        <meshStandardMaterial color="#78909c" metalness={0.6} roughness={0.4} />
      </mesh>
      <mesh position={[0, 0.17, 0]} castShadow>
        <boxGeometry args={[0.01, 0.2, 0.04]} />
        <meshStandardMaterial color="#cfd8dc" metalness={0.8} roughness={0.25} />
      </mesh>
    </group>
  )
}
