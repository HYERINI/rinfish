/** 한 브라우저에서 게임 탭은 하나만 (진행 사본·서버 저장 정보를 탭끼리 나눠 쓰기 때문) */
export const TAB_LOCK = 'seommaeul-game'
/** 새로고침 직후 옛 페이지가 잠금을 놓기를 기다리는 시간 */
const RETRY_MS = 500

/** 잠금을 바로 잡을 수 있으면 잡고 페이지가 닫힐 때까지 쥔다 */
function tryHold(locks: LockManager): Promise<boolean> {
  return new Promise((resolve, reject) => {
    locks
      .request(TAB_LOCK, { ifAvailable: true }, (lock) => {
        if (!lock) return resolve(false)
        resolve(true)
        return new Promise<never>(() => {})
      })
      .catch(reject)
  })
}

/** 이 탭이 게임을 해도 되면 true. Web Locks 가 없거나 막힌 브라우저는 잠금 없이 간다 */
export async function holdTabLock(locks: LockManager | undefined): Promise<boolean> {
  if (!locks) return true
  try {
    if (await tryHold(locks)) return true
    await new Promise((r) => setTimeout(r, RETRY_MS))
    return await tryHold(locks)
  } catch {
    return true
  }
}
