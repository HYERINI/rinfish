import type { PersistStorage, StorageValue } from 'zustand/middleware'

/**
 * 미룰 수 있는 저장소 (persist storage 감싸기). defer(f) 안에서 일어난 저장은 바로 쓰지 않고 delayMs 안에 한 번만 쓴다
 * (연사 소총이 쏠 때마다 저장본 전체를 JSON 으로 만들어 쓰지 않게). 다른 저장은 바로 쓰고, 그때 미룬 것은 버린다 (새 저장에 다 들어 있다).
 * flush: 미룬 것을 지금 쓴다 (탭을 숨기거나 닫을 때). inner 가 없으면(저장소를 못 쓰는 환경) storage 도 없다 (persist 가 저장하지 않는다)
 */
export function deferrableStorage<S>(inner: PersistStorage<S> | undefined, delayMs: number) {
  let deferring = false
  let pending: { name: string; value: StorageValue<S> } | null = null
  let timer: ReturnType<typeof setTimeout> | null = null
  const cancel = () => {
    pending = null
    if (timer !== null) clearTimeout(timer)
    timer = null
  }
  const flush = () => {
    const p = pending
    cancel()
    if (p) void inner?.setItem(p.name, p.value)
  }
  const storage: PersistStorage<S> | undefined = inner && {
    getItem: (name) => inner.getItem(name),
    setItem: (name, value) => {
      if (deferring) {
        pending = { name, value }
        timer ??= setTimeout(flush, delayMs)
        return
      }
      cancel()
      return inner.setItem(name, value)
    },
    removeItem: (name) => {
      cancel()
      return inner.removeItem(name)
    },
  }
  return {
    storage,
    flush,
    defer(f: () => void) {
      deferring = true
      try {
        f()
      } finally {
        deferring = false
      }
    },
  }
}
