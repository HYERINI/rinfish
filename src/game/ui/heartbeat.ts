let audio: AudioContext | null = null

/** 쿵-쿵 두 번 울리는 낮은 소리. 파일 없이 WebAudio로 만든다 */
export function playHeartbeat() {
  try {
    audio ??= new AudioContext()
    const now = audio.currentTime
    for (const offset of [0, 0.22]) {
      const osc = audio.createOscillator()
      const gain = audio.createGain()
      osc.frequency.value = 55
      gain.gain.setValueAtTime(0.0001, now + offset)
      gain.gain.exponentialRampToValueAtTime(0.6, now + offset + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.0001, now + offset + 0.18)
      osc.connect(gain).connect(audio.destination)
      osc.start(now + offset)
      osc.stop(now + offset + 0.2)
    }
  } catch {
    // 소리를 낼 수 없는 환경이면 조용히 넘어간다
  }
}
