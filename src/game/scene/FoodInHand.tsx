import type { DishId } from '../data/types'

/** 먹을 때 손에 드는 음식 (손 크기에 맞춘 작은 모형). 원점이 주먹 가운데 */
export function FoodInHand({ dish }: { dish: DishId }) {
  switch (dish) {
    case 'sashimi':
      // 젓가락에 집은 연어회 한 점
      return (
        <group rotation-x={-0.4}>
          <mesh position={[0, 0.06, 0.05]} rotation-z={0.3}>
            <boxGeometry args={[0.09, 0.025, 0.05]} />
            <meshStandardMaterial color="#ff8a65" />
          </mesh>
          {[-0.01, 0.01].map((x) => (
            <mesh key={x} position={[x, 0.03, 0.02]} rotation-x={0.9}>
              <cylinderGeometry args={[0.004, 0.004, 0.18, 4]} />
              <meshStandardMaterial color="#d7ccc8" />
            </mesh>
          ))}
        </group>
      )
    case 'bowl':
    case 'stew':
      // 작은 그릇 (회덮밥은 흰 밥에 연어, 매운탕은 빨간 국물)
      return (
        <group position={[0, 0.04, 0.03]}>
          <mesh rotation-x={Math.PI}>
            <sphereGeometry args={[0.07, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2]} />
            <meshStandardMaterial color={dish === 'bowl' ? '#5d4037' : '#455a64'} side={2} />
          </mesh>
          <mesh rotation-x={-Math.PI / 2} position={[0, -0.005, 0]}>
            <circleGeometry args={[0.064, 14]} />
            <meshStandardMaterial color={dish === 'bowl' ? '#fafafa' : '#e53935'} />
          </mesh>
          <mesh position={[0.015, 0.005, 0]}>
            <boxGeometry args={[0.04, 0.012, 0.025]} />
            <meshStandardMaterial color={dish === 'bowl' ? '#ff7043' : '#fff59d'} />
          </mesh>
        </group>
      )
  }
}
