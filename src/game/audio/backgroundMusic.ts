import { useEffect } from 'react'
import { MUSIC } from '../data/settings'
import { musicGain, musicTrackFor, type MusicTrack } from '../logic/music'
import { useSessionStore } from '../stores/sessionStore'
import { useSettingsStore } from '../stores/settingsStore'

const trackUrl = (track: MusicTrack) => `${import.meta.env.BASE_URL}${MUSIC.tracks[track]}`

/**
 * 배경 음악 (WebAudio). 곡은 버퍼로 받아 끊김 없이 반복(loop)하고, 곡마다 gain 을 두어 겹쳐 넘긴다.
 * 소리 크기: 곡 gain(0/1, 크로스페이드) × master gain(볼륨·음소거·탭 숨김)
 */
class BackgroundMusic {
  private ctx: AudioContext | null = null
  private master: GainNode | null = null
  private tracks = new Map<MusicTrack, { gain: GainNode; started: boolean }>()
  private current: MusicTrack = 'island'
  private volume = 0
  private hidden = false
  private suspendTimer: ReturnType<typeof setTimeout> | null = null
  private disposed = false

  /** 처음 사용자 입력(클릭·키) 때 부른다. 브라우저는 그 전엔 소리를 막는다 */
  start(track: MusicTrack, volume: number) {
    if (this.ctx || this.disposed) return
    const ctx = new AudioContext()
    this.ctx = ctx
    this.master = ctx.createGain()
    this.master.gain.value = 0
    this.master.connect(ctx.destination)
    this.volume = volume
    this.current = track
    void ctx.resume()
    this.ensureTrack(track)
    this.tracks.get(track)?.gain.gain.setValueAtTime(1, ctx.currentTime)
    this.applyMaster(MUSIC.fadeIn)
  }

  get started(): boolean {
    return this.ctx !== null
  }

  /** 디버그·확인용: 지금 상태 */
  debugState() {
    return { state: this.ctx?.state ?? 'none', time: this.ctx?.currentTime ?? 0, gain: this.master?.gain.value ?? 0, track: this.current, volume: this.volume, hidden: this.hidden }
  }

  setVolume(volume: number) {
    this.volume = volume
    this.applyMaster(MUSIC.volumeFade)
  }

  /** 곡 바꾸기: 지금 곡은 줄이고 새 곡은 키운다 (겹쳐 넘기기) */
  setTrack(track: MusicTrack) {
    if (track === this.current) return
    this.current = track
    if (!this.ctx) return
    this.ensureTrack(track)
    const now = this.ctx.currentTime
    for (const [id, t] of this.tracks) t.gain.gain.setTargetAtTime(id === track ? 1 : 0, now, MUSIC.crossfade / 3)
  }

  /** 탭을 숨기면 소리를 줄이고 멈춘다(CPU도 쉬게). 돌아오면 이어서 다시 키운다 */
  setHidden(hidden: boolean) {
    if (hidden === this.hidden) return
    this.hidden = hidden
    const ctx = this.ctx
    if (!ctx) return
    if (this.suspendTimer) clearTimeout(this.suspendTimer)
    this.suspendTimer = null
    if (hidden) {
      this.applyMaster(MUSIC.hideFade / 3)
      this.suspendTimer = setTimeout(() => void ctx.suspend(), MUSIC.hideFade * 1000)
    } else {
      void ctx.resume()
      this.applyMaster(MUSIC.volumeFade)
    }
  }

  dispose() {
    this.disposed = true
    if (this.suspendTimer) clearTimeout(this.suspendTimer)
    void this.ctx?.close()
    this.ctx = null
    this.master = null
    this.tracks.clear()
  }

  private applyMaster(fade: number) {
    if (!this.ctx || !this.master) return
    const target = this.hidden ? 0 : this.volume
    this.master.gain.cancelScheduledValues(this.ctx.currentTime)
    this.master.gain.setTargetAtTime(target, this.ctx.currentTime, Math.max(fade / 3, 0.01))
  }

  /** 곡을 처음 쓸 때 받아서 반복 재생을 건다. gain 은 0 에서 시작한다 (키우는 건 부른 쪽) */
  private ensureTrack(track: MusicTrack) {
    const ctx = this.ctx
    if (!ctx || !this.master || this.tracks.get(track)?.started) return
    const gain = ctx.createGain()
    gain.gain.value = 0
    gain.connect(this.master)
    const entry = { gain, started: true }
    this.tracks.set(track, entry)
    fetch(trackUrl(track))
      .then((r) => {
        if (!r.ok) throw new Error(`${r.status}`)
        return r.arrayBuffer()
      })
      .then((data) => ctx.decodeAudioData(data))
      .then((buffer) => {
        if (this.ctx !== ctx) return // 그새 게임을 나갔다
        const source = ctx.createBufferSource()
        source.buffer = buffer
        source.loop = true
        source.connect(gain)
        source.start()
      })
      .catch((err: unknown) => {
        // 음악이 없어도 게임은 돌아가야 한다. 다음에 다시 시도할 수 있게 비워 둔다
        console.warn('배경 음악을 불러오지 못했다', track, err)
        if (this.tracks.get(track) === entry) this.tracks.delete(track)
      })
  }
}

/** 지금 게임의 배경 음악 (게임 밖에서 확인용). Game 이 떠 있는 동안만 있다 */
export let activeMusic: BackgroundMusic | null = null

/**
 * Game 이 떠 있는 동안 배경 음악을 튼다. 첫 클릭·키 입력 때 시작해서 서서히 커지고,
 * 볼륨·음소거 설정과 화면(어항 크게 보기)에 따라 바뀌고, 탭을 숨기면 멈추고, Game 이 사라지면 끈다.
 * M 키로 음소거를 켜고 끈다
 */
export function useBackgroundMusic() {
  useEffect(() => {
    const music = new BackgroundMusic()
    activeMusic = music
    const volume = () => {
      const s = useSettingsStore.getState()
      return musicGain(s.musicVolume, s.musicMuted)
    }

    const onGesture = () => {
      if (music.started) return
      music.start(musicTrackFor(useSessionStore.getState().mode), volume())
      music.setHidden(document.hidden)
    }
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'KeyM' && !e.repeat && !(e.target instanceof HTMLInputElement)) useSettingsStore.getState().toggleMusicMuted()
    }
    const onVisibility = () => music.setHidden(document.hidden)
    // 캡처 단계에서 받아야 다른 곳에서 전파를 막아도 시작한다
    window.addEventListener('pointerdown', onGesture, true)
    window.addEventListener('keydown', onGesture, true)
    window.addEventListener('keydown', onKeyDown)
    document.addEventListener('visibilitychange', onVisibility)
    const unsubSettings = useSettingsStore.subscribe(() => music.setVolume(volume()))
    const unsubMode = useSessionStore.subscribe((s) => music.setTrack(musicTrackFor(s.mode)))

    return () => {
      window.removeEventListener('pointerdown', onGesture, true)
      window.removeEventListener('keydown', onGesture, true)
      window.removeEventListener('keydown', onKeyDown)
      document.removeEventListener('visibilitychange', onVisibility)
      unsubSettings()
      unsubMode()
      music.dispose()
      if (activeMusic === music) activeMusic = null
    }
  }, [])
}
