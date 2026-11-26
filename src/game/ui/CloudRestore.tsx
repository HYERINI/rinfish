import { useState, type CSSProperties } from 'react'
import { cloud } from '../net/cloudBoot'
import { summarize, type ServerSave } from '../logic/cloudSync'
import { formatCode, normalizeCode } from '../logic/recoveryCode'
import { useCloudStore } from '../stores/cloudStore'
import { useNetStore } from '../stores/netStore'
import { useProgressStore } from '../stores/progressStore'
import { useSessionStore } from '../stores/sessionStore'
import { BackupRow } from './CloudBackup'
import { copyCode } from './copyCode'
import { button } from './styles'

const input: CSSProperties = { width: '100%', padding: '10px 12px', fontSize: 16, borderRadius: 8, border: '1px solid #ccc', boxSizing: 'border-box', pointerEvents: 'auto', letterSpacing: 1 }
const note: CSSProperties = { margin: 0, fontSize: 13, opacity: 0.75 }

/** ESC 메뉴: 내 복구 코드와 복사, 코드로 이어 하기, 덮어쓰기 전 진행으로 되돌리기. 서버 저장이 꺼져 있으면 없다 */
export function CloudCodeSection() {
  const code = useCloudStore((s) => s.code)
  const backup = useCloudStore((s) => s.backup)
  // 같이 하기 방 안에서는 진행을 바꾸는 일(되돌리기)을 숨긴다 (생김새가 방과 어긋난다)
  const online = useNetStore((s) => s.phase !== 'off')
  const [open, setOpen] = useState(false)
  if (!cloud || !code) return null
  const copy = () => void copyCode(formatCode(code), navigator.clipboard, (t) => useSessionStore.getState().notify(t))
  return (
    <div style={{ marginTop: 20, paddingTop: 16, borderTop: '1px solid rgba(255,255,255,0.15)', display: 'flex', flexDirection: 'column', gap: 8 }}>
      <h3 style={{ margin: 0, fontSize: 15, opacity: 0.85 }}>☁️ 진행 저장</h3>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <code style={{ fontSize: 16, letterSpacing: 1, userSelect: 'all' }}>{formatCode(code)}</code>
        <button style={{ ...button, minHeight: 32 }} onClick={copy}>
          복사
        </button>
      </div>
      <p style={note}>브라우저를 지우거나 다른 기기에서 이어 하려면 이 코드가 필요해요. 남에게 보여 주지 마세요.</p>
      {backup && !online && <BackupRow backup={backup} onRestore={() => cloud!.restoreBackup()} onClear={() => cloud!.clearBackup()} />}
      {open ? <CloudRestoreForm onDone={() => setOpen(false)} /> : (
        <button style={button} onClick={() => setOpen(true)}>
          🔑 코드로 이어 하기
        </button>
      )}
    </div>
  )
}

/** 코드 입력 → 그 진행 미리보기 → 확인하면 바꾼다. 같이 하기 방 안에서는 막는다 */
export function CloudRestoreForm({ onDone }: { onDone: () => void }) {
  const online = useNetStore((s) => s.phase !== 'off')
  const [text, setText] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [found, setFound] = useState<{ code: string; save: ServerSave } | null>(null)
  const [busy, setBusy] = useState(false)
  if (!cloud) return null
  if (online) return <p style={note}>같이 하기 방을 나온 뒤에 할 수 있어요.</p>

  const look = async () => {
    setBusy(true)
    setError(null)
    const r = await cloud!.preview(text)
    setBusy(false)
    if (r === 'bad') return setError('코드 모양이 틀렸어요 (20자)')
    if (r === 'none') return setError('그 코드로 저장된 진행이 없어요')
    if (r === 'error') return setError('서버에 연결할 수 없어요. 잠시 뒤 다시 해 주세요')
    if (normalizeCode(text) === cloud!.code()) return setError('지금 쓰고 있는 코드예요')
    setFound({ code: normalizeCode(text)!, save: r })
  }
  const confirm = async () => {
    if (!found) return
    setBusy(true)
    // 확인하는 지금 그 저장을 다시 읽어 받는다 (미리보기 뒤 바뀌었을 수 있다)
    const switched = await cloud!.switchTo(found.code)
    setBusy(false)
    if (!switched) {
      // 서버와 아직 못 맞췄거나, 지금 진행을 올리지 못했거나, 그 저장을 다시 읽지 못했으면 바꾸지 않는다
      setFound(null)
      return setError('지금은 바꾸지 못했어요. 서버 연결을 확인하고 잠시 뒤 다시 해 주세요')
    }
    useCloudStore.setState({ code: found.code })
    useSessionStore.getState().notify('그 진행으로 바꿨어요')
    onDone()
  }

  if (found) {
    const now = useProgressStore.getState()
    const next = summarize(found.save.data) ?? { coins: 0, dex: 0 }
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <p style={{ margin: 0, fontSize: 14 }}>
          지금 이 브라우저의 진행(코인 {now.coins}, 도감 {Object.keys(now.dex).length}종)을 그 진행(코인 {next.coins}, 도감 {next.dex}종)으로 바꿀까요?
        </p>
        <p style={note}>지금 진행은 지금 코드로 서버에 남아 있어요.</p>
        <div style={{ display: 'flex', gap: 8 }}>
          <button style={{ ...button, flex: 1 }} disabled={busy} onClick={() => void confirm()}>
            {busy ? '바꾸는 중…' : '바꾸기'}
          </button>
          <button style={{ ...button, flex: 1, opacity: 0.8 }} disabled={busy} onClick={() => setFound(null)}>
            취소
          </button>
        </div>
      </div>
    )
  }
  return (
    <form
      style={{ display: 'flex', flexDirection: 'column', gap: 8 }}
      onSubmit={(e) => {
        e.preventDefault()
        void look()
      }}
    >
      <input style={input} placeholder="XXXX-XXXX-XXXX-XXXX-XXXX" aria-label="복구 코드" value={text} maxLength={40} onChange={(e) => setText(e.target.value)} />
      {error && <p style={{ ...note, color: '#ff8a80', opacity: 1 }}>{error}</p>}
      <div style={{ display: 'flex', gap: 8 }}>
        <button type="submit" style={{ ...button, flex: 1 }} disabled={busy}>
          {busy ? '찾는 중…' : '찾기'}
        </button>
        <button type="button" style={{ ...button, flex: 1, opacity: 0.8 }} onClick={onDone}>
          닫기
        </button>
      </div>
    </form>
  )
}
