import { useRef, type ReactNode } from 'react'

/**
 * 손가락을 뗄 때 버튼 위면 누른 것으로 친다 (누르는 순간 바로 패널이 열리면, 떼는 손가락이 새로 열린 패널 버튼을 누를 수 있다).
 * 다른 손가락이 조이스틱을 밀고 있어도 따로 받는다
 */
export function TapButton({ className, onTap, ariaLabel, children }: { className: string; onTap: () => void; ariaLabel?: string; children: ReactNode }) {
  const down = useRef<number | null>(null)
  return (
    <button
      className={className}
      aria-label={ariaLabel}
      onPointerDown={(e) => {
        e.preventDefault()
        e.currentTarget.setPointerCapture(e.pointerId)
        down.current = e.pointerId
      }}
      onPointerUp={(e) => {
        if (down.current !== e.pointerId) return
        down.current = null
        const r = e.currentTarget.getBoundingClientRect()
        if (e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom) onTap()
      }}
      onPointerCancel={() => (down.current = null)}
      onClick={(e) => {
        // 키보드(Enter·Space)로 누른 경우만. 포인터는 위에서 처리했다
        if (e.detail === 0) onTap()
      }}
    >
      {children}
    </button>
  )
}
