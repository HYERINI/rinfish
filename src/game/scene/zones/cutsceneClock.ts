import type { ZoneId } from '../../data/types'
import { useSessionStore } from '../../stores/sessionStore'

/** zoneId 연출이 시작된 뒤 지난 시간(초). 그 구역 연출 중이 아니면 null */
export function cutsceneTime(zoneId: ZoneId): number | null {
  const c = useSessionStore.getState().cutscene
  return c && c.zoneId === zoneId ? performance.now() / 1000 - c.startedAt : null
}
