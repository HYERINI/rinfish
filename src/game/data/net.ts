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
  /** 다른 사람은 이만큼(초) 늦은 시점을 그린다 (받은 state 두 개 사이를 잇는다) */
  interpDelay: 0.25,
  /** 사람마다 쌓아 두는 state 수 */
  bufferSize: 8,
  /** 두 state 가 이보다(m) 멀면 이어 그리지 않고 바로 옮긴다 (진료소로 순간이동 등) */
  snapDistance: 6,
  /** 받는 좌표 한계 (섬 반경 30 + 여유) */
  coordLimit: 40,
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
  /** 서버가 받는 메시지 최대 길이(글자) */
  maxMessageLength: 4096,
  /** 아무도 안 쓴 지 이만큼(일) 지난 방 이름은 새로 만들 수 있다 */
  roomExpireDays: 7,
  /** 폰(quality low)에서 그리는 다른 사람 최대 수 (가까운 순) */
  lowQualityMaxRemote: 10,
  /** 다시 연결할 때 기다리는 시간(초). 마지막 값을 계속 쓴다 */
  reconnectDelays: [1, 2, 4, 8, 10],
}

/** 마지막 방 이름·닉네임 저장 키 (암호는 저장하지 않는다) */
export const NET_SAVE_KEY = 'fishing-island-net-v1'
