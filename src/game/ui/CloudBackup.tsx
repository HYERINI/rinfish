import { useState, type CSSProperties } from 'react'
import { summarize } from '../logic/cloudSync'
import type { CloudBackup } from '../net/cloudSave'
import { button } from './styles'

const note: CSSProperties = { margin: 0, fontSize: 13, opacity: 0.75 }

/** 11월 26일 14:05 */
function when(ms: number): string {
  const d = new Date(ms)
  const two = (n: number) => String(n).padStart(2, '0')
  return `${d.getMonth() + 1}월 ${d.getDate()}일 ${two(d.getHours())}:${two(d.getMinutes())}`
}

function summary(raw: string) {
  try {
    return summarize(JSON.parse(raw)) ?? { coins: 0, dex: 0 }
  } catch {
    return { coins: 0, dex: 0 }
  }
}

/** ESC 메뉴: 서버 것으로 덮어쓰기 전 진행으로 되돌리기 (확인 뒤) 와 백업 지우기 */
export function BackupRow({ backup, onRestore, onClear }: { backup: CloudBackup; onRestore: () => Promise<boolean>; onClear: () => void }) {
  const [asking, setAsking] = useState(false)
  const [busy, setBusy] = useState(false)
  const s = summary(backup.raw)
  if (asking) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <p style={{ margin: 0, fontSize: 14 }}>
          지금 진행을 덮어쓰기 전 진행(코인 {s.coins}, 도감 {s.dex}종)으로 되돌릴까요? 되돌린 진행이 서버에 가장 새 진행으로 올라가요.
        </p>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            style={{ ...button, flex: 1 }}
            disabled={busy}
            onClick={async () => {
              setBusy(true)
              await onRestore()
              setBusy(false)
              setAsking(false)
            }}
          >
            {busy ? '되돌리는 중…' : '되돌리기'}
          </button>
          <button style={{ ...button, flex: 1, opacity: 0.8 }} disabled={busy} onClick={() => setAsking(false)}>
            취소
          </button>
        </div>
      </div>
    )
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <button style={button} onClick={() => setAsking(true)}>
        ↩️ 덮어쓰기 전 진행으로 되돌리기 (코인 {s.coins}, 도감 {s.dex}종, {when(backup.savedAt)})
      </button>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <p style={{ ...note, flex: 1 }}>다른 곳의 진행으로 바뀌기 전 이 브라우저의 진행이에요.</p>
        <button style={{ ...button, minHeight: 28, fontSize: 12, opacity: 0.8 }} onClick={onClear}>
          백업 지우기
        </button>
      </div>
    </div>
  )
}
