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
