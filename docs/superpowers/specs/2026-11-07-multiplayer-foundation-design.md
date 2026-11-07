# 같이 하는 낚시섬 1단계: 암호 방 · 서로 보이기 · 채팅

## 큰 그림

낚시섬을 여러 명이 동시에 접속하는 게임으로 바꾼다. 세 단계로 나눠 차례로 만든다.

1. **기반 (이 문서)**: 암호 방에 모여 서로의 캐릭터·동작을 보고 채팅한다.
2. **섬 공동 목표 (다음 문서)**: 방 사람들이 함께 모은 물고기·코인으로 섬 시설을 같이 짓는다. 방 서버(Durable Object)의 저장소에 방마다 진행을 저장한다.
3. **협동 보스 낚시 (그다음 문서)**: 여러 명이 동시에 감아야 잡히는 대왕 물고기. 방 서버가 보스 상태를 계산하고 모두에게 나눠 준다.

혼자 하는 진행(코인·도감·장비·어항)은 지금처럼 각자 기기에 저장하고 그대로 둔다.

## 사용자가 정한 것

- 같이 보이는 것: 다른 사람 캐릭터(옷차림·닉네임), 위치, 동작(걷기·앉기·먹기·감정 표현·낚시), 채팅.
- 서버: **Cloudflare Workers + Durable Objects** (처음엔 Supabase 였으나 무료 메시지 한도 때문에 바꿨다. Supabase 무료는 한 달 200만 개를 받는 사람 수만큼 세어 5명이 10Hz 로 놀면 2~3시간에 끝난다. Cloudflare 무료는 서버가 보내는 메시지는 공짜, 받는 메시지는 20개 = 요청 1번, 하루 요청 10만 번).
- 방: 방 이름 + 암호를 아는 사람끼리만 같은 섬에서 만난다.
- 게임 화면은 Vercel 정적 배포 그대로. 방 서버만 Cloudflare 에 따로 올린다.

## 서버 모양

- 저장소 `server/` 폴더에 Worker 하나와 Durable Object 클래스 `Room` 하나. `wrangler` 로 로컬 실행(`wrangler dev`)·배포한다.
- 주소: `GET /rooms/<roomId>` 를 웹소켓으로 업그레이드하면 그 이름의 `Room` 으로 넘긴다. 그 밖의 주소는 404. Origin 검사는 하지 않는다(정적 게임은 어디서든 접속할 수 있게).
- `roomId` = SHA-256(`rinfish-room|` + 정리한 방 이름) 앞 32자(16진수). 방 이름을 그대로 서버 주소에 쓰지 않는다.
- `Room` 은 웹소켓 Hibernation API (`ctx.acceptWebSocket`, `webSocketMessage`, `webSocketClose`, `serializeAttachment`) 를 쓴다. 사람마다 붙임 정보(attachment)에 `{ id, nick, look, joinedAt, lastState, rate }` 를 둔다.
- 방 저장소(SQLite KV `ctx.storage`)에는 `passHash`, `createdAt`, `lastActive` 만 둔다.

## 방과 암호

- 시작할 때 고르는 창(로비): **혼자 하기** / **같이 하기**. 같이 하기는 탭 두 개: **방 만들기** / **들어가기**. 입력: 방 이름, 암호, 닉네임.
- 방 이름: 앞뒤 공백 제거·소문자, 1~20자. 암호: 4~32자(대소문자 구분). 닉네임: 1~10자.
- 클라이언트는 암호를 그대로 보내지 않고 `passHash` = SHA-256(roomId + `|` + 암호) 를 보낸다 (Web Crypto). 서버는 그 값을 저장·비교만 한다.
- 서버 판정:
  - 만들기: 방이 없거나 7일 넘게 아무도 안 쓴 빈 방이면 `passHash` 를 저장하고 입장. 아니면 `room-exists`.
  - 들어가기: 방이 없으면 `no-room`, `passHash` 가 다르면 `bad-password`, 20명이면 `full`.
- 화면 안내: `room-exists` "이미 있는 방 이름이에요", `no-room` "그런 방이 없어요", `bad-password` "암호가 틀렸어요", `full` "방이 꽉 찼어요 (20명)".
- 공유 링크 `?room=<방 이름>` 에는 **방 이름만** 넣는다. 링크로 들어오면 로비가 '들어가기' 탭에 방 이름이 채워진 채 열린다. 화면 위 방 배지에 "링크 복사" 버튼.
- 마지막 방 이름·닉네임은 기기에 저장(`fishing-island-net-v1`). 암호는 저장하지 않는다.

## 닉네임

