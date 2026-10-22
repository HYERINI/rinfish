import type { ReactNode } from 'react'
import { useSessionStore } from '../stores/sessionStore'

/**
 * 주문 키오스크처럼 생긴 상점 틀: 위쪽 머리줄(가게 이름·코인·닫기) → 분류 탭 → 큰 그림 카드 격자 → 고른 물건 자세히·큰 버튼.
 * 넓은 화면에선 자세히 칸이 오른쪽, 좁은 화면(휴대폰)에선 아래에 붙는다 (CSS 미디어 쿼리)
 */
export type KioskTab = { id: string; label: string; icon?: ReactNode }

export type KioskCard = {
  id: string
  name: string
  image: ReactNode
  /** 카드 아래 큰 글씨 (가격 등) */
  price?: string
  /** 카드 오른쪽 위 작은 표시 (보유 3 등) */
  badge?: string
  /** 이름 아래 작은 글씨 */
  sub?: string
  subColor?: string
  /** 흐리게 (살 수 없음 등). 그래도 눌러서 자세히 볼 수는 있다 */
  dimmed?: boolean
  /** 여러 개 고르는 카드(판매함)에서 체크 표시 */
  checked?: boolean
}

type Props = {
  title: string
  /** 머리줄 색 */
  accent: string
  coins: number
  tabs?: KioskTab[]
  tab?: string
  onTab?: (id: string) => void
  cards: KioskCard[]
  selectedId: string | null
  onSelect: (id: string) => void
  /** 카드가 없을 때 안내 */
  empty?: ReactNode
  /** 고른 물건 자세히 (그림·설명·수량·큰 버튼) */
  detail: ReactNode
  /** 잠깐 띄우는 알림 (구매 완료 등) */
  toast?: string | null
}

export function Kiosk({ title, accent, coins, tabs, tab, onTab, cards, selectedId, onSelect, empty, detail, toast }: Props) {
  const setMode = useSessionStore((s) => s.setMode)
  return (
    <div className="kiosk" style={{ ['--accent' as string]: accent }}>
      <KioskStyle />
      <header className="kiosk-head">
        <h2>{title}</h2>
        <span className="kiosk-coins">
          <CoinDot /> {coins.toLocaleString()}
        </span>
        <button className="kiosk-close" onClick={() => setMode('explore')}>
          닫기 <small>ESC</small>
        </button>
      </header>
      {tabs && tabs.length > 0 && (
        <nav className="kiosk-tabs">
          {tabs.map((t) => (
            <button
              key={t.id}
              className={t.id === tab ? 'on' : ''}
              onClick={(e) => {
                onTab?.(t.id)
                e.currentTarget.blur()
              }}
            >
              {t.icon}
              {t.label}
            </button>
          ))}
        </nav>
      )}
      <div className="kiosk-body">
        <div className="kiosk-grid-wrap">
          {cards.length === 0 ? (
            <div className="kiosk-empty">{empty}</div>
          ) : (
            <div className="kiosk-grid">
              {cards.map((c) => (
                <button
                  key={c.id}
                  className={`kiosk-card${c.id === selectedId ? ' on' : ''}${c.dimmed ? ' dim' : ''}${c.checked ? ' checked' : ''}`}
                  onClick={(e) => {
                    onSelect(c.id)
                    e.currentTarget.blur()
                  }}
                >
                  {c.badge && <span className="kiosk-badge">{c.badge}</span>}
                  {c.checked !== undefined && <span className="kiosk-check">{c.checked ? '✓' : ''}</span>}
                  <span className="kiosk-card-img">{c.image}</span>
                  <span className="kiosk-card-name">{c.name}</span>
                  {c.sub && (
                    <span className="kiosk-card-sub" style={{ color: c.subColor }}>
                      {c.sub}
                    </span>
                  )}
                  {c.price && <span className="kiosk-card-price">{c.price}</span>}
                </button>
              ))}
            </div>
          )}
        </div>
        <aside className="kiosk-detail">{detail}</aside>
      </div>
      {toast && <div className="kiosk-toast">{toast}</div>}
    </div>
  )
}

/** 자세히 칸 안의 기본 모양: 큰 그림, 이름, 설명 줄들, 그 아래 조작(수량·버튼) */
export function KioskDetail({ image, title, tag, lines, children }: { image: ReactNode; title: string; tag?: ReactNode; lines: ReactNode[]; children?: ReactNode }) {
  return (
    <>
      <div className="kiosk-detail-top">
        <div className="kiosk-detail-img">{image}</div>
        <div className="kiosk-detail-text">
          <h3>
            {title} {tag}
          </h3>
          {lines.map((line, i) => (
            <p key={i}>{line}</p>
          ))}
        </div>
      </div>
      <div className="kiosk-detail-actions">{children}</div>
    </>
  )
}

