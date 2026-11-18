import { useEffect, useState } from 'react'

/** 위쪽 버튼 줄(🔊·어항 구경·도감·메뉴)이 가운데까지 오는 좁은 화면 */
const NARROW_BELOW = 900

export function useNarrow(): boolean {
  const [narrow, setNarrow] = useState(() => window.innerWidth < NARROW_BELOW)
  useEffect(() => {
    const onResize = () => setNarrow(window.innerWidth < NARROW_BELOW)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])
  return narrow
}

/** 지금 화면 폭 (창 크기가 바뀌면 다시 그린다) */
export function useViewWidth(): number {
  const [width, setWidth] = useState(() => window.innerWidth)
  useEffect(() => {
    const onResize = () => setWidth(window.innerWidth)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])
  return width
}
