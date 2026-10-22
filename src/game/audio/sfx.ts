import { musicGain } from '../logic/music'
import { useSettingsStore } from '../stores/settingsStore'

/** 효과음 크기 (음악 볼륨 기준 배율). 음소거(M)면 효과음도 끈다 */
const SFX_LEVEL = 0.9

let ctx: AudioContext | null = null
let noise: AudioBuffer | null = null

function context(): AudioContext | null {
  if (typeof AudioContext === 'undefined') return null
  if (!ctx) ctx = new AudioContext()
  if (ctx.state === 'suspended') void ctx.resume()
  return ctx
}

/** 0.3초짜리 흰 소음. 아삭거리는 소리의 재료 */
function noiseBuffer(c: AudioContext): AudioBuffer {
  if (noise) return noise
  noise = c.createBuffer(1, Math.floor(c.sampleRate * 0.3), c.sampleRate)
  const data = noise.getChannelData(0)
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1
  return noise
}

/**
 * 한 입 씹는 소리 (파일 없이 만든다): 아삭아삭 짧은 소음 몇 번 + 낮게 "웁" 하는 소리.
 * strength 0~1: 아구작은 세게, 쩝쩝은 약하게
 */
export function playChew(strength = 1) {
  const s = useSettingsStore.getState()
  const level = musicGain(s.musicVolume, s.musicMuted) * SFX_LEVEL * strength
  if (level <= 0) return
  const c = context()
  if (!c) return
  const out = c.createGain()
  out.gain.value = level
  out.connect(c.destination)
  const now = c.currentTime

  // 아삭: 높은 대역만 남긴 소음을 아주 짧게 3~4번
  const crunches = 2 + Math.round(strength * 2)
  for (let i = 0; i < crunches; i++) {
    const t = now + i * 0.055 + Math.random() * 0.015
    const src = c.createBufferSource()
    src.buffer = noiseBuffer(c)
    const band = c.createBiquadFilter()
    band.type = 'bandpass'
    band.frequency.value = 1800 + Math.random() * 2200
    band.Q.value = 1.2
    const env = c.createGain()
    env.gain.setValueAtTime(0.0001, t)
    env.gain.exponentialRampToValueAtTime(0.9, t + 0.004)
    env.gain.exponentialRampToValueAtTime(0.0001, t + 0.045)
    src.connect(band).connect(env).connect(out)
    src.start(t, Math.random() * 0.2, 0.06)
  }

  // 웁: 입 다무는 낮은 소리
  const osc = c.createOscillator()
  osc.type = 'sine'
  osc.frequency.setValueAtTime(220, now)
  osc.frequency.exponentialRampToValueAtTime(110, now + 0.12)
  const thump = c.createGain()
  thump.gain.setValueAtTime(0.0001, now)
  thump.gain.exponentialRampToValueAtTime(0.5, now + 0.01)
  thump.gain.exponentialRampToValueAtTime(0.0001, now + 0.14)
  osc.connect(thump).connect(out)
  osc.start(now)
  osc.stop(now + 0.16)
  setTimeout(() => out.disconnect(), 500)
}
