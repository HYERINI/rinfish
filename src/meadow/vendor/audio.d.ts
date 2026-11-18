/** 은지 효과음 (WebAudio 합성). setVolumeSource 로 낚시섬 음량을 따른다 (rinfish) */
export function setVolumeSource(fn: () => number): void
export function playShot(kind: string): void
export function playSwing(pitch?: number): void
export function playPunch(): void
export function playDing(): void
export function playClick(when?: number): void
export function playReload(duration: number): void
export function playHitThud(): void
export function playBeep(freq?: number, dur?: number, gainV?: number): void
export function playBuzzer(): void
