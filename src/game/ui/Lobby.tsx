import { useEffect, useState, type CSSProperties } from 'react'
import type { HubHint } from '../Game'
import { DEFAULT_LOOK } from '../data/characterParts'
import { NET } from '../data/net'
import type { JoinMode } from '../logic/netProtocol'
import { lobbyErrors, readRoomParam, type LobbyField } from '../logic/roomKey'
import { useNetStore, type NetError } from '../stores/netStore'
import { useProgressStore } from '../stores/progressStore'
import { useSessionStore } from '../stores/sessionStore'
import { button, panelBox } from './styles'

const ERROR_TEXT: Record<NetError, string> = {
  unreachable: '방 서버에 연결할 수 없어요. 잠시 뒤 다시 해 주세요',
  'room-exists': '이미 있는 방 이름이에요',
  'no-room': '그런 방이 없어요',
  'bad-password': '암호가 틀렸어요',
  full: `방이 꽉 찼어요 (${NET.maxPlayers}명)`,
  version: '게임을 새로고침해 주세요 (버전이 달라요)',
  'bad-hello': '연결에 문제가 있어요. 다시 해 주세요',
}
const FIELD_TEXT: Record<LobbyField, string> = {
  room: `방 이름은 ${NET.roomName[0]}~${NET.roomName[1]}자`,
  password: `암호는 ${NET.password[0]}~${NET.password[1]}자`,
  nick: `닉네임은 ${NET.nick[0]}~${NET.nick[1]}자`,
}
const input: CSSProperties = { width: '100%', padding: '10px 12px', fontSize: 16, borderRadius: 8, border: '1px solid #ccc', boxSizing: 'border-box', pointerEvents: 'auto' }
const errorText: CSSProperties = { margin: 0, color: '#ff8a80', fontSize: 14 }

/**
 * 시작 창: 혼자 하기 / 같이 하기(방 만들기·들어가기). 공유 링크(?room=)로 오면 들어가기 탭에 방 이름이 채워져 있다.
 * 허브 로비에서 왔으면 이름을 채우고, 허브 방 친구들과 바로 들어가는 버튼과 허브로 돌아가는 버튼을 띄운다
 */
export function Lobby({ onExit, hub }: { onExit?: () => void; hub?: HubHint }) {
  const phase = useNetStore((s) => s.phase)
  const error = useNetStore((s) => s.error)
  const [linkRoom] = useState(() => readRoomParam(window.location.search))
  const [tab, setTab] = useState<JoinMode>(linkRoom ? 'join' : 'create')
  const [room, setRoom] = useState(() => linkRoom || useNetStore.getState().lastRoom)
  const [password, setPassword] = useState('')
  const [nick, setNick] = useState(() => hub?.name ?? useNetStore.getState().nick)
  const [bad, setBad] = useState<LobbyField[]>([])
  const setMode = useSessionStore((s) => s.setMode)

  // 들어가지면 로비를 닫는다
  useEffect(() => {
    if (phase === 'online') setMode('explore')
  }, [phase, setMode])

  const submit = () => {
    const errors = lobbyErrors({ room, password, nick })
    setBad(errors)
    if (errors.length > 0) return
    void useNetStore.getState().join({ mode: tab, room, password, nick, look: useProgressStore.getState().look ?? DEFAULT_LOOK })
  }
  const joinHub = (code: string) => {
    const errors = lobbyErrors({ room: 'hub', password: 'hub-room', nick })
    setBad(errors)
    if (errors.length > 0) return
    void useNetStore.getState().joinHub({ code, nick, look: useProgressStore.getState().look ?? DEFAULT_LOOK })
  }
  const busy = phase === 'connecting'

  return (
    <div style={{ ...panelBox, width: 'min(400px, 92vw)' }}>
      <h2 style={{ margin: '0 0 12px', fontSize: 22 }}>🎣 낚시섬</h2>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, width: '100%' }}>
        {hub?.room && (
          <button style={{ ...button, fontSize: 18, padding: '10px 14px', background: '#81c784' }} disabled={busy} onClick={() => joinHub(hub.room!)}>
            {busy ? '연결 중…' : '👥 허브 방 친구들과 같이 하기'}
          </button>
        )}
        <button
          style={{ ...button, fontSize: 18, padding: '10px 14px' }}
          onClick={() => {
            // 연결 중이던 것도 그만둔다 (나중에 몰래 붙지 않게)
            useNetStore.getState().leave()
            setMode('explore')
          }}
        >
          혼자 하기
        </button>
        <div style={{ borderTop: '1px solid rgba(255,255,255,0.25)', paddingTop: 12 }}>
          <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
            {(['create', 'join'] as const).map((t) => (
              <button key={t} style={{ ...button, flex: 1, opacity: tab === t ? 1 : 0.45 }} onClick={() => setTab(t)}>
                {t === 'create' ? '🔒 방 만들기' : '🚪 들어가기'}
              </button>
            ))}
          </div>
          <form
            style={{ display: 'flex', flexDirection: 'column', gap: 8 }}
            onSubmit={(e) => {
              e.preventDefault()
              submit()
            }}
          >
            <input style={input} placeholder="방 이름" aria-label="방 이름" value={room} maxLength={40} onChange={(e) => setRoom(e.target.value)} />
            <input style={input} placeholder="암호" aria-label="암호" type="password" value={password} maxLength={64} onChange={(e) => setPassword(e.target.value)} />
            <input style={input} placeholder="닉네임" aria-label="닉네임" value={nick} maxLength={20} onChange={(e) => setNick(e.target.value)} />
            {bad.map((f) => (
              <p key={f} style={errorText}>
                {FIELD_TEXT[f]}
              </p>
            ))}
            {error && <p style={errorText}>{ERROR_TEXT[error]}</p>}
            <button type="submit" style={{ ...button, fontSize: 18, padding: '10px 14px' }} disabled={busy}>
              {busy ? '연결 중…' : tab === 'create' ? '방 만들고 들어가기' : '들어가기'}
            </button>
          </form>
          <p style={{ margin: '8px 0 0', fontSize: 13, opacity: 0.75 }}>암호를 아는 사람끼리만 같은 섬에서 만나요. 암호는 저장되지 않아요.</p>
        </div>
        {onExit && (
          <button
            style={{ ...button, opacity: 0.85 }}
            onClick={() => {
              useNetStore.getState().leave()
              onExit()
            }}
          >
            🏠 허브 로비로
          </button>
        )}
      </div>
    </div>
  )
}
