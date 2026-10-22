import type { ReactNode } from 'react'
import type { BaitId } from '../data/bait'
import type { SnackId } from '../data/snacks'
import type { DishId, GearSlot } from '../data/types'

/** 상점 카드에 그리는 물건 그림 종류 (물고기는 FishImage) */
export type ItemIconId = BaitId | GearSlot | DishId | SnackId | 'feed' | 'none'

/** 작은 SVG 그림. 64×64 칸에 그려서 size 로 늘린다 */
export function ItemIcon({ id, size = 64, level = 0 }: { id: ItemIconId; size?: number; /** 장비 단계(0부터). 단계마다 색이 달라진다 */ level?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden style={{ display: 'block' }}>
      {ICONS[id](level)}
    </svg>
  )
}

/** 찜 냄비 그림: 뚝배기 + 소스 + 물고기 꼬리 + 김 */
function SteamDish({ sauce, rim = '#4e342e', children }: { sauce: string; rim?: string; children?: ReactNode }) {
  return (
    <g>
      <path d="M8 34 h 48 c 0 14, -10 22, -24 22 s -24 -8 -24 -22 z" fill="#5d4037" stroke={rim} strokeWidth="3" />
      <ellipse cx="32" cy="34" rx="24" ry="7" fill={sauce} />
      <path d="M38 33 l 10 -9 l 2 12 z" fill="#90a4ae" stroke="#546e7a" strokeWidth="1.5" />
      <ellipse cx="26" cy="34" rx="9" ry="4" fill="#b0bec5" />
      <circle cx="21" cy="33" r="1.2" fill="#000" />
      <path d="M2 38 h 6 M56 38 h 6" stroke="#3e2723" strokeWidth="4" strokeLinecap="round" />
      <path d="M22 24 c -3 -4, 3 -6, 0 -10 M32 22 c -3 -4, 3 -6, 0 -10 M42 24 c -3 -4, 3 -6, 0 -10" stroke="#cfd8dc" strokeWidth="2" fill="none" opacity="0.9" />
      {children}
    </g>
  )
}

/** 장비 단계 색: 나무·나일론 → 은색 → 금색 */
const TIER = ['#a1887f', '#90caf9', '#ffd54f']

