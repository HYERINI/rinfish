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

/** 노치·둥근 모서리(안전 영역)를 피해서 가장자리에서 px 만큼. 안전 영역이 없는 화면에선 px 그대로 */
export const safeTop = (px: number) => `calc(${px}px + env(safe-area-inset-top, 0px))`
export const safeBottom = (px: number) => `calc(${px}px + env(safe-area-inset-bottom, 0px))`
export const safeLeft = (px: number) => `calc(${px}px + env(safe-area-inset-left, 0px))`
export const safeRight = (px: number) => `calc(${px}px + env(safe-area-inset-right, 0px))`

/** 터치 화면의 안내 문구: 아래쪽은 조이스틱·버튼 자리라 위쪽(코인·버튼 줄 아래)에 띄운다 */
export const touchHint: CSSProperties = {
  ...hint,
  bottom: 'auto',
  top: safeTop(112),
  whiteSpace: 'normal',
  textAlign: 'center',
  width: 'max-content',
  maxWidth: 'min(420px, 88vw)',
  boxSizing: 'border-box',
  fontSize: 15,
}