/** 수량 고르기 (−  3  +) */
export function QtyStepper({ value, min = 1, max, onChange }: { value: number; min?: number; max: number; onChange: (n: number) => void }) {
  const clamp = (n: number) => Math.max(min, Math.min(max, n))
  return (
    <div className="kiosk-qty">
      <button disabled={value <= min} onClick={() => onChange(clamp(value - 1))} aria-label="하나 빼기">
        −
      </button>
      <span>{value}</span>
      <button disabled={value >= max} onClick={() => onChange(clamp(value + 1))} aria-label="하나 더하기">
        +
      </button>
    </div>
  )
}

/** 큰 주문 버튼. 누른 뒤 포커스를 풀어서 Space/Enter 로 연달아 눌리지 않게 한다 */
export function BigButton({ label, sub, disabled, onClick, tone = 'buy' }: { label: string; sub?: string; disabled?: boolean; onClick: () => void; tone?: 'buy' | 'sell' | 'plain' }) {
  return (
    <button
      className={`kiosk-big ${tone}`}
      disabled={disabled}
      onClick={(e) => {
        onClick()
        e.currentTarget.blur()
      }}
    >
      {label}
      {sub && <small>{sub}</small>}
    </button>
  )
}

/** 키오스크 class 스타일. Kiosk 밖에서 BigButton 등만 쓸 때도 넣는다 */
export function KioskStyle() {
  return <style>{KIOSK_CSS}</style>
}

function CoinDot() {
  return (
    <svg width="18" height="18" viewBox="0 0 20 20" aria-hidden>
      <circle cx="10" cy="10" r="9" fill="#ffca28" stroke="#f57f17" strokeWidth="2" />
      <text x="10" y="14" textAnchor="middle" fontSize="10" fontWeight="800" fill="#e65100">
        C
      </text>
    </svg>
  )
}

