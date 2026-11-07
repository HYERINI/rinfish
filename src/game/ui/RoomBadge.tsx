import { useState } from 'react'
import { DEFAULT_LOOK } from '../data/characterParts'
import { lobbyErrors } from '../logic/roomKey'
import { useNetStore } from '../stores/netStore'
import { useProgressStore } from '../stores/progressStore'
import { useSessionStore } from '../stores/sessionStore'
import { useTouchUi } from '../input/touchDevice'
import { button, safeRight, safeTop } from './styles'
import { useNarrow } from './useNarrow'

const small = { ...button, padding: '4px 10px', fontSize: 13 }

/**
 * 화면 오른쪽 위: 🔒 방 이름 · 👥 인원, 링크 복사·닉네임 바꾸기·나가기. 같이 하는 중에만.
 * 넓은 화면은 가운데 목표 안내 아래 높이에 펼쳐 두고, 좁은 화면(폰)은 위쪽 버튼 줄 바로 밑에 작게 두었다가 누르면 펼친다
 */
export function RoomBadge() {
  const phase = useNetStore((s) => s.phase)
  const room = useNetStore((s) => s.room)
  const count = useNetStore((s) => Object.keys(s.peers).length + 1)
  const nick = useNetStore((s) => s.nick)
  const mode = useSessionStore((s) => s.mode)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')
  const narrowScreen = useNarrow()
  const touchUi = useTouchUi()
  const narrow = narrowScreen || touchUi
  const [expanded, setExpanded] = useState(false)
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
  const box = { position: 'absolute' as const, top: safeTop(narrow ? 52 : 100), right: safeRight(16), background: 'rgba(0,0,0,0.6)', color: '#fff', borderRadius: 10, padding: narrow ? '3px 10px' : '6px 10px', fontSize: narrow ? 13 : 14, display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' as const, justifyContent: 'flex-end', maxWidth: 'min(420px, 80vw)', pointerEvents: 'auto' as const, zIndex: 5 }
  const label = `🔒 ${room} · 👥 ${count}명${status}`

  if (narrow && !expanded) {
    return (
      <button style={{ ...box, border: 'none', cursor: 'pointer' }} onClick={() => setExpanded(true)} title="방 메뉴 펼치기">
        {label} ▾
      </button>
    )
  }
  return (
    <div style={box}>
      {narrow ? (
        <button style={{ ...small, background: 'transparent', color: '#fff' }} onClick={() => setExpanded(false)} title="방 메뉴 접기">
          {label} ▴
        </button>
      ) : (
        <span>{label}</span>
      )}
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
