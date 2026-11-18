import { ISLAND_LANTERNS } from '../../data/zones'

/** 선착장 끝·상점가 등불 기둥. 빛은 MeadowLighting 이 처음부터 붙이고 밤에만 세기를 올린다 (빛 개수를 같게) */
export function IslandLanterns() {
  return (
    <>
      {ISLAND_LANTERNS.map(([x, y, z]) => (
        <group key={`${x},${z}`} position={[x, 0, z]}>
          <mesh position={[0, (y - 0.2) / 2, 0]} castShadow>
            <cylinderGeometry args={[0.06, 0.08, y - 0.2, 8]} />
            <meshStandardMaterial color="#5d4037" />
          </mesh>
          <mesh position={[0, y, 0]}>
            <boxGeometry args={[0.28, 0.36, 0.28]} />
            <meshStandardMaterial color="#ffe0a3" emissive="#ffb74d" emissiveIntensity={0.6} />
          </mesh>
        </group>
      ))}
    </>
  )
}