// 미디어 쿼리가 필요해서 인라인 스타일 대신 class 를 쓴다. 이름은 모두 kiosk- 로 시작해서 다른 곳과 겹치지 않는다
const KIOSK_CSS = `
.kiosk { pointer-events: auto; z-index: 1000; position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%);
  width: min(880px, 92vw); height: min(640px, 88vh); display: flex; flex-direction: column; overflow: hidden;
  background: #eef2f6; color: #1f2933; border-radius: 16px; box-shadow: 0 12px 40px rgba(0,0,0,0.45); box-sizing: border-box;
  font-family: inherit; }
.kiosk button { font-family: inherit; }
.kiosk-head { display: flex; align-items: center; gap: 10px; padding: 12px 16px; background: var(--accent); color: #fff; }
.kiosk-head h2 { margin: 0; font-size: 20px; flex: 1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.kiosk-coins { display: inline-flex; align-items: center; gap: 6px; background: rgba(0,0,0,0.25); padding: 5px 12px; border-radius: 999px; font-weight: 800; font-size: 16px; }
.kiosk-close { border: none; border-radius: 8px; padding: 7px 12px; background: rgba(255,255,255,0.9); color: #222; font-weight: 700; cursor: pointer; }
.kiosk-close small { opacity: 0.6; margin-left: 2px; }
.kiosk-tabs { display: flex; gap: 6px; padding: 10px 12px 0; overflow-x: auto; flex-shrink: 0; }
.kiosk-tabs button { display: inline-flex; align-items: center; gap: 6px; border: none; border-radius: 12px 12px 0 0; padding: 8px 16px;
  background: #d5dde6; color: #4a5866; font-weight: 700; font-size: 15px; cursor: pointer; white-space: nowrap; }
.kiosk-tabs button.on { background: #fff; color: #111; box-shadow: inset 0 3px 0 var(--accent); }
.kiosk-body { flex: 1; min-height: 0; display: flex; background: #fff; margin: 0 12px 12px; border-radius: 0 12px 12px 12px; overflow: hidden; }
.kiosk-grid-wrap { flex: 1; min-width: 0; overflow-y: auto; padding: 12px; }
.kiosk-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap: 10px; }
.kiosk-empty { padding: 40px 12px; text-align: center; color: #66737f; }
.kiosk-card { position: relative; display: flex; flex-direction: column; align-items: center; gap: 2px; padding: 10px 8px 10px;
  border: 3px solid #e3e8ee; border-radius: 14px; background: #f8fafc; color: #1f2933; cursor: pointer; text-align: center; transition: transform .08s; }
.kiosk-card:hover { transform: translateY(-2px); border-color: #c9d3dd; }
.kiosk-card.on { border-color: var(--accent); background: #fffdf3; box-shadow: 0 0 0 3px rgba(255,209,102,0.45); }
.kiosk-card.dim .kiosk-card-img, .kiosk-card.dim .kiosk-card-price { opacity: 0.45; }
.kiosk-card-img { display: flex; align-items: center; justify-content: center; height: 72px; }
.kiosk-card-name { font-weight: 800; font-size: 15px; line-height: 1.2; }
.kiosk-card-sub { font-size: 12px; color: #66737f; }
.kiosk-card-price { margin-top: 4px; font-weight: 800; font-size: 15px; color: #c25e00; }
.kiosk-badge { position: absolute; top: 6px; right: 6px; background: #263238; color: #fff; border-radius: 999px; padding: 1px 7px; font-size: 11px; font-weight: 700; }
.kiosk-check { position: absolute; top: 6px; left: 6px; width: 20px; height: 20px; border-radius: 6px; border: 2px solid #b0bcc8; background: #fff;
  color: #fff; font-size: 14px; line-height: 18px; font-weight: 900; }
.kiosk-card.checked .kiosk-check { background: var(--accent); border-color: var(--accent); }
.kiosk-detail { width: 290px; flex-shrink: 0; border-left: 2px solid #eef2f6; padding: 14px; display: flex; flex-direction: column; gap: 10px; overflow-y: auto; }
.kiosk-detail-top { display: flex; flex-direction: column; align-items: center; gap: 6px; text-align: center; }
.kiosk-detail-img { display: flex; align-items: center; justify-content: center; min-height: 120px; background: #f1f5f9; border-radius: 14px; width: 100%; padding: 8px 0; }
.kiosk-detail-text h3 { margin: 4px 0; font-size: 19px; }
.kiosk-detail-text p { margin: 2px 0; font-size: 13px; color: #4a5866; }
.kiosk-detail-actions { margin-top: auto; display: flex; flex-direction: column; gap: 8px; }
.kiosk-combo { display: flex; align-items: center; gap: 4px; }
.kiosk-qty { display: flex; align-items: center; justify-content: center; gap: 14px; }
.kiosk-qty button { width: 44px; height: 44px; border-radius: 12px; border: none; background: #e3e8ee; font-size: 24px; font-weight: 800; cursor: pointer; color: #1f2933; }
.kiosk-qty button:disabled { opacity: 0.35; cursor: not-allowed; }
.kiosk-qty span { min-width: 36px; text-align: center; font-size: 22px; font-weight: 800; }
.kiosk-big { border: none; border-radius: 14px; padding: 14px 10px; font-size: 18px; font-weight: 900; cursor: pointer; display: flex; flex-direction: column; align-items: center; gap: 2px; }
.kiosk-big small { font-size: 12px; font-weight: 700; opacity: 0.8; }
.kiosk-big.buy { background: #ff7043; color: #fff; }
.kiosk-big.sell { background: #1e88e5; color: #fff; }
.kiosk-big.plain { background: #e3e8ee; color: #1f2933; padding: 10px; font-size: 15px; }
.kiosk-big:disabled { background: #cfd8dc; color: #8a979f; cursor: not-allowed; }
.kiosk-toast { position: absolute; left: 50%; top: 64px; transform: translateX(-50%); background: rgba(33,33,33,0.9); color: #fff; padding: 8px 16px;
  border-radius: 999px; font-weight: 700; font-size: 14px; white-space: nowrap; pointer-events: none; }
@media (max-width: 640px) {
  .kiosk { height: 90vh; }
  .kiosk-head h2 { font-size: 17px; }
  .kiosk-tabs button { padding: 7px 11px; font-size: 14px; }
  .kiosk-body { flex-direction: column; margin: 0 8px 8px; }
  .kiosk-grid-wrap { padding: 8px; }
  .kiosk-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; }
  .kiosk-card-img { height: 56px; }
  .kiosk-detail { width: auto; border-left: none; border-top: 2px solid #eef2f6; padding: 10px; gap: 8px; max-height: 46%; }
  .kiosk-detail-top { flex-direction: row; text-align: left; align-items: center; }
  .kiosk-detail-img { width: 112px; min-height: 64px; flex-shrink: 0; padding: 4px 0; }
  .kiosk-detail-img > svg { width: 76px; height: 76px; }
  .kiosk-detail-img > img { width: 104px; height: auto; }
  .kiosk-combo svg { width: 50px; height: 50px; }
  .kiosk-combo img { width: 56px; height: auto; }
  .kiosk-detail-text h3 { font-size: 16px; }
  .kiosk-detail-text p { font-size: 12px; }
  .kiosk-detail-actions { flex-direction: row; align-items: center; flex-wrap: wrap; }
  .kiosk-detail-actions > .kiosk-big { flex: 1; padding: 10px 6px; font-size: 16px; }
  .kiosk-qty button { width: 36px; height: 36px; font-size: 20px; }
}
`
