import { STARTUP_WAIT_MS, saveUrl } from '../logic/cloudSync'
import { SAVE_KEY, flushProgressSave, onProgressSaved, useProgressStore } from '../stores/progressStore'
import { useCloudStore } from '../stores/cloudStore'
import { useSessionStore } from '../stores/sessionStore'
import { createCloudSave, type CloudSave } from './cloudSave'
import { ROOM_SERVER } from './serverUrl'

function localStore(): Storage | null {
  try {
    return window.localStorage
  } catch {
    return null
  }
}

/** 서버 저장. 방 서버 주소가 없으면 null (지금처럼 브라우저에만 저장) */
export const cloud: CloudSave | null = ROOM_SERVER
  ? createCloudSave({
      base: saveUrl(ROOM_SERVER),
      fetch: (...a) => fetch(...a),
      storage: localStore(),
      now: () => Date.now(),
      readSave: () => localStore()?.getItem(SAVE_KEY) ?? null,
      writeSave: (raw) => localStore()?.setItem(SAVE_KEY, raw),
      rehydrate: () => Promise.resolve(useProgressStore.persist.rehydrate()),
      flushLocal: flushProgressSave,
      onStatus: (status) => useCloudStore.setState({ status, code: cloud?.code() ?? null }),
      notify: (text) => useSessionStore.getState().notify(text),
    })
  : null

let started = false

/** 한 번만: 서버와 맞추기 시작. 로딩 화면은 끝나거나 3초가 지나면 닫힐 수 있다 */
export function startCloud() {
  if (!cloud || started) return
  started = true
  useCloudStore.setState({ ready: false, code: cloud.code() })
  onProgressSaved(() => cloud.markDirty())
  const ready = () => useCloudStore.setState({ ready: true, code: cloud.code() })
  const wait = setTimeout(ready, STARTUP_WAIT_MS)
  void cloud.start().finally(() => {
    clearTimeout(wait)
    ready()
  })
  window.addEventListener('pagehide', () => cloud.hide())
  document.addEventListener('visibilitychange', () => document.hidden && cloud.hide())
}
