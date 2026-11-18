import { playBeep, playBuzzer, playClick, playDing, playHitThud, playPunch, playReload, playShot, playSwing, setVolumeSource } from '../../meadow/vendor/audio.js'
import type { GunId } from '../data/guns'
import { musicGain } from '../logic/music'
import { useSettingsStore } from '../stores/settingsStore'

/** 효과음 크기 (음악 볼륨 기준 배율, audio/sfx 의 씹는 소리와 같다). 음소거(M)면 끈다 */
const SFX_LEVEL = 0.9

/** 은지 audio.js 소리가 우리 음량 설정을 따른다 (부를 때마다 지금 설정을 읽는다) */
setVolumeSource(() => {
  const s = useSettingsStore.getState()
  return musicGain(s.musicVolume, s.musicMuted) * SFX_LEVEL
})

/** 무기·사격장 소리 (은지 audio.js, WebAudio 합성. 파일 없음) */
export const weaponSfx = {
  shot: (gun: GunId) => playShot(gun),
  /** 빈 탄창 딸깍 */
  dry: () => playClick(),
  reload: (seconds: number) => playReload(seconds),
  /** 칼 휘두르기 (찌르기는 낮게 0.6) */
  swing: (pitch = 1) => playSwing(pitch),
  punch: () => playPunch(),
  /** 칼이 무언가에 박힌다 */
  thud: () => playHitThud(),
  /** 사격장 표적 명중 */
  ding: () => playDing(),
  beep: (freq?: number, dur?: number) => playBeep(freq, dur),
  buzzer: () => playBuzzer(),
}
