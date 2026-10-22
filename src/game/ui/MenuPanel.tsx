import type { ReactNode } from 'react'
import { sensitivityToSlider, sliderToSensitivity } from '../logic/settings'
import { useSessionStore } from '../stores/sessionStore'
import { useSettingsStore } from '../stores/settingsStore'
import { Panel } from './Panel'
import { button } from './styles'

export function MenuPanel({ onExit }: { onExit?: () => void }) {
  const setMode = useSessionStore((s) => s.setMode)
  return (
    <Panel title="메뉴">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <button style={button} onClick={() => setMode('explore')}>
          계속하기
        </button>
        <button style={button} onClick={() => setMode('dex')}>
          도감
        </button>
        <button style={button} onClick={() => onExit?.()}>
          로비로 나가기
        </button>
      </div>
      <SettingsSection />
    </Panel>
  )
}

/** 설정: 음악 볼륨·음소거, 마우스 감도·위아래 반전. 바꾸는 즉시 적용되고 저장된다 */
function SettingsSection() {
  const volume = useSettingsStore((s) => s.musicVolume)
  const muted = useSettingsStore((s) => s.musicMuted)
  const sensitivity = useSettingsStore((s) => s.lookSensitivity)
  const invertY = useSettingsStore((s) => s.invertY)
  const { setMusicVolume, toggleMusicMuted, setLookSensitivity, setInvertY } = useSettingsStore.getState()

  return (
    <div style={{ marginTop: 20, paddingTop: 16, borderTop: '1px solid rgba(255,255,255,0.15)', display: 'flex', flexDirection: 'column', gap: 12 }}>
      <h3 style={{ margin: 0, fontSize: 15, opacity: 0.85 }}>설정</h3>
      <Row label="음악">
        <input
          type="range"
          aria-label="음악 볼륨"
          min={0}
          max={100}
          step={1}
          value={Math.round((muted ? 0 : volume) * 100)}
          onChange={(e) => setMusicVolume(Number(e.target.value) / 100)}
          style={{ flex: 1, pointerEvents: 'auto' }}
        />
        <span style={valueText}>{muted ? '꺼짐' : `${Math.round(volume * 100)}%`}</span>
        <button style={{ ...button, minWidth: 64 }} onClick={toggleMusicMuted}>
          {muted ? '켜기' : '끄기'}
        </button>
      </Row>
      <Row label="마우스 감도">
        <input
          type="range"
          aria-label="마우스 감도"
          min={0}
          max={100}
          step={1}
          value={Math.round(sensitivityToSlider(sensitivity))}
          onChange={(e) => setLookSensitivity(sliderToSensitivity(Number(e.target.value)))}
          style={{ flex: 1, pointerEvents: 'auto' }}
        />
        <span style={valueText}>{Math.round(sensitivityToSlider(sensitivity))}</span>
      </Row>
      <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, pointerEvents: 'auto', cursor: 'pointer' }}>
        <input type="checkbox" checked={invertY} onChange={(e) => setInvertY(e.target.checked)} />
        마우스 위아래 반전
      </label>
      <div style={{ fontSize: 12, opacity: 0.6 }}>탐험 중 화면을 클릭하면 마우스로 시점을 돌린다 · ESC 로 풀고 메뉴 · M 음악 켜기/끄기</div>
    </div>
  )
}

const valueText = { width: 40, textAlign: 'right', fontSize: 13, opacity: 0.85 } as const

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 14 }}>
      <span style={{ width: 80 }}>{label}</span>
      {children}
    </div>
  )
}
