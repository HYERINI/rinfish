import { useEffect, useState } from 'react'

/** 잠깐(ms) 보였다 사라지는 한 줄 알림. 같은 글이어도 다시 부르면 처음부터 센다 */
export function useFlash(ms = 1600): [string | null, (text: string) => void] {
  const [flash, setFlash] = useState<{ text: string; id: number } | null>(null)
  useEffect(() => {
    if (!flash) return
    const id = setTimeout(() => setFlash(null), ms)
    return () => clearTimeout(id)
  }, [flash, ms])
  return [flash?.text ?? null, (text) => setFlash((f) => ({ text, id: (f?.id ?? 0) + 1 }))]
}
