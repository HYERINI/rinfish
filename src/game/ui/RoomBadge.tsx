import { useState } from 'react'
import { DEFAULT_LOOK } from '../data/characterParts'
import { lobbyErrors } from '../logic/roomKey'
import { useNetStore } from '../stores/netStore'
import { useProgressStore } from '../stores/progressStore'
import { useSessionStore } from '../stores/sessionStore'
import { button, safeRight, safeTop } from './styles'

const small = { ...button, padding: '4px 10px', fontSize: 13 }

/** 화면 오른쪽 위: 🔒 방 이름 · 👥 인원, 링크 복사·닉네임 바꾸기·나가기. 같이 하는 중에만 */
export function RoomBadge() {
  const phase = useNetStore((s) => s.phase)
  const room = useNetStore((s) => s.room)
  const count = useNetStore((s) => Object.keys(s.peers).length + 1)
  const nick = useNetStore((s) => s.nick)
  const mode = useSessionStore((s) => s.mode)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')
  if (phase === 'off' || !room || mode === 'cutscene' || mode === 'lobby' || mode === 'aquariumView') return null

  const copy = () => {
    const url = `${window.location.origin}${window.location.pathname}?room=${encodeURIComponent(room)}`
    void navigator.clipboard?.writeText(url).then(() => useSessionStore.getState().notify('링크를 복사했어요. 암호는 따로 알려 주세요'))
  }
  const saveNick = () => {
    // 닉네임 칸만 검사한다 (방 이름·암호는 이미 맞는 값)
    if (lobbyErrors({ room, password: 'xxxx', nick: draft }).includes('nick')) return
    useNetStore.getState().sendProfile(draft, useProgressStore.getState().look ?? DEFAULT_LOOK)
    setEditing(false)
  }
  const status = phase === 'reconnecting' ? ' · 다시 연결 중…' : phase === 'connecting' ? ' · 연결 중…' : ''

  return (
    <div style={{ position: 'absolute', top: safeTop(64), right: safeRight(16), background: 'rgba(0,0,0,0.6)', color: '#fff', borderRadius: 10, padding: '6px 10px', fontSize: 14, display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end', maxWidth: '70vw', pointerEvents: 'auto' }}>
      <span>
        🔒 {room} · 👥 {count}명{status}
      </span>
      <button style={small} onClick={copy}>
        링크 복사
      </button>
      {editing ? (
        <form
          style={{ display: 'flex', gap: 4 }}
          onSubmit={(e) => {
            e.preventDefault()
            saveNick()
          }}
        >
          <input
            value={draft}
            maxLength={20}
            autoFocus
            aria-label="닉네임"
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') setEditing(false)
            }}
            style={{ width: 90, fontSize: 14 }}
          />
          <button type="submit" style={small}>
            저장
          </button>
        </form>
      ) : (
        <button
          style={small}
          onClick={() => {
            setDraft(nick)
            setEditing(true)
          }}
        >
          ✏️ {nick}
        </button>
      )}
      <button style={small} onClick={() => useNetStore.getState().leave()}>
        나가기
      </button>
    </div>
  )
}