const ICONS: Record<ItemIconId, (level: number) => ReactNode> = {
  worm: () => (
    <g>
      <ellipse cx="32" cy="50" rx="22" ry="5" fill="#6d4c41" opacity="0.5" />
      <path d="M10 40 C 16 26, 24 50, 32 36 S 46 24, 54 34" fill="none" stroke="#e57373" strokeWidth="9" strokeLinecap="round" />
      <path d="M10 40 C 16 26, 24 50, 32 36 S 46 24, 54 34" fill="none" stroke="#f8bbd0" strokeWidth="2" strokeDasharray="2 5" strokeLinecap="round" />
      <circle cx="53" cy="32" r="1.6" fill="#3e2723" />
    </g>
  ),
  shrimp: () => (
    <g>
      <path d="M46 16 C 30 12, 14 22, 16 38 C 18 50, 32 54, 40 46" fill="none" stroke="#ff8a65" strokeWidth="12" strokeLinecap="round" />
      {[0, 1, 2, 3].map((i) => (
        <path key={i} d={`M${20 + i * 6} ${22 + i * 5} l 6 -3`} stroke="#ffccbc" strokeWidth="2" />
      ))}
      <path d="M40 46 l 8 6 l -2 -10 z" fill="#ff7043" />
      <circle cx="44" cy="16" r="2" fill="#3e2723" />
      <path d="M48 14 C 56 8, 60 12, 62 6 M48 17 C 58 16, 60 20, 63 16" stroke="#bf360c" strokeWidth="1.5" fill="none" />
    </g>
  ),
  lure: () => (
    <g>
      <path d="M8 32 C 18 18, 40 18, 50 32 C 40 46, 18 46, 8 32 z" fill="#26c6da" stroke="#00838f" strokeWidth="2" />
      <path d="M8 32 C 18 26, 36 26, 50 32 C 36 38, 18 38, 8 32 z" fill="#ffee58" opacity="0.8" />
      <circle cx="16" cy="29" r="3" fill="#fff" />
      <circle cx="16" cy="29" r="1.5" fill="#000" />
      <path d="M50 32 l 8 -6 l 0 12 z" fill="#ef5350" />
      <path d="M30 42 c 0 8, 6 10, 8 6" stroke="#9e9e9e" strokeWidth="2" fill="none" />
      <path d="M38 48 l 2 -4" stroke="#9e9e9e" strokeWidth="2" />
      <circle cx="44" cy="22" r="2" fill="#fff" opacity="0.9" />
    </g>
  ),
  line: (level) => (
    <g>
      <circle cx="32" cy="32" r="22" fill={TIER[level] ?? TIER[0]} stroke="#455a64" strokeWidth="3" />
      <circle cx="32" cy="32" r="8" fill="#eceff1" stroke="#455a64" strokeWidth="2" />
      {[0, 1, 2, 3, 4].map((i) => (
        <circle key={i} cx="32" cy="32" r={11 + i * 2.2} fill="none" stroke="#fff" strokeWidth="0.8" opacity="0.7" />
      ))}
      <path d="M54 32 C 60 40, 58 50, 62 60" stroke="#eceff1" strokeWidth="1.5" fill="none" />
    </g>
  ),
  reel: (level) => (
    <g>
      <rect x="14" y="20" width="28" height="26" rx="12" fill={TIER[level] ?? TIER[0]} stroke="#37474f" strokeWidth="3" />
      <circle cx="28" cy="33" r="6" fill="#eceff1" stroke="#37474f" strokeWidth="2" />
      <path d="M42 33 h 10" stroke="#37474f" strokeWidth="4" />
      <rect x="50" y="26" width="6" height="14" rx="3" fill="#ef5350" />
      <path d="M24 46 v 8 h 18" stroke="#37474f" strokeWidth="4" fill="none" />
    </g>
  ),
  rod: (level) => (
    <g>
      <path d="M10 56 L 54 8" stroke={TIER[level] ?? TIER[0]} strokeWidth="5" strokeLinecap="round" />
      <path d="M10 56 L 20 45" stroke="#3e2723" strokeWidth="8" strokeLinecap="round" />
      <circle cx="22" cy="44" r="5" fill="#90a4ae" stroke="#37474f" strokeWidth="2" />
      <path d="M54 8 C 58 24, 58 34, 56 46" stroke="#eceff1" strokeWidth="1.5" fill="none" />
      <path d="M56 46 c -4 0, -4 6, 0 6" stroke="#9e9e9e" strokeWidth="2" fill="none" />
    </g>
  ),
  feed: () => (
    <g>
      <path d="M16 18 h 32 l 4 38 h -40 z" fill="#ffcc80" stroke="#8d6e63" strokeWidth="2.5" />
      <path d="M16 18 l 4 -8 h 24 l 4 8" fill="#ffe0b2" stroke="#8d6e63" strokeWidth="2.5" />
      <ellipse cx="32" cy="36" rx="9" ry="5" fill="#4fc3f7" />
      <path d="M41 36 l 5 -4 v 8 z" fill="#4fc3f7" />
      <circle cx="28" cy="35" r="1.2" fill="#000" />
      {[0, 1, 2].map((i) => (
        <circle key={i} cx={24 + i * 8} cy="50" r="2.4" fill="#a1887f" />
      ))}
    </g>
  ),
  sashimi: () => (
    <g>
      <ellipse cx="32" cy="42" rx="26" ry="10" fill="#eceff1" stroke="#90a4ae" strokeWidth="2" />
      {[0, 1, 2, 3].map((i) => (
        <path key={i} d={`M${14 + i * 9} 42 q 6 -14 12 -2 z`} fill="#ff8a65" stroke="#fff" strokeWidth="1.5" />
      ))}
      <path d="M48 34 c 4 -6, 8 -4, 8 0" fill="#66bb6a" />
    </g>
  ),
  bowl: () => (
    <g>
      <path d="M8 30 h 48 c 0 16, -12 24, -24 24 s -24 -8 -24 -24 z" fill="#5d4037" stroke="#3e2723" strokeWidth="2" />
      <ellipse cx="32" cy="30" rx="24" ry="7" fill="#fafafa" />
      {[0, 1, 2].map((i) => (
        <path key={i} d={`M${16 + i * 10} 30 q 5 -10 10 0 z`} fill="#ff7043" />
      ))}
      <circle cx="42" cy="26" r="3" fill="#66bb6a" />
      <path d="M44 8 L 30 26 M50 10 L 34 27" stroke="#bcaaa4" strokeWidth="2.5" strokeLinecap="round" />
    </g>
  ),
  stew: () => (
    <g>
      <rect x="8" y="26" width="48" height="26" rx="8" fill="#455a64" stroke="#263238" strokeWidth="2" />
      <ellipse cx="32" cy="27" rx="24" ry="6" fill="#e53935" />
      <circle cx="24" cy="26" r="3" fill="#fff59d" />
      <circle cx="38" cy="27" r="3.5" fill="#fafafa" />
      <path d="M44 25 l 4 -2" stroke="#2e7d32" strokeWidth="2.5" />
      <path d="M4 34 h 6 M54 34 h 6" stroke="#263238" strokeWidth="4" strokeLinecap="round" />
      <path d="M22 18 c -3 -4, 3 -6, 0 -10 M32 18 c -3 -4, 3 -6, 0 -10 M42 18 c -3 -4, 3 -6, 0 -10" stroke="#eceff1" strokeWidth="2" fill="none" opacity="0.8" />
    </g>
  ),
  gimbap: () => (
    <g>
      <ellipse cx="32" cy="52" rx="26" ry="6" fill="#cfd8dc" />
      {[0, 1, 2].map((i) => (
        <g key={i} transform={`translate(${14 + i * 18} ${38 - (i % 2) * 4})`}>
          <circle r="10" fill="#1b2a1b" />
          <circle r="7.5" fill="#fafafa" />
          <circle cx="-2.5" cy="-1" r="2" fill="#ff9800" />
          <circle cx="2.5" cy="1" r="2" fill="#66bb6a" />
          <circle cx="0" cy="3" r="1.6" fill="#ffeb3b" />
          <circle cx="1" cy="-3.2" r="1.5" fill="#e53935" />
        </g>
      ))}
    </g>
  ),
  ramen: () => (
    <g>
      <path d="M12 22 h40 l-5 34 h-30 z" fill="#fafafa" stroke="#b0bec5" strokeWidth="2" />
      <path d="M13.5 32 h37 l-1.6 11 h-33.8 z" fill="#e53935" />
      <text x="32" y="41" textAnchor="middle" fontSize="8" fontWeight="900" fill="#fff">라면</text>
      <ellipse cx="32" cy="22" rx="20" ry="4" fill="#ffcc80" />
      <path d="M22 21 q 4 -4 8 0 t 8 0 t 8 0" stroke="#ffb74d" strokeWidth="2" fill="none" />
      <path d="M40 4 L 30 22 M46 6 L 34 22" stroke="#bcaaa4" strokeWidth="2.5" strokeLinecap="round" />
      <path d="M20 14 c -3 -4, 3 -6, 0 -10" stroke="#eceff1" strokeWidth="2" fill="none" opacity="0.8" />
    </g>
  ),
  energy: () => (
    <g>
      <rect x="20" y="10" width="24" height="46" rx="5" fill="#1e88e5" stroke="#0d47a1" strokeWidth="2" />
      <rect x="22" y="8" width="20" height="4" rx="2" fill="#b0bec5" />
      <path d="M34 18 l -8 14 h 6 l -4 14 l 10 -17 h -6 l 4 -11 z" fill="#ffeb3b" stroke="#f57f17" strokeWidth="1" />
      <rect x="24" y="14" width="4" height="36" rx="2" fill="#fff" opacity="0.25" />
    </g>
  ),
  fishSteam: () => <SteamDish sauce="#d7a86e" />,
  spicySteam: () => (
    <SteamDish sauce="#e53935">
      <path d="M40 30 q 6 -2 8 4 q -6 4 -8 -4 z" fill="#2e7d32" />
      <path d="M22 33 q 4 -6 9 -2" stroke="#b71c1c" strokeWidth="3" fill="none" strokeLinecap="round" />
    </SteamDish>
  ),
  bossSteam: () => (
    <SteamDish sauce="#ff8f00" rim="#ffd54f">
      <path d="M24 12 l 4 6 l 4 -8 l 4 8 l 4 -6 l -2 9 h -12 z" fill="#ffd54f" stroke="#f57f17" strokeWidth="1.5" />
    </SteamDish>
  ),
  xxlSteam: () => (
    <g>
      <ellipse cx="32" cy="46" rx="30" ry="12" fill="#eceff1" stroke="#90a4ae" strokeWidth="2" />
      <path d="M6 42 C 10 22, 54 22, 58 42 z" fill="#6d4c41" />
      <ellipse cx="22" cy="36" rx="4" ry="2.5" fill="#fff" />
      <circle cx="21" cy="36" r="1.4" fill="#000" />
      <path d="M58 40 l 6 -6 v 12 z" fill="#5d4037" />
      <path d="M14 30 q 18 -10 36 0" stroke="#ff7043" strokeWidth="3" fill="none" />
      <text x="32" y="58" textAnchor="middle" fontSize="9" fontWeight="900" fill="#c62828">8인분</text>
      <path d="M20 14 c -3 -4, 3 -6, 0 -10 M32 12 c -3 -4, 3 -6, 0 -10 M44 14 c -3 -4, 3 -6, 0 -10" stroke="#b0bec5" strokeWidth="2" fill="none" />
    </g>
  ),
  none: () => (
    <g>
      <path d="M32 8 v 30 c 0 10, -12 10, -12 2" stroke="#b0bec5" strokeWidth="4" fill="none" strokeLinecap="round" />
      <circle cx="32" cy="8" r="3" fill="#b0bec5" />
    </g>
  ),
}
