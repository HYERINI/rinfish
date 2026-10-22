/** 배경 음악. 파일은 public/audio (출처는 public/audio/CREDITS.md) */
export const MUSIC = {
  tracks: {
    /** 섬 어디서나 */
    island: 'audio/feel-good-island-loop.ogg',
    /** 어항 크게 보기 (조용한 곡) */
    calm: 'audio/heavenly-loop.ogg',
  },
  /** 처음 틀 때 커지는 시간 (초) */
  fadeIn: 2.5,
  /** 곡을 바꿀 때 겹쳐 넘기는 시간 (초) */
  crossfade: 1.5,
  /** 음소거·볼륨 조절이 따라가는 시간 (초) */
  volumeFade: 0.15,
  /** 탭을 숨기면 이만큼 줄이다가 멈춘다 (초) */
  hideFade: 0.3,
}

/** 마우스로 시점 돌리기 (3인칭 게임식: 클릭하면 마우스가 잠기고, 움직이는 만큼 돈다) */
export const MOUSE_LOOK = {
  /** 감도: 마우스 1px 당 회전 (라디안) */
  defaultSensitivity: 0.0025,
  minSensitivity: 0.0005,
  maxSensitivity: 0.008,
  /** 위아래 기울기(pitch) 범위 (라디안). 양수 = 카메라가 더 위에서 내려다본다 */
  minPitch: -0.3,
  maxPitch: 0.4,
  /** 카메라가 땅을 뚫지 않게 지키는 최소 높이 (발 기준 m) */
  minCameraHeight: 0.3,
  /** 낚시 중엔 기울기를 0으로 천천히 되돌린다 (빠르기) */
  pitchResetSpeed: 3,
  /** 터치 등 마우스를 잠글 수 없을 때 드래그 회전 감도 (라디안/px) */
  dragSensitivity: 0.005,
}

/** 설정 기본값 (처음 실행하거나 저장본이 깨졌을 때) */
export const DEFAULT_SETTINGS = {
  musicVolume: 0.6,
  musicMuted: false,
  lookSensitivity: MOUSE_LOOK.defaultSensitivity,
  invertY: false,
}