- 1~10자, 앞뒤 공백 제거, 줄바꿈·제어문자 제거. 같은 방에 같은 닉네임이 있어도 막지 않는다.
- 로비에서 정하고, 같이 하는 중에 방 배지에서 바꿀 수 있다(`profile` 메시지). 옷장에서 옷을 바꿔도 `profile` 을 보낸다.

## 주고받는 것 (JSON 텍스트, 버전 `v: 1`)

클라이언트 → 서버
- `hello { v, mode: 'create'|'join', room, passHash, nick, look }` — 연결 직후 한 번.
- `state { s }` — 내 모습 (아래 `NetState`).
- `chat { text }`
- `profile { nick, look }`

서버 → 클라이언트
- `welcome { you, players: [{ id, nick, look, s|null }] }` — 나를 뺀 지금 사람들.
- `error { code }` — `bad-hello`·`room-exists`·`no-room`·`bad-password`·`full`·`version`. 보내고 연결을 닫는다.
- `join { id, nick, look }`, `leave { id }`, `profile { id, nick, look }`
- `state { id, s }`, `chat { id, text }`

`id` 는 서버가 정한다(연결마다 새로). 받는 쪽이 보낸 사람을 사칭할 수 없다.

`NetState` (보내기 전 숫자는 소수 둘째 자리로 반올림)
`{ p: [x, y, z], f: 바라보는 각도, v: 수평 속도, rest: 앉아 있나, fish: { pose, lean } | null, rod: 낚싯대 각도, rodOn: 낚싯대 보이나, bob: [x, y, z] | null, act: { emote, emoteAge, airAge|null, landedAge, eat, eatAge } }`
- `fish.pose`: `aim`·`tug`·`dragged`·`celebrate`·`fallBack`·`dejected`. `lean`: 줄다리기 상체 젖힘(0~0.75).
- `act` 의 시각들은 "몇 초 전에" 로 보낸다 (기기마다 시계가 달라서). 30초보다 오래된 건 30. 받는 쪽은 받은 순간 자기 시계로 바꾼다. 같은 감정 표현을 다시 시작한 게 아니면 바꾼 값을 그대로 둔다 (매 프레임 새로 바꾸면 한 번짜리 동작이 계속 처음부터 재생된다).

보내는 빈도: 바뀐 게 있으면 초당 최대 5번, 없으면 2초마다 1번.

서버 검사 (클라이언트 받는 쪽도 같은 함수를 쓴다): 모양·범위(좌표는 섬 반경 40 안, 글자 수, 감정 표현·음식·자세 이름이 목록에 있는지). 틀리면 그 메시지만 버린다. 속도 제한: state 초당 10번, chat 1초에 1번, profile 5초에 1번을 넘으면 버린다.

## 다른 사람 그리기

- 받은 state 를 사람마다 최근 몇 개(받은 시각과 함께) 쌓아 두고, **지금 - 250ms** 시점을 두 state 사이에서 보간해 그린다 (위치 선형, 바라보는 각도는 짧은 쪽으로). 새 state 가 안 오면 마지막 자리에 서 있다.
- `leave` 를 받거나 연결이 끊기면 지운다.
- 모델은 지금 플레이어가 쓰는 `PlayerModel` 을 그대로 쓴다. 그러려면 `PlayerModel.update` 가 `FishingState` 대신 `FishingLook`(`{ pose, lean }`) 만 받게 바꾼다. 물리 몸은 없다(서로 통과).
- 낚싯대(손에 붙임), 찌·줄(`bob` 이 있으면), 머리 위 이름표, 채팅 말풍선(5초).
- 폰(quality low)에서는 가까운 10명까지만 그린다.
- 매 프레임 바뀌는 값(버퍼·보간)은 React 상태가 아니라 모듈 안 객체에 두고 `useFrame` 에서 읽는다. 스토어에는 사람 목록·채팅처럼 드물게 바뀌는 것만.

## 화면

- **로비**: 로딩 화면이 끝나고, 캐릭터가 있으면 뜬다 (처음이면 옷장 다음에). 혼자 하기를 누르면 지금과 똑같다.
- **방 배지** (화면 위): `🔒 방 이름 · 👥 3명` + 링크 복사 + 닉네임 바꾸기 + 나가기(혼자 하기로).
- **채팅**: 왼쪽 아래 최근 30줄(10초 지나면 흐려짐). Enter 로 입력 열기·보내기, Esc 로 닫기. 입력 중에는 게임 키(이동·E·숫자 등)가 먹지 않는다. 폰은 💬 버튼.
- **알림**: "○○님이 들어왔어요 / 나갔어요" 를 기존 notice 로.

