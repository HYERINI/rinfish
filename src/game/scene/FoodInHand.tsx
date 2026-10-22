import type { FoodId } from '../data/types'

/** 먹을 때 손에 드는 음식 (손 크기에 맞춘 작은 모형). 원점이 주먹 가운데 */
export function FoodInHand({ dish }: { dish: FoodId }) {
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
    case 'gimbap':
      // 김밥 한 줄 (김·밥·속)
      return (
        <group position={[0, 0.05, 0.03]} rotation-z={Math.PI / 2}>
          <mesh>
            <cylinderGeometry args={[0.035, 0.035, 0.16, 12]} />
            <meshStandardMaterial color="#1b2a1b" />
          </mesh>
          {[-1, 1].map((s) => (
            <mesh key={s} position={[0, s * 0.081, 0]}>
              <cylinderGeometry args={[0.03, 0.03, 0.002, 12]} />
              <meshStandardMaterial color="#fafafa" />
            </mesh>
          ))}
          <mesh position={[0, 0.082, 0]}>
            <cylinderGeometry args={[0.012, 0.012, 0.003, 8]} />
            <meshStandardMaterial color="#ff9800" />
          </mesh>
        </group>
      )
    case 'ramen':
      // 컵라면 (흰 컵 + 빨간 띠, 젓가락)
      return (
        <group position={[0, 0.05, 0.03]}>
          <mesh>
            <cylinderGeometry args={[0.055, 0.042, 0.1, 14]} />
            <meshStandardMaterial color="#fafafa" />
          </mesh>
          <mesh position={[0, 0.01, 0]}>
            <cylinderGeometry args={[0.052, 0.048, 0.03, 14]} />
            <meshStandardMaterial color="#e53935" />
          </mesh>
          <mesh position={[0, 0.051, 0]}>
            <cylinderGeometry args={[0.05, 0.05, 0.002, 14]} />
            <meshStandardMaterial color="#ffcc80" />
          </mesh>
          <mesh position={[0.02, 0.09, 0]} rotation-z={-0.3}>
            <cylinderGeometry args={[0.004, 0.004, 0.16, 4]} />
            <meshStandardMaterial color="#d7ccc8" />
          </mesh>
        </group>
      )
    case 'energy':
      // 에너지 음료 캔
      return (
        <group position={[0, 0.05, 0.02]}>
          <mesh>
            <cylinderGeometry args={[0.032, 0.032, 0.12, 14]} />
            <meshStandardMaterial color="#1e88e5" metalness={0.5} roughness={0.35} />
          </mesh>
          <mesh position={[0, 0.0, 0]}>
            <cylinderGeometry args={[0.033, 0.033, 0.03, 14]} />
            <meshStandardMaterial color="#ffeb3b" />
          </mesh>
          <mesh position={[0, 0.061, 0]}>
            <cylinderGeometry args={[0.028, 0.028, 0.004, 14]} />
            <meshStandardMaterial color="#b0bec5" metalness={0.8} roughness={0.3} />
          </mesh>
        </group>
      )
    case 'fishSteam':
    case 'spicySteam':
    case 'bossSteam':
    case 'xxlSteam':
      // 찜 한 그릇 (뚝배기 + 소스 위 생선)
      return (
        <group position={[0, 0.04, 0.03]}>
          <mesh rotation-x={Math.PI}>
            <sphereGeometry args={[0.075, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2]} />
            <meshStandardMaterial color="#4e342e" side={2} />
          </mesh>
          <mesh rotation-x={-Math.PI / 2} position={[0, -0.005, 0]}>
            <circleGeometry args={[0.07, 14]} />
            <meshStandardMaterial color={dish === 'spicySteam' ? '#e53935' : dish === 'bossSteam' ? '#ff8f00' : '#d7a86e'} />
          </mesh>
          <mesh position={[0, 0.012, 0]} scale={[1.6, 0.6, 0.8]}>
            <sphereGeometry args={[0.025, 8, 6]} />
            <meshStandardMaterial color="#b0bec5" />
          </mesh>
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
