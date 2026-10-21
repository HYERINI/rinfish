import type { CSSProperties } from 'react'

/** 캔버스 위를 덮는 레이어. 클릭은 통과시키고, 버튼에서만 받는다 */
export const overlayLayer: CSSProperties = {
  position: 'absolute',
  inset: 0,
  zIndex: 1000,
  pointerEvents: 'none',
  color: '#fff',
}

export const panelBox: CSSProperties = {
  pointerEvents: 'auto',
  zIndex: 1000,
  position: 'absolute',
  top: '50%',
  left: '50%',
  transform: 'translate(-50%, -50%)',
  width: 'min(560px, 90vw)',
  maxHeight: '80vh',
  overflowY: 'auto',
  background: 'rgba(20, 30, 45, 0.95)',
  color: '#fff',
  borderRadius: 12,
  padding: 20,
  boxSizing: 'border-box',
}

export const button: CSSProperties = {
  pointerEvents: 'auto',
  padding: '6px 14px',
  cursor: 'pointer',
  borderRadius: 6,
  border: 'none',
  background: '#ffd166',
  color: '#222',
  fontWeight: 600,
}

export const disabledButton: CSSProperties = {
  ...button,
  background: '#555',
  color: '#999',
  cursor: 'not-allowed',
}

/** 화면 아래 가운데 안내 문구 */
export const hint: CSSProperties = {
  position: 'absolute',
  bottom: 32,
  left: '50%',
  transform: 'translateX(-50%)',
  background: 'rgba(0, 0, 0, 0.6)',
  padding: '8px 16px',
  borderRadius: 8,
  fontSize: 16,
  whiteSpace: 'nowrap',
}