## 연결 끊김·서버 주소 없음

- `VITE_ROOM_SERVER`(예: `wss://rinfish-rooms.<계정>.workers.dev`) 가 없으면 로비 없이 지금처럼 혼자 하기만.
- 연결이 끊기면 배지에 "다시 연결 중…", 1·2·4·8초(최대 10초) 간격으로 다시 붙는다(같은 방·암호 해시로 join). 끊긴 동안 다른 사람은 숨기고 혼자 게임은 계속된다. `error` 로 닫힌 건 다시 붙지 않고 로비로 돌아간다.

## 보안에 대해

로그인이 없다. 암호를 아는 사람은 자기 위치·채팅만 마음대로 보낼 수 있다(남을 사칭할 수는 없다). 스터디 규모라 감수한다. 서버가 검사·속도 제한을 하므로 이상한 값이 다른 사람 화면을 깨뜨리지 않는다.

## 코드 나누기 (scene/ui → stores → logic → data, 서버는 logic·data 만 가져다 쓴다)

- `src/game/data/net.ts`: 숫자들 (보내는 빈도, 보간 지연, 인원 제한, 글자 수, 속도 제한, 폰에서 그릴 인원, 재연결 간격).
- `src/game/logic/roomKey.ts`: 방 이름·암호·닉네임 정리와 검사, roomId·passHash 만들기. 테스트.
- `src/game/logic/netProtocol.ts`: 메시지 타입, 만들기·검사(서버·클라이언트 공용), 숫자 반올림, `act` 를 몇 초 전 ↔ 내 시계로 바꾸기. 테스트.
- `src/game/logic/interpolate.ts`: 받은 state 버퍼에서 지금 그릴 자리. 테스트.
- `src/game/logic/rateLimit.ts`: 간격·초당 횟수 제한기 (서버·클라이언트 채팅 공용). 테스트.
- `src/game/logic/characterPose.ts`: `FishingLook`·`fishingLook()` 추가, `characterPose` 가 `FishingLook` 을 받게.
- `server/src/index.ts` (Worker 주소 나누기), `server/src/room.ts` (Durable Object), `server/src/roomRules.ts` (입장 판정·메시지 처리, 순수 함수, 테스트), `server/wrangler.toml`.
- `src/game/net/connection.ts`: 웹소켓 열기·다시 붙기·보내기·받기. 화면·스토어를 모른다.
- `src/game/net/remoteRig.ts`: 다른 사람 state 버퍼 (모듈 객체).
- `src/game/stores/netStore.ts`: 연결 상태, 방 정보, 사람 목록, 채팅 기록. 테스트(가짜 연결).
- `src/game/net/NetBridge.tsx`: 캔버스 안에서 내 상태 보내기(useFrame).
- `src/game/scene/RemotePlayers.tsx`, `src/game/scene/RemotePlayer.tsx`.
- `src/game/ui/Lobby.tsx`, `src/game/ui/RoomBadge.tsx`, `src/game/ui/ChatBox.tsx`.
- 기존 수정: `Player` 가 지금 모습을 `playerRig` 에 내놓기, `FishingVisuals` 가 찌 위치를 `fishingFx` 에 내놓기, 키 입력이 채팅 중엔 멈추기, `Game` 에 로비·배지·채팅·NetBridge·RemotePlayers 붙이기.
- 새 개발 의존성: `wrangler`, `@cloudflare/workers-types`.

## 확인 방법

- 단위 테스트: 위 logic 파일들, `roomRules`, netStore(가짜 연결).
- 서버 주소 없는 빌드에서 혼자 하기가 지금과 똑같은지.
- 로컬 `wrangler dev` + 헤드리스 Chrome 두 개: 같은 방·같은 암호면 서로 보이고 채팅이 가는지, 틀린 암호는 "암호가 틀렸어요", 없는 방은 "그런 방이 없어요" 인지 스크린샷으로 확인. (계정 없이 로컬에서 끝까지 확인할 수 있다)

## 사용자가 할 일 (배포 때)

1. Cloudflare 가입(무료).
2. 터미널에서 `! npx wrangler login` (브라우저로 로그인 승인). 그다음 배포는 내가 `npm run server:deploy` 로 한다.
3. 배포 주소를 Vercel 환경변수 `VITE_ROOM_SERVER` 에 넣고 재배포.

## 2·3단계를 위한 자리

- 방 서버가 방마다 하나라서, 2단계 공동 목표 진행은 같은 `Room` 저장소에, 3단계 보스는 `Room` 이 직접 계산(알람으로 틱)한다.
- 메시지 종류에 `goal:*`, `boss:*` 를 더한다.
