/** 같이 하기(방 서버) 숫자들 */
export const NET = {
  /** 메시지 형식 버전. 서버와 다르면 'version' 오류 */
  protocolVersion: 1,
  /** 방 하나 최대 인원 */
  maxPlayers: 20,
  /** 글자 수 범위 [최소, 최대] (글자 = 유니코드 문자) */
  roomName: [1, 20] as [number, number],
  password: [4, 32] as [number, number],
  nick: [1, 10] as [number, number],
  chatLength: 60,
  /** 내 모습 보내기: 바뀐 게 있으면 초당 최대 이만큼, 없으면 이 초마다 한 번 */
  sendHz: 5,
  idleSendEvery: 2,
  /** 모습에 싣는 체력 단위 (이름표 체력 막대. 회복 중 모습을 덜 보낸다) */
  hpStep: 5,
  /** 다른 사람은 이만큼(초) 늦은 시점을 그린다 (받은 state 두 개 사이를 잇는다) */
  interpDelay: 0.25,
  /** 사람마다 쌓아 두는 state 수 */
  bufferSize: 8,
  /** 두 state 가 이보다(m) 멀면 이어 그리지 않고 바로 옮긴다 (진료소로 순간이동 등) */
  snapDistance: 6,
  /** 받는 좌표 한계 (섬 반경 30 + 여유) */
  /** 받는 좌표 한계 (섬 원점 반경 30 + 초원 x 90..290 + 여유) */
  coordLimit: 400,
  /** "몇 초 전" 값의 상한 */
  actAgeCap: 30,
  /** 채팅 기록 줄 수, 말풍선 시간(초), 기록이 흐려지기 시작하는 시간(초) */
  chatLog: 30,
  bubbleSeconds: 5,
  chatFadeSeconds: 10,
  /** 내가 채팅을 보낼 수 있는 간격(초) */
  chatEvery: 1,
  /** 서버 속도 제한: state 초당 횟수, chat·profile 최소 간격(초) */
  serverStatePerSecond: 10,
  serverChatEvery: 1,
  serverProfileEvery: 5,
  /** 서버 속도 제한: 잠 투표(sleep) 초당 횟수 */
  serverSleepPerSecond: 4,
  /**
   * 아침이 온 뒤 이만큼(초) 안에 닿은 "눕기"는 표시만 남기고 이 시간이 지나서 센다
   * (둘이 거의 같이 누우면 늦게 닿은 눕기가 아침을 또 부른다. 그 사람 화면은 morning 을 받고 sleep false 를 보내 지운다)
   */
  morningGuard: 3,
  /** 세지 않고 미룬 잠 표시(너무 잦음·아침 직후)를 세는 짧은 alarm 까지 최소 시간(초) */
  sleepRetry: 0.3,
  /**
   * 들판 동물 간격(초, 5Hz). 서버는 alarm 없이 사람 메시지가 올 때 움직여 보낸다 (0.75 × 이 값보다 잦지 않게).
   * 그래서 들판 근처(nearAnimalField) 사람은 가만히 있어도 NET.sendHz 로 모습을 보낸다
   */
  animalEvery: 0.2,
  /** 동물 목록 최대 수 (받는 쪽 검사) */
  maxAnimals: 64,
  /** 서버 명중 검사: 사거리 + 판정 원에 더해 주는 여유(m). 내 모습(5Hz)과 남이 보는 동물(0.25초 늦음)이 어긋나는 만큼 */
  hitSlack: 2.5,
  /** 서버 명중 검사: 공격 종류를 바꿀 때 최소 간격에서 빼 주는 여유(초, 메시지가 몰려 닿는 만큼) */
  hitTimingSlack: 0.1,
  /** 서버 속도 제한: animalHit 초당 횟수 (버린 것도 센다). 총은 연사(소총 분당 650발)라 따로 */
  serverHitPerSecond: 4,
  serverGunHitPerSecond: 12,
  /** 서버 속도 제한: pvpHit 초당 횟수 (버린 것도 센다. 산탄총 한 발이 여럿을 맞히면 사람마다 하나씩 온다) */
  serverPvpHitPerSecond: 20,
  /**
   * 서버 총 명중 간격 여유(초): 앞 메시지가 늦게 닿아 다음 것과 가까워져도 이만큼 일찍 온 것은 받는다.
   * 받은 시각은 앞 명중 + 간격으로 쳐서 평균 빠르기는 늘지 않는다
   */
  gunTimingSlack: 0.04,
  /** 같은 한 발(shot 번호)의 다른 대상을 간격 없이 받는 시간(초): 한 발의 메시지는 같은 프레임에 나간다 */
  shotGroupWindow: 0.2,
  /** 서버 속도 제한: 남에게 보여 줄 사격(shot) 최소 간격(초, 은지 SHOT_MIN_MS), 쓰러짐(died) 최소 간격(초) */
  serverShotEvery: 0.05,
  serverDiedEvery: 5,
  /** 쏜 자리(총구)가 내 마지막 모습에서 이보다(m) 멀면 shot 을 버린다 (남의 화면에 엉뚱한 궤적을 그리지 않게) */
  shotOriginSlack: 6,
  /** 쓰러뜨린 사람으로 쳐 주는 시간(초): 쓰러지기 이만큼 안에 나를 맞힌 사람만 kill 알림에 나온다 */
  killCredit: 10,
  /** 방에 사람이 있는 동안 서버가 시계 확인(time)을 보내고 잠 표시를 다시 세는 간격(초). 서버 alarm 은 이것만 건다 */
  clockEvery: 30,
  /** 서버가 받는 메시지 최대 길이(글자) */
  maxMessageLength: 4096,
  /** 아무도 안 쓴 지 이만큼(일) 지난 방 이름은 새로 만들 수 있다 */
  roomExpireDays: 7,
  /** 폰(quality low)에서 그리는 다른 사람 최대 수 (가까운 순) */
  lowQualityMaxRemote: 10,
  /** 다시 연결할 때 기다리는 시간(초). 마지막 값을 계속 쓴다 */
  reconnectDelays: [1, 2, 4, 8, 10],
  /** 처음 들어갈 때 이만큼 시도해도 안 붙으면 포기한다 (한 번 붙은 뒤 끊긴 건 계속 다시 붙는다) */
  firstConnectTries: 3,
  /** profile 을 보내는 최소 간격(초). 서버 제한(serverProfileEvery)보다 조금 길게 */
  profileEvery: 5.2,
}

/** 마지막 방 이름·닉네임 저장 키 (암호는 저장하지 않는다) */
export const NET_SAVE_KEY = 'fishing-island-net-v1'
