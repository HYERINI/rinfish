# 3-4 총·사격장·PvP 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 은지 총 4종(권총·소총·산탄총·저격총)을 도구 칸 4~7 에 넣어 탄창·예비 탄약(저장, 잡화점에서 산다)·R 장전·조준(1인칭 조준경, 휠 배율)·V 1인칭으로 쏘게 하고, 동물·사격장 표적·벽·다른 사람(PvP)을 맞히며, 사격장 방에 표적·무기 선반·G 60초 연습 게임을 세우고, 폰에 쏘기·조준·장전·무기 바꾸기 버튼을 단다.

**Architecture:** 쏘기 규칙(연사 간격·장전·열기·반동)과 광선 판정(동물 기둥·사람 캡슐·산탄 퍼짐)은 그래픽 없는 순수 TS(`logic/gun`·`logic/hitscan`)로, 매 프레임 바뀌는 총 상태는 모듈 객체 `guns/gunRig`(performance.now() 시각)에 둔다. `scene/guns/GunController` 가 화면 가운데(카메라)에서 알마다 광선을 쏴 동물·사람(판정 목록)·표적판(Raycaster, 3개)·벽(Rapier `ONLY_FIXED`) 중 처음 닿는 것을 고르고, 혼자면 바로·같이면 서버에 알린다(`animalHit`·`pvpHit`·`shot`). 서버(rinfish-rooms)는 쏜 사람 화면의 판정을 은지 피해표·무기별 최소 간격·든 도구·사거리로 검사해 맞은 사람에게만 `hurt {by:'pvp', from}`, 쓰러진 사람의 `died {by}` 로 모두에게 `kill`. 무기 모델·사격장·소리는 은지 `weapons.js`·`range.js`·`audio.js` 를 vendor 로 복사해 쓰고(빛·저장·음량만 `// rinfish:` 로 고친다), 1인칭 무기는 카메라를 따라 그리며 조준경은 FOV + 화면 덮개(`ui/ScopeOverlay`)로 한다.

**Tech Stack:** React 19, @react-three/fiber 9, @react-three/rapier 2, three 0.186, zustand 5, vitest 5, oxlint, Cloudflare Durable Objects (WebSocket Hibernation API, wrangler 4), WebAudio.

**Spec:** `docs/superpowers/specs/2026-11-18-eunji-features-design.md` — 이 계획은 "3-4 총·사격장·PvP" 와, "키 배치"(마우스 왼쪽/오른쪽·4~7·R·V·휠 조준 배율·G·폰 버튼)·"같이 하기 메시지"(`pvpHit`·`hurt`·`died`→`kill`·`shot`·모습 `hp`)·"저장"(`ammo`·`reserve`·`rangeBest`)·"확인 방법"(사격장·PvP 헤드리스 점검, 폰 총 버튼) 가운데 3-4 몫, 그리고 3-2 가 미룬 잡화점 탄약 가격(권총 12발 80 · 소총 30발 150 · 산탄 6발 120 · 저격 5발 250)과 3-3 이 미룬 칼 찌르기 폰 버튼·무기 소리를 만든다. 마지막 묶음이다.

**기준 커밋:** `feat/eunji-features` 의 `6ff4c7f` (test: 이름표 숨김 점검은 들판에서 먼 섬에서). 이 위에서 계획의 코드를 스크래치 복사본으로 Task 1~10 순서대로 모두 만들어 확인했다 (Task 마다 `npx tsc -b` 깨끗·oxlint 경고 6·vitest 통과, 마지막에 `npm run build`, `tools/room-smoke.mjs` 47개 전부 OK, `tools/meadow-check.mjs` 의 3-4 점검 37~41 56개 전부 OK — 3-4 부분만 떼어 돌린 것. 전체 점검(약 190개)은 기계가 아주 바쁠 때(load 20~45) 돌려 186~188개 OK 였고, 실패는 매번 다른 시간 기대 점검(3-2 의 24 문 지나가기, 3-3 의 36 두 사람 사냥)이었다 — 같은 코드로 다른 판에선 통과). 각 Task 머리의 스크래치 커밋 SHA 는 그 Task 끝 상태다 (스크래치 저장소 `/private/tmp/claude-501/-Users-ihyelin-proten-hrlee-----threejs/e476c70e-362f-4ed3-9ff7-d8664da04e4b/scratchpad/plan-3-4/repo`, 브랜치 `feat/eunji-features`). 시작할 때 HEAD 가 `6ff4c7f` 보다 앞서 있으면 diff 의 바꿀 곳(특히 `Player.tsx`·`TouchControls.tsx`·`MeleeController.tsx`·`netStore.ts`·`room.ts`·`roomRules.ts`·`tools/meadow-check.mjs`)이 그대로 있는지 먼저 본다.

## Global Constraints

- 브랜치 `feat/eunji-features` 에서 그대로 커밋한다. push·main 합치기·서버 배포(`npm run server:deploy`)는 바깥에 영향을 주므로 **사용자에게 먼저 묻는다** (Task 10 Step 7). 배포 순서는 **서버 먼저**: 옛 서버는 `pvpHit`·`shot`·`died` 와 총 `animalHit` 을 버린다(`parseClientMsg` 가 null — 같이 하기에서 총이 사람·동물에게 안 맞는다). 새 서버에 붙은 옛 클라이언트는 모르는 `shot`·`kill`, `hurt.by 'pvp'` 를 버리고, 모습의 `hp`·총 `tool` 은 그 필드만 버린다.
- 은지 값 그대로 (`data/guns.ts`, vendor `weapons.js` 와 같은지 테스트): 권총 rpm 320·탄창 12·장전 1.3·퍼짐 0.012/조준 0.003·반동 0.018·aimFov 50 / 소총 연사 650·30·2.0·0.02/0.006·0.01·45·배율 홀로·2.5x / 산탄총 70·6·2.4·8알·0.05/0.035·0.05·55 / 저격총 40·5·2.6·피해 3·0.04/0·0.06·40·배율 4x·8x. 사거리 80m, 동물 피해 알마다 1(저격 3). 기본 예비 권총 48·소총 120·산탄 24·저격 20. 빈 탄창 딸깍 뒤 0.3초, 바꾸기 0.25초, 연사 열기 +0.15/발(최대 1)·초당 2 식음·퍼짐 +열기×0.01, 반동 조준 ×0.6·조준경 ×0.5.
- PvP (은지 server `PVP_DMG`·`HIT_COOL`): 권총 20·소총 14·산탄 9×맞은 알 수(최대 8)·저격 70·칼 15·찌르기 30·주먹 5, 같은 무기 최소 간격 0.15·0.07·0.6·1.2·0.4·0.7·0.3초. 남의 몸 = 보이지 않는 캡슐 반지름 0.32·가운데 기둥 1.3 (모습 `p` = 몸 가운데). 같은 편 구분 없음. PvP 로 쓰러지면 침대 경로(같이 하기라 시간 그대로).
- 잡화점 탄약 묶음 (`AMMO_PACKS`, `data/meadowPrices.ts`): 권총 12발 80 · 소총 30발 150 · 산탄 6발 120 · 저격 5발 250 코인. 산 탄은 예비 탄약에 더한다(상한 9999).
- 같이 하기: `NET.protocolVersion` **1 그대로**. 새 종류·선택 필드만: → 서버 `pvpHit {target, weapon, n}`·`shot {o, d, w}`·`died {by?}`, `animalHit` 의 `w` 에 총·선택 필드 `n` / 서버 → `shot {id, o, d, w}`·`kill {victim, killer?}`, `hurt.by` 에 `'pvp'`(`from` = 쏜 사람) / 모습(`NetState`) 선택 필드 `hp`(0~100 정수). 서버 속도 제한: 총 `animalHit` 초당 12, `shot` 0.05초에 하나, `died` 5초에 하나.
- 저장(`fishing-island-save-v1`) **version 5**: `ammo`(탄창, 총마다 0~탄창)·`reserve`(예비, 0~9999)·`rangeBest`(사격장 최고 점수). 빠진 값은 탄창 가득·은지 기본 예비·0. 필드만 늘어 옮길 것 없다(`migrateSave` 그대로). `view`(1인칭)·`lastGun`·조준 배율은 저장하지 않는다.
- 새 `Mode` **`rack`**(무기 선반 창) 하나. Mode 를 고르는 곳은 다 본다: `logic/view.ts` 의 `FIRST_PERSON_OK` 는 `Record<Mode, boolean>` 이라 빠뜨리면 타입 오류, 그 밖(`canLockPointer`·`canZoom`·`timeStops`·`resolveKeyAction`)은 explore 만 고르는 목록이라 `rack` 은 패널처럼 막힌다. 총은 `mode === 'explore'` 이고 먹기·감정 표현 중이 아닐 때만 쏜다 (낚시·배·잠·패널·T 바퀴는 explore 가 아니다).
- 빛 개수는 처음부터 같게(1·2단계 원칙): 총구 불꽃은 빛 없는 Sprite, 은지 `range.js` 의 보조 PointLight 3개는 뺀다 (`meadowSingleton.test` 의 빛 10개 그대로).
- oxlint 경고 기준선 **6** 을 늘리지 않는다 (`npm run lint 2>&1 | grep -c warning`). 컴포넌트 파일(.tsx)은 컴포넌트만 export 한다 (함수·상수는 .ts: `ui/gunStatus.ts`·`scene/guns/gunEffectsPool.ts`·`viewModel.ts`). hook 이 준 값을 `useFrame` 에서 고치지 않는다 — 카메라는 `useFrame` 인자(`camera`)로 받고, 매 프레임 바뀌는 것은 모듈 객체(`guns/gunRig`·`playerRig`)에 둔다. 렌더 중에 `performance.now()` 를 부르지 않는다. 스토어(`stores/*`)는 `scene/*` 을 import 하지 않는다 (남이 쏜 `shot` 은 `guns/gunNet.setShotHandler` 로 `GunController` 가 붙인 처리기로 간다).
- 모듈 상태는 게임을 다시 열면(Game 다시 마운트) 남는다: `gunRig` 은 `performance.now()` 시각을 쓰고 `Game` 의 첫 effect 에서 `resetGunRig()` 로 지운다 (3-3 의 `meleeRig.readyAt` 버그와 같은 일을 막는다).
- macOS 파일 이름은 대소문자를 가리지 않는다: 대소문자만 다른 두 파일을 만들지 않는다.
- 폰 화면 360×780·390×844·780×360·844×390 에서 무기 버튼이 조이스틱·도구 칸·채팅·안내 글씨·미니맵·상호작용 버튼과 겹치지 않는다 (Task 10 meadow-check 40).
- 테스트 기준선 78 파일 / 775 개 (6ff4c7f). 이 계획을 다 하면 **86 파일 / 840 개**. `npx tsc -b` 깨끗 (server 프로젝트 포함).
- 커밋 메시지: `feat:`/`fix:`/`test:` 처럼 타입만(괄호 스코프 금지), 제목 짧게, 자세한 건 본문. Co-Authored-By·AI 생성 표기 금지.
- 코드 주석·UI 글은 한국어, 지금 코드 말투(평서형, 짧게).
- 은지 원본: `/private/tmp/claude-501/-Users-ihyelin-proten-hrlee-----threejs/e476c70e-362f-4ed3-9ff7-d8664da04e4b/scratchpad/eunji/repo2` (= https://github.com/Eunji1217/3js 커밋 `f3c3808`). 위 경로가 없으면 그 저장소를 받아 같은 커밋에서 복사한다.
- 헤드리스 점검 준비: `npm run server:dev` (8787) 와 `VITE_ROOM_SERVER=ws://127.0.0.1:8787 npx vite --port 5190 --strictPort`. Vite 는 `::1` 에 뜨므로 점검 주소는 `http://localhost:5190`. 포트(서버 8787·Vite 5190·Chrome 디버깅 9731~9747)가 다른 점검과 겹치면 `wrangler dev --port <다른 포트>`·`vite --port <다른 포트>`·디버깅 포트를 바꾼 사본으로 돌린다. **코드를 고친 뒤엔 Vite 를 다시 띄우고 점검한다**: HMR 로 바뀐 모듈은 점검 도우미(`__mod`)가 옛 모듈을 집을 수 있다. 점검이 도는 동안 작업 폴더를 `git checkout` 하지 않는다. 헤드리스(swiftshader)는 사격장 안에서 몇 fps 라 시간에 기대는 점검은 `until` 로 기다린다.

## Review Focus

1. **서버가 PvP 명중을 믿지 않기** — 멀리서·너무 자주(자동 클릭)·들지 않은 무기로·나 자신에게 보낸 `pvpHit`, 산탄 알 수 부풀리기는 버리거나 피해표 값으로만 깎아야 한다. 맞은 사람 화면이 체력을 깎으므로 서버를 지나간 `hurt` 만 믿는다 (Task 7 roomRules "같은 무기는 최소 간격"·"나 자신·없는 사람·…·너무 먼 사람은 버린다"·"은지 피해표", room-smoke "곧바로 또·들지 않은 저격총은 버린다").
2. **거짓 쓰러뜨림 알림** — 아무나 `died {by: 다른 사람}` 을 보내 "A 님이 B 님을 쓰러뜨렸어요" 를 꾸미거나 알림을 도배하면 안 된다. 쓰러뜨린 사람은 10초 안에 정말 나를 맞힌(서버를 지나간) 사람이고 아직 방에 있을 때만, `died` 는 5초에 하나 (Task 7 roomRules "쓰러짐: 10초 안에…", room-smoke "5초 안에 또 온 것은 버린다").
3. **쏘면 안 되는 때와 클릭** — 낚시·배·잠·패널·T 바퀴·먹는 중·감정 표현 중엔 쏘지 않고, 마우스 잠금을 거는 첫 클릭과 UI 버튼 클릭이 방아쇠로 남지 않아야 한다(연사 소총이 계속 쏘지 않게). 총을 들면 누른 것은 휘두르기가 아니라 쏘기가 가져간다 (Task 4 pointer.test "총 입력", interaction.test R 은 탐험에서만, GunController `canShoot`).
4. **예전 저장본과 깨진 값** — version 4 저장본은 탄창 가득·은지 기본 예비·최고 점수 0 으로, 탄창보다 많은 탄·음수·소수는 그 총만 기본값으로 연다 (Task 1 progressStore "탄약이 없는 예전 저장본(version 4)…", ammo.test "저장본 읽기").
5. **폰에서 버튼이 겹치지 않기** — 총·칼 버튼이 한두 줄 늘어도 360×780·390×844·780×360·844×390 에서 조이스틱·도구 칸·안내·미니맵·상호작용 버튼과 겹치거나 화면 밖으로 나가지 않아야 한다 (Task 10 meadow-check 40, 3-3 의 26·35·36 겹침 점검도 그대로 통과).

---

## 결정한 것 (스펙 해석·Ruling)

- **Ruling: 폰 도구 칸은 총을 한 칸만(마지막에 든 총, `sessionStore.lastGun`) 그리고 총끼리는 ⇄ 로 넘긴다** — 7칸을 다 그리면 좁은 폰(360)에서 버튼·조이스틱과 겹친다. 컴퓨터는 9칸 그대로.
- **Ruling: 조준경은 은지 렌즈 확대(PIP 렌더 타깃) 대신 FOV 를 배율만큼 좁히고 둥근 조준경 화면(Kenney Crosshair `scope.svg`)·홀로 고리(`holo.svg`)로 덮는다** — 장면을 한 번만 그려 폰에서도 가볍고, 은지 렌즈처럼 화면 가운데가 그 배율로 보인다. 조준경으로 보는 동안 1인칭 무기는 숨긴다 (총열 통이 시야를 가린다).
- **Ruling: 3인칭에서 조준하면 소총·저격총만 그동안 1인칭(은지 `wantScope`), 권총·산탄총은 3인칭 그대로 1.9m 로 당겨 오른쪽 어깨 너머(0.65m)** — 스펙 "3인칭에서 조준하면 그동안 1인칭(은지 그대로)" 의 은지 동작이 조준경 총만 그렇다.
- **Ruling: 휠은 조준 중인 소총·저격총에서만 배율 단계(위로 굴리면 크게), 그 밖엔 지금처럼 카메라 거리. 폰 조준 버튼은 누를 때마다 조준 → 다음 배율 → 끄기 (`nextTouchAim`)** — 스펙 "휠로 바꿈", 폰엔 휠이 없다 (은지는 우클릭 두 번).
- **Ruling: 동물 몸은 판정 원(3-3 `hitRadius`) × 높이(배율 × 1.5, 최소 0.4)의 기둥, 사람은 몸 가운데를 중심으로 세운 캡슐** — 3-3 근접 판정과 같은 원을 쓰고, 총은 카메라 광선이라 높이가 필요하다. 벽은 Rapier `castRayAndGetNormal`(`ONLY_FIXED`, 감지 상자 빼고), 사격장 표적판 3개만 three `Raycaster` (장면에 붙은 판만 — 초원 모델이 오기 전엔 은지 좌표 그대로라 섬 근처에 유령 표적이 생긴다).
- **Ruling: 3인칭 광선은 카메라 ~ 눈(발 + 키 × 0.92) 사이를 건너뛰고 눈보다 0.35m 앞에서부터 맞는다 (은지 `aimRay`)** — 화면 가운데가 내 머리 위라 내 몸에 맞지 않게. 총구 자리는 손의 총 모델 `userData.muzzle`, 없으면(조준경) 눈 앞 0.3m.
- **Ruling: `animalHit` 에 선택 필드 `n`(맞은 알 수) 을 더한다** — 스펙 `{id, dmg, w}` 그대로면 산탄 8알을 따로 보내야 해 서버 최소 간격에 걸린다. 서버 피해는 알마다 은지 값 × n(그 총 알 수까지), 총마다 은지 `HIT_COOL` 간격, 사거리 80 + 판정 원 + 2.5m, 초당 12 (소총 분당 650발).
- **Ruling: 서버 PvP 검사에 은지(무기·간격)에 더해 든 도구와 사거리(무기 사거리 + 몸 반지름 + 2.5m)를 본다** — 3-3 `judgeAnimalHit` 과 같은 수준으로 꾸민 메시지를 막는다. 판정 자체는 스펙대로 쏜 사람 화면.
- **Ruling: `died` 는 같이 하는 중 모든 쓰러짐(굶주림 포함)에 보내고 `by` 는 PvP 로 맞았을 때만** — 은지처럼 "B 님이 쓰러졌어요" 도 모두가 본다. 알림은 채팅 기록(💀)과 화면 위 알림(쓰러진 사람 빼고: 그 사람 화면엔 3-1 의 "쓰러졌어요… 침대에서 깨어납니다").
- **Ruling: `shot` 은 쏜 사람 자리에서 6m 넘는 총구를 버리고 0.05초에 하나** — 남의 화면에 엉뚱한 궤적을 그리지 못하게. 남이 쏜 궤적은 벽(Rapier)까지, 소리는 60m 안만 (은지 `remoteShot`).
- **Ruling: 무기 선반 E 는 새 Mode `rack` 창으로 무기(총 4·칼·주먹)를 고르면 그 무기를 든다 (도구 칸에서 고른 것과 같다)** — 스펙 "무기 고르기(도구 칸에 넣기)": 도구 칸 4~7 은 늘 총이라 "넣기" 는 드는 것이다.
- **Ruling: 은지 `range.js` 를 거의 그대로 복사하고 보조 PointLight 3개와 localStorage `range.best` 만 뺀다** — 빛 개수 원칙, 최고 점수는 저장본 `rangeBest`. 결과는 6초 보인 뒤 닫는다(은지는 닫기 버튼). 사격장 안에선 "연습 게임 시작 (G)" 버튼도 띄운다(폰엔 G 키가 없다). 근접 공격은 표적에 맞지 않는다(총만).
- **Ruling: 소리는 은지 `audio.js` 를 복사해 모든 소리를 master gain 하나로 모으고 음량 = 음악 볼륨² × 0.9 (음소거면 0, 3-2 씹는 소리와 같은 기준)** — 스펙 "우리 효과음 음량 설정을 따르게". 3-3 이 미룬 주먹·칼 휘두르는 소리·맞는 소리도 같이.
- **Ruling: 탄창·예비는 `progressStore` 에 두고 쏠 때마다 고친다** — 저장이 바로 맞고(새로 고쳐도 쏜 탄이 돌아오지 않는다) 모양이 단순하다. 연사 소총도 초당 11번이라 무겁지 않다.
- **Ruling: 침대에 누워 잠 투표 중에 맞으면 깬다 (`takeHit` → `wake`)** — 스펙 3-1 "맞으면 깬다", PvP 로 처음 생긴다.
- **Ruling: 3-3 의 칼 폰 버튼을 베기(크게)·찌르기 두 개로 바꾸고 총처럼 세로 세 줄·가로 두 줄로 놓는다** — 3-3 이 "칼 찌르기 폰 버튼은 3-4 의 총 버튼과 같이" 로 미뤘다. 무기 줄이 늘면 세로 화면 도구 칸(352)·채팅(460)·안내를 더 올리고, 가로 화면 위 줄은 미니맵 왼쪽에 두며 상호작용 버튼은 그 왼쪽에서 길면 …로 자른다.
- **Ruling: 이름표 체력 막대는 모습의 `hp`(체력 정수) 로** — 정수로 보내 회복 중에도 1초쯤에 한 번만 바뀐다(`stateKey` 에 넣는다). 은지 색(50 넘으면 초록·25 넘으면 노랑·그 아래 빨강).
- **Ruling: 총은 공중에서도 쏜다 (은지 그대로)** — 3-3 의 휘두르기 공중 금지(`canSwing`)는 근접만.
- **Ruling: 연사 열기는 은지 식 그대로** — 한 발 +0.15, 초당 2 식는다. 실제로는 소총 연사(0.092초 간격)에서도 0.15 근처에 머문다 (은지와 같은 손맛).
- **Ruling: 테스트에서 은지 맵을 만드는 곳(`vendor.test`·`meadowSingleton.test`·`meadowActions.test`·`rangeActions.test`)은 가짜 2D 캔버스(`meadow/canvasStub.ts`)를 쓴다** — 사격장이 과녁·글씨를 캔버스로 그리는데 jsdom 엔 2D 가 없다.

---

## 파일 구조

| 파일 | 책임 |
|---|---|
| `src/game/data/guns.ts` (+test) | 총 4종·사거리·기본 예비·열기·반동·PvP 피해/간격·몸 판정·조준 카메라·1인칭 무기 자리 |
| `src/game/data/tools.ts`, `meadowPrices.ts`, `meadow.ts`, `touch.ts`, `net.ts` | 도구 칸 4~7·폰 총 한 칸·⇄ / 탄약 묶음 / 잡화점 인사·`inRangeRoom` / 무기 줄 폰 자리 / 서버 제한 |
| `src/game/logic/ammo.ts` (+test) | 쏘기·장전·탄약 사기·저장본 읽기 (순수) |
| `src/game/logic/gun.ts`, `hitscan.ts`, `view.ts` (+test) | 방아쇠·장전·열기·반동 / 광선 판정·산탄 퍼짐 / 1인칭 화면·조준 FOV·배율 단계 |
| `src/game/stores/{progressStore,sessionStore,netStore}.ts` (+test) | 저장 v5 / `lastGun`·`view` / `pvpHit`·`shot`·`died`·`kill` |
| `src/game/guns/{gunRig,gunFx,gunNet}.ts` | 내 총 상태 / 총알 효과 창구 / 남이 쏜 것 처리기 |
| `src/game/scene/guns/{GunController,GunEffects,FirstPersonView}.tsx`, `gunEffectsPool.ts` (+test), `viewModel.ts`, `scene/tools/GunModel.tsx` | 쏘기·판정·남의 궤적 / 궤적·자국·불꽃 / 1인칭 무기 / 손의 총 |
| `src/game/audio/weaponSfx.ts`, `src/meadow/vendor/{weapons,audio,range}.js` (+.d.ts) | 은지 무기 모델·소리·사격장 |
| `src/meadow/{rangeActions.ts,RangeRunner.tsx,canvasStub.ts}`, `meadowSingleton.ts`, `vendor/world.js` | 연습 게임·최고 점수 / 매 프레임 / 테스트 캔버스 / 선반 E 대상 |
| `server/src/{roomRules,room}.ts` (+test), `src/game/logic/netProtocol.ts` (+test), `tools/room-smoke.mjs` | PvP·사격·쓰러짐 검사·중계 |
| `src/game/scene/{Player,RemotePlayer}.tsx`, `melee/MeleeController.tsx`, `day/dayActions.ts`, `net/{NetBridge.tsx,remoteRig.ts}`, `hunt/*` | 겨누기·1인칭 카메라·반동 / 남의 총·체력 막대 / 주먹·칼 PvP / 맞아 쓰러짐 / hp·남의 몸 / 총 사냥 |
| `src/game/ui/{GunHud,ScopeOverlay,RangeHud,RackPanel,WeaponTouchControls,TapButton}.tsx`, `gunStatus.ts`, `Hotbar`·`Hud`·`VendorPanel`·`TouchControls`·`ChatBox`·`Panels` | 조준선·탄창 / 조준경 / 연습 게임 / 무기 선반 / 폰 총 버튼 |
| `public/meadow/models/crosshair/` | Kenney Crosshair Pack `scope.svg`·`holo.svg`·License (CC0) |
| `tools/meadow-check.mjs` | 헤드리스 점검 37~41 |

---

### Task 1: 총 4종 도구 칸과 탄약 저장·잡화점 탄약  — 스크래치 `d6f33df`

**Files:**
- Create: `src/game/data/guns.ts`, `src/game/logic/ammo.ts`
- Modify: `src/game/data/meadow.ts`, `src/game/data/meadowPrices.ts`, `src/game/data/tools.ts`, `src/game/stores/progressStore.ts`, `src/game/stores/sessionStore.ts`, `src/game/ui/Hotbar.tsx`, `src/game/ui/Hud.tsx`, `src/game/ui/VendorPanel.tsx`, `tools/meadow-check.mjs`
- Test: `src/game/data/guns.test.ts`, `src/game/logic/ammo.test.ts`, `src/game/logic/interaction.test.ts`, `src/game/stores/progressStore.test.ts`, `src/game/stores/sessionStore.test.ts`

**Interfaces:**
- Consumes: `ToolId`·`HOTBAR`·`hotbarSlot` (`data/tools`), `VendorId` (`data/meadowPrices`), `Kiosk`·`KioskDetail`·`QtyStepper`·`BigButton` (`ui/Kiosk`), `affordableQty` (`logic/bait`)
- Produces: `GunId = 'pistol' | 'rifle' | 'shotgun' | 'sniper'`, `GUN_IDS`, `GUNS: Record<GunId, Gun>` (`Gun = { id, name, auto, rpm, mag, reload, pellets, dmg, spread, aimSpread, recoil, aimFov, zoom?: ZoomStep[] }`, `ZoomStep = { label, mag }`), `isGun(v): v is GunId`, `GUN_RANGE = 80`, `START_RESERVE`, `MAX_RESERVE`, `GUN_SWAP`, `DRY_FIRE_PAUSE`, `HEAT`, `RECOIL`, `PvpWeapon`, `PVP_WEAPONS`, `PVP: Record<PvpWeapon, { dmg; cool }>`, `PEER_HIT`, `ANIMAL_HIT_HEIGHT` (`data/guns`); `ToolId` 에 총, `toolDef(id)`, `touchHotbar(lastGun): ToolId[]`, `nextWeapon(tool): ToolId` (`data/tools`); `AMMO_PACKS: Record<GunId, { n; price }>` (`data/meadowPrices`); `Rounds = Record<GunId, number>`, `FULL_MAGS`, `START_ROUNDS`, `spendRound`, `canReload(mag, reserve, id)`, `reloadRounds`, `buyAmmoPacks`, `readRounds` (`logic/ammo`); progressStore `ammo`·`reserve`·`rangeBest`·`fireRound(id): boolean`·`reloadGun(id): boolean`·`buyAmmo(id, packs): boolean`·`recordRangeScore(score): boolean`; sessionStore `lastGun: GunId`

- [ ] **Step 1: 실패하는 테스트 쓰기**

`src/game/data/guns.test.ts` (새 파일):

```ts
import { describe, expect, it } from 'vitest'
import { GUNS, GUN_IDS, PVP, PVP_WEAPONS, START_RESERVE } from './guns'
import { MELEE } from './melee'
import { AMMO_PACKS } from './meadowPrices'
import { HOTBAR, nextWeapon, touchHotbar } from './tools'

describe('총 (은지 WEAPONS)', () => {
  it('은지 숫자 그대로: 탄창·연사·알 수·피해', () => {
    expect(GUN_IDS.map((id) => [GUNS[id].mag, GUNS[id].rpm, GUNS[id].pellets, GUNS[id].dmg])).toEqual([
      [12, 320, 1, 1],
      [30, 650, 1, 1],
      [6, 70, 8, 1],
      [5, 40, 1, 3],
    ])
    expect(GUNS.rifle.auto && !GUNS.pistol.auto).toBe(true)
    expect(GUNS.sniper.zoom?.map((z) => z.mag)).toEqual([4, 8])
    expect(START_RESERVE).toEqual({ pistol: 48, rifle: 120, shotgun: 24, sniper: 20 })
  })
  it('잡화점 탄약 묶음: 권총 12발 80 · 소총 30발 150 · 산탄 6발 120 · 저격 5발 250', () => {
    expect(AMMO_PACKS).toEqual({ pistol: { n: 12, price: 80 }, rifle: { n: 30, price: 150 }, shotgun: { n: 6, price: 120 }, sniper: { n: 5, price: 250 } })
  })
  it('PvP 피해표 (권총 20 · 소총 14 · 산탄 9 · 저격 70 · 칼 15 · 찌르기 30 · 주먹 5). 서버 간격은 내 화면 간격보다 짧다', () => {
    expect(PVP_WEAPONS.map((w) => PVP[w].dmg)).toEqual([20, 14, 9, 70, 15, 30, 5])
    for (const id of GUN_IDS) expect(PVP[id].cool).toBeLessThan(60 / GUNS[id].rpm)
    for (const id of ['knife', 'stab', 'fists'] as const) expect(PVP[id].cool).toBeLessThan(MELEE[id].cool)
  })
})

describe('도구 칸', () => {
  it('1 낚싯대 · 2 주먹 · 3 칼 · 4 권총 · 5 소총 · 6 산탄총 · 7 저격총', () => {
    expect(HOTBAR).toEqual(['rod', 'fists', 'knife', 'pistol', 'rifle', 'shotgun', 'sniper', null, null])
  })
  it('폰은 총을 한 칸만 (마지막에 든 총), 무기 바꾸기는 주먹 → 칼 → 총 4종 → 주먹', () => {
    expect(touchHotbar('rifle')).toEqual(['rod', 'fists', 'knife', 'rifle'])
    expect(nextWeapon('fists')).toBe('knife')
    expect(nextWeapon('knife')).toBe('pistol')
    expect(nextWeapon('sniper')).toBe('fists')
    expect(nextWeapon('rod')).toBe('fists')
    expect(nextWeapon(null)).toBe('fists')
  })
})
```

`src/game/logic/ammo.test.ts` (새 파일):

```ts
import { describe, expect, it } from 'vitest'
import { FULL_MAGS, START_ROUNDS, buyAmmoPacks, canReload, readRounds, reloadRounds, spendRound } from './ammo'

describe('탄약', () => {
  it('쏘면 탄창에서 1발, 비었으면 null', () => {
    expect(spendRound(FULL_MAGS, 'pistol')?.pistol).toBe(11)
    expect(spendRound({ ...FULL_MAGS, sniper: 0 }, 'sniper')).toBeNull()
  })
  it('장전: 예비에서 모자란 만큼만. 탄창이 가득이거나 예비가 없으면 못 한다', () => {
    const mag = { ...FULL_MAGS, rifle: 4 }
    expect(reloadRounds(mag, START_ROUNDS, 'rifle')).toEqual({ mag: { ...mag, rifle: 30 }, reserve: { ...START_ROUNDS, rifle: 94 } })
    expect(reloadRounds(mag, { ...START_ROUNDS, rifle: 10 }, 'rifle')).toEqual({ mag: { ...mag, rifle: 14 }, reserve: { ...START_ROUNDS, rifle: 0 } })
    expect(canReload(FULL_MAGS, START_ROUNDS, 'pistol')).toBe(false)
    expect(reloadRounds(mag, { ...START_ROUNDS, rifle: 0 }, 'rifle')).toBeNull()
  })
  it('탄약 묶음 사기: 코인을 내고 예비에 더한다. 코인이 모자라거나 개수가 틀리면 그대로', () => {
    expect(buyAmmoPacks(200, START_ROUNDS, 'pistol', 2)).toEqual({ ok: true, coins: 40, reserve: { ...START_ROUNDS, pistol: 72 } })
    expect(buyAmmoPacks(249, START_ROUNDS, 'sniper', 1)).toEqual({ ok: false, reason: 'coins' })
    expect(buyAmmoPacks(1000, START_ROUNDS, 'rifle', 0)).toEqual({ ok: false, reason: 'qty' })
    expect(buyAmmoPacks(1000, START_ROUNDS, 'rifle', 1.5)).toEqual({ ok: false, reason: 'qty' })
  })
  it('저장본 읽기: 총마다 0 ~ 상한 정수만, 나머지는 기본값', () => {
    expect(readRounds({ pistol: 3, rifle: 99, shotgun: -1, sniper: 'x' }, FULL_MAGS, (id) => FULL_MAGS[id])).toEqual({ ...FULL_MAGS, pistol: 3 })
    expect(readRounds(null, START_ROUNDS, () => 9999)).toEqual(START_ROUNDS)
  })
})
```

`src/game/stores/progressStore.test.ts` (바꿀 곳, `git diff -U3`):

```diff
diff --git a/src/game/stores/progressStore.test.ts b/src/game/stores/progressStore.test.ts
--- a/src/game/stores/progressStore.test.ts
+++ b/src/game/stores/progressStore.test.ts
@@ -490,4 +490,35 @@ describe('progressStore', () => {
     await useProgressStore.persist.rehydrate()
     expect(store().stock).toEqual(INITIAL_PROGRESS.stock)
   })
+
+  it('총: 쏘면 탄창이 줄고, 장전하면 예비에서 채운다. 탄약 묶음은 코인으로 산다', () => {
+    expect(store().ammo.pistol).toBe(12)
+    expect(store().fireRound('pistol')).toBe(true)
+    expect(store().ammo.pistol).toBe(11)
+    expect(store().reloadGun('pistol')).toBe(true)
+    expect([store().ammo.pistol, store().reserve.pistol]).toEqual([12, 47])
+    expect(store().buyAmmo('sniper', 1)).toBe(false)
+    useProgressStore.setState({ coins: 300 })
+    expect(store().buyAmmo('sniper', 1)).toBe(true)
+    expect([store().coins, store().reserve.sniper]).toEqual([50, 25])
+  })
+
+  it('사격장 최고 점수는 더 높을 때만 바뀐다', () => {
+    expect(store().recordRangeScore(30)).toBe(true)
+    expect(store().recordRangeScore(12)).toBe(false)
+    expect(store().rangeBest).toBe(30)
+  })
+
+  it('탄약이 없는 예전 저장본(version 4)은 탄창 가득·은지 기본 예비·최고 점수 0, 깨진 값은 그 총만 기본값', async () => {
+    localStorage.setItem(SAVE_KEY, JSON.stringify({ state: { coins: 3 }, version: 4 }))
+    await useProgressStore.persist.rehydrate()
+    expect(store().ammo).toEqual({ pistol: 12, rifle: 30, shotgun: 6, sniper: 5 })
+    expect(store().reserve).toEqual({ pistol: 48, rifle: 120, shotgun: 24, sniper: 20 })
+    expect(store().rangeBest).toBe(0)
+    localStorage.setItem(SAVE_KEY, JSON.stringify({ state: { ammo: { pistol: 13, rifle: 7 }, reserve: { sniper: 2, shotgun: 1.5 }, rangeBest: 88 }, version: 5 }))
+    await useProgressStore.persist.rehydrate()
+    expect(store().ammo).toEqual({ pistol: 12, rifle: 7, shotgun: 6, sniper: 5 })
+    expect(store().reserve).toEqual({ pistol: 48, rifle: 120, shotgun: 24, sniper: 2 })
+    expect(store().rangeBest).toBe(88)
+  })
 })
```

`src/game/stores/sessionStore.test.ts` (바꿀 곳, `git diff -U3`):

```diff
diff --git a/src/game/stores/sessionStore.test.ts b/src/game/stores/sessionStore.test.ts
--- a/src/game/stores/sessionStore.test.ts
+++ b/src/game/stores/sessionStore.test.ts
@@ -98,6 +98,15 @@ describe('도구 칸', () => {
     useSessionStore.getState().resetSession()
     expect(useSessionStore.getState().tool).toBe('rod')
   })
+
+  it('총을 들면 마지막에 든 총으로 기억한다 (폰 도구 칸의 총 한 칸). 다른 도구를 들어도 그대로', () => {
+    expect(useSessionStore.getState().lastGun).toBe('pistol')
+    useSessionStore.getState().equip('sniper')
+    useSessionStore.getState().equip('knife')
+    expect(useSessionStore.getState().lastGun).toBe('sniper')
+    useSessionStore.getState().resetSession()
+    expect(useSessionStore.getState().lastGun).toBe('pistol')
+  })
 })
 
 describe('마을 상인 창', () => {
```

`src/game/logic/interaction.test.ts` (바꿀 곳, `git diff -U3`):

```diff
diff --git a/src/game/logic/interaction.test.ts b/src/game/logic/interaction.test.ts
--- a/src/game/logic/interaction.test.ts
+++ b/src/game/logic/interaction.test.ts
@@ -137,11 +137,13 @@ describe('resolveKeyAction', () => {
     expect(resolveKeyAction('Escape', 'emote', null)).toEqual({ type: 'closePanel' })
   })
 
-  it('탐험 중 숫자 키는 도구 칸 (1 낚싯대 · 2 주먹 · 3 칼), 빈 칸은 무시. X 는 넣기', () => {
+  it('탐험 중 숫자 키는 도구 칸 (1 낚싯대 · 2 주먹 · 3 칼 · 4~7 총), 빈 칸은 무시. X 는 넣기', () => {
     expect(resolveKeyAction('Digit1', 'explore', null)).toEqual({ type: 'equip', tool: 'rod' })
     expect(resolveKeyAction('Digit2', 'explore', null)).toEqual({ type: 'equip', tool: 'fists' })
     expect(resolveKeyAction('Digit3', 'explore', null)).toEqual({ type: 'equip', tool: 'knife' })
-    expect(resolveKeyAction('Digit4', 'explore', null)).toEqual({ type: 'none' })
+    expect(resolveKeyAction('Digit4', 'explore', null)).toEqual({ type: 'equip', tool: 'pistol' })
+    expect(resolveKeyAction('Digit7', 'explore', null)).toEqual({ type: 'equip', tool: 'sniper' })
+    expect(resolveKeyAction('Digit8', 'explore', null)).toEqual({ type: 'none' })
     expect(resolveKeyAction('Digit0', 'explore', null)).toEqual({ type: 'none' })
     expect(resolveKeyAction('KeyX', 'explore', null)).toEqual({ type: 'equip', tool: null })
     // 낚시 중 숫자는 그대로 미끼, 패널에선 무시
```

- [ ] **Step 2: 실행해 실패 확인**

Run: `npx vitest run src/game/data/guns.test.ts src/game/logic/ammo.test.ts src/game/stores src/game/logic/interaction.test.ts`
Expected: FAIL — `Failed to resolve import "./guns"`·`"./ammo"`, progressStore `fireRound is not a function`, sessionStore `lastGun` undefined, interaction `Digit4` 가 `none`

- [ ] **Step 3: 총 데이터·도구 칸·탄약 값**

`src/game/data/guns.ts` (새 파일):

```ts
/** 총 4종 (은지 weapons.js WEAPONS 값 그대로). 도구 칸 4~7 */
export type GunId = 'pistol' | 'rifle' | 'shotgun' | 'sniper'
export const GUN_IDS: GunId[] = ['pistol', 'rifle', 'shotgun', 'sniper']

/** 조준경 배율 한 단계 (mag 1 = 확대 없는 홀로그램 조준기) */
export type ZoomStep = { label: string; mag: number }

/**
 * auto: 누르고 있으면 계속 쏜다, rpm: 분당 발사 수, mag: 탄창, reload: 장전 시간(초), pellets: 한 번에 나가는 알 수,
 * dmg: 동물 피해 (알 하나), spread·aimSpread: 퍼짐(rad, 조준하면 aimSpread), recoil: 반동(rad), aimFov: 은지 조준 FOV(은지 기본 60 기준),
 * zoom: 조준경 배율 단계 (소총·저격총), sound: 은지 audio.js 총소리
 */
export type Gun = {
  id: GunId
  name: string
  auto: boolean
  rpm: number
  mag: number
  reload: number
  pellets: number
  dmg: number
  spread: number
  aimSpread: number
  recoil: number
  aimFov: number
  zoom?: ZoomStep[]
}

export const GUNS: Record<GunId, Gun> = {
  pistol: { id: 'pistol', name: '권총', auto: false, rpm: 320, mag: 12, reload: 1.3, pellets: 1, dmg: 1, spread: 0.012, aimSpread: 0.003, recoil: 0.018, aimFov: 50 },
  rifle: { id: 'rifle', name: '소총', auto: true, rpm: 650, mag: 30, reload: 2.0, pellets: 1, dmg: 1, spread: 0.02, aimSpread: 0.006, recoil: 0.01, aimFov: 45, zoom: [{ label: '홀로', mag: 1 }, { label: '2.5x', mag: 2.5 }] },
  shotgun: { id: 'shotgun', name: '산탄총', auto: false, rpm: 70, mag: 6, reload: 2.4, pellets: 8, dmg: 1, spread: 0.05, aimSpread: 0.035, recoil: 0.05, aimFov: 55 },
  sniper: { id: 'sniper', name: '저격총', auto: false, rpm: 40, mag: 5, reload: 2.6, pellets: 1, dmg: 3, spread: 0.04, aimSpread: 0, recoil: 0.06, aimFov: 40, zoom: [{ label: '4x', mag: 4 }, { label: '8x', mag: 8 }] },
}

export const isGun = (v: unknown): v is GunId => GUN_IDS.includes(v as GunId)

/** 총알이 날아가는 거리 (은지 MAX_RANGE, m) */
export const GUN_RANGE = 80
/** 은지 기본 예비 탄약 (탄창은 가득 찬 채로 시작) */
export const START_RESERVE: Record<GunId, number> = { pistol: 48, rifle: 120, shotgun: 24, sniper: 20 }
/** 예비 탄약 상한 (저장본 검사. 묶음을 아주 많이 사도 이만큼) */
export const MAX_RESERVE = 9999

/** 총 바꾸는 시간(초, 은지 cool 0.25), 빈 탄창 딸깍 뒤 쉬는 시간(초, 은지 0.3) */
export const GUN_SWAP = 0.25
export const DRY_FIRE_PAUSE = 0.3
/** 연사 열기: 연사 총은 한 발마다 +0.15 (최대 1), 초당 2 씩 식는다. 퍼짐에 열기 × 0.01 을 더한다 (은지 heat) */
export const HEAT = { perShot: 0.15, cool: 2, spread: 0.01 }
/** 반동 배율: 조준하면 0.6, 조준경으로 보면 0.5 를 더 곱한다 (은지 rig.kick) */
export const RECOIL = { aim: 0.6, scope: 0.5 }

/**
 * PvP (은지 server PVP_DMG·HIT_COOL). 체력 100 기준 피해, 산탄총은 맞은 알 수(최대 8)만큼 곱한다.
 * cool: 서버가 같은 무기로 다시 받는 최소 간격(초. 클라이언트 연사 간격보다 조금 느슨하게)
 */
export type PvpWeapon = GunId | 'knife' | 'stab' | 'fists'
export const PVP_WEAPONS: PvpWeapon[] = [...GUN_IDS, 'knife', 'stab', 'fists']
export const PVP: Record<PvpWeapon, { dmg: number; cool: number }> = {
  pistol: { dmg: 20, cool: 0.15 },
  rifle: { dmg: 14, cool: 0.07 },
  shotgun: { dmg: 9, cool: 0.6 },
  sniper: { dmg: 70, cool: 1.2 },
  knife: { dmg: 15, cool: 0.4 },
  stab: { dmg: 30, cool: 0.7 },
  fists: { dmg: 5, cool: 0.3 },
}

/** 다른 사람 몸 판정 캡슐 (은지 remote.js: 반지름 0.32, 가운데 기둥 1.3 → 발밑~머리 위 1.94) */
export const PEER_HIT = { radius: 0.32, length: 1.3 }

/** 동물 몸 판정 기둥 높이 (m) = 모델 배율 × 1.5, 아주 작은 동물도 0.4 (반지름은 data/animals hitRadius) */
export const ANIMAL_HIT_HEIGHT = { perScale: 1.5, min: 0.4 }
```

`src/game/data/tools.ts` (바꿀 곳, `git diff -U3`):

```diff
diff --git a/src/game/data/tools.ts b/src/game/data/tools.ts
--- a/src/game/data/tools.ts
+++ b/src/game/data/tools.ts
@@ -1,18 +1,40 @@
-/** 손에 드는 도구. 3-2 에서는 낚싯대·주먹·칼 (휘두르기는 3-3, 총 4~7 칸은 3-4) */
-export type ToolId = 'rod' | 'fists' | 'knife'
+import { GUN_IDS, type GunId } from './guns'
 
-export const TOOLS: { id: ToolId; name: string; icon: string }[] = [
+/** 손에 드는 도구: 낚싯대·주먹·칼 (3-2·3-3), 총 4종 (3-4) */
+export type ToolId = 'rod' | 'fists' | 'knife' | GunId
+
+/** short: 도구 칸에 적는 짧은 이름 (총은 모양이 같은 그림이라 이름으로 가른다) */
+export const TOOLS: { id: ToolId; name: string; icon: string; short?: string }[] = [
   { id: 'rod', name: '낚싯대', icon: '🎣' },
   { id: 'fists', name: '주먹', icon: '✊' },
   { id: 'knife', name: '칼', icon: '🔪' },
+  { id: 'pistol', name: '권총', icon: '🔫', short: '권총' },
+  { id: 'rifle', name: '소총', icon: '🔫', short: '소총' },
+  { id: 'shotgun', name: '산탄총', icon: '🔫', short: '산탄' },
+  { id: 'sniper', name: '저격총', icon: '🔫', short: '저격' },
 ]
 export const TOOL_IDS: ToolId[] = TOOLS.map((t) => t.id)
+export const toolDef = (id: ToolId) => TOOLS.find((t) => t.id === id)!
 
-/** 도구 칸 9개 (숫자 키 1~9). 1 = 낚싯대, 2 = 주먹, 3 = 칼, 4~7 = 총 (3-4 에서 채운다) */
-export const HOTBAR: (ToolId | null)[] = ['rod', 'fists', 'knife', null, null, null, null, null, null]
+/** 도구 칸 9개 (숫자 키 1~9). 1 = 낚싯대, 2 = 주먹, 3 = 칼, 4 = 권총, 5 = 소총, 6 = 산탄총, 7 = 저격총 */
+export const HOTBAR: (ToolId | null)[] = ['rod', 'fists', 'knife', ...GUN_IDS, null, null]
 
 /** 숫자 키(e.code) → 칸 번호 (0부터). 숫자 키가 아니면 null */
 export function hotbarSlot(code: string): number | null {
   const m = /^Digit([1-9])$/.exec(code)
   return m ? Number(m[1]) - 1 : null
 }
+
+/**
+ * 폰 도구 칸: 좁아서 총은 한 칸만 (지금 든 총, 아니면 마지막에 든 총). 총끼리는 무기 바꾸기 버튼(⇄)으로 넘긴다
+ */
+export function touchHotbar(lastGun: GunId): ToolId[] {
+  return ['rod', 'fists', 'knife', lastGun]
+}
+
+/** 폰 무기 바꾸기(⇄): 주먹 → 칼 → 권총 → 소총 → 산탄총 → 저격총 → 주먹 (은지 CYCLE 처럼 돈다. 낚싯대·빈손은 건너뛴다) */
+export function nextWeapon(tool: ToolId | null): ToolId {
+  const cycle: ToolId[] = ['fists', 'knife', ...GUN_IDS]
+  const i = tool ? cycle.indexOf(tool) : -1
+  return cycle[(i + 1) % cycle.length]
+}
```

`src/game/data/meadowPrices.ts` (바꿀 곳, `git diff -U3`):

```diff
diff --git a/src/game/data/meadowPrices.ts b/src/game/data/meadowPrices.ts
--- a/src/game/data/meadowPrices.ts
+++ b/src/game/data/meadowPrices.ts
@@ -1,8 +1,9 @@
+import type { GunId } from './guns'
 import { ITEMS, hasTag, type ItemId, type RawItemId } from './meadowItems'
 
 /**
  * 마을 상인 가격 (코인). 은지 "원" 값의 약 2배: 고기 ≈ 흔한 물고기 하위 값, 요리 ≈ 간식. 나중에 맞추기 쉽게 숫자는 여기에만 둔다.
- * 탄약 묶음(권총 80 · 소총 150 · 산탄 120 · 저격 250)은 3-4 에서 잡화점에 연다
+ * 탄약 묶음은 장비 값(60~2200) 쪽으로 조금 비싸게 (AMMO_PACKS, 잡화점이 판다)
  */
 export const SELL_PRICE: Record<RawItemId, number> = {
   beef: 12,
@@ -31,6 +32,14 @@ export const BUY_PRICE: Partial<Record<ItemId, number>> = { egg: 8, pumpkin: 12,
  */
 export const DAILY_STOCK: Partial<Record<ItemId, number>> = { egg: 3, pumpkin: 3, mushroom: 3 }
 
+/** 잡화점 탄약 묶음: 권총 12발 80 · 소총 30발 150 · 산탄 6발 120 · 저격 5발 250 (예비 탄약에 더한다) */
+export const AMMO_PACKS: Record<GunId, { n: number; price: number }> = {
+  pistol: { n: 12, price: 80 },
+  rifle: { n: 30, price: 150 },
+  shotgun: { n: 6, price: 120 },
+  sniper: { n: 5, price: 250 },
+}
+
 /** 물건 하나를 상인에게 팔 때 받는 값 */
 export function sellPrice(id: ItemId): number {
   const sate = ITEMS[id].sate
@@ -40,7 +49,7 @@ export function sellPrice(id: ItemId): number {
 export type VendorId = 'butcher' | 'general' | 'grocer'
 export const VENDOR_IDS: VendorId[] = ['butcher', 'general', 'grocer']
 
-/** 누가 무엇을 사고(buys) 파는지(sells). 은지 VENDORS 그대로: 정육점 고기·요리 삼 / 잡화점 뼈·비계 삼 (탄약은 3-4) / 농산물 사고팜 */
+/** 누가 무엇을 사고(buys) 파는지(sells). 은지 VENDORS 그대로: 정육점 고기·요리 삼 / 잡화점 뼈·비계 삼 (탄약은 AMMO_PACKS) / 농산물 사고팜 */
 export const VENDOR_TRADE: Record<VendorId, { buys: (id: ItemId) => boolean; sells: ItemId[] }> = {
   butcher: { buys: (id) => hasTag(id, 'meat') || hasTag(id, 'dish'), sells: [] },
   general: { buys: (id) => id === 'bone' || id === 'fat', sells: [] },
```

`src/game/data/meadow.ts` — 잡화점 인사 (바꿀 곳, `git diff -U3`):

```diff
diff --git a/src/game/data/meadow.ts b/src/game/data/meadow.ts
--- a/src/game/data/meadow.ts
+++ b/src/game/data/meadow.ts
@@ -78,6 +78,6 @@ export const MEADOW_DOORS = ['거실 문', '사격장 문', '주방 문', '현
  */
 export const MEADOW_VENDORS: { id: VendorId; name: string; greet: string; at: [number, number]; npc: [number, number]; look: string }[] = [
   { id: 'butcher', name: '정육점', greet: '고기와 요리를 삽니다', at: [46, 11.5], npc: [46, 12.4], look: 'grandpa' },
-  { id: 'general', name: '잡화점', greet: '뼈·비계를 삽니다 · 탄약은 곧 들어와요', at: [52, 11.5], npc: [52, 12.4], look: 'lady' },
+  { id: 'general', name: '잡화점', greet: '탄약을 팝니다 · 뼈·비계는 삽니다', at: [52, 11.5], npc: [52, 12.4], look: 'lady' },
   { id: 'grocer', name: '농산물 가게', greet: '달걀·호박·버섯을 사고팝니다', at: [58, 11.5], npc: [58, 12.4], look: 'rangerMale' },
 ]
```

- [ ] **Step 4: 탄약 규칙과 저장 (version 5)**

`src/game/logic/ammo.ts` (새 파일):

```ts
import { GUNS, GUN_IDS, MAX_RESERVE, START_RESERVE, type GunId } from '../data/guns'
import { AMMO_PACKS } from '../data/meadowPrices'

/** 총마다 탄 수 (탄창 안 · 예비) */
export type Rounds = Record<GunId, number>

/** 처음: 탄창 가득 */
export const FULL_MAGS: Rounds = Object.fromEntries(GUN_IDS.map((id) => [id, GUNS[id].mag])) as Rounds
/** 처음 예비 탄약 (은지 그대로) */
export const START_ROUNDS: Rounds = { ...START_RESERVE }

/** 한 발 쏜다. 탄창이 비었으면 null */
export function spendRound(mag: Rounds, id: GunId): Rounds | null {
  return mag[id] > 0 ? { ...mag, [id]: mag[id] - 1 } : null
}

/** 장전할 수 있나: 탄창이 덜 찼고 예비가 있다 (은지 reload 조건) */
export function canReload(mag: Rounds, reserve: Rounds, id: GunId): boolean {
  return mag[id] < GUNS[id].mag && reserve[id] > 0
}

/** 장전이 끝났다: 예비에서 모자란 만큼만 채운다. 못 하면 null */
export function reloadRounds(mag: Rounds, reserve: Rounds, id: GunId): { mag: Rounds; reserve: Rounds } | null {
  if (!canReload(mag, reserve, id)) return null
  const take = Math.min(GUNS[id].mag - mag[id], reserve[id])
  return { mag: { ...mag, [id]: mag[id] + take }, reserve: { ...reserve, [id]: reserve[id] - take } }
}

export type AmmoBuy = { ok: true; coins: number; reserve: Rounds } | { ok: false; reason: 'qty' | 'coins' }

/** 잡화점에서 탄약 묶음 packs 개를 산다 (예비에 더한다, 상한 MAX_RESERVE) */
export function buyAmmoPacks(coins: number, reserve: Rounds, id: GunId, packs: number): AmmoBuy {
  if (!Number.isInteger(packs) || packs < 1) return { ok: false, reason: 'qty' }
  const { n, price } = AMMO_PACKS[id]
  if (coins < price * packs) return { ok: false, reason: 'coins' }
  return { ok: true, coins: coins - price * packs, reserve: { ...reserve, [id]: Math.min(MAX_RESERVE, reserve[id] + n * packs) } }
}

/** 저장본의 탄 수. 총마다 0 ~ max(id) 정수만 살리고 나머지는 fallback */
export function readRounds(v: unknown, fallback: Rounds, max: (id: GunId) => number): Rounds {
  const out = { ...fallback }
  if (typeof v !== 'object' || v === null) return out
  for (const id of GUN_IDS) {
    const n = (v as Record<string, unknown>)[id]
    if (typeof n === 'number' && Number.isInteger(n) && n >= 0 && n <= max(id)) out[id] = n
  }
  return out
}
```

`src/game/stores/progressStore.ts` (바꿀 곳, `git diff -U3`):

```diff
diff --git a/src/game/stores/progressStore.ts b/src/game/stores/progressStore.ts
--- a/src/game/stores/progressStore.ts
+++ b/src/game/stores/progressStore.ts
@@ -6,6 +6,7 @@ import { BAIT_IDS, type BaitId } from '../data/bait'
 import { SNACK_IDS, type SnackId } from '../data/snacks'
 import { getDish } from '../data/dishes'
 import { GEAR } from '../data/gear'
+import { GUNS, MAX_RESERVE, type GunId } from '../data/guns'
 import { findSpecies } from '../data/fish'
 import { MEADOW_DOORS } from '../data/meadow'
 import { ITEM_IDS, getRecipe, type ItemId, type MeadowDishId } from '../data/meadowItems'
@@ -24,6 +25,7 @@ import {
   type AquariumEvent,
   type AquariumState,
 } from '../logic/aquarium'
+import { FULL_MAGS, START_ROUNDS, buyAmmoPacks, readRounds, reloadRounds, spendRound, type Rounds } from '../logic/ammo'
 import { NO_BAIT, buyBait as buyBaitRule, consumeBait, type BaitCounts } from '../logic/bait'
 import { normalizeLook } from '../logic/characterLook'
 import { NO_SNACKS, buyAndEatSnack as buyAndEatSnackRule, buySnacks as buySnacksRule, eatSnackFromBag, type SnackCounts, type SnackEatResult } from '../logic/snacks'
@@ -75,6 +77,12 @@ type ProgressData = {
   doors: boolean[]
   /** 농산물 가게에서 오늘 산 수 (하루 수량). 없던 저장본은 가득 */
   stock: VendorStock
+  /** 총마다 탄창에 든 탄 (없던 저장본은 가득) */
+  ammo: Rounds
+  /** 총마다 예비 탄약 (잡화점에서 산다. 없던 저장본은 은지 기본값) */
+  reserve: Rounds
+  /** 사격장 연습 게임 최고 점수 */
+  rangeBest: number
 }
 
 
@@ -138,6 +146,14 @@ type ProgressActions = {
   /** 마을 상인에게서 qty 개 산다. 코인이 모자라거나 안 파는 물건이면 false */
   /** day: 지금 날짜 (혼자 시계·방 시계). 농산물 가게 하루 수량을 센다 */
   buyItem: (vendor: VendorId, id: ItemId, qty: number, day: number) => boolean
+  /** 한 발 쏜다 (탄창에서 1). 탄창이 비었으면 false */
+  fireRound: (id: GunId) => boolean
+  /** 장전이 끝났다: 예비에서 탄창으로 모자란 만큼. 못 하면 false */
+  reloadGun: (id: GunId) => boolean
+  /** 잡화점에서 탄약 묶음 packs 개. 코인이 모자라면 false */
+  buyAmmo: (id: GunId, packs: number) => boolean
+  /** 사격장 최고 점수. 더 높을 때만 바꾸고 true */
+  recordRangeScore: (score: number) => boolean
 }
 
 export const INITIAL_PROGRESS: ProgressData = {
@@ -158,6 +174,9 @@ export const INITIAL_PROGRESS: ProgressData = {
   items: NO_ITEMS,
   doors: MEADOW_DOORS.map(() => false),
   stock: FULL_STOCK,
+  ammo: FULL_MAGS,
+  reserve: START_ROUNDS,
+  rangeBest: 0,
 }
 
 // --- 저장본 검증: 타입이 틀린 값은 버리고 초기값을 쓴다 ---
@@ -520,6 +539,30 @@ export const useProgressStore = create<ProgressData & ProgressActions>()(
         return r.ok
       },
 
+      fireRound: (id) => {
+        const ammo = spendRound(get().ammo, id)
+        if (ammo) set({ ammo })
+        return ammo !== null
+      },
+
+      reloadGun: (id) => {
+        const r = reloadRounds(get().ammo, get().reserve, id)
+        if (r) set({ ammo: r.mag, reserve: r.reserve })
+        return r !== null
+      },
+
+      buyAmmo: (id, packs) => {
+        const r = buyAmmoPacks(get().coins, get().reserve, id, packs)
+        if (r.ok) set({ coins: r.coins, reserve: r.reserve })
+        return r.ok
+      },
+
+      recordRangeScore: (score) => {
+        if (!(Number.isInteger(score) && score > get().rangeBest)) return false
+        set({ rangeBest: score })
+        return true
+      },
+
       setDoorOpen: (index, open) => set((s) => (index >= 0 && index < s.doors.length ? { doors: s.doors.map((o, i) => (i === index ? open : o)) } : {})),
 
       unlockZone: (id) => {
@@ -536,8 +579,9 @@ export const useProgressStore = create<ProgressData & ProgressActions>()(
     }),
     {
       name: SAVE_KEY,
-      // 2: 장비·어항이 5단계 → 10단계. 3: 배고픔(survival.hunger)·혼자 시계(clock) 추가. 4: 은지 가방(items)·문(doors)·농산물 하루 수량(stock) 추가 (3·4 는 필드만 늘어 옮길 것 없다)
-      version: 4,
+      // 2: 장비·어항이 5단계 → 10단계. 3: 배고픔(survival.hunger)·혼자 시계(clock) 추가. 4: 은지 가방(items)·문(doors)·농산물 하루 수량(stock) 추가.
+      // 5: 탄창(ammo)·예비 탄약(reserve)·사격장 최고 점수(rangeBest) 추가 (3~5 는 필드만 늘어 옮길 것 없다)
+      version: 5,
       migrate: (persisted, version) => migrateSave(persisted, version) as ProgressData & ProgressActions,
       storage: createJSONStorage(() => localStorage),
       // 저장본의 각 필드를 검증해서, 틀린 값은 기본값을 쓰고 지금은 없는 물고기는 버린다
@@ -562,6 +606,9 @@ export const useProgressStore = create<ProgressData & ProgressActions>()(
           items: readItems(saved.items, current.items),
           doors: readDoors(saved.doors, current.doors),
           stock: readStock(saved.stock),
+          ammo: readRounds(saved.ammo, current.ammo, (id) => GUNS[id].mag),
+          reserve: readRounds(saved.reserve, current.reserve, () => MAX_RESERVE),
+          rangeBest: readCount(saved.rangeBest, current.rangeBest),
         }
       },
     },
```

`src/game/stores/sessionStore.ts` (바꿀 곳, `git diff -U3`):

```diff
diff --git a/src/game/stores/sessionStore.ts b/src/game/stores/sessionStore.ts
--- a/src/game/stores/sessionStore.ts
+++ b/src/game/stores/sessionStore.ts
@@ -1,5 +1,6 @@
 import { create } from 'zustand'
 import { CAMERA_ZOOM } from '../data/balance'
+import { isGun, type GunId } from '../data/guns'
 import type { MeadowDishId } from '../data/meadowItems'
 import type { VendorId } from '../data/meadowPrices'
 import type { ToolId } from '../data/tools'
@@ -58,6 +59,8 @@ type SessionState = {
   openVendor: (id: VendorId) => void
   /** 손에 든 도구 (도구 칸). null = 빈손. 저장하지 않는다 (다시 들어오면 낚싯대) */
   tool: ToolId | null
+  /** 마지막에 든 총 (폰 도구 칸의 총 한 칸). 저장하지 않는다 */
+  lastGun: GunId
   equip: (tool: ToolId | null) => void
   /** 마지막으로 맞은 때 (performance.now() 초. 화면 가장자리가 빨갛게 번쩍인다, ui/HurtFlash). 저장하지 않는다 */
   hurtAt: number | null
@@ -106,7 +109,8 @@ export const useSessionStore = create<SessionState>((set, get) => ({
   stoveCook: null,
   setStoveCook: (stoveCook) => set({ stoveCook }),
   tool: 'rod',
-  equip: (tool) => set({ tool }),
+  lastGun: 'pistol',
+  equip: (tool) => set(isGun(tool) ? { tool, lastGun: tool } : { tool }),
   hurtAt: null,
   flashHurt: () => set({ hurtAt: performance.now() / 1000 }),
   setPlayerAction: (playerAction) => set({ playerAction }),
@@ -123,5 +127,5 @@ export const useSessionStore = create<SessionState>((set, get) => ({
   // 순간이동(쓰러져 진료소로 등)하면 타던 배에서 내린다
   requestTeleport: (pos) => set((s) => ({ teleport: pos, boat: null, mode: s.mode === 'boat' ? 'explore' : s.mode })),
   clearTeleport: () => set({ teleport: null }),
-  resetSession: () => set({ mode: 'explore', nearby: null, notice: null, teleport: null, zoom: CAMERA_ZOOM.initial, playerAction: IDLE_ACTION, cutscene: null, cooking: null, boat: null, tool: 'rod', stoveCook: null, vendor: null, hurtAt: null }),
+  resetSession: () => set({ mode: 'explore', nearby: null, notice: null, teleport: null, zoom: CAMERA_ZOOM.initial, playerAction: IDLE_ACTION, cutscene: null, cooking: null, boat: null, tool: 'rod', lastGun: 'pistol', stoveCook: null, vendor: null, hurtAt: null }),
 }))
```

- [ ] **Step 5: 도구 칸·잡화점 화면·키 안내**

도구 칸 총 칸엔 짧은 이름과 탄창에 든 탄을 적는다. 폰은 총을 한 칸(마지막에 든 총)만. 잡화점 "사기" 탭은 탄약 묶음 키오스크.

`src/game/ui/Hotbar.tsx` (바꿀 곳, `git diff -U3`):

```diff
diff --git a/src/game/ui/Hotbar.tsx b/src/game/ui/Hotbar.tsx
--- a/src/game/ui/Hotbar.tsx
+++ b/src/game/ui/Hotbar.tsx
@@ -1,37 +1,42 @@
 import { getBait } from '../data/bait'
-import { HOTBAR, TOOLS } from '../data/tools'
+import { isGun } from '../data/guns'
+import { HOTBAR, toolDef, touchHotbar, type ToolId } from '../data/tools'
 import { TOUCH } from '../data/touch'
 import { useMediaQuery, useTouchUi } from '../input/touchDevice'
 import { useProgressStore } from '../stores/progressStore'
 import { useSessionStore } from '../stores/sessionStore'
 import { safeBottom } from './styles'
 
+const corner = { position: 'absolute' as const, fontSize: 10, fontWeight: 800 }
+
 /**
  * 화면 아래 가운데 도구 칸 (탐험 중). 숫자 키 1~9 와 같고, 눌러서도 바꾼다(폰).
- * 낚싯대 칸에는 고른 미끼 개수를 탄약처럼 적는다. 폰은 좁아서 빈 칸을 그리지 않는다
+ * 낚싯대 칸에는 고른 미끼 개수를, 총 칸에는 탄창에 든 탄을 적는다. 폰은 좁아서 빈 칸을 그리지 않고 총은 한 칸만 (마지막에 든 총)
  */
 export function Hotbar() {
   const mode = useSessionStore((s) => s.mode)
   const tool = useSessionStore((s) => s.tool)
+  const lastGun = useSessionStore((s) => s.lastGun)
   const bait = useProgressStore((s) => s.selectedBait)
   const baitCount = useProgressStore((s) => (s.selectedBait ? (s.bait[s.selectedBait] ?? 0) : 0))
+  const ammo = useProgressStore((s) => s.ammo)
   const touchUi = useTouchUi()
   const portrait = useMediaQuery('(orientation: portrait)')
   if (mode !== 'explore') return null
   // 컴퓨터: 아래 조작 안내가 좁은 창에서 두 줄이 되어도 겹치지 않게 띄운다
   const bottom = touchUi ? TOUCH.hotbarBottom[portrait ? 'portrait' : 'landscape'] : 44
-  const slots = HOTBAR.map((id, i) => ({ id, i })).filter((s) => !touchUi || s.id)
+  const slots: { id: ToolId | null; key: number }[] = touchUi ? touchHotbar(lastGun).map((id) => ({ id, key: HOTBAR.indexOf(id) })) : HOTBAR.map((id, key) => ({ id, key }))
   return (
     <div style={{ position: 'absolute', left: '50%', bottom: safeBottom(bottom), transform: 'translateX(-50%)', display: 'flex', gap: 4, pointerEvents: 'auto', zIndex: 1000 }} aria-label="도구 칸">
-      {slots.map(({ id, i }) => {
-        const def = id ? TOOLS.find((t) => t.id === id) : undefined
+      {slots.map(({ id, key }) => {
+        const def = id ? toolDef(id) : undefined
         const on = id !== null && id === tool
         return (
           <button
-            key={i}
+            key={key}
             disabled={!id}
-            title={def ? `${i + 1} ${def.name}` : undefined}
-            aria-label={def ? `${def.name} 들기` : `빈 칸 ${i + 1}`}
+            title={def ? `${key + 1} ${def.name}` : undefined}
+            aria-label={def ? `${def.name} 들기` : `빈 칸 ${key + 1}`}
             aria-pressed={on}
             onClick={(e) => {
               e.currentTarget.blur()
@@ -51,13 +56,15 @@ export function Hotbar() {
               lineHeight: 1,
             }}
           >
-            <span style={{ position: 'absolute', top: 2, left: 4, fontSize: 10, opacity: 0.8 }}>{i + 1}</span>
+            <span style={{ position: 'absolute', top: 2, left: 4, fontSize: 10, opacity: 0.8 }}>{key + 1}</span>
+            {def?.short && <span style={{ ...corner, top: 2, right: 3, fontWeight: 600, opacity: 0.9 }}>{def.short}</span>}
             {def?.icon}
             {id === 'rod' && (
-              <span style={{ position: 'absolute', bottom: 1, right: 3, fontSize: 10, fontWeight: 800 }} title={bait ? `${getBait(bait).name} ${baitCount}개` : '미끼 없이'}>
+              <span style={{ ...corner, bottom: 1, right: 3 }} title={bait ? `${getBait(bait).name} ${baitCount}개` : '미끼 없이'}>
                 {bait ? baitCount : '–'}
               </span>
             )}
+            {isGun(id) && <span style={{ ...corner, bottom: 1, right: 3, color: ammo[id] === 0 ? '#ff8a80' : undefined }}>{ammo[id]}</span>}
           </button>
         )
       })}
```

`src/game/ui/VendorPanel.tsx` (바꿀 곳, `git diff -U3`):

```diff
diff --git a/src/game/ui/VendorPanel.tsx b/src/game/ui/VendorPanel.tsx
--- a/src/game/ui/VendorPanel.tsx
+++ b/src/game/ui/VendorPanel.tsx
@@ -1,7 +1,8 @@
 import { useState } from 'react'
+import { GUNS, GUN_IDS, type GunId } from '../data/guns'
 import { MEADOW_VENDORS } from '../data/meadow'
 import { ITEMS, ITEM_IDS, type ItemId } from '../data/meadowItems'
-import { BUY_PRICE, VENDOR_TRADE, sellPrice, type VendorId } from '../data/meadowPrices'
+import { AMMO_PACKS, BUY_PRICE, VENDOR_TRADE, sellPrice, type VendorId } from '../data/meadowPrices'
 import { affordableQty } from '../logic/bait'
 import { stockLeft } from '../logic/meadowShop'
 import { useDayStore } from '../stores/dayStore'
@@ -20,7 +21,7 @@ function Emoji({ id, size }: { id: ItemId; size: number }) {
 
 /**
  * 마을 상인 (정육점·잡화점·농산물 가게) 키오스크: 왼쪽 탭 "팔기" (내 가방에서 이 상인이 사는 것), 오른쪽 탭 "사기" (이 상인이 파는 것).
- * 누가 무엇을 사고파는지와 값은 data/meadowPrices
+ * 누가 무엇을 사고파는지와 값은 data/meadowPrices. 잡화점 "사기" 는 탄약 묶음 (예비 탄약에 더한다)
  */
 export function VendorPanel() {
   const vendorId = useSessionStore((s) => s.vendor)
@@ -40,7 +41,8 @@ export function VendorPanel() {
     tab,
     onTab: (id: string) => setTab(id as Tab),
   }
-  return tab === 'sell' ? <SellTab key={vendor.id} frame={frame} vendor={vendor.id} /> : <BuyTab key={vendor.id} frame={frame} vendor={vendor.id} />
+  if (tab === 'sell') return <SellTab key={vendor.id} frame={frame} vendor={vendor.id} />
+  return vendor.id === 'general' ? <AmmoTab frame={frame} /> : <BuyTab key={vendor.id} frame={frame} vendor={vendor.id} />
 }
 
 type Frame = Pick<Parameters<typeof Kiosk>[0], 'title' | 'subtitle' | 'accent' | 'coins' | 'tabs' | 'tab' | 'onTab'>
@@ -113,7 +115,7 @@ function BuyTab({ frame, vendor }: { frame: Frame; vendor: VendorId }) {
         setSelected(r as ItemId)
         setQty(1)
       }}
-      empty={vendor === 'general' ? '탄약은 곧 들어와요' : '이 가게는 파는 물건이 없어요'}
+      empty="이 가게는 파는 물건이 없어요"
       detail={
         id && (
           <KioskDetail image={<Emoji id={id} size={96} />} title={ITEMS[id].name} lines={[ITEMS[id].desc, `1개 ${price} 코인 · 가방에 ${items[id]}개${stockText(id)}`]}>
@@ -134,3 +136,45 @@ function BuyTab({ frame, vendor }: { frame: Frame; vendor: VendorId }) {
     />
   )
 }
+
+function Gun({ size }: { size: number }) {
+  return <span style={{ fontSize: size * 0.8, lineHeight: 1 }}>🔫</span>
+}
+
+/** 잡화점 탄약 묶음 (권총 12발 80 · 소총 30발 150 · 산탄 6발 120 · 저격 5발 250). 산 탄은 예비 탄약으로 들어가 R 로 장전한다 */
+function AmmoTab({ frame }: { frame: Frame }) {
+  const { coins } = frame
+  const reserve = useProgressStore((s) => s.reserve)
+  const [selected, setSelected] = useState<GunId>('pistol')
+  const [qty, setQty] = useState(1)
+  const [toast, flash] = useFlash()
+  const pack = AMMO_PACKS[selected]
+  const max = Math.max(1, affordableQty(coins, pack.price, BUY_MAX))
+  const n = Math.min(qty, max)
+  return (
+    <Kiosk
+      {...frame}
+      cards={GUN_IDS.map((id) => ({ id, name: `${GUNS[id].name} 탄약`, image: <Gun size={56} />, price: `${AMMO_PACKS[id].n}발 ${AMMO_PACKS[id].price} 코인`, badge: `예비 ${reserve[id]}`, dimmed: coins < AMMO_PACKS[id].price }))}
+      selectedId={selected}
+      onSelect={(id) => {
+        setSelected(id as GunId)
+        setQty(1)
+      }}
+      detail={
+        <KioskDetail image={<Gun size={96} />} title={`${GUNS[selected].name} 탄약`} lines={[`한 묶음 ${pack.n}발 · ${pack.price} 코인`, `예비 탄약 ${reserve[selected]}발 · 총을 들고 R 로 장전`]}>
+          <QtyStepper value={n} max={max} onChange={setQty} />
+          <BigButton
+            label={`${n}묶음 사기`}
+            sub={coins >= pack.price * n ? `${pack.n * n}발 · ${pack.price * n} 코인` : '코인이 모자라요'}
+            disabled={coins < pack.price * n}
+            onClick={() => {
+              if (useProgressStore.getState().buyAmmo(selected, n)) flash(`${GUNS[selected].name} 탄약 ${pack.n * n}발을 샀어요!`)
+              setQty(1)
+            }}
+          />
+        </KioskDetail>
+      }
+      toast={toast}
+    />
+  )
+}
```

`src/game/ui/Hud.tsx` (바꿀 곳, `git diff -U3`):

```diff
diff --git a/src/game/ui/Hud.tsx b/src/game/ui/Hud.tsx
--- a/src/game/ui/Hud.tsx
+++ b/src/game/ui/Hud.tsx
@@ -132,7 +132,7 @@ export function Hud() {
           {mouseLook && !locked && <div style={lookHint}>클릭하면 마우스로 시점 회전 · ESC 해제</div>}
           {!touchUi && (
             <div style={{ position: 'absolute', bottom: 8, left: 16, right: 16, textAlign: 'center', opacity: 0.7, fontSize: 12 }}>
-              WASD 이동 · Shift 달리기 · Space 점프 · 1~3 도구 · X 넣기 · {tool === 'fists' ? '클릭 주먹 · ' : tool === 'knife' ? '클릭 베기 · 오른쪽 클릭 찌르기 · ' : ''}I 가방 · F 먹기 · T 꾹 감정 표현 · Tab 지도 · 휠 확대 · M 음악 · {mouseLook ? (locked ? '마우스로 시점 회전 · ESC 메뉴' : '클릭 후 마우스로 시점 회전') : '드래그로 카메라 회전'}
+              WASD 이동 · Shift 달리기 · Space 점프 · 1~7 도구 · X 넣기 · {tool === 'fists' ? '클릭 주먹 · ' : tool === 'knife' ? '클릭 베기 · 오른쪽 클릭 찌르기 · ' : ''}I 가방 · F 먹기 · T 꾹 감정 표현 · Tab 지도 · 휠 확대 · M 음악 · {mouseLook ? (locked ? '마우스로 시점 회전 · ESC 메뉴' : '클릭 후 마우스로 시점 회전') : '드래그로 카메라 회전'}
             </div>
           )}
         </>
```

`tools/meadow-check.mjs` — 3-2 점검 26 의 폰 도구 칸 수 (3 → 4) (바꿀 곳, `git diff -U3`):

```diff
diff --git a/tools/meadow-check.mjs b/tools/meadow-check.mjs
--- a/tools/meadow-check.mjs
+++ b/tools/meadow-check.mjs
@@ -614,11 +614,11 @@ await press('Escape')
 check((await sess('s.mode')) === 'explore', '25) ESC 로 닫기')
 
 
-// 26) 폰: 도구 칸은 쓰는 칸만, 오른쪽 아래 점프 위에 가방 버튼. 세로(390·360)·가로 화면에서 겹치지 않는지 스크린샷
+// 26) 폰: 도구 칸은 쓰는 칸만 (총은 한 칸), 오른쪽 아래 점프 위에 가방 버튼. 세로(390·360)·가로 화면에서 겹치지 않는지 스크린샷
 await M.evaluate(`(async () => { (await __mod('/src/game/input/touchDevice.ts')).useTouchUiStore.setState({ touchUi: true }); return true })()`)
 await M.send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true })
 await wait(1200)
-check(await M.evaluate(`document.querySelectorAll('[aria-label="도구 칸"] button').length === 3`), '26) 폰 도구 칸은 3칸')
+check(await M.evaluate(`document.querySelectorAll('[aria-label="도구 칸"] button').length === 4`), '26) 폰 도구 칸은 4칸 (총은 마지막에 든 한 칸)')
 await M.shot('26-phone-portrait')
 await M.evaluate(`[...document.querySelectorAll('[aria-label="도구 칸"] button')][2].click(), true`)
 await wait(300)
```

- [ ] **Step 6: 테스트 통과 확인**

Run: `npx vitest run && npx tsc -b && npm run lint 2>&1 | grep -c warning`
Expected: 모든 테스트 PASS, tsc 오류 없음, 경고 6

- [ ] **Step 7: 커밋**

```bash
git add src/game/data/guns.test.ts \
  src/game/data/guns.ts \
  src/game/data/meadow.ts \
  src/game/data/meadowPrices.ts \
  src/game/data/tools.ts \
  src/game/logic/ammo.test.ts \
  src/game/logic/ammo.ts \
  src/game/logic/interaction.test.ts \
  src/game/stores/progressStore.test.ts \
  src/game/stores/progressStore.ts \
  src/game/stores/sessionStore.test.ts \
  src/game/stores/sessionStore.ts \
  src/game/ui/Hotbar.tsx \
  src/game/ui/Hud.tsx \
  src/game/ui/VendorPanel.tsx \
  tools/meadow-check.mjs
git commit -F - <<'EOF'
feat: 총 4종 도구 칸과 탄약 저장·잡화점 탄약

- data/guns: 은지 WEAPONS 수치(권총·소총·산탄총·저격총), 기본 예비 탄약, PvP 피해·간격표
- 도구 칸 4~7 = 총. 폰은 총을 한 칸(마지막에 든 총)만 그린다
- 저장 version 5: 탄창(ammo)·예비 탄약(reserve)·사격장 최고 점수(rangeBest). 없던 저장본은 탄창 가득·은지 기본 예비
- 잡화점 "사기" 탭에 탄약 묶음(권총 12발 80 · 소총 30발 150 · 산탄 6발 120 · 저격 5발 250)
EOF
```

검증한 스크래치 커밋: `d6f33df` (이 커밋의 diff 를 그대로 적용해도 된다: `git -C /private/tmp/claude-501/-Users-ihyelin-proten-hrlee-----threejs/e476c70e-362f-4ed3-9ff7-d8664da04e4b/scratchpad/plan-3-4/repo format-patch -1 --binary d6f33df --stdout | git apply --index` 한 뒤 위 커밋 명령. 스크래치 커밋의 작성자는 scratch 라 `git am` 은 쓰지 않는다)

### Task 2: 총 쏘기 규칙과 광선 판정  — 스크래치 `7967ed6`

**Files:**
- Create: `src/game/logic/gun.ts`, `src/game/logic/hitscan.ts`
- Test: `src/game/logic/gun.test.ts`, `src/game/logic/hitscan.test.ts`

**Interfaces:**
- Consumes: `GUNS`·`DRY_FIRE_PAUSE`·`GUN_SWAP`·`HEAT`·`RECOIL`·`PEER_HIT`·`ANIMAL_HIT_HEIGHT` (Task 1), `hitRadius`·`speciesOf` (`data/animals`), `AnimalView` (`logic/animalSim`), `Rng` (`logic/rng`)
- Produces: `GunState = { readyAt; reload: { gun; until } | null; heat; heatAt; firedAt }`, `GUN_IDLE`, `heatNow(s, now)`, `spreadOf(id, aiming, heat)`, `recoilOf(id, aiming, scoped)`, `pullTrigger(s, id, now, rounds): { kind: 'fire' | 'empty' | 'busy'; state }`, `startReload(s, id, now, canReload): GunState | null`, `finishReload(s, now): { gun; state } | null`, `reloadProgress(s, now)`, `swapGun(s, now)` (`logic/gun`); `V3`, `pelletDirs(dir, spread, n, rand): V3[]`, `rayCylinder`, `rayCapsule`, `raySphere`, `animalHeight`, `PeerBody = { id; x; y; z }`, `ShotHit`, `firstBodyHit(o, d, near, far, animals, peers): ShotHit | null`, `countHits<K>(keys): Map<K, number>` (`logic/hitscan`)

- [ ] **Step 1: 실패하는 테스트 쓰기**

`src/game/logic/gun.test.ts` (새 파일):

```ts
import { describe, expect, it } from 'vitest'
import { GUN_IDLE, finishReload, heatNow, pullTrigger, recoilOf, reloadProgress, spreadOf, startReload, swapGun } from './gun'

describe('방아쇠 (은지 cool·heat)', () => {
  it('쏘면 다음 발까지 60/rpm 초, 그 전엔 busy', () => {
    const a = pullTrigger(GUN_IDLE, 'pistol', 10, 12)
    expect(a.kind).toBe('fire')
    expect(a.state.readyAt).toBeCloseTo(10 + 60 / 320)
    expect(pullTrigger(a.state, 'pistol', 10.1, 11).kind).toBe('busy')
    expect(pullTrigger(a.state, 'pistol', 10.19, 11).kind).toBe('fire')
  })
  it('빈 탄창은 딸깍 (empty), 0.3초 쉰다', () => {
    const e = pullTrigger(GUN_IDLE, 'rifle', 5, 0)
    expect(e.kind).toBe('empty')
    expect(e.state.readyAt).toBeCloseTo(5.3)
    expect(pullTrigger(e.state, 'rifle', 5.2, 30).kind).toBe('busy')
  })
  it('연사 총만 열기가 한 발에 0.15 오르고(최대 1) 초당 2 씩 식는다. 퍼짐에 열기 × 0.01', () => {
    const s = pullTrigger(GUN_IDLE, 'rifle', 1, 30).state
    expect(s.heat).toBeCloseTo(0.15)
    expect(heatNow(s, 1.05)).toBeCloseTo(0.05)
    expect(heatNow(s, 2)).toBe(0)
    expect(pullTrigger({ ...GUN_IDLE, heat: 0.95, heatAt: 3 }, 'rifle', 3, 30).state.heat).toBe(1)
    expect(pullTrigger(GUN_IDLE, 'pistol', 1, 12).state.heat).toBe(0)
    expect(spreadOf('rifle', false, 0.5)).toBeCloseTo(0.025)
    expect(spreadOf('rifle', true, 0)).toBeCloseTo(0.006)
  })
  it('반동: 조준 0.6배, 조준경 0.5배 더', () => {
    expect(recoilOf('sniper', false, false)).toBeCloseTo(0.06)
    expect(recoilOf('sniper', true, true)).toBeCloseTo(0.018)
  })
})

describe('장전', () => {
  it('장전 시간(권총 1.3초) 동안 쏠 수 없고, 끝나면 그 총을 돌려준다', () => {
    const s = startReload(GUN_IDLE, 'pistol', 2, true)!
    expect(s.reload).toEqual({ gun: 'pistol', until: 3.3 })
    expect(pullTrigger(s, 'pistol', 2.5, 5).kind).toBe('busy')
    expect(reloadProgress(s, 2.65)).toBeCloseTo(0.5)
    expect(finishReload(s, 3.2)).toBeNull()
    const done = finishReload(s, 3.3)!
    expect(done.gun).toBe('pistol')
    expect(done.state.reload).toBeNull()
  })
  it('이미 장전 중이거나 할 수 없으면(탄창 가득·예비 없음) 시작하지 않는다', () => {
    const s = startReload(GUN_IDLE, 'pistol', 2, true)!
    expect(startReload(s, 'pistol', 2.1, true)).toBeNull()
    expect(startReload(GUN_IDLE, 'pistol', 2, false)).toBeNull()
  })
  it('도구를 바꾸면 장전·열기를 지우고 0.25초 뒤부터 쏜다', () => {
    const s = swapGun({ ...startReload(GUN_IDLE, 'rifle', 1, true)!, heat: 0.7, heatAt: 1 }, 1.5)
    expect(s.reload).toBeNull()
    expect(s.heat).toBe(0)
    expect(pullTrigger(s, 'sniper', 1.7, 5).kind).toBe('busy')
    expect(pullTrigger(s, 'sniper', 1.75, 5).kind).toBe('fire')
  })
})
```

`src/game/logic/hitscan.test.ts` (새 파일):

```ts
import { describe, expect, it } from 'vitest'
import type { AnimalView } from './animalSim'
import { countHits, firstBodyHit, pelletDirs, rayCapsule, rayCylinder, raySphere, type V3 } from './hitscan'

/** 정해 둔 수를 차례로 돌려주는 난수 */
const seq = (...v: number[]) => {
  let i = 0
  return () => v[i++ % v.length]
}
const o: V3 = { x: 0, y: 1, z: 0 }
const east: V3 = { x: 1, y: 0, z: 0 }
const cow = (id: number, x: number, z: number, pose: AnimalView['pose'] = 'idle'): AnimalView => ({ id, sp: 'cow', x, z, h: 0, pose, hp: 3 })

describe('광선 판정', () => {
  it('기둥: 옆면에 닿는 첫 거리, 높이 밖이나 near..far 밖이면 null', () => {
    expect(rayCylinder(o, east, 5, 0, 0.5, 0, 2, 0, 80)).toBeCloseTo(4.5)
    expect(rayCylinder(o, east, 5, 0, 0.5, 1.5, 2, 0, 80)).toBeNull()
    expect(rayCylinder(o, east, 5, 0, 0.5, 0, 2, 0, 4)).toBeNull()
    expect(rayCylinder(o, east, 5, 0, 0.5, 0, 2, 4.8, 80)).toBeCloseTo(5.5)
    // 위에서 내려다보며 쏘면 뚜껑에 닿는다
    expect(rayCylinder({ x: 5, y: 3, z: 0 }, { x: 0, y: -1, z: 0 }, 5, 0, 0.5, 0, 1.2, 0, 80)).toBeCloseTo(1.8)
  })
  it('캡슐·공', () => {
    expect(rayCapsule(o, east, { x: 3, y: 0.5, z: 0 }, { x: 3, y: 1.8, z: 0 }, 0.32, 0, 80)).toBeCloseTo(2.68)
    expect(rayCapsule({ x: 0, y: 2.0, z: 0 }, east, { x: 3, y: 0.5, z: 0 }, { x: 3, y: 1.8, z: 0 }, 0.32, 0, 80)).toBeCloseTo(3 - Math.sqrt(0.32 ** 2 - 0.2 ** 2))
    expect(raySphere(o, east, { x: 2, y: 1, z: 0 }, 0.5, 0, 80)).toBeCloseTo(1.5)
    expect(raySphere(o, east, { x: 2, y: 2, z: 0 }, 0.5, 0, 80)).toBeNull()
  })
  it('처음 닿는 몸: 가까운 동물이나 사람. 쓰러진 동물은 건너뛴다', () => {
    const animals = [cow(1, 10, 0), cow(2, 6, 0, 'dead')]
    expect(firstBodyHit(o, east, 0, 80, animals, [])).toEqual({ kind: 'animal', id: 1, t: expect.closeTo(10 - 0.52) })
    expect(firstBodyHit(o, east, 0, 80, animals, [{ id: 'b', x: 7, y: 1, z: 0 }])).toEqual({ kind: 'peer', id: 'b', t: expect.closeTo(6.68) })
    expect(firstBodyHit(o, { x: 0, y: 0, z: 1 }, 0, 80, animals, [])).toBeNull()
  })
})

describe('산탄·퍼짐', () => {
  it('알마다 방향이 단위 벡터이고 원뿔(반각 spread) 안. 퍼짐 0 이면 그대로', () => {
    const dirs = pelletDirs(east, 0.05, 8, seq(0.1, 0.99, 0.5, 0.3, 0.8, 0.05, 0.7, 0.6))
    expect(dirs).toHaveLength(8)
    for (const d of dirs) {
      expect(Math.hypot(d.x, d.y, d.z)).toBeCloseTo(1)
      expect(Math.acos(d.x)).toBeLessThanOrEqual(0.0501)
    }
    expect(pelletDirs({ x: 0, y: -1, z: 0 }, 0, 1, seq(0.4))[0]).toEqual({ x: 0, y: -1, z: 0 })
  })
  it('맞은 알 수 세기', () => {
    expect([...countHits(['a', 'b', 'a'])]).toEqual([
      ['a', 2],
      ['b', 1],
    ])
  })
})
```

- [ ] **Step 2: 실행해 실패 확인**

Run: `npx vitest run src/game/logic/gun.test.ts src/game/logic/hitscan.test.ts`
Expected: FAIL — `Failed to resolve import "./gun"`·`"./hitscan"`

- [ ] **Step 3: 구현**

`src/game/logic/gun.ts` (새 파일):

```ts
import { DRY_FIRE_PAUSE, GUNS, GUN_SWAP, HEAT, RECOIL, type GunId } from '../data/guns'

/**
 * 총 쏘기 상태 (은지 WeaponSystem 의 cool·reloadT·heat). 시각은 초 (performance.now() 기준이라 게임을 다시 열어도 이어진다).
 * readyAt: 다음에 쏠 수 있는 때, reload: 장전 중인 총과 끝나는 때, heat·heatAt: 연사 열기와 그 값을 잰 때, firedAt: 마지막으로 쏜 때
 */
export type GunState = { readyAt: number; reload: { gun: GunId; until: number } | null; heat: number; heatAt: number; firedAt: number }

export const GUN_IDLE: GunState = { readyAt: -Infinity, reload: null, heat: 0, heatAt: 0, firedAt: -Infinity }

/** 지금 열기 (초당 HEAT.cool 씩 식는다) */
export function heatNow(s: GunState, now: number): number {
  return Math.max(0, s.heat - Math.max(0, now - s.heatAt) * HEAT.cool)
}

/** 퍼짐(rad): 조준하면 aimSpread, 연사 열기만큼 더 퍼진다 (은지 base) */
export function spreadOf(id: GunId, aiming: boolean, heat: number): number {
  const g = GUNS[id]
  return (aiming ? g.aimSpread : g.spread) + heat * HEAT.spread
}

/** 반동(rad): 조준하면 0.6배, 조준경으로 보면 0.5배 더 (은지 rig.kick) */
export function recoilOf(id: GunId, aiming: boolean, scoped: boolean): number {
  return GUNS[id].recoil * (aiming ? RECOIL.aim : 1) * (scoped ? RECOIL.scope : 1)
}

export type Trigger = { kind: 'fire' | 'empty' | 'busy'; state: GunState }

/**
 * 방아쇠. 아직 쏠 수 없거나(연사 간격·장전 중) → busy. 탄창이 비었으면 → empty (딸깍, 0.3초 쉰다. 장전은 부르는 쪽이).
 * 쏘면 다음 발까지 60/rpm 초, 연사 총은 열기가 오른다
 */
export function pullTrigger(s: GunState, id: GunId, now: number, rounds: number): Trigger {
  if (now < s.readyAt || s.reload) return { kind: 'busy', state: s }
  if (rounds <= 0) return { kind: 'empty', state: { ...s, readyAt: now + DRY_FIRE_PAUSE } }
  const g = GUNS[id]
  const heat = g.auto ? Math.min(1, heatNow(s, now) + HEAT.perShot) : heatNow(s, now)
  return { kind: 'fire', state: { ...s, readyAt: now + 60 / g.rpm, heat, heatAt: now, firedAt: now } }
}

/** 장전 시작 (R 또는 빈 탄창). 이미 장전 중이거나 할 수 없으면(canReload false) null */
export function startReload(s: GunState, id: GunId, now: number, canReload: boolean): GunState | null {
  if (s.reload || !canReload) return null
  return { ...s, reload: { gun: id, until: now + GUNS[id].reload } }
}

/** 장전이 끝났나: 끝났으면 그 총 (탄을 옮기는 건 부르는 쪽) 과 비운 상태 */
export function finishReload(s: GunState, now: number): { gun: GunId; state: GunState } | null {
  if (!s.reload || now < s.reload.until) return null
  return { gun: s.reload.gun, state: { ...s, reload: null } }
}

/** 장전 진행도 0..1 (장전 중이 아니면 -1) */
export function reloadProgress(s: GunState, now: number): number {
  if (!s.reload) return -1
  const total = GUNS[s.reload.gun].reload
  return Math.min(1, Math.max(0, 1 - (s.reload.until - now) / total))
}

/** 도구를 바꿨다: 장전·열기를 지우고 0.25초 뒤부터 쏜다 (은지 select) */
export function swapGun(s: GunState, now: number): GunState {
  return { ...s, reload: null, heat: 0, heatAt: now, readyAt: Math.max(s.readyAt, now + GUN_SWAP) }
}
```

`src/game/logic/hitscan.ts` (새 파일):

```ts
import { hitRadius, speciesOf } from '../data/animals'
import { ANIMAL_HIT_HEIGHT, PEER_HIT } from '../data/guns'
import type { AnimalView } from './animalSim'
import type { Rng } from './rng'

/** 3차원 점·방향 (x, y, z) */
export type V3 = { x: number; y: number; z: number }

const dot = (a: V3, b: V3) => a.x * b.x + a.y * b.y + a.z * b.z

/**
 * 산탄·퍼짐: 방향 dir(단위 벡터) 둘레 원뿔(반각 spread) 안에서 n 개 (은지 shoot: 각도 a·반지름 √u·spread, side = dir × 위)
 */
export function pelletDirs(dir: V3, spread: number, n: number, rand: Rng): V3[] {
  // side = dir × (0,1,0), up = side × dir
  let sx = -dir.z
  let sz = dir.x
  const sl = Math.hypot(sx, sz)
  if (sl < 1e-6) {
    sx = 1
    sz = 0
  } else {
    sx /= sl
    sz /= sl
  }
  const ux = -sz * dir.y
  const uy = sz * dir.x - sx * dir.z
  const uz = sx * dir.y
  const out: V3[] = []
  for (let i = 0; i < n; i++) {
    const a = rand() * Math.PI * 2
    const r = Math.sqrt(rand()) * spread
    const x = dir.x + sx * Math.cos(a) * r + ux * Math.sin(a) * r
    const y = dir.y + uy * Math.sin(a) * r
    const z = dir.z + sz * Math.cos(a) * r + uz * Math.sin(a) * r
    const l = Math.hypot(x, y, z)
    out.push({ x: x / l, y: y / l, z: z / l })
  }
  return out
}

/**
 * 광선(o + t·d, d 단위 벡터)이 세운 기둥(가운데 (cx, cz), 반지름 r, 높이 y0..y1)에 처음 닿는 t. near..far 밖이면 null.
 * 옆면과 위·아래 뚜껑을 다 본다
 */
export function rayCylinder(o: V3, d: V3, cx: number, cz: number, r: number, y0: number, y1: number, near: number, far: number): number | null {
  let best: number | null = null
  const consider = (t: number) => {
    if (t >= near && t <= far && (best === null || t < best)) best = t
  }
  const ox = o.x - cx
  const oz = o.z - cz
  const a = d.x * d.x + d.z * d.z
  if (a > 1e-12) {
    const b = ox * d.x + oz * d.z
    const c = ox * ox + oz * oz - r * r
    const disc = b * b - a * c
    if (disc >= 0) {
      const s = Math.sqrt(disc)
      for (const t of [(-b - s) / a, (-b + s) / a]) {
        const y = o.y + t * d.y
        if (y >= y0 && y <= y1) consider(t)
      }
    }
  }
  if (Math.abs(d.y) > 1e-12) {
    for (const yc of [y0, y1]) {
      const t = (yc - o.y) / d.y
      const x = ox + t * d.x
      const z = oz + t * d.z
      if (x * x + z * z <= r * r) consider(t)
    }
  }
  return best
}

/** 광선이 캡슐(선분 a..b 둘레 반지름 r)에 처음 닿는 t. near..far 밖이면 null */
export function rayCapsule(o: V3, d: V3, a: V3, b: V3, r: number, near: number, far: number): number | null {
  // 선분 위 가장 가까운 점까지 거리가 r 이 되는 첫 t 를 촘촘히 찾지 않고, 기둥 + 위아래 공으로 나눠 푼다 (세운 캡슐만 쓴다)
  let best: number | null = null
  const consider = (t: number | null) => {
    if (t !== null && t >= near && t <= far && (best === null || t < best)) best = t
  }
  consider(rayCylinder(o, d, a.x, a.z, r, Math.min(a.y, b.y), Math.max(a.y, b.y), near, far))
  for (const c of [a, b]) consider(raySphere(o, d, c, r, near, far))
  return best
}

/** 광선이 공(가운데 c, 반지름 r)에 처음 닿는 t */
export function raySphere(o: V3, d: V3, c: V3, r: number, near: number, far: number): number | null {
  const m = { x: o.x - c.x, y: o.y - c.y, z: o.z - c.z }
  const b = dot(m, d)
  const cc = dot(m, m) - r * r
  const disc = b * b - cc
  if (disc < 0) return null
  const s = Math.sqrt(disc)
  for (const t of [-b - s, -b + s]) if (t >= near && t <= far) return t
  return null
}

/** 동물 몸 기둥: 판정 원(hitRadius)과 높이 (배율 × 1.5, 최소 0.4). 바닥 y = 0 */
export function animalHeight(a: AnimalView): number {
  return Math.max(ANIMAL_HIT_HEIGHT.min, ANIMAL_HIT_HEIGHT.perScale * speciesOf(a.sp).scale)
}

/** 남의 몸 (p: 몸 가운데 = 캡슐 가운데, 은지 캡슐 반지름 0.32 · 가운데 기둥 1.3) */
export type PeerBody = { id: string; x: number; y: number; z: number }

export type ShotHit = { kind: 'animal'; id: number; t: number } | { kind: 'peer'; id: string; t: number }

/** 광선 하나가 처음 닿는 살아 있는 동물이나 다른 사람 (near..far). 벽·표적은 장면이 따로 본다 */
export function firstBodyHit(o: V3, d: V3, near: number, far: number, animals: readonly AnimalView[], peers: readonly PeerBody[]): ShotHit | null {
  let best: ShotHit | null = null
  for (const a of animals) {
    if (a.pose === 'dead') continue
    const t = rayCylinder(o, d, a.x, a.z, hitRadius(a.sp), 0, animalHeight(a), near, far)
    if (t !== null && (!best || t < best.t)) best = { kind: 'animal', id: a.id, t }
  }
  const half = PEER_HIT.length / 2
  for (const p of peers) {
    const t = rayCapsule(o, d, { x: p.x, y: p.y - half, z: p.z }, { x: p.x, y: p.y + half, z: p.z }, PEER_HIT.radius, near, far)
    if (t !== null && (!best || t < best.t)) best = { kind: 'peer', id: p.id, t }
  }
  return best
}

/** 알마다 맞은 것 → 대상별 맞은 알 수 (산탄총은 한 번에 보낸다: pvpHit n, animalHit n) */
export function countHits<K>(keys: readonly K[]): Map<K, number> {
  const m = new Map<K, number>()
  for (const k of keys) m.set(k, (m.get(k) ?? 0) + 1)
  return m
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npx vitest run && npx tsc -b && npm run lint 2>&1 | grep -c warning`
Expected: 모든 테스트 PASS, tsc 오류 없음, 경고 6

- [ ] **Step 5: 커밋**

```bash
git add src/game/logic/gun.test.ts \
  src/game/logic/gun.ts \
  src/game/logic/hitscan.test.ts \
  src/game/logic/hitscan.ts
git commit -F - <<'EOF'
feat: 총 쏘기 규칙과 광선 판정

- logic/gun: 은지 WeaponSystem 의 연사 간격·빈 탄창 딸깍·장전 시간·연사 열기·반동 배율을 순수 함수로
- logic/hitscan: 산탄 퍼짐 방향, 광선 → 동물 기둥(판정 원 × 높이)·다른 사람 캡슐(반지름 0.32, 기둥 1.3) 첫 명중, 맞은 알 수 세기
EOF
```

검증한 스크래치 커밋: `7967ed6` (이 커밋의 diff 를 그대로 적용해도 된다: `git -C /private/tmp/claude-501/-Users-ihyelin-proten-hrlee-----threejs/e476c70e-362f-4ed3-9ff7-d8664da04e4b/scratchpad/plan-3-4/repo format-patch -1 --binary 7967ed6 --stdout | git apply --index` 한 뒤 위 커밋 명령. 스크래치 커밋의 작성자는 scratch 라 `git am` 은 쓰지 않는다)

### Task 3: 손에 든 총 모델과 무기 소리  — 스크래치 `ae710f4`

**Files:**
- Create: `src/game/audio/weaponSfx.ts`, `src/game/scene/tools/GunModel.tsx`, `src/meadow/vendor/audio.d.ts`, `src/meadow/vendor/audio.js`, `src/meadow/vendor/weapons.d.ts`, `src/meadow/vendor/weapons.js`
- Modify: `src/game/scene/Player.tsx`, `src/game/scene/RemotePlayer.tsx`, `src/game/scene/melee/MeleeController.tsx`, `src/meadow/vendor/README.md`
- Test: `src/meadow/vendor.test.ts`

**Interfaces:**
- Consumes: `GunId`·`isGun`·`GUNS` (Task 1), `musicGain` (`logic/music`), `useSettingsStore`, `shownTool` (`logic/playerMotion`, 총은 칼처럼 서 있거나 걸을 때만 보인다), `PlayerModelHandle.gripPosition`
- Produces: vendor `weapons.js` (`buildWeaponModel(id, { shadows? })`: 총열 -Z, `userData.muzzle`·`sight`·`eyeDist`·`lens`, `WEAPONS`), vendor `audio.js` (`setVolumeSource(fn)`, `playShot`·`playSwing`·`playPunch`·`playDing`·`playClick`·`playReload`·`playHitThud`·`playBeep`·`playBuzzer`), `weaponSfx = { shot(gun), dry(), reload(sec), swing(pitch?), punch(), thud(), ding(), beep(freq?, dur?), buzzer() }` (`audio/weaponSfx`), `<GunModel id={gun} />` (`scene/tools/GunModel`, 총열을 캐릭터 앞 +Z 로)

- [ ] **Step 1: 은지 무기·소리 코드를 vendor 로 복사**

```bash
cp /private/tmp/claude-501/-Users-ihyelin-proten-hrlee-----threejs/e476c70e-362f-4ed3-9ff7-d8664da04e4b/scratchpad/eunji/repo2/src/weapons.js src/meadow/vendor/weapons.js
cp /private/tmp/claude-501/-Users-ihyelin-proten-hrlee-----threejs/e476c70e-362f-4ed3-9ff7-d8664da04e4b/scratchpad/eunji/repo2/src/audio.js src/meadow/vendor/audio.js
```

`weapons.js` 는 고치지 않는다 (`WeaponSystem` 은 쓰지 않고 `buildWeaponModel`·`WEAPONS` 만 쓴다). `audio.js` 는 소리를 master gain 하나로 모아 우리 음량을 따르게 고친다 (은지 원본 대비):

```diff
--- 은지 src/audio.js
+++ src/meadow/vendor/audio.js
@@ -1,14 +1,23 @@
 // WebAudio 로 합성한 효과음 (파일 없이 동작). 첫 사용자 클릭 이후에 재생된다.
 let ctx = null;
 let noiseBuf = null;
+// rinfish: 모든 소리를 master 하나로 모아 낚시섬 음량 설정(volumeOf)을 따른다. 0 이면 소리를 만들지 않는다
+let master = null;
+let volumeOf = () => 1;
+export function setVolumeSource(fn) { volumeOf = fn; }
 
 function ac() {
+  const v = volumeOf();
+  if (!(v > 0)) return null;
   if (!ctx) {
     const AC = window.AudioContext || window.webkitAudioContext;
     if (!AC) return null;
     ctx = new AC();
+    master = ctx.createGain();
+    master.connect(ctx.destination);
   }
   if (ctx.state === 'suspended') ctx.resume();
+  master.gain.value = v;
   return ctx;
 }
 
@@ -43,7 +52,7 @@
   const gain = c.createGain();
   gain.gain.setValueAtTime(P.g, t);
   gain.gain.exponentialRampToValueAtTime(0.001, t + P.dur);
-  src.connect(filt).connect(gain).connect(c.destination);
+  src.connect(filt).connect(gain).connect(master);
   src.start(t);
   src.stop(t + P.dur + 0.05);
 
@@ -54,7 +63,7 @@
   const g2 = c.createGain();
   g2.gain.setValueAtTime(P.g * 0.8, t);
   g2.gain.exponentialRampToValueAtTime(0.001, t + P.dur);
-  osc.connect(g2).connect(c.destination);
+  osc.connect(g2).connect(master);
   osc.start(t);
   osc.stop(t + P.dur + 0.05);
 }
@@ -75,7 +84,7 @@
   gain.gain.setValueAtTime(0.0001, t);
   gain.gain.exponentialRampToValueAtTime(0.3, t + 0.05);
   gain.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
-  src.connect(filt).connect(gain).connect(c.destination);
+  src.connect(filt).connect(gain).connect(master);
   src.start(t);
   src.stop(t + 0.25);
 }
@@ -92,7 +101,7 @@
   const g = c.createGain();
   g.gain.setValueAtTime(0.6, t);
   g.gain.exponentialRampToValueAtTime(0.001, t + 0.14);
-  osc.connect(g).connect(c.destination);
+  osc.connect(g).connect(master);
   osc.start(t);
   osc.stop(t + 0.16);
   const src = c.createBufferSource();
@@ -103,7 +112,7 @@
   const g2 = c.createGain();
   g2.gain.setValueAtTime(0.35, t);
   g2.gain.exponentialRampToValueAtTime(0.001, t + 0.08);
-  src.connect(filt).connect(g2).connect(c.destination);
+  src.connect(filt).connect(g2).connect(master);
   src.start(t);
   src.stop(t + 0.1);
 }
@@ -120,7 +129,7 @@
     const gain = c.createGain();
     gain.gain.setValueAtTime(g, t);
     gain.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
-    osc.connect(gain).connect(c.destination);
+    osc.connect(gain).connect(master);
     osc.start(t);
     osc.stop(t + 0.4);
   }
@@ -139,7 +148,7 @@
   const gain = c.createGain();
   gain.gain.setValueAtTime(0.2, t);
   gain.gain.exponentialRampToValueAtTime(0.001, t + 0.03);
-  src.connect(filt).connect(gain).connect(c.destination);
+  src.connect(filt).connect(gain).connect(master);
   src.start(t);
   src.stop(t + 0.05);
 }
@@ -161,7 +170,7 @@
   const g = c.createGain();
   g.gain.setValueAtTime(0.5, t);
   g.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
-  osc.connect(g).connect(c.destination);
+  osc.connect(g).connect(master);
   osc.start(t);
   osc.stop(t + 0.12);
   const src = c.createBufferSource();
@@ -172,7 +181,7 @@
   const g2 = c.createGain();
   g2.gain.setValueAtTime(0.3, t);
   g2.gain.exponentialRampToValueAtTime(0.001, t + 0.06);
-  src.connect(filt).connect(g2).connect(c.destination);
+  src.connect(filt).connect(g2).connect(master);
   src.start(t);
   src.stop(t + 0.08);
 }
@@ -188,7 +197,7 @@
   const g = c.createGain();
   g.gain.setValueAtTime(gainV, t);
   g.gain.exponentialRampToValueAtTime(0.001, t + dur);
-  osc.connect(g).connect(c.destination);
+  osc.connect(g).connect(master);
   osc.start(t);
   osc.stop(t + dur + 0.02);
 }
```

`src/meadow/vendor/weapons.d.ts` (새 파일):

```ts
import type { Group, Mesh, Object3D, Vector3 } from 'three'

/** 은지 무기 표 (총 4종 + 칼). 숫자는 우리 TS 복사본 data/guns.ts 와 같은지 테스트에서만 비교한다 */
export const WEAPONS: { id: string; name: string; type: 'gun' | 'melee'; auto?: boolean; rpm: number; mag?: number; reload?: number; pellets?: number; dmg?: number; spread?: number; aimSpread?: number; recoil?: number; aimFov?: number; zoom?: { label: string; mag: number }[] }[]

/**
 * 은지 무기 모델 (기본 도형). 총열은 -Z, 손잡이는 -Y.
 * userData.muzzle: 총구, sight: 조준할 때 화면 가운데에 올 점, eyeDist: 눈 ~ sight 거리, lens·reticle·lensRadius: 조준경 렌즈 (소총·저격총)
 */
export function buildWeaponModel(
  id: string,
  opts?: { shadows?: boolean },
): Group & { userData: { muzzle: Object3D; sight?: Vector3; eyeDist?: number; lens?: Mesh; reticle?: Mesh; lensRadius?: number; left?: Group; right?: Group } }
```

`src/meadow/vendor/audio.d.ts` (새 파일):

```ts
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
```

`src/meadow/vendor/README.md` (바꿀 곳, `git diff -U3`):

```diff
diff --git a/src/meadow/vendor/README.md b/src/meadow/vendor/README.md
--- a/src/meadow/vendor/README.md
+++ b/src/meadow/vendor/README.md
@@ -1,6 +1,7 @@
 # 은지 게임(Room Sim) 코드 복사본
 
 - 출처: https://github.com/Eunji1217/3js 커밋 `f3c3808` 의 `src/` (모델은 `public/models/{kenney,nature,town,food,pets}` → `public/meadow/models/`, 모두 CC0. 동물(pets, Kenney Cube Pets)은 3-3 에서 TS 로 옮긴 `logic/animalSim`·`scene/animals` 가 쓴다)
-- 고친 곳은 `// rinfish:` 로 찾는다: 모델 경로(paths.js), 사격장 설비·동물·거울(world.js), 상인 NPC(town.js), 들판·마을 ready 를 allSettled 로(outdoor.js·town.js)
+- 고친 곳은 `// rinfish:` 로 찾는다: 모델 경로(paths.js), 사격장 설비·동물·거울(world.js), 상인 NPC(town.js), 들판·마을 ready 를 allSettled 로(outdoor.js·town.js), 효과음을 낚시섬 음량으로(audio.js)
+- 3-4: `weapons.js` 는 그대로 복사했다 (무기 모델 `buildWeaponModel`·`WEAPONS` 만 쓴다. 쏘기·조준은 TS 로 옮긴 `logic/gun`·`scene/guns`)
 - 남의 코드라 oxlint 검사에서 뺀다. 타입은 우리가 쓰는 부분만 `.d.ts` 에 선언한다
 - 은지 원본이 바뀌면 같은 파일을 다시 복사하고 `// rinfish:` 자리만 다시 고친다
```

- [ ] **Step 2: 실패하는 테스트 쓰기 (총 수치가 은지와 같은지, 총구가 있는지)**

`src/meadow/vendor.test.ts` (바꿀 곳, `git diff -U3`):

```diff
diff --git a/src/meadow/vendor.test.ts b/src/meadow/vendor.test.ts
--- a/src/meadow/vendor.test.ts
+++ b/src/meadow/vendor.test.ts
@@ -66,6 +66,13 @@ describe('은지 맵 복사본', () => {
     expect(MEADOW_VENDORS.map((v) => [v.id, v.name, ...v.at])).toEqual(VENDORS.map((v) => [v.id, v.name, v.x, v.z]))
     expect(MEADOW_REACH.vendor).toBe(VENDOR_DIST)
   })
+  it('총 수치가 은지 weapons.js WEAPONS 와 같고, 총마다 모델에 총구가 있다', async () => {
+    const { WEAPONS, buildWeaponModel } = await import('./vendor/weapons.js')
+    const { GUNS, GUN_IDS } = await import('../game/data/guns')
+    const pick = (w: Record<string, unknown>) => [w.id, w.name, w.auto, w.rpm, w.mag, w.reload, w.pellets, w.dmg, w.spread, w.aimSpread, w.recoil, w.aimFov, w.zoom]
+    expect(GUN_IDS.map((id) => pick(GUNS[id]))).toEqual(WEAPONS.filter((w) => w.type === 'gun').map((w) => pick(w)))
+    for (const id of GUN_IDS) expect(buildWeaponModel(id, { shadows: false }).userData.muzzle.position.z).toBeLessThan(0)
+  })
   it('모델 주소는 meadow/ 아래', async () => {
     const { asset } = await import('./vendor/paths.js')
     expect(asset('models/kenney/desk.glb')).toBe('/meadow/models/kenney/desk.glb')
```

Run: `npx vitest run src/meadow/vendor.test.ts`
Expected: Step 1 의 복사가 끝났으면 PASS (data/guns 가 Task 1 에 있다). 복사 전이면 `Failed to resolve import "./vendor/weapons.js"`

- [ ] **Step 3: 소리 묶음과 손의 총**

`src/game/audio/weaponSfx.ts` (새 파일):

```ts
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
```

`src/game/scene/tools/GunModel.tsx` (새 파일):

```tsx
import { useEffect, useMemo } from 'react'
import type { Material, Mesh } from 'three'
import { buildWeaponModel } from '../../../meadow/vendor/weapons.js'
import type { GunId } from '../../data/guns'

/**
 * 손에 든 총 (은지 buildWeaponModel, 기본 도형). 은지 모델은 총열이 -Z 라서 캐릭터 앞(+Z)을 보게 돌린다.
 * 원점이 손잡이 위쪽이라 주먹 가운데에 바로 둔다. 내 캐릭터와 다른 사람이 같이 쓴다
 */
export function GunModel({ id }: { id: GunId }) {
  const model = useMemo(() => buildWeaponModel(id), [id])
  useEffect(
    () => () => {
      model.traverse((o) => {
        const m = o as Mesh
        if (!m.isMesh) return
        m.geometry.dispose()
        for (const mat of ([] as Material[]).concat(m.material)) mat.dispose()
      })
    },
    [model],
  )
  return <primitive object={model} rotation-y={Math.PI} />
}
```

`src/game/scene/Player.tsx` — 총을 손(그립)에 (바꿀 곳, `git diff -U3`):

```diff
diff --git a/src/game/scene/Player.tsx b/src/game/scene/Player.tsx
--- a/src/game/scene/Player.tsx
+++ b/src/game/scene/Player.tsx
@@ -3,6 +3,7 @@ import { useFrame, useThree } from '@react-three/fiber'
 import { CapsuleCollider, RigidBody, useRapier, type RapierRigidBody } from '@react-three/rapier'
 import { Vector3, type Group, type Object3D } from 'three'
 import { CAMERA_ZOOM, MOVE, PLAYER_BODY } from '../data/balance'
+import { isGun } from '../data/guns'
 import { CHARACTER_BASE_HEIGHT } from '../data/characters'
 import { COOK_SCENE } from '../data/cooking'
 import { REPAIR_PLANS, type RepairPlan } from '../data/repair'
@@ -42,6 +43,7 @@ import { ChewChatter } from './ChewChatter'
 import { FoodInHand } from './FoodInHand'
 import { playerGround } from './playerGround'
 import { PlayerModel, type PlayerModelHandle } from './PlayerModel'
+import { GunModel } from './tools/GunModel'
 import { KnifeModel } from './tools/KnifeModel'
 
 /** 다른 컴포넌트(낚싯줄·같이 하기 등)가 읽는 플레이어 정보. Player가 매 프레임 갱신한다 */
@@ -135,8 +137,10 @@ export function Player() {
   const visual = useRef<Group>(null)
   const rod = useRef<Group>(null)
   const rodTip = useRef<Object3D>(null)
-  /** 손에 든 칼 (도구 칸 3) */
+  /** 손에 든 칼 (도구 칸 3), 총 (도구 칸 4~7) */
   const knife = useRef<Group>(null)
+  const gun = useRef<Group>(null)
+  const tool = useSessionStore((s) => s.tool)
   const model = useRef<PlayerModelHandle>(null)
   const boatRef = useRef<Group>(null)
   /** 지난번에 서 있던 자리 (탭을 닫았다 와도 이어서). 처음 그릴 때 한 번만 읽는다 */
@@ -408,6 +412,7 @@ export function Player() {
       const held = shownTool(boatAt ? 'boat' : mode, session.zoom, action, session.tool)
       rod.current.visible = held === 'rod'
       if (knife.current) knife.current.visible = held === 'knife'
+      if (gun.current) gun.current.visible = isGun(held)
       playerRig.rodAngle = rod.current.rotation.x
       playerRig.rodShown = rod.current.visible
       const m = model.current
@@ -426,6 +431,8 @@ export function Player() {
           knife.current.position.copy(rod.current.position)
           knife.current.rotation.x = rod.current.rotation.x + (swingAt >= 0 ? KNIFE_SWING_TILT * Math.sin(Math.PI * swingAt) : 0)
         }
+        // 총도 같은 손에 (총열이 앞을 본다)
+        if (gun.current) gun.current.position.copy(rod.current.position)
         // 먹는 음식도 같은 손에 든다
         if (food.current) food.current.position.copy(grip)
       }
@@ -505,6 +512,11 @@ export function Player() {
         <group ref={knife} visible={false}>
           <KnifeModel />
         </group>
+        {isGun(tool) && (
+          <group ref={gun} visible={false}>
+            <GunModel id={tool} />
+          </group>
+        )}
         {eating && (
           <>
             <group ref={food}>
```

`src/game/scene/RemotePlayer.tsx` — 남이 든 총 (모습의 tool) (바꿀 곳, `git diff -U3`):

```diff
diff --git a/src/game/scene/RemotePlayer.tsx b/src/game/scene/RemotePlayer.tsx
--- a/src/game/scene/RemotePlayer.tsx
+++ b/src/game/scene/RemotePlayer.tsx
@@ -4,6 +4,7 @@ import { useFrame } from '@react-three/fiber'
 import { BufferGeometry, Line, LineBasicMaterial, Vector3, type Group, type Mesh, type Object3D } from 'three'
 import { BOAT_FLOOR, BOAT_SEAT_SHAPE } from '../data/boat'
 import { CHARACTER_BASE_HEIGHT } from '../data/characters'
+import { isGun, type GunId } from '../data/guns'
 import { NET } from '../data/net'
 import type { CharacterLook } from '../data/types'
 import { saggingLinePoint } from '../logic/castArc'
@@ -15,6 +16,7 @@ import { BENCH_SEAT_SHAPE } from './facilities/benchShape'
 import { bubbleStyle, nameTagStyle } from './nameTag'
 import { FOOT_Y } from './Player'
 import { PlayerModel, type PlayerModelHandle } from './PlayerModel'
+import { GunModel } from './tools/GunModel'
 import { KnifeModel } from './tools/KnifeModel'
 
 const LINE_POINTS = 16
@@ -34,6 +36,9 @@ export function RemotePlayer({ id, nick, look, shown }: { id: string; nick: stri
   const model = useRef<PlayerModelHandle>(null)
   const rod = useRef<Group>(null)
   const knife = useRef<Group>(null)
+  const gun = useRef<Group>(null)
+  /** 남이 든 총 (바뀔 때만 React 상태를 바꾼다) */
+  const [gunId, setGunId] = useState<GunId | null>(null)
   const boatRef = useRef<Group>(null)
   const rodTip = useRef<Object3D>(null)
   const bobber = useRef<Mesh>(null)
@@ -76,12 +81,19 @@ export function RemotePlayer({ id, nick, look, shown }: { id: string; nick: stri
     visual.current.updateWorldMatrix(true, false)
     m.gripPosition(grip)
     rod.current.position.copy(visual.current.worldToLocal(grip))
-    // 남이 든 칼 (낚싯대는 rodOn 이 정한다). 앉았거나 감정 표현·점프·먹는 중엔 숨긴다
+    // 남이 든 칼·총 (낚싯대는 rodOn 이 정한다). 앉았거나 감정 표현·점프·먹는 중엔 숨긴다
+    const held = shownTool(s.fish ? 'fishing' : s.boat ? 'boat' : s.rest ? 'rest' : 'explore', Infinity, e.action, s.tool ?? null)
     if (knife.current) {
-      knife.current.visible = shownTool(s.fish ? 'fishing' : s.boat ? 'boat' : s.rest ? 'rest' : 'explore', Infinity, e.action, s.tool ?? null) === 'knife'
+      knife.current.visible = held === 'knife'
       knife.current.position.copy(rod.current.position)
       knife.current.rotation.x = s.rod
     }
+    const nextGun = isGun(s.tool) ? s.tool : null
+    if (nextGun !== gunId) setGunId(nextGun)
+    if (gun.current) {
+      gun.current.visible = isGun(held)
+      gun.current.position.copy(rod.current.position)
+    }
     // 찌와 낚싯줄 (낚싯대 끝 → 찌)
     if (s.bob && bobber.current && rodTip.current) {
       bobber.current.position.set(s.bob[0], s.bob[1], s.bob[2])
@@ -120,6 +132,11 @@ export function RemotePlayer({ id, nick, look, shown }: { id: string; nick: stri
           <group ref={knife} visible={false}>
             <KnifeModel />
           </group>
+          {gunId && (
+            <group ref={gun} visible={false}>
+              <GunModel id={gunId} />
+            </group>
+          )}
         </group>
         {drawn && (
           <Html center position={[0, headY, 0]} zIndexRange={[50, 0]}>
```

`src/game/scene/melee/MeleeController.tsx` — 3-3 이 미룬 휘두르기·맞는 소리 (바꿀 곳, `git diff -U3`):

```diff
diff --git a/src/game/scene/melee/MeleeController.tsx b/src/game/scene/melee/MeleeController.tsx
--- a/src/game/scene/melee/MeleeController.tsx
+++ b/src/game/scene/melee/MeleeController.tsx
@@ -1,7 +1,8 @@
 import { useEffect, useRef } from 'react'
 import { useFrame } from '@react-three/fiber'
 import { useRapier } from '@react-three/rapier'
-import { MELEE, meleeFor } from '../../data/melee'
+import { weaponSfx } from '../../audio/weaponSfx'
+import { MELEE, meleeFor, type MeleeId } from '../../data/melee'
 import { animalViews } from '../../hunt/animalRig'
 import { strikeAnimal } from '../../hunt/huntActions'
 import { meleeRig, resetMeleeRig } from '../../hunt/meleeRig'
@@ -34,7 +35,10 @@ export function MeleeController() {
     if (press && canSwing(session.mode, session.playerAction, playerGround.grounded)) {
       const kind = meleeFor(session.tool, press === 'secondary')
       const next = kind && startSwing(meleeRig, kind, now)
-      if (next) Object.assign(meleeRig, next, { yaw: playerRig.yaw })
+      if (next && kind) {
+        Object.assign(meleeRig, next, { yaw: playerRig.yaw })
+        swingSound(kind)
+      }
     }
     const swing = meleeRig.swing
     if (!swing) return
@@ -49,10 +53,20 @@ export function MeleeController() {
         r.origin = { x, y, z }
         r.dir = { x: dx, y: 0, z: dz }
         const wall = target.dist > 0 ? world.castRay(r, target.dist, true, rapier.QueryFilterFlags.ONLY_FIXED | rapier.QueryFilterFlags.EXCLUDE_SENSORS) : null
-        if (!wall) strikeAnimal(target.id, swing.kind)
+        if (!wall) {
+          strikeAnimal(target.id, swing.kind)
+          if (swing.kind === 'fists') weaponSfx.punch()
+          else weaponSfx.thud()
+        }
       }
     }
     if (swingProgress(swing, now) < 0 && swing.hitDone) meleeRig.swing = null
   })
   return null
 }
+
+/** 휘두르는 소리 (은지: 주먹 '퍽', 베기 휙, 찌르기는 낮게) */
+function swingSound(kind: MeleeId) {
+  if (kind === 'fists') weaponSfx.punch()
+  else weaponSfx.swing(kind === 'stab' ? 0.6 : 1)
+}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npx vitest run && npx tsc -b && npm run lint 2>&1 | grep -c warning`
Expected: 모든 테스트 PASS, tsc 오류 없음, 경고 6

- [ ] **Step 5: 눈으로 확인**

`npm run dev` → 혼자 하기 → 초원에서 4~7 을 누르면 오른손에 은지 총(권총·소총·산탄총·저격총)이 앞을 보고 들린다. 카메라를 옆으로 돌려 총열이 캐릭터 앞(수평)을 보는지 본다. 칼로 휘두르면 휙 소리, 소를 때리면 "턱" (M 으로 음소거하면 안 난다).

- [ ] **Step 6: 커밋**

```bash
git add src/game/audio/weaponSfx.ts \
  src/game/scene/Player.tsx \
  src/game/scene/RemotePlayer.tsx \
  src/game/scene/melee/MeleeController.tsx \
  src/game/scene/tools/GunModel.tsx \
  src/meadow/vendor.test.ts \
  src/meadow/vendor/README.md \
  src/meadow/vendor/audio.d.ts \
  src/meadow/vendor/audio.js \
  src/meadow/vendor/weapons.d.ts \
  src/meadow/vendor/weapons.js
git commit -F - <<'EOF'
feat: 손에 든 총 모델과 무기 소리

- 은지 weapons.js 를 그대로, audio.js 는 모든 소리를 master 하나로 모아 낚시섬 음량(음악 볼륨·음소거)을 따르게 고쳐 복사했다
- 총을 들면 내 캐릭터와 다른 사람 손에 은지 buildWeaponModel 총 (총열이 앞)
- 주먹·칼 휘두르기와 맞을 때 은지 소리 (3-3 이 미룬 것)
- 총 수치가 은지 WEAPONS 와 같은지 테스트
EOF
```

검증한 스크래치 커밋: `ae710f4` (이 커밋의 diff 를 그대로 적용해도 된다: `git -C /private/tmp/claude-501/-Users-ihyelin-proten-hrlee-----threejs/e476c70e-362f-4ed3-9ff7-d8664da04e4b/scratchpad/plan-3-4/repo format-patch -1 --binary ae710f4 --stdout | git apply --index` 한 뒤 위 커밋 명령. 스크래치 커밋의 작성자는 scratch 라 `git am` 은 쓰지 않는다)

### Task 4: 총 쏘기·장전과 총알 효과  — 스크래치 `9a36474`

**Files:**
- Create: `src/game/guns/gunFx.ts`, `src/game/guns/gunRig.ts`, `src/game/scene/guns/GunController.tsx`, `src/game/scene/guns/GunEffects.tsx`, `src/game/scene/guns/gunEffectsPool.ts`, `src/game/ui/GunHud.tsx`, `src/game/ui/gunStatus.ts`
- Modify: `src/game/Game.tsx`, `src/game/hunt/huntActions.ts`, `src/game/input/pointer.ts`, `src/game/input/useInteractionKeys.ts`, `src/game/logic/characterPose.ts`, `src/game/logic/interaction.ts`, `src/game/scene/Player.tsx`, `src/game/scene/World.tsx`, `src/game/scene/melee/MeleeController.tsx`, `src/game/ui/Hud.tsx`
- Test: `src/game/hunt/huntActions.test.ts`, `src/game/input/pointer.test.ts`, `src/game/logic/characterPose.test.ts`, `src/game/logic/interaction.test.ts`, `src/game/scene/guns/gunEffectsPool.test.ts`, `src/game/ui/gunStatus.test.ts`

**Interfaces:**
- Consumes: Task 1 (`GUNS`·`GUN_RANGE`·`isGun`, progressStore `ammo`·`reserve`·`fireRound`·`reloadGun`), Task 2 (`pullTrigger`·`startReload`·`finishReload`·`swapGun`·`heatNow`·`spreadOf`·`recoilOf`·`reloadProgress`·`pelletDirs`·`firstBodyHit`·`countHits`), Task 3 (`weaponSfx`, Player 의 `gun` 그룹), `animalViews`·`soloHerd`·`hitAnimal` (3-3), `takeAttackPress` (3-3 pointer)
- Produces: `gunRig: GunState & { gun; aiming; kick; muzzle: Vector3 | null; hitAt; hitText; lastShot: LastShot | null }`, `LastShot = { o: V3; d: V3; hit: 'animal' | 'peer' | 'target' | 'wall' | null }`, `resetGunRig()`, `takeKick()`, `markHit(now, text?)` (`guns/gunRig`); `gunFx: GunFx = { tracer(from, to); hole(point, normal, parent?); flash(at) }`, `setGunFx(fx)` (`guns/gunFx`); `createGunEffects()` (`scene/guns/gunEffectsPool`); pointer `isTriggerHeld()`·`isAimHeld()`·`holdTrigger(on)`·`setTouchAim(on)`·`isTouchAim()`·`pressReload()`·`takeReloadPress()`; `KeyAction` `{ type: 'reload' }` (R); `shootAnimal(id, gun, n)` (`hunt/huntActions`); `gunArm(w): SwingArm` (`logic/characterPose`); `playerRig.eyeHeight`; `gunStatus(gun, mag, reserve, reloading)` (`ui/gunStatus`); `<GunController />`·`<GunEffects />`·`<GunHud />`

- [ ] **Step 1: 실패하는 테스트 쓰기**

`src/game/input/pointer.test.ts` (바꿀 곳, `git diff -U3`):

```diff
diff --git a/src/game/input/pointer.test.ts b/src/game/input/pointer.test.ts
--- a/src/game/input/pointer.test.ts
+++ b/src/game/input/pointer.test.ts
@@ -1,5 +1,5 @@
 import { describe, expect, it } from 'vitest'
-import { attackFromPointer, pressAttack, takeAttackPress } from './pointer'
+import { attackFromPointer, holdTrigger, isAimHeld, isTriggerHeld, pressAttack, pressPointer, pressReload, setTouchAim, takeAttackPress, takeReloadPress } from './pointer'
 
 describe('휘두르기 입력', () => {
   it('마우스 잠금 중 왼쪽 = 베기·주먹, 오른쪽 = 찌르기, 가운데는 없다', () => {
@@ -20,3 +20,30 @@ describe('휘두르기 입력', () => {
     expect(takeAttackPress()).toBeNull()
   })
 })
+
+describe('총 입력', () => {
+  it('잠금을 못 쓰는 환경: 캔버스에서 왼쪽을 누르면 방아쇠, 오른쪽은 조준 (누른 채로)', () => {
+    pressPointer({ button: 0, buttons: 1, pointerId: 1, clientX: 0, clientY: 0, pointerType: 'mouse' })
+    expect(isTriggerHeld()).toBe(true)
+    expect(isAimHeld()).toBe(false)
+    pressPointer({ button: 2, buttons: 2, pointerId: 1, clientX: 0, clientY: 0, pointerType: 'mouse' })
+    expect(isAimHeld()).toBe(true)
+    expect(takeAttackPress()).toBe('secondary')
+  })
+  it('폰: 쏘기 버튼을 누르고 있는 동안 방아쇠, 조준 버튼은 켜고 끈다', () => {
+    pressPointer({ button: 0, buttons: 0, pointerId: 2, clientX: 0, clientY: 0, pointerType: 'mouse' })
+    holdTrigger(true)
+    expect(isTriggerHeld()).toBe(true)
+    holdTrigger(false)
+    expect(isTriggerHeld()).toBe(false)
+    setTouchAim(true)
+    expect(isAimHeld()).toBe(true)
+    setTouchAim(false)
+    takeAttackPress()
+  })
+  it('R 은 한 번만 가져간다', () => {
+    pressReload()
+    expect(takeReloadPress()).toBe(true)
+    expect(takeReloadPress()).toBe(false)
+  })
+})
```

`src/game/logic/interaction.test.ts` (바꿀 곳, `git diff -U3`):

```diff
diff --git a/src/game/logic/interaction.test.ts b/src/game/logic/interaction.test.ts
--- a/src/game/logic/interaction.test.ts
+++ b/src/game/logic/interaction.test.ts
@@ -146,6 +146,9 @@ describe('resolveKeyAction', () => {
     expect(resolveKeyAction('Digit8', 'explore', null)).toEqual({ type: 'none' })
     expect(resolveKeyAction('Digit0', 'explore', null)).toEqual({ type: 'none' })
     expect(resolveKeyAction('KeyX', 'explore', null)).toEqual({ type: 'equip', tool: null })
+    expect(resolveKeyAction('KeyR', 'explore', null)).toEqual({ type: 'reload' })
+    expect(resolveKeyAction('KeyR', 'fishing', null)).toEqual({ type: 'none' })
+    expect(resolveKeyAction('KeyR', 'bag', null)).toEqual({ type: 'none' })
     // 낚시 중 숫자는 그대로 미끼, 패널에선 무시
     expect(resolveKeyAction('Digit2', 'fishing', null)).toEqual({ type: 'selectBait', bait: 'shrimp' })
     expect(resolveKeyAction('KeyX', 'fishing', null)).toEqual({ type: 'none' })
```

`src/game/hunt/huntActions.test.ts` (바꿀 곳, `git diff -U3`):

```diff
diff --git a/src/game/hunt/huntActions.test.ts b/src/game/hunt/huntActions.test.ts
--- a/src/game/hunt/huntActions.test.ts
+++ b/src/game/hunt/huntActions.test.ts
@@ -2,8 +2,8 @@
 import { beforeEach, describe, expect, it } from 'vitest'
 import { INITIAL_PROGRESS, useProgressStore } from '../stores/progressStore'
 import { useSessionStore } from '../stores/sessionStore'
-import { lootList, resetAnimalRig, spawnLoot } from './animalRig'
-import { pickLoot } from './huntActions'
+import { lootList, resetAnimalRig, soloHerd, spawnLoot } from './animalRig'
+import { pickLoot, shootAnimal } from './huntActions'
 
 beforeEach(() => {
   localStorage.clear()
@@ -28,3 +28,14 @@ describe('전리품 줍기', () => {
     expect(useProgressStore.getState().items.beef).toBe(0)
   })
 })
+
+describe('총으로 사냥 (혼자)', () => {
+  it('알마다 은지 피해: 산탄 3알이 소(체력 3)를 쓰러뜨리고 전리품, 권총 한 알은 1', () => {
+    // 새 무리는 1번 소(체력 3), 2번 돼지(체력 2)
+    shootAnimal(2, 'pistol', 1)
+    expect(soloHerd().animals.find((a) => a.id === 2)?.hp).toBe(1)
+    shootAnimal(1, 'shotgun', 3)
+    expect(soloHerd().animals.find((a) => a.id === 1)?.state).toBe('dead')
+    expect(useSessionStore.getState().notice?.text).toContain('사냥 성공')
+  })
+})
```

`src/game/logic/characterPose.test.ts` (바꿀 곳, `git diff -U3`):

```diff
diff --git a/src/game/logic/characterPose.test.ts b/src/game/logic/characterPose.test.ts
--- a/src/game/logic/characterPose.test.ts
+++ b/src/game/logic/characterPose.test.ts
@@ -2,7 +2,7 @@ import { describe, expect, it } from 'vitest'
 import { EAT } from '../data/balance'
 import { JUMP_POSE, SPRINT_MIN_SPEED } from '../data/characters'
 import { MELEE } from '../data/melee'
-import { aimWeights, characterPose, chewBite, clipTimeScale, eatArm, fishingLook, leanBack, poseClips, swingArm } from './characterPose'
+import { aimWeights, characterPose, chewBite, clipTimeScale, eatArm, fishingLook, gunArm, leanBack, poseClips, swingArm } from './characterPose'
 import { createFight } from './fight'
 import type { FishingState } from './fishingSession'
 import { IDLE_ACTION, type PlayerAction } from './playerMotion'
@@ -207,3 +207,12 @@ describe('swingArm (3-3 휘두르기)', () => {
     expect(swingArm('stab', 0.3).forward).toBeGreaterThan(0)
   })
 })
+
+describe('gunArm (3-4 총 겨누기)', () => {
+  it('겨눈 정도만큼 팔을 앞으로 든다 (0 이면 그대로, 1 을 넘지 않는다)', () => {
+    expect(gunArm(0)).toEqual({ forward: 0, inward: 0, elbow: 0 })
+    expect(gunArm(1).forward).toBeCloseTo(-1.45)
+    expect(gunArm(0.5).forward).toBeCloseTo(-0.725)
+    expect(gunArm(3)).toEqual(gunArm(1))
+  })
+})
```

`src/game/scene/guns/gunEffectsPool.test.ts` (새 파일):

```ts
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Group, Vector3, type Line, type Mesh, type Sprite } from 'three'
import { createGunEffects } from './gunEffectsPool'

afterEach(() => vi.restoreAllMocks())

const at = (ms: number) => vi.spyOn(performance, 'now').mockReturnValue(ms)

describe('총알 효과 묶음', () => {
  it('궤적은 0.05초, 총구 불꽃은 0.04초 보였다 사라진다', () => {
    const fx = createGunEffects()
    at(1000)
    fx.api.tracer(new Vector3(0, 0, 0), new Vector3(0, 0, -10))
    fx.api.flash(new Vector3(0, 1, 0))
    const lines = fx.group.children.filter((o): o is Line => (o as Line).isLine === true)
    const flash = fx.group.children.find((o): o is Sprite => (o as Sprite).isSprite === true)!
    expect(lines.filter((l) => l.visible)).toHaveLength(1)
    expect(flash.visible).toBe(true)
    at(1045)
    fx.step()
    expect(flash.visible).toBe(false)
    expect(lines.filter((l) => l.visible)).toHaveLength(1)
    at(1051)
    fx.step()
    expect(lines.filter((l) => l.visible)).toHaveLength(0)
    fx.dispose()
  })
  it('자국: 벽은 맞은 자리에서 면 쪽으로 살짝 띄우고, 표적판에 맞으면 판에 붙는다. 120개를 돌려 쓴다', () => {
    const fx = createGunEffects()
    fx.api.hole(new Vector3(1, 2, 3), new Vector3(0, 0, 1))
    const hole = fx.group.children.at(-1) as Mesh
    expect(hole.position.toArray()).toEqual([1, 2, 3.004])
    const board = new Group()
    board.position.set(5, 0, 0)
    board.updateMatrixWorld()
    fx.api.hole(new Vector3(5.1, 0.2, 0), new Vector3(0, 0, 1), board)
    expect(board.children).toHaveLength(1)
    expect(board.children[0].position.x).toBeCloseTo(0.1)
    expect(board.children[0].position.z).toBe(0.003)
    for (let i = 0; i < 120; i++) fx.api.hole(new Vector3(0, 0, 0), new Vector3(0, 1, 0))
    expect(fx.group.children.filter((o) => (o as Mesh).isMesh && !(o as Sprite).isSprite)).toHaveLength(120)
    expect(board.children).toHaveLength(0)
    fx.dispose()
  })
})
```

`src/game/ui/gunStatus.test.ts` (새 파일):

```ts
import { describe, expect, it } from 'vitest'
import { gunStatus } from './gunStatus'

describe('총 상태 한 줄', () => {
  it('장전 중이 먼저, 빈 탄창은 예비가 있으면 R 장전 · 없으면 잡화점', () => {
    expect(gunStatus('pistol', 0, 0, true)).toBe('장전 중…')
    expect(gunStatus('pistol', 0, 12, false)).toBe('R 장전')
    expect(gunStatus('pistol', 0, 0, false)).toBe('탄약 없음 · 마을 잡화점에서 사요')
    expect(gunStatus('rifle', 30, 120, false)).toBe('누르고 있으면 연사')
    expect(gunStatus('pistol', 5, 0, false)).toBe('')
  })
})
```

- [ ] **Step 2: 실행해 실패 확인**

Run: `npx vitest run src/game/input/pointer.test.ts src/game/logic src/game/hunt src/game/scene/guns src/game/ui/gunStatus.test.ts`
Expected: FAIL — `holdTrigger is not a function`, `KeyR` 가 `none`, `shootAnimal is not a function`, `gunArm is not a function`, `Failed to resolve import "./gunEffectsPool"`·`"./gunStatus"`

- [ ] **Step 3: 입력 (방아쇠·조준·R)과 총 사냥·겨누는 팔**

`src/game/input/pointer.ts` (바꿀 곳, `git diff -U3`):

```diff
diff --git a/src/game/input/pointer.ts b/src/game/input/pointer.ts
--- a/src/game/input/pointer.ts
+++ b/src/game/input/pointer.ts
@@ -21,10 +21,20 @@ let dragY = 0
 
 /** 휘두르기 입력: primary = 마우스 왼쪽 (베기·주먹), secondary = 오른쪽 (칼 찌르기) */
 export type AttackPress = 'primary' | 'secondary'
-/** 지난 프레임 뒤로 새로 누른 휘두르기. MeleeController 가 매 프레임 가져가며 비운다 */
+/** 지난 프레임 뒤로 새로 누른 휘두르기·쏘기. 손에 든 것에 따라 MeleeController 나 GunController 가 매 프레임 가져가며 비운다 */
 let attackPress: AttackPress | null = null
+/**
+ * 총: 누르고 있는 마우스 버튼 (e.buttons 비트: 1 왼쪽 = 방아쇠, 2 오른쪽 = 조준). 캔버스에서 쏘기로 누른 것부터 센다.
+ * 마우스 잠금 중엔 창 전체의 pointermove·pointerup 으로 따라간다 (왼쪽을 누른 채 오른쪽을 눌러도 pointerdown 이 오지 않는다)
+ */
+let mouseButtons = 0
+/** 폰: 쏘기 버튼을 누르고 있다 · 조준 버튼을 켰다 */
+let touchTrigger = false
+let touchAim = false
+/** R (장전). GunController 가 가져가며 비운다 */
+let reloadPressed = false
 
-type PointerLike = { button: number; pointerId: number; clientX: number; clientY: number; pointerType?: string }
+type PointerLike = { button: number; pointerId: number; clientX: number; clientY: number; pointerType?: string; buttons?: number }
 
 /**
  * 마우스로 캔버스를 누른 게 휘두르기인가: 왼쪽·오른쪽 버튼, 마우스 잠금 중(잠금을 못 쓰는 환경이면 늘).
@@ -49,9 +59,52 @@ export function takeAttackPress(): AttackPress | null {
   return a
 }
 
+/** 마우스로 쏠 수 있는 때: 잠금 중 (잠금을 못 쓰는 환경이면 늘) */
+const mouseAims = () => isPointerLocked() || !canUseMouseLook()
+
+/** 방아쇠를 당기고 있다 (연사 총은 누르고 있는 동안 계속 쏜다) */
+export function isTriggerHeld(): boolean {
+  return ((mouseButtons & 1) !== 0 && mouseAims()) || touchTrigger
+}
+
+/** 조준 중 (마우스 오른쪽을 누르고 있거나 폰 조준 버튼을 켰다) */
+export function isAimHeld(): boolean {
+  return ((mouseButtons & 2) !== 0 && mouseAims()) || touchAim
+}
+
+/** 폰 쏘기 버튼: 누를 때 한 발(pressAttack) + 누르고 있는 동안 연사 */
+export function holdTrigger(on: boolean) {
+  touchTrigger = on
+}
+
+/** 폰 조준 버튼 (누를 때마다 켜고 끈다) */
+export function setTouchAim(on: boolean) {
+  touchAim = on
+}
+
+export function isTouchAim(): boolean {
+  return touchAim
+}
+
+/** R: 장전 */
+export function pressReload() {
+  reloadPressed = true
+}
+
+export function takeReloadPress(): boolean {
+  const r = reloadPressed
+  reloadPressed = false
+  return r
+}
+
+/** 누른 버튼 비트 (e.buttons 가 없으면 누른 버튼 하나로) */
+const buttonsOf = (e: PointerLike) => e.buttons ?? (e.button === 0 ? 1 : e.button === 2 ? 2 : 0)
+
 /** 캔버스 영역에서 눌렀을 때 호출 (UI 버튼 클릭은 여기로 오지 않는다) */
 export function pressPointer(e: PointerLike) {
-  attackPress = attackFromPointer(e, isPointerLocked(), canUseMouseLook()) ?? attackPress
+  const attack = attackFromPointer(e, isPointerLocked(), canUseMouseLook())
+  if (attack) mouseButtons = buttonsOf(e)
+  attackPress = attack ?? attackPress
   // 우클릭·휠 클릭은 낚시 입력으로 보지 않는다 (컨텍스트 메뉴가 pointerup을 삼켜 입력이 고착될 수 있다)
   if (e.button !== 0) return
   canvasPointers.set(e.pointerId, { x: e.clientX, y: e.clientY })
@@ -88,6 +141,10 @@ function releaseAll() {
   canvasPointers.clear()
   buttonPointers.clear()
   attackPress = null
+  mouseButtons = 0
+  touchTrigger = false
+  touchAim = false
+  reloadPressed = false
   dragX = 0
   dragY = 0
 }
@@ -95,11 +152,18 @@ function releaseAll() {
 /** 포인터를 떼거나 움직일 때를 창 전체에서 듣는다: 떼면 그 포인터만 빼고, 움직이면 드래그·두 손가락 확대를 계산한다 */
 export function usePointerTracking() {
   useEffect(() => {
+    // 마우스 버튼: 잠금 중엔 그대로 따라가고(왼쪽을 누른 채 오른쪽을 누르는 것도), 아니면 뗀 버튼만 지운다 (UI 를 누른 건 세지 않는다)
+    const trackButtons = (e: PointerEvent) => {
+      if (e.pointerType !== 'mouse') return
+      mouseButtons = isPointerLocked() ? e.buttons : mouseButtons & e.buttons
+    }
     const release = (e: PointerEvent) => {
+      trackButtons(e)
       canvasPointers.delete(e.pointerId)
       buttonPointers.delete(e.pointerId)
     }
     const move = (e: PointerEvent) => {
+      trackButtons(e)
       if (!canvasPointers.has(e.pointerId)) return
       const to = { x: e.clientX, y: e.clientY }
       const step = gestureStep(canvasPointers, e.pointerId, to)
```

`src/game/logic/interaction.ts` (바꿀 곳, `git diff -U3`):

```diff
diff --git a/src/game/logic/interaction.ts b/src/game/logic/interaction.ts
--- a/src/game/logic/interaction.ts
+++ b/src/game/logic/interaction.ts
@@ -88,6 +88,8 @@ export type KeyAction =
   | { type: 'equip'; tool: ToolId | null }
   /** F: 가방에서 배고픔을 가장 많이 채우는 것을 먹는다 */
   | { type: 'eatBest' }
+  /** R: 든 총 장전 */
+  | { type: 'reload' }
   /** 버섯·호박 따기 */
   | { type: 'harvest'; index: number }
   /** 문 열기/닫기 */
@@ -129,6 +131,7 @@ export function resolveKeyAction(code: string, mode: Mode, nearby: Interactable
     if (slot !== null) return HOTBAR[slot] ? { type: 'equip', tool: HOTBAR[slot] } : { type: 'none' }
     if (code === 'KeyX') return { type: 'equip', tool: null }
     if (code === 'KeyF') return { type: 'eatBest' }
+    if (code === 'KeyR') return { type: 'reload' }
     if (code === 'KeyI') return { type: 'openMode', mode: 'bag' }
   }
   // 가방은 I 로도 닫는다
```

`src/game/input/useInteractionKeys.ts` (바꿀 곳, `git diff -U3`):

```diff
diff --git a/src/game/input/useInteractionKeys.ts b/src/game/input/useInteractionKeys.ts
--- a/src/game/input/useInteractionKeys.ts
+++ b/src/game/input/useInteractionKeys.ts
@@ -2,6 +2,7 @@ import { useEffect } from 'react'
 import { isCookingSkipKey, resolveKeyAction } from '../logic/interaction'
 import { harvest, toggleDoor } from '../../meadow/meadowActions'
 import { pickLoot } from '../hunt/huntActions'
+import { pressReload } from './pointer'
 import { finishCooking } from '../scene/cooking/finishCooking'
 import { startSleep, wake } from '../scene/day/dayActions'
 import { useFishingStore } from '../stores/fishingStore'
@@ -87,6 +88,9 @@ export function runKeyAction(code: string): boolean {
     case 'eatBest':
       eatBestNow()
       break
+    case 'reload':
+      pressReload()
+      break
     case 'toggleMap':
       if (session.mode === 'map') session.closeMap()
       else session.openMap()
```

`src/game/hunt/huntActions.ts` (바꿀 곳, `git diff -U3`):

```diff
diff --git a/src/game/hunt/huntActions.ts b/src/game/hunt/huntActions.ts
--- a/src/game/hunt/huntActions.ts
+++ b/src/game/hunt/huntActions.ts
@@ -1,4 +1,5 @@
 import { speciesOf } from '../data/animals'
+import { GUNS, type GunId } from '../data/guns'
 import { ITEMS, rollDrops } from '../data/meadowItems'
 import { MELEE, type MeleeId } from '../data/melee'
 import { hitAnimal } from '../logic/animalSim'
@@ -17,7 +18,18 @@ export function strikeAnimal(id: number, kind: MeleeId) {
     net.sendAnimalHit(id, MELEE[kind].dmg, kind)
     return
   }
-  const r = hitAnimal(soloHerd(), id, MELEE[kind].dmg, ME)
+  hitSolo(id, MELEE[kind].dmg)
+}
+
+/** 내 총알 n 알(산탄총은 여러 알)이 동물 id 에 맞았다. 혼자면 알마다 은지 피해(저격 3, 나머지 1)만큼 바로 때린다 */
+export function shootAnimal(id: number, gun: GunId, n: number) {
+  if (useNetStore.getState().phase !== 'off') return
+  hitSolo(id, GUNS[gun].dmg * n)
+}
+
+/** 혼자 할 때 때리기: 쓰러뜨리면 전리품 */
+function hitSolo(id: number, dmg: number) {
+  const r = hitAnimal(soloHerd(), id, dmg, ME)
   setSoloHerd(r.herd)
   if (r.result !== 'killed' || !r.animal) return
   spawnLoot(rollDrops(r.animal.sp), r.animal.x, r.animal.z, netNow())
```

`src/game/logic/characterPose.ts` (바꿀 곳, `git diff -U3`):

```diff
diff --git a/src/game/logic/characterPose.ts b/src/game/logic/characterPose.ts
--- a/src/game/logic/characterPose.ts
+++ b/src/game/logic/characterPose.ts
@@ -191,6 +191,16 @@ const SWING_KEYS: Record<MeleeId, [number, number, number, number][]> = {
   ],
 }
 
+/** 총을 겨누는 오른팔 (찌르기를 뻗은 자세와 비슷하게 앞으로 곧게). 은지 3인칭 조준 자세 */
+const GUN_AIM: SwingArm = { forward: -1.45, inward: 0.12, elbow: -0.08 }
+
+/** 총을 겨눈 정도 w (0 = 내린 채, 1 = 겨눔) 만큼 오른팔을 든다 (조준하거나 막 쐈을 때. 오르내릴 때 툭 튀지 않게 w 를 부드럽게 바꾼다) */
+export function gunArm(w: number): SwingArm {
+  const k = Math.min(1, Math.max(0, w))
+  if (!(k > 0)) return REST_ARM
+  return { forward: GUN_AIM.forward * k, inward: GUN_AIM.inward * k, elbow: GUN_AIM.elbow * k }
+}
+
 /** 휘두르는 동안 오른팔 (서 있기 클립 위에 덧돌린다. eatArm 처럼). p: 동작 진행도 0..1, 범위 밖이면 그대로 */
 export function swingArm(kind: MeleeId, p: number): SwingArm {
   if (!(p > 0 && p < 1)) return REST_ARM
```

- [ ] **Step 4: 총 상태·효과**

`src/game/guns/gunRig.ts` (새 파일):

```ts
import { Vector3 } from 'three'
import type { GunId } from '../data/guns'
import { GUN_IDLE, type GunState } from '../logic/gun'
import type { V3 } from '../logic/hitscan'

/** 마지막으로 쏜 한 발: 광선 시작(카메라)·방향(가운데 알), 무엇에 맞았나 (헤드리스 점검·같이 하기 shot 이 쓴다) */
export type LastShot = { o: V3; d: V3; hit: 'animal' | 'peer' | 'target' | 'wall' | null }

/**
 * 내 총 (scene/guns/GunController 가 매 프레임 고치고 Player·HUD 가 읽는다). 매 프레임 바뀌는 값이라 React 상태가 아닌 모듈 객체에 둔다.
 * 시각은 performance.now() 초 (게임을 다시 열어도 R3F 시계처럼 0 으로 돌아가지 않는다).
 * - gun: 손에 든 총 (없으면 null), aiming: 조준 중
 * - kick: Player 가 카메라 기울기에서 가져갈 반동 (rad), muzzle: 총구 자리 (Player 가 손의 총에서 적는다, 없으면 null)
 * - hitAt·hitText: 명중 표시 (조준선에 잠깐), lastShot: 마지막 한 발
 */
export const gunRig: GunState & { gun: GunId | null; aiming: boolean; kick: number; muzzle: Vector3 | null; hitAt: number; hitText: string; lastShot: LastShot | null } = {
  ...GUN_IDLE,
  gun: null,
  aiming: false,
  kick: 0,
  muzzle: null,
  hitAt: -Infinity,
  hitText: '',
  lastShot: null,
}

/** 판을 새로 시작할 때 (Game 을 다시 열면 모듈 값이 남아 있다) */
export function resetGunRig() {
  Object.assign(gunRig, GUN_IDLE, { gun: null, aiming: false, kick: 0, muzzle: null, hitAt: -Infinity, hitText: '', lastShot: null })
}

/** Player 가 반동을 가져간다 */
export function takeKick(): number {
  const k = gunRig.kick
  gunRig.kick = 0
  return k
}

/** 명중 표시 (조준선 둘레 ✕, 사격장 점수) */
export function markHit(now: number, text = '') {
  gunRig.hitAt = now
  gunRig.hitText = text
}
```

`src/game/guns/gunFx.ts` (새 파일):

```ts
import type { Object3D, Vector3 } from 'three'

/** 총알 효과 (scene/guns/GunEffects 가 붙인다): 궤적 선, 총알 자국, 총구 불꽃. 그리는 곳이 없으면(장면 밖·테스트) 아무 일도 없다 */
export type GunFx = {
  tracer(from: Vector3, to: Vector3): void
  /** 자국: parent 를 주면(사격장 표적판) 그 판에 붙어 같이 움직인다 */
  hole(point: Vector3, normal: Vector3, parent?: Object3D | null): void
  flash(at: Vector3): void
}

let current: GunFx | null = null

export function setGunFx(fx: GunFx | null) {
  current = fx
}

export const gunFx: GunFx = {
  tracer: (from, to) => current?.tracer(from, to),
  hole: (point, normal, parent) => current?.hole(point, normal, parent),
  flash: (at) => current?.flash(at),
}
```

`src/game/scene/guns/gunEffectsPool.ts` (새 파일):

```ts
import { AdditiveBlending, BufferGeometry, CircleGeometry, Group, Line, LineBasicMaterial, Mesh, MeshBasicMaterial, Sprite, SpriteMaterial, Vector3, type Object3D } from 'three'
import type { GunFx } from '../../guns/gunFx'

/** 은지 Effects 숫자: 자국 120개를 돌려 쓰고, 궤적 16개 (0.05초), 총구 불꽃 0.04초 */
const HOLES = 120
const TRACERS = 16
const TRACER_LIFE = 0.05
const FLASH_LIFE = 0.04

const up = new Vector3()

/**
 * 총알 효과 묶음 (scene/guns/GunEffects 가 하나 만들어 장면에 붙인다). 그려 둔 것을 돌려 쓴다.
 * step: 매 프레임 (다 된 궤적·불꽃을 숨긴다), dispose: 내릴 때
 */
export function createGunEffects(): { group: Group; api: GunFx; step: () => void; dispose: () => void } {
  const group = new Group()
  const holeMat = new MeshBasicMaterial({ color: 0x1a1a1a, transparent: true, opacity: 0.9, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 })
  const holeGeo = new CircleGeometry(0.022, 10)
  const holes: Mesh[] = []
  let holeI = 0
  const tracerMat = new LineBasicMaterial({ color: 0xffe9a8, transparent: true, opacity: 0.85 })
  const tracers = Array.from({ length: TRACERS }, () => {
    const line = new Line(new BufferGeometry().setFromPoints([new Vector3(), new Vector3()]), tracerMat)
    line.frustumCulled = false
    line.visible = false
    group.add(line)
    return { line, until: 0 }
  })
  let tracerI = 0
  const flash = new Sprite(new SpriteMaterial({ color: 0xffd27a, transparent: true, blending: AdditiveBlending, depthWrite: false }))
  flash.scale.setScalar(0.18)
  flash.visible = false
  group.add(flash)
  let flashUntil = 0
  const now = () => performance.now() / 1000
  const api: GunFx = {
    tracer(from, to) {
      const t = tracers[tracerI]
      tracerI = (tracerI + 1) % TRACERS
      t.line.geometry.setFromPoints([from, to])
      t.line.visible = true
      t.until = now() + TRACER_LIFE
    },
    hole(point, normal, parent?: Object3D | null) {
      let h = holes[holeI]
      if (!h) h = holes[holeI] = new Mesh(holeGeo, holeMat)
      holeI = (holeI + 1) % HOLES
      h.removeFromParent()
      if (parent) {
        parent.add(h)
        h.position.copy(parent.worldToLocal(point.clone()))
        h.position.z = 0.003
        h.quaternion.identity()
      } else {
        group.add(h)
        h.position.copy(point).addScaledVector(normal, 0.004)
        h.lookAt(up.copy(point).add(normal))
      }
    },
    flash(at) {
      flash.position.copy(at)
      flash.visible = true
      flash.material.rotation = Math.random() * Math.PI
      flashUntil = now() + FLASH_LIFE
    },
  }
  const step = () => {
    const t = now()
    for (const tr of tracers) if (tr.line.visible && t >= tr.until) tr.line.visible = false
    if (flash.visible && t >= flashUntil) flash.visible = false
  }
  const dispose = () => {
    for (const h of holes) h.removeFromParent()
    holeGeo.dispose()
    holeMat.dispose()
    tracerMat.dispose()
    for (const tr of tracers) tr.line.geometry.dispose()
    flash.material.dispose()
  }
  return { group, api, step, dispose }
}
```

`src/game/scene/guns/GunEffects.tsx` (새 파일):

```tsx
import { useEffect, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import { setGunFx } from '../../guns/gunFx'
import { createGunEffects } from './gunEffectsPool'

/**
 * 총알 효과 (은지 weapons.js Effects): 궤적 선·총알 자국·총구 불꽃. 빛 개수를 바꾸지 않도록 총구 불꽃은 빛 없이 더해지는 판(Sprite)만 쓴다.
 * 다른 사람이 쏜 것(같이 하기 shot)도 같은 효과로 그린다
 */
export function GunEffects() {
  const fx = useMemo(() => createGunEffects(), [])

  useEffect(() => {
    setGunFx(fx.api)
    return () => {
      setGunFx(null)
      fx.dispose()
    }
  }, [fx])

  useFrame(() => fx.step())
  return <primitive object={fx.group} />
}
```

- [ ] **Step 5: 쏘기 (GunController) 와 휘두르기와 나누기**

알마다 동물 기둥·벽 중 처음 닿는 것. 총을 들면 누른 것은 GunController 가 가져간다 (MeleeController 는 건너뛴다).

`src/game/scene/guns/GunController.tsx` (새 파일):

```tsx
import { useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { useRapier } from '@react-three/rapier'
import { Vector3 } from 'three'
import { weaponSfx } from '../../audio/weaponSfx'
import { GUNS, GUN_RANGE, isGun, type GunId } from '../../data/guns'
import { gunFx } from '../../guns/gunFx'
import { gunRig, markHit, type LastShot } from '../../guns/gunRig'
import { animalViews } from '../../hunt/animalRig'
import { shootAnimal } from '../../hunt/huntActions'
import { isAimHeld, isTriggerHeld, takeAttackPress, takeReloadPress } from '../../input/pointer'
import { canReload } from '../../logic/ammo'
import { finishReload, heatNow, pullTrigger, recoilOf, spreadOf, startReload, swapGun } from '../../logic/gun'
import { countHits, firstBodyHit, pelletDirs } from '../../logic/hitscan'
import { netNow } from '../../net/remoteRig'
import { useNetStore } from '../../stores/netStore'
import { useProgressStore } from '../../stores/progressStore'
import { useSessionStore } from '../../stores/sessionStore'
import { FOOT_Y, playerRig } from '../Player'

/** 3인칭: 카메라 ~ 눈 사이(내 몸)는 건너뛰고, 눈보다 이만큼 앞에서부터 맞는다 (은지 aimRay) */
const EYE_SKIP = 0.35

// 매 프레임 new 하지 않도록 재사용
const origin = new Vector3()
const dir = new Vector3()
const eye = new Vector3()
const end = new Vector3()
const from = new Vector3()
const normal = new Vector3()

/** 쏠 수 있는 때: 탐험 중, 먹거나 감정 표현 중이 아닐 때 (낚시·배·잠·패널·T 바퀴는 mode 가 explore 가 아니다) */
function canShoot(): boolean {
  const s = useSessionStore.getState()
  return s.mode === 'explore' && !s.playerAction.eat && !s.playerAction.emote
}

/** 장전 시작 (R 이나 빈 탄창). manual: R 을 눌렀다 (예비가 없으면 알린다) */
function tryReload(gun: GunId, now: number, manual: boolean) {
  const { ammo, reserve } = useProgressStore.getState()
  const next = startReload(gunRig, gun, now, canReload(ammo, reserve, gun))
  if (next) {
    Object.assign(gunRig, next)
    weaponSfx.reload(GUNS[gun].reload)
  } else if (manual && reserve[gun] === 0 && !gunRig.reload) {
    useSessionStore.getState().notify('예비 탄약이 없어요 · 마을 잡화점에서 사요')
  }
}

/**
 * 화면엔 아무것도 그리지 않는다. 총을 든 채 마우스 왼쪽(연사 총은 누르고 있는 동안)·폰 쏘기 버튼으로 쏘고, 오른쪽으로 조준, R 로 장전한다 (은지 WeaponSystem).
 * 화면 가운데(카메라)에서 광선: 알마다 처음 닿는 것 = 동물(판정 기둥) · 벽(Rapier 고정 충돌체, 총알 자국). 반동·퍼짐·연사는 은지 수치
 */
export function GunController() {
  const { world, rapier } = useRapier()
  const camera = useThree((s) => s.camera)
  const ray = useRef<InstanceType<typeof rapier.Ray> | null>(null)

  /** 한 발 쏘기 (산탄총은 여덟 알) */
  const shoot = (gun: GunId, now: number, spread: number) => {
    camera.getWorldPosition(origin)
    camera.getWorldDirection(dir)
    eye.set(playerRig.position.x, playerRig.position.y + FOOT_Y + playerRig.eyeHeight, playerRig.position.z)
    const near = Math.max(0, origin.distanceTo(eye) - EYE_SKIP)
    const muzzle = gunRig.muzzle ? from.copy(gunRig.muzzle) : from.copy(origin).addScaledVector(dir, 0.3)
    const animals = animalViews(useNetStore.getState().phase !== 'off', netNow())
    const r = (ray.current ??= new rapier.Ray({ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 1 }))
    const struck: number[] = []
    let first: LastShot['hit'] | undefined
    for (const d of pelletDirs(dir, spread, GUNS[gun].pellets, Math.random)) {
      const body = firstBodyHit(origin, d, near, GUN_RANGE, animals, [])
      r.origin = { x: origin.x + d.x * near, y: origin.y + d.y * near, z: origin.z + d.z * near }
      r.dir = d
      const wall = world.castRayAndGetNormal(r, GUN_RANGE - near, true, rapier.QueryFilterFlags.ONLY_FIXED | rapier.QueryFilterFlags.EXCLUDE_SENSORS)
      const wallT = wall ? near + wall.timeOfImpact : Infinity
      const t = Math.min(body?.t ?? Infinity, wallT, GUN_RANGE)
      end.set(origin.x + d.x * t, origin.y + d.y * t, origin.z + d.z * t)
      let hit: LastShot['hit'] = null
      if (body && body.t <= wallT) {
        hit = body.kind
        if (body.kind === 'animal') struck.push(body.id)
      } else if (wall) {
        hit = 'wall'
        gunFx.hole(end, normal.set(wall.normal.x, wall.normal.y, wall.normal.z))
      }
      first ??= hit
      gunFx.tracer(muzzle, end)
    }
    gunRig.lastShot = { o: { x: origin.x, y: origin.y, z: origin.z }, d: { x: dir.x, y: dir.y, z: dir.z }, hit: first ?? null }
    for (const [id, n] of countHits(struck)) shootAnimal(id, gun, n)
    if (struck.length) markHit(now)
    gunFx.flash(muzzle)
    weaponSfx.shot(gun)
    gunRig.kick += recoilOf(gun, gunRig.aiming, false)
  }

  useFrame(() => {
    const now = performance.now() / 1000
    const session = useSessionStore.getState()
    const gun = isGun(session.tool) ? session.tool : null
    // 총을 바꾸면 장전·열기를 지우고 0.25초 뒤부터 쏜다
    if (gun !== gunRig.gun) Object.assign(gunRig, swapGun(gunRig, now), { gun })
    const done = finishReload(gunRig, now)
    if (done) {
      Object.assign(gunRig, done.state)
      useProgressStore.getState().reloadGun(done.gun)
    }
    const reloadKey = takeReloadPress()
    if (!gun) {
      gunRig.aiming = false
      return
    }
    // 총을 들었을 때만 누른 것을 가져간다 (아니면 MeleeController 가 휘두르기로 가져간다)
    const press = takeAttackPress()
    const ready = canShoot()
    gunRig.aiming = ready && isAimHeld()
    if (!ready) return
    if (reloadKey) tryReload(gun, now, true)
    const want = GUNS[gun].auto ? isTriggerHeld() || press === 'primary' : press === 'primary'
    if (!want) return
    const heat = heatNow(gunRig, now)
    const progress = useProgressStore.getState()
    const t = pullTrigger(gunRig, gun, now, progress.ammo[gun])
    Object.assign(gunRig, t.state)
    if (t.kind === 'empty') {
      weaponSfx.dry()
      tryReload(gun, now, false)
    } else if (t.kind === 'fire' && progress.fireRound(gun)) {
      shoot(gun, now, spreadOf(gun, gunRig.aiming, heat))
    }
  })
  return null
}
```

`src/game/scene/melee/MeleeController.tsx` (바꿀 곳, `git diff -U3`):

```diff
diff --git a/src/game/scene/melee/MeleeController.tsx b/src/game/scene/melee/MeleeController.tsx
--- a/src/game/scene/melee/MeleeController.tsx
+++ b/src/game/scene/melee/MeleeController.tsx
@@ -2,6 +2,7 @@ import { useEffect, useRef } from 'react'
 import { useFrame } from '@react-three/fiber'
 import { useRapier } from '@react-three/rapier'
 import { weaponSfx } from '../../audio/weaponSfx'
+import { isGun } from '../../data/guns'
 import { MELEE, meleeFor, type MeleeId } from '../../data/melee'
 import { animalViews } from '../../hunt/animalRig'
 import { strikeAnimal } from '../../hunt/huntActions'
@@ -30,8 +31,9 @@ export function MeleeController() {
 
   useFrame(({ clock }) => {
     const now = clock.elapsedTime
-    const press = takeAttackPress()
     const session = useSessionStore.getState()
+    // 총을 들었으면 누른 것은 GunController 가 가져간다
+    const press = isGun(session.tool) ? null : takeAttackPress()
     if (press && canSwing(session.mode, session.playerAction, playerGround.grounded)) {
       const kind = meleeFor(session.tool, press === 'secondary')
       const next = kind && startSwing(meleeRig, kind, now)
```

- [ ] **Step 6: 겨누기·반동·총구 (Player)**

쏘거나 조준하는 동안(0.6초) 카메라 쪽을 보고 오른팔을 든다. 반동은 카메라 기울기에서 뺀다.

`src/game/scene/Player.tsx` (바꿀 곳, `git diff -U3`):

```diff
diff --git a/src/game/scene/Player.tsx b/src/game/scene/Player.tsx
--- a/src/game/scene/Player.tsx
+++ b/src/game/scene/Player.tsx
@@ -25,9 +25,10 @@ import { applyMouseLook, pitchedOffset } from '../logic/mouseLook'
 import { useSettingsStore } from '../stores/settingsStore'
 import { castPowerFromHold } from '../logic/cast'
 import type { FishingState } from '../logic/fishingSession'
-import { fishingLook, swingArm } from '../logic/characterPose'
+import { fishingLook, gunArm, swingArm } from '../logic/characterPose'
 import { swingProgress } from '../logic/melee'
 import { meleeRig } from '../hunt/meleeRig'
+import { gunRig, takeKick } from '../guns/gunRig'
 import { cameraRig, isGrounded, moveSpeed, nextAction, shouldFaceCamera, shownTool } from '../logic/playerMotion'
 import { NO_MOVE } from '../logic/joystick'
 import { DEFAULT_LOOK } from '../data/characterParts'
@@ -58,6 +59,8 @@ export const playerRig = {
   rodShown: true,
   /** 카메라가 플레이어 주위를 도는 각도 (미니맵이 이 방향을 위로 그린다) */
   yaw: 0,
+  /** 발바닥에서 눈까지 (m, 키에 따라. 총 광선이 카메라 ~ 눈 사이를 건너뛴다) */
+  eyeHeight: 1.66,
 }
 
 /** 낚시 시작 시 카메라가 물 쪽으로 돌아가는 속도 */
@@ -110,6 +113,12 @@ function rodAngle(fishing: FishingState | null, now: number): number {
 
 /** 휘두르는 동안 칼날을 앞으로 눕히는 각도 (동작 가운데에서 가장 크게) */
 const KNIFE_SWING_TILT = 1.1
+/** 눈 높이 (키 대비, 은지 1.65 / 1.8) */
+const EYE_RATIO = 0.92
+/** 쏜 뒤 이만큼(초) 총을 겨눈 채 카메라 쪽을 본다 */
+const GUN_HOLD = 0.6
+/** 총을 들어 올리고 내리는 빠르기 */
+const GUN_RAISE_SPEED = 12
 
 /** 캡슐 콜라이더 바닥(발바닥) 높이. 모델은 발이 원점이라 이만큼 내린다 */
 export const FOOT_Y = -(PLAYER_BODY.halfHeight + PLAYER_BODY.radius)
@@ -131,6 +140,7 @@ const grip = new Vector3()
 const lookTarget = new Vector3()
 const cutLook = new Vector3()
 const camDir = new Vector3()
+const muzzleAt = new Vector3()
 
 export function Player() {
   const body = useRef<RapierRigidBody>(null)
@@ -171,6 +181,8 @@ export function Player() {
   /** 수리 연출 카메라 비율(0 = 보통 카메라, 1 = 연출 자리)과 마지막 연출 카메라 (끝난 뒤 부드럽게 돌아오도록 기억한다) */
   const cut = useRef<{ blend: number; camera: RepairPlan['camera'] | null }>({ blend: 0, camera: null })
   const look = useProgressStore((s) => s.look) ?? DEFAULT_LOOK
+  /** 총을 겨눈 정도 (0 내림 ~ 1 겨눔) */
+  const gunRaise = useRef(0)
   /** 먹고 있는 요리 (손에 든 음식과 "아구작 냠냠") */
   const eating = useSessionStore((s) => s.playerAction.eat)
   const food = useRef<Group>(null)
@@ -300,6 +312,10 @@ export function Player() {
       pitch.current = next.pitch
     }
 
+    // 0-2) 총 반동: 총구가 들리듯 위를 본다 (기울기가 작을수록 고개를 든다)
+    const kick = takeKick()
+    if (kick > 0) pitch.current = Math.max(MOUSE_LOOK.minPitch, pitch.current - kick)
+
     // 1) WASD·조이스틱 → 카메라 기준 이동 방향 (조이스틱은 민 만큼 천천히 걷는다)
     const move = mode === 'explore' ? readMoveInput() : NO_MOVE
     const { forward, right } = move
@@ -365,6 +381,7 @@ export function Player() {
     playerRig.position.set(x, y, z)
 
     // 3) 바라보는 방향: 낚시 중엔 물 쪽, 아니면 이동 방향
+    const gunUp = mode === 'explore' && isGun(session.tool) && gunRig.gun === session.tool && (gunRig.aiming || performance.now() / 1000 - gunRig.firedAt < GUN_HOLD)
     if (boatAt) {
       facing.current = boatAt.heading
     } else if (mode === 'fishing' && spot) {
@@ -382,6 +399,9 @@ export function Player() {
     } else if (mode === 'explore' && swingProgress(meleeRig.swing, now) >= 0) {
       // 휘두르는 동안엔 휘두른 쪽(그때 카메라가 보던 쪽)을 본다
       facing.current = meleeRig.yaw + Math.PI
+    } else if (gunUp) {
+      // 총을 겨누는 동안(조준·막 쏨)엔 카메라가 보는 쪽 (총알이 나가는 쪽)
+      facing.current = yaw.current + Math.PI
     } else if (moveDir.lengthSq() > 0) {
       facing.current = Math.atan2(moveDir.x, moveDir.z)
     }
@@ -394,6 +414,7 @@ export function Player() {
     if (boatRef.current) boatRef.current.visible = boatAt !== null
     playerRig.facing = facing.current
     playerRig.yaw = yaw.current
+    playerRig.eyeHeight = CHARACTER_BASE_HEIGHT * look.height * EYE_RATIO
     playerRig.speed = speed
     playerRig.resting = mode === 'rest' || boatAt !== null
 
@@ -423,6 +444,9 @@ export function Player() {
         m.update(delta, now, fishingLook(fishing), action, speed, rod.current.rotation.x, seated, boatAt ? BOAT_SEAT_SHAPE : BENCH_SEAT_SHAPE)
         const swingAt = swingProgress(meleeRig.swing, now)
         if (swingAt >= 0 && meleeRig.swing) m.swing(swingArm(meleeRig.swing.kind, swingAt))
+        // 총을 겨누면 오른팔을 앞으로 든다 (총은 손에 붙어 함께 올라간다)
+        gunRaise.current += (Number(gunUp && isGun(held)) - gunRaise.current) * (1 - Math.exp(-delta * GUN_RAISE_SPEED))
+        if (gunRaise.current > 1e-3) m.swing(gunArm(gunRaise.current))
         visual.current.updateWorldMatrix(true, false)
         m.gripPosition(grip)
         rod.current.position.copy(visual.current.worldToLocal(grip))
@@ -431,8 +455,13 @@ export function Player() {
           knife.current.position.copy(rod.current.position)
           knife.current.rotation.x = rod.current.rotation.x + (swingAt >= 0 ? KNIFE_SWING_TILT * Math.sin(Math.PI * swingAt) : 0)
         }
-        // 총도 같은 손에 (총열이 앞을 본다)
-        if (gun.current) gun.current.position.copy(rod.current.position)
+        // 총도 같은 손에 (총열이 앞을 본다). 총구 자리를 쏘기(궤적·불꽃)에 알려 준다
+        gunRig.muzzle = null
+        if (gun.current) {
+          gun.current.position.copy(rod.current.position)
+          const muzzle = gun.current.visible ? (gun.current.children[0]?.userData.muzzle as Object3D | undefined) : undefined
+          if (muzzle) gunRig.muzzle = muzzle.getWorldPosition(muzzleAt)
+        }
         // 먹는 음식도 같은 손에 든다
         if (food.current) food.current.position.copy(grip)
       }
```

- [ ] **Step 7: 조준선·탄창 화면, 붙이기**

`src/game/ui/gunStatus.ts` (새 파일):

```ts
import { GUNS, type GunId } from '../data/guns'

/** 총 상태 한 줄 (은지 setWeaponHud): 장전 중 / 탄약 없음 / R 장전 / 연사 안내 */
export function gunStatus(gun: GunId, mag: number, reserve: number, reloading: boolean): string {
  if (reloading) return '장전 중…'
  if (mag === 0 && reserve === 0) return '탄약 없음 · 마을 잡화점에서 사요'
  if (mag === 0) return 'R 장전'
  return GUNS[gun].auto ? '누르고 있으면 연사' : ''
}
```

`src/game/ui/GunHud.tsx` (새 파일):

```tsx
import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { GUNS, isGun } from '../data/guns'
import { gunRig } from '../guns/gunRig'
import { useTouchUi } from '../input/touchDevice'
import { heatNow, reloadProgress, spreadOf } from '../logic/gun'
import { useProgressStore } from '../stores/progressStore'
import { useSessionStore } from '../stores/sessionStore'
import { gunStatus } from './gunStatus'
import { safeBottom, safeRight } from './styles'

/** 명중 표시를 띄워 두는 시간(초) */
const HIT_MARK = 0.25

/**
 * 총을 든 동안: 화면 가운데 조준선(퍼짐만큼 벌어진다, 맞히면 ✕), 오른쪽 아래 총 이름·탄창/예비·상태.
 * 매 프레임 바뀌는 퍼짐·명중 표시는 React 상태 대신 rAF 로 스타일만 고친다
 */
export function GunHud() {
  const mode = useSessionStore((s) => s.mode)
  const tool = useSessionStore((s) => s.tool)
  const mag = useProgressStore((s) => (isGun(tool) ? s.ammo[tool] : 0))
  const reserve = useProgressStore((s) => (isGun(tool) ? s.reserve[tool] : 0))
  const touchUi = useTouchUi()
  const cross = useRef<HTMLDivElement>(null)
  const mark = useRef<HTMLDivElement>(null)
  const [reloading, setReloading] = useState(false)
  const shown = mode === 'explore' && isGun(tool)

  useEffect(() => {
    if (!shown) return
    let raf = 0
    const tick = () => {
      raf = requestAnimationFrame(tick)
      const now = performance.now() / 1000
      const gun = gunRig.gun
      if (!gun) return
      const gap = 6 + spreadOf(gun, gunRig.aiming, heatNow(gunRig, now)) * 900
      cross.current?.style.setProperty('--gap', `${gap}px`)
      if (mark.current) mark.current.style.opacity = now - gunRig.hitAt < HIT_MARK ? '1' : '0'
      const r = reloadProgress(gunRig, now) >= 0
      setReloading((prev) => (prev === r ? prev : r))
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [shown])

  if (!shown) return null
  const status = gunStatus(tool, mag, reserve, reloading)
  return (
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 999, color: '#fff' }}>
      <div ref={cross} style={crossBox} aria-hidden>
        {[0, 90, 180, 270].map((deg) => (
          <span key={deg} style={{ ...tick, transform: `rotate(${deg}deg) translateY(calc(-1 * var(--gap, 8px)))` }} />
        ))}
        <div ref={mark} style={hitMark}>
          ✕
        </div>
      </div>
      {!touchUi && (
        <div style={panel} aria-label="총">
          <div style={{ fontSize: 13, opacity: 0.85 }}>🔫 {GUNS[tool].name}</div>
          <div style={{ fontSize: 26, fontWeight: 800, lineHeight: 1.1 }}>
            {mag} <span style={{ fontSize: 15, opacity: 0.75 }}>/ {reserve}</span>
          </div>
          {status && <div style={{ fontSize: 12, color: mag === 0 ? '#ffab91' : '#ffe082' }}>{status}</div>}
        </div>
      )}
    </div>
  )
}

const crossBox: CSSProperties = { position: 'absolute', left: '50%', top: '50%', width: 0, height: 0 }
const tick: CSSProperties = { position: 'absolute', left: -1, top: -5, width: 2, height: 8, background: 'rgba(255,255,255,0.9)', boxShadow: '0 0 2px #000', transformOrigin: '1px 5px' }
const hitMark: CSSProperties = { position: 'absolute', left: -9, top: -13, width: 18, textAlign: 'center', fontSize: 18, fontWeight: 900, color: '#ff5252', textShadow: '0 0 3px #000', opacity: 0, transition: 'opacity 0.08s' }
const panel: CSSProperties = { position: 'absolute', right: safeRight(16), bottom: safeBottom(52), textAlign: 'right', background: 'rgba(15, 20, 30, 0.55)', padding: '6px 12px', borderRadius: 10, textShadow: '0 1px 2px #000' }
```

`src/game/ui/Hud.tsx` (바꿀 곳, `git diff -U3`):

```diff
diff --git a/src/game/ui/Hud.tsx b/src/game/ui/Hud.tsx
--- a/src/game/ui/Hud.tsx
+++ b/src/game/ui/Hud.tsx
@@ -1,5 +1,6 @@
 import { useEffect, useState, type CSSProperties } from 'react'
 import { HUNGER, STAMINA } from '../data/balance'
+import { isGun } from '../data/guns'
 import { BUFF_LABEL, getDish } from '../data/dishes'
 import { MARKET } from '../data/market'
 import { SNACKS } from '../data/snacks'
@@ -132,7 +133,7 @@ export function Hud() {
           {mouseLook && !locked && <div style={lookHint}>클릭하면 마우스로 시점 회전 · ESC 해제</div>}
           {!touchUi && (
             <div style={{ position: 'absolute', bottom: 8, left: 16, right: 16, textAlign: 'center', opacity: 0.7, fontSize: 12 }}>
-              WASD 이동 · Shift 달리기 · Space 점프 · 1~7 도구 · X 넣기 · {tool === 'fists' ? '클릭 주먹 · ' : tool === 'knife' ? '클릭 베기 · 오른쪽 클릭 찌르기 · ' : ''}I 가방 · F 먹기 · T 꾹 감정 표현 · Tab 지도 · 휠 확대 · M 음악 · {mouseLook ? (locked ? '마우스로 시점 회전 · ESC 메뉴' : '클릭 후 마우스로 시점 회전') : '드래그로 카메라 회전'}
+              WASD 이동 · Shift 달리기 · Space 점프 · 1~7 도구 · X 넣기 · {tool === 'fists' ? '클릭 주먹 · ' : tool === 'knife' ? '클릭 베기 · 오른쪽 클릭 찌르기 · ' : isGun(tool) ? '클릭 쏘기 · 오른쪽 클릭 조준 · R 장전 · ' : ''}I 가방 · F 먹기 · T 꾹 감정 표현 · Tab 지도 · 휠 확대 · M 음악 · {mouseLook ? (locked ? '마우스로 시점 회전 · ESC 메뉴' : '클릭 후 마우스로 시점 회전') : '드래그로 카메라 회전'}
             </div>
           )}
         </>
```

`src/game/scene/World.tsx` (바꿀 곳, `git diff -U3`):

```diff
diff --git a/src/game/scene/World.tsx b/src/game/scene/World.tsx
--- a/src/game/scene/World.tsx
+++ b/src/game/scene/World.tsx
@@ -8,6 +8,8 @@ import { Animals } from './animals/Animals'
 import { HerdRunner } from './animals/HerdRunner'
 import { LootItems } from './animals/LootItems'
 import { MeleeController } from './melee/MeleeController'
+import { GunController } from './guns/GunController'
+import { GunEffects } from './guns/GunEffects'
 import { Docks } from './boat/Docks'
 import { DayCycle } from './day/DayCycle'
 import { FishingSpots } from './facilities/FishingSpots'
@@ -69,6 +71,8 @@ export function World() {
       </Suspense>
       <LootItems />
       <MeleeController />
+      <GunController />
+      <GunEffects />
       <DayCycle />
     </>
   )
```

`src/game/Game.tsx` — resetGunRig 와 GunHud (바꿀 곳, `git diff -U3`):

```diff
diff --git a/src/game/Game.tsx b/src/game/Game.tsx
--- a/src/game/Game.tsx
+++ b/src/game/Game.tsx
@@ -28,6 +28,8 @@ import { GoalTracker } from './ui/GoalTracker'
 import { Hud, NoticeLayer } from './ui/Hud'
 import { Hotbar } from './ui/Hotbar'
 import { HurtFlash } from './ui/HurtFlash'
+import { GunHud } from './ui/GunHud'
+import { resetGunRig } from './guns/gunRig'
 import { LoadingScreen } from './ui/LoadingScreen'
 import { SleepOverlay } from './ui/SleepOverlay'
 import { WeaknessOverlay } from './ui/WeaknessOverlay'
@@ -81,6 +83,7 @@ export function Game({ onExit, hub }: GameProps) {
   // 진행 상황(progressStore)은 저장된 것을 이어 쓰고, 이번 판 상태만 초기화한다
   useEffect(() => {
     useSessionStore.getState().resetSession()
+    resetGunRig()
     useFishingStore.getState().end()
     // 시계는 저장된 혼자 시계에서 (같이 하면 welcome 에서 방 시계로 바꾼다)
     useDayStore.getState().reset()
@@ -114,6 +117,7 @@ export function Game({ onExit, hub }: GameProps) {
       <WeaknessOverlay />
       <HurtFlash />
       <Hud />
+      <GunHud />
       <Hotbar />
       <RoomBadge />
       <MiniMap />
```

- [ ] **Step 8: 테스트 통과 확인**

Run: `npx vitest run && npx tsc -b && npm run lint 2>&1 | grep -c warning`
Expected: 모든 테스트 PASS, tsc 오류 없음, 경고 6

- [ ] **Step 9: 눈으로 확인**

`npm run dev` → 혼자 하기 → 4(권총) → 화면을 클릭해 마우스를 잠그고 왼쪽 클릭: 궤적·총구 불꽃·소리, 오른쪽 아래 `11 / 48`. 집 벽을 쏘면 검은 자국. R → 1.3초 뒤 `12 / 47`. 5(소총)는 누르고 있으면 연사, 오른쪽 클릭 중엔 조준선이 좁아진다. 들판 동물을 쏘면(카메라를 조금 들어 수평으로) 조준선에 빨간 ✕, 동물이 맞는다. 낚시·가방·T 바퀴 중엔 쏘지 않는다.

- [ ] **Step 10: 커밋**

```bash
git add src/game/Game.tsx \
  src/game/guns/gunFx.ts \
  src/game/guns/gunRig.ts \
  src/game/hunt/huntActions.test.ts \
  src/game/hunt/huntActions.ts \
  src/game/input/pointer.test.ts \
  src/game/input/pointer.ts \
  src/game/input/useInteractionKeys.ts \
  src/game/logic/characterPose.test.ts \
  src/game/logic/characterPose.ts \
  src/game/logic/interaction.test.ts \
  src/game/logic/interaction.ts \
  src/game/scene/Player.tsx \
  src/game/scene/World.tsx \
  src/game/scene/guns/GunController.tsx \
  src/game/scene/guns/GunEffects.tsx \
  src/game/scene/guns/gunEffectsPool.test.ts \
  src/game/scene/guns/gunEffectsPool.ts \
  src/game/scene/melee/MeleeController.tsx \
  src/game/ui/GunHud.tsx \
  src/game/ui/Hud.tsx \
  src/game/ui/gunStatus.test.ts \
  src/game/ui/gunStatus.ts
git commit -F - <<'EOF'
feat: 총 쏘기·장전과 총알 효과

- 총을 들고 마우스 왼쪽(소총은 누르고 있으면 연사)으로 쏜다. 오른쪽은 조준(퍼짐·반동이 준다), R 장전, 빈 탄창은 딸깍 뒤 저절로 장전
- 화면 가운데(카메라)에서 광선: 알마다 동물 판정 기둥이나 벽(Rapier 고정 충돌체)에 처음 닿는 것. 벽엔 총알 자국, 동물은 혼자일 때 바로 맞는다 (알마다 은지 피해)
- 은지 Effects 를 옮긴 궤적·자국·총구 불꽃 (불꽃은 빛 없이 Sprite 만, 빛 개수 그대로)
- 쏘는 동안 카메라 쪽을 보고 오른팔을 들어 겨눈다, 반동으로 고개가 든다
- 화면 가운데 조준선(퍼짐만큼 벌어지고 맞히면 ✕), 오른쪽 아래 탄창/예비·상태
- 총 상태(gunRig)는 performance.now() 시각이고 게임을 다시 열 때 지운다
EOF
```

검증한 스크래치 커밋: `9a36474` (이 커밋의 diff 를 그대로 적용해도 된다: `git -C /private/tmp/claude-501/-Users-ihyelin-proten-hrlee-----threejs/e476c70e-362f-4ed3-9ff7-d8664da04e4b/scratchpad/plan-3-4/repo format-patch -1 --binary 9a36474 --stdout | git apply --index` 한 뒤 위 커밋 명령. 스크래치 커밋의 작성자는 scratch 라 `git am` 은 쓰지 않는다)

### Task 5: 1인칭(V)과 조준·조준경  — 스크래치 `a98918a`

**Files:**
- Create: `public/meadow/models/crosshair/License.txt`, `public/meadow/models/crosshair/holo.svg`, `public/meadow/models/crosshair/scope.svg`, `src/game/logic/view.ts`, `src/game/scene/guns/FirstPersonView.tsx`, `src/game/scene/guns/viewModel.ts`, `src/game/ui/ScopeOverlay.tsx`
- Modify: `src/game/Game.tsx`, `src/game/data/guns.ts`, `src/game/guns/gunRig.ts`, `src/game/input/useInteractionKeys.ts`, `src/game/input/useWheelZoom.ts`, `src/game/logic/interaction.ts`, `src/game/scene/Player.tsx`, `src/game/scene/World.tsx`, `src/game/scene/guns/GunController.tsx`, `src/game/stores/sessionStore.ts`, `src/game/ui/GunHud.tsx`, `src/game/ui/Hud.tsx`
- Test: `src/game/logic/interaction.test.ts`, `src/game/logic/view.test.ts`, `src/game/stores/sessionStore.test.ts`

**Interfaces:**
- Consumes: Task 1 (`GUNS[*].zoom`·`aimFov`), Task 3 (`buildWeaponModel`), Task 4 (`gunRig`·`gunRig.aiming`·`muzzle`·`kick`), `Mode` (`logic/interaction`), `meleeRig`·`swingProgress` (3-3)
- Produces: `ViewMode = 'third' | 'first'`, `isFirstPerson(view, mode, scopeAim)`, `scopeFov(baseFov, mag)`, `aimFov(gun, optic, baseFov?)`, `stepZoom(index, steps, deltaY)` (`logic/view`); `AIM_VIEW`·`VIEW_MODEL` (`data/guns`); sessionStore `view`·`toggleView()`; `KeyAction` `{ type: 'toggleView' }` (V); `gunRig.zoomStep: Record<GunId, number>`·`optic: ZoomStep | null`·`viewKick`; `playerRig.firstPerson`; `buildViewModel(id)`·`viewModelRest(id, aiming, ud, out)`·`ViewTool` (`scene/guns/viewModel`); `<FirstPersonView />`·`<ScopeOverlay />`

- [ ] **Step 1: 실패하는 테스트 쓰기**

`src/game/logic/view.test.ts` (새 파일):

```ts
import { describe, expect, it } from 'vitest'
import { aimFov, isFirstPerson, scopeFov, stepZoom } from './view'

describe('1인칭·조준 카메라', () => {
  it('V 로 고른 1인칭은 탐험·패널에서만. 낚시·벤치·배·연출·잠은 3인칭', () => {
    expect(isFirstPerson('first', 'explore', false)).toBe(true)
    expect(isFirstPerson('first', 'bag', false)).toBe(true)
    for (const m of ['fishing', 'rest', 'boat', 'cutscene', 'sleep', 'wardrobe', 'aquariumView', 'lobby'] as const) expect(isFirstPerson('first', m, true)).toBe(false)
    expect(isFirstPerson('third', 'explore', false)).toBe(false)
  })
  it('3인칭에서 조준경 총으로 조준하면 그동안 1인칭 (은지 그대로)', () => {
    expect(isFirstPerson('third', 'explore', true)).toBe(true)
  })
  it('조준 FOV: 배율 조준경은 가운데가 mag 배, 그 밖엔 은지 aimFov 비율 (권총 50/60)', () => {
    expect(Math.tan((scopeFov(50, 4) * Math.PI) / 360)).toBeCloseTo(Math.tan((25 * Math.PI) / 180) / 4)
    expect(aimFov('pistol', null)).toBeCloseTo(41.67, 1)
    expect(aimFov('rifle', { label: '홀로', mag: 1 })).toBeCloseTo(37.5)
    expect(aimFov('sniper', { label: '8x', mag: 8 })).toBeCloseTo(scopeFov(50, 8))
  })
  it('휠: 위로 굴리면 더 크게, 아래로 굴리면 작게, 끝에서 멈춘다', () => {
    expect(stepZoom(0, 2, -100)).toBe(1)
    expect(stepZoom(1, 2, -100)).toBe(1)
    expect(stepZoom(1, 2, 100)).toBe(0)
    expect(stepZoom(0, 2, 100)).toBe(0)
    expect(stepZoom(0, 2, Number.NaN)).toBe(0)
  })
})
```

`src/game/stores/sessionStore.test.ts` (바꿀 곳, `git diff -U3`):

```diff
diff --git a/src/game/stores/sessionStore.test.ts b/src/game/stores/sessionStore.test.ts
--- a/src/game/stores/sessionStore.test.ts
+++ b/src/game/stores/sessionStore.test.ts
@@ -109,6 +109,18 @@ describe('도구 칸', () => {
   })
 })
 
+describe('시점 (V)', () => {
+  beforeEach(() => useSessionStore.getState().resetSession())
+
+  it('1인칭과 3인칭을 오가고, 판을 새로 시작하면 3인칭', () => {
+    expect(useSessionStore.getState().view).toBe('third')
+    useSessionStore.getState().toggleView()
+    expect(useSessionStore.getState().view).toBe('first')
+    useSessionStore.getState().resetSession()
+    expect(useSessionStore.getState().view).toBe('third')
+  })
+})
+
 describe('마을 상인 창', () => {
   beforeEach(() => useSessionStore.getState().resetSession())
```

`src/game/logic/interaction.test.ts` (바꿀 곳, `git diff -U3`):

```diff
diff --git a/src/game/logic/interaction.test.ts b/src/game/logic/interaction.test.ts
--- a/src/game/logic/interaction.test.ts
+++ b/src/game/logic/interaction.test.ts
@@ -149,6 +149,8 @@ describe('resolveKeyAction', () => {
     expect(resolveKeyAction('KeyR', 'explore', null)).toEqual({ type: 'reload' })
     expect(resolveKeyAction('KeyR', 'fishing', null)).toEqual({ type: 'none' })
     expect(resolveKeyAction('KeyR', 'bag', null)).toEqual({ type: 'none' })
+    expect(resolveKeyAction('KeyV', 'explore', null)).toEqual({ type: 'toggleView' })
+    expect(resolveKeyAction('KeyV', 'fishing', null)).toEqual({ type: 'none' })
     // 낚시 중 숫자는 그대로 미끼, 패널에선 무시
     expect(resolveKeyAction('Digit2', 'fishing', null)).toEqual({ type: 'selectBait', bait: 'shrimp' })
     expect(resolveKeyAction('KeyX', 'fishing', null)).toEqual({ type: 'none' })
```

- [ ] **Step 2: 실행해 실패 확인**

Run: `npx vitest run src/game/logic/view.test.ts src/game/stores/sessionStore.test.ts src/game/logic/interaction.test.ts`
Expected: FAIL — `Failed to resolve import "./view"`, `view` undefined, `KeyV` 가 `none`

- [ ] **Step 3: 시점·조준 규칙**

`src/game/data/guns.ts` (바꿀 곳, `git diff -U3`):

```diff
diff --git a/src/game/data/guns.ts b/src/game/data/guns.ts
--- a/src/game/data/guns.ts
+++ b/src/game/data/guns.ts
@@ -71,3 +71,23 @@ export const PEER_HIT = { radius: 0.32, length: 1.3 }
 
 /** 동물 몸 판정 기둥 높이 (m) = 모델 배율 × 1.5, 아주 작은 동물도 0.4 (반지름은 data/animals hitRadius) */
 export const ANIMAL_HIT_HEIGHT = { perScale: 1.5, min: 0.4 }
+
+/**
+ * 조준·1인칭 카메라 (은지 cameraRig·weapons.js). baseFov: 우리 카메라 FOV (은지는 60 이라 은지 aimFov 는 이 비율로 줄인다),
+ * aimDistance·shoulder: 3인칭 조준 때 카메라 거리 상한과 오른쪽 어깨 너머로 비키는 거리, fovSpeed: FOV 가 따라가는 빠르기,
+ * firstPitch: 1인칭에서 위아래로 볼 수 있는 한계 (rad)
+ */
+export const AIM_VIEW = { baseFov: 50, eunjiBaseFov: 60, aimDistance: 1.9, shoulder: 0.65, fovSpeed: 14, firstPitch: 1.3 }
+
+/**
+ * 1인칭 무기 자리 (카메라 기준, 은지 _hip·_knifePos·_fistsPos). 조준하면 가늠쇠(sight)가 화면 가운데 오도록 옮긴다.
+ * kick: 쏠 때 뒤로 밀리는 거리, kickDecay: 되돌아오는 빠르기, follow: 자리를 따라가는 빠르기
+ */
+export const VIEW_MODEL = {
+  hip: [0.2, -0.17, -0.42] as [number, number, number],
+  knife: [0.18, -0.16, -0.3] as [number, number, number],
+  fists: [0, -0.2, -0.38] as [number, number, number],
+  kick: 0.04,
+  kickDecay: 14,
+  follow: 12,
+}
```

`src/game/logic/view.ts` (새 파일):

```ts
import { AIM_VIEW, GUNS, type GunId, type ZoomStep } from '../data/guns'
import type { Mode } from './interaction'

/** 카메라 시점: 3인칭(지금처럼) / 1인칭 (V) */
export type ViewMode = 'third' | 'first'

/**
 * 1인칭으로 볼 수 있는 화면. 낚시·벤치·배·연출·잠·꾸미기·어항 크게 보기·로비는 늘 3인칭 (몸이 보여야 하거나 카메라가 따로 움직인다).
 * 새 Mode 를 더하면 여기서도 정해야 한다 (Record 라 빠뜨리면 타입 오류)
 */
const FIRST_PERSON_OK: Record<Mode, boolean> = {
  explore: true,
  map: true,
  menu: true,
  bag: true,
  vendor: true,
  emote: true,
  sell: true,
  shop: true,
  dex: true,
  market: true,
  aquarium: true,
  unlock: true,
  fishing: false,
  rest: false,
  boat: false,
  cutscene: false,
  sleep: false,
  wardrobe: false,
  aquariumView: false,
  lobby: false,
}

/** 지금 1인칭으로 그리나: V 로 1인칭을 골랐거나, 조준경 총(소총·저격총)으로 조준하는 동안 (은지: 3인칭에서 조준하면 그동안 1인칭) */
export function isFirstPerson(view: ViewMode, mode: Mode, scopeAim: boolean): boolean {
  return FIRST_PERSON_OK[mode] && (view === 'first' || scopeAim)
}

/** 배율 mag 조준경의 FOV (도): 화면 가운데가 mag 배로 커 보인다 */
export function scopeFov(baseFov: number, mag: number): number {
  return (2 * Math.atan(Math.tan((baseFov * Math.PI) / 360) / mag) * 180) / Math.PI
}

/** 조준할 때 FOV (도): 배율 조준경(2.5x·4x·8x)이면 그만큼, 아니면 은지 aimFov 를 우리 FOV 비율로 (권총 50/60 → 41.7) */
export function aimFov(gun: GunId, optic: ZoomStep | null, baseFov = AIM_VIEW.baseFov): number {
  if (optic && optic.mag > 1) return scopeFov(baseFov, optic.mag)
  return (baseFov * GUNS[gun].aimFov) / AIM_VIEW.eunjiBaseFov
}

/** 휠로 배율 단계 바꾸기: 위로(deltaY < 0) 굴리면 다음(더 크게), 아래로 굴리면 이전. 끝에서 멈춘다 */
export function stepZoom(index: number, steps: number, deltaY: number): number {
  if (!(steps > 0) || !Number.isFinite(deltaY) || deltaY === 0) return index
  return Math.min(steps - 1, Math.max(0, index + (deltaY < 0 ? 1 : -1)))
}
```

`src/game/stores/sessionStore.ts` (바꿀 곳, `git diff -U3`):

```diff
diff --git a/src/game/stores/sessionStore.ts b/src/game/stores/sessionStore.ts
--- a/src/game/stores/sessionStore.ts
+++ b/src/game/stores/sessionStore.ts
@@ -9,6 +9,7 @@ import type { BoatDir } from '../logic/boatRoute'
 import { nextZoom, pinchZoom } from '../logic/cameraZoom'
 import { isSameInteractable, type Interactable, type Mode } from '../logic/interaction'
 import { IDLE_ACTION, type PlayerAction } from '../logic/playerMotion'
+import type { ViewMode } from '../logic/view'
 
 type SessionState = {
   mode: Mode
@@ -62,6 +63,9 @@ type SessionState = {
   /** 마지막에 든 총 (폰 도구 칸의 총 한 칸). 저장하지 않는다 */
   lastGun: GunId
   equip: (tool: ToolId | null) => void
+  /** 카메라 시점 (V: 1인칭/3인칭). 저장하지 않는다 */
+  view: ViewMode
+  toggleView: () => void
   /** 마지막으로 맞은 때 (performance.now() 초. 화면 가장자리가 빨갛게 번쩍인다, ui/HurtFlash). 저장하지 않는다 */
   hurtAt: number | null
   flashHurt: () => void
@@ -111,6 +115,8 @@ export const useSessionStore = create<SessionState>((set, get) => ({
   tool: 'rod',
   lastGun: 'pistol',
   equip: (tool) => set(isGun(tool) ? { tool, lastGun: tool } : { tool }),
+  view: 'third',
+  toggleView: () => set((s) => ({ view: s.view === 'first' ? 'third' : 'first' })),
   hurtAt: null,
   flashHurt: () => set({ hurtAt: performance.now() / 1000 }),
   setPlayerAction: (playerAction) => set({ playerAction }),
@@ -127,5 +133,5 @@ export const useSessionStore = create<SessionState>((set, get) => ({
   // 순간이동(쓰러져 진료소로 등)하면 타던 배에서 내린다
   requestTeleport: (pos) => set((s) => ({ teleport: pos, boat: null, mode: s.mode === 'boat' ? 'explore' : s.mode })),
   clearTeleport: () => set({ teleport: null }),
-  resetSession: () => set({ mode: 'explore', nearby: null, notice: null, teleport: null, zoom: CAMERA_ZOOM.initial, playerAction: IDLE_ACTION, cutscene: null, cooking: null, boat: null, tool: 'rod', lastGun: 'pistol', stoveCook: null, vendor: null, hurtAt: null }),
+  resetSession: () => set({ mode: 'explore', nearby: null, notice: null, teleport: null, zoom: CAMERA_ZOOM.initial, playerAction: IDLE_ACTION, cutscene: null, cooking: null, boat: null, tool: 'rod', lastGun: 'pistol', stoveCook: null, vendor: null, hurtAt: null, view: 'third' }),
 }))
```

`src/game/logic/interaction.ts` (바꿀 곳, `git diff -U3`):

```diff
diff --git a/src/game/logic/interaction.ts b/src/game/logic/interaction.ts
--- a/src/game/logic/interaction.ts
+++ b/src/game/logic/interaction.ts
@@ -90,6 +90,8 @@ export type KeyAction =
   | { type: 'eatBest' }
   /** R: 든 총 장전 */
   | { type: 'reload' }
+  /** V: 1인칭 / 3인칭 */
+  | { type: 'toggleView' }
   /** 버섯·호박 따기 */
   | { type: 'harvest'; index: number }
   /** 문 열기/닫기 */
@@ -132,6 +134,7 @@ export function resolveKeyAction(code: string, mode: Mode, nearby: Interactable
     if (code === 'KeyX') return { type: 'equip', tool: null }
     if (code === 'KeyF') return { type: 'eatBest' }
     if (code === 'KeyR') return { type: 'reload' }
+    if (code === 'KeyV') return { type: 'toggleView' }
     if (code === 'KeyI') return { type: 'openMode', mode: 'bag' }
   }
   // 가방은 I 로도 닫는다
```

`src/game/input/useInteractionKeys.ts` (바꿀 곳, `git diff -U3`):

```diff
diff --git a/src/game/input/useInteractionKeys.ts b/src/game/input/useInteractionKeys.ts
--- a/src/game/input/useInteractionKeys.ts
+++ b/src/game/input/useInteractionKeys.ts
@@ -91,6 +91,9 @@ export function runKeyAction(code: string): boolean {
     case 'reload':
       pressReload()
       break
+    case 'toggleView':
+      session.toggleView()
+      break
     case 'toggleMap':
       if (session.mode === 'map') session.closeMap()
       else session.openMap()
```

`src/game/input/useWheelZoom.ts` — 조준 중 소총·저격총은 배율 (바꿀 곳, `git diff -U3`):

```diff
diff --git a/src/game/input/useWheelZoom.ts b/src/game/input/useWheelZoom.ts
--- a/src/game/input/useWheelZoom.ts
+++ b/src/game/input/useWheelZoom.ts
@@ -1,8 +1,14 @@
 import { useEffect, type RefObject } from 'react'
+import { GUNS } from '../data/guns'
+import { gunRig } from '../guns/gunRig'
 import { canZoom } from '../logic/cameraZoom'
+import { stepZoom } from '../logic/view'
 import { useSessionStore } from '../stores/sessionStore'
 
-/** 캔버스 위 마우스 휠 → 카메라 줌. 페이지가 같이 스크롤되지 않게 기본 동작을 막는다 (passive: false 필요) */
+/**
+ * 캔버스 위 마우스 휠 → 카메라 줌. 소총·저격총으로 조준하는 동안엔 조준경 배율 단계 (은지는 우클릭 두 번).
+ * 페이지가 같이 스크롤되지 않게 기본 동작을 막는다 (passive: false 필요)
+ */
 export function useWheelZoom(target: RefObject<HTMLElement | null>) {
   useEffect(() => {
     const el = target.current
@@ -11,7 +17,10 @@ export function useWheelZoom(target: RefObject<HTMLElement | null>) {
       const session = useSessionStore.getState()
       if (!canZoom(session.mode)) return
       e.preventDefault()
-      session.zoomBy(e.deltaY)
+      const gun = gunRig.aiming ? gunRig.gun : null
+      const zoom = gun && GUNS[gun].zoom
+      if (gun && zoom) gunRig.zoomStep[gun] = stepZoom(gunRig.zoomStep[gun], zoom.length, e.deltaY)
+      else session.zoomBy(e.deltaY)
     }
     el.addEventListener('wheel', onWheel, { passive: false })
     return () => el.removeEventListener('wheel', onWheel)
```

`src/game/guns/gunRig.ts` (바꿀 곳, `git diff -U3`):

```diff
diff --git a/src/game/guns/gunRig.ts b/src/game/guns/gunRig.ts
--- a/src/game/guns/gunRig.ts
+++ b/src/game/guns/gunRig.ts
@@ -1,5 +1,5 @@
 import { Vector3 } from 'three'
-import type { GunId } from '../data/guns'
+import { GUN_IDS, type GunId, type ZoomStep } from '../data/guns'
 import { GUN_IDLE, type GunState } from '../logic/gun'
 import type { V3 } from '../logic/hitscan'
 
@@ -12,8 +12,20 @@ export type LastShot = { o: V3; d: V3; hit: 'animal' | 'peer' | 'target' | 'wall
  * - gun: 손에 든 총 (없으면 null), aiming: 조준 중
  * - kick: Player 가 카메라 기울기에서 가져갈 반동 (rad), muzzle: 총구 자리 (Player 가 손의 총에서 적는다, 없으면 null)
  * - hitAt·hitText: 명중 표시 (조준선에 잠깐), lastShot: 마지막 한 발
+ * - zoomStep: 총마다 고른 조준경 배율 단계 (휠), optic: 지금 조준경으로 보는 단계 (조준 중인 소총·저격총), viewKick: 1인칭 총이 뒤로 밀린 거리
  */
-export const gunRig: GunState & { gun: GunId | null; aiming: boolean; kick: number; muzzle: Vector3 | null; hitAt: number; hitText: string; lastShot: LastShot | null } = {
+export const gunRig: GunState & {
+  gun: GunId | null
+  aiming: boolean
+  kick: number
+  muzzle: Vector3 | null
+  hitAt: number
+  hitText: string
+  lastShot: LastShot | null
+  zoomStep: Record<GunId, number>
+  optic: ZoomStep | null
+  viewKick: number
+} = {
   ...GUN_IDLE,
   gun: null,
   aiming: false,
@@ -22,11 +34,18 @@ export const gunRig: GunState & { gun: GunId | null; aiming: boolean; kick: numb
   hitAt: -Infinity,
   hitText: '',
   lastShot: null,
+  zoomStep: noSteps(),
+  optic: null,
+  viewKick: 0,
+}
+
+function noSteps(): Record<GunId, number> {
+  return Object.fromEntries(GUN_IDS.map((id) => [id, 0])) as Record<GunId, number>
 }
 
 /** 판을 새로 시작할 때 (Game 을 다시 열면 모듈 값이 남아 있다) */
 export function resetGunRig() {
-  Object.assign(gunRig, GUN_IDLE, { gun: null, aiming: false, kick: 0, muzzle: null, hitAt: -Infinity, hitText: '', lastShot: null })
+  Object.assign(gunRig, GUN_IDLE, { gun: null, aiming: false, kick: 0, muzzle: null, hitAt: -Infinity, hitText: '', lastShot: null, zoomStep: noSteps(), optic: null, viewKick: 0 })
 }
 
 /** Player 가 반동을 가져간다 */
```

`src/game/scene/guns/GunController.tsx` — optic·조준경 반동·1인칭 반동 (바꿀 곳, `git diff -U3`):

```diff
diff --git a/src/game/scene/guns/GunController.tsx b/src/game/scene/guns/GunController.tsx
--- a/src/game/scene/guns/GunController.tsx
+++ b/src/game/scene/guns/GunController.tsx
@@ -3,7 +3,7 @@ import { useFrame, useThree } from '@react-three/fiber'
 import { useRapier } from '@react-three/rapier'
 import { Vector3 } from 'three'
 import { weaponSfx } from '../../audio/weaponSfx'
-import { GUNS, GUN_RANGE, isGun, type GunId } from '../../data/guns'
+import { GUNS, GUN_RANGE, VIEW_MODEL, isGun, type GunId } from '../../data/guns'
 import { gunFx } from '../../guns/gunFx'
 import { gunRig, markHit, type LastShot } from '../../guns/gunRig'
 import { animalViews } from '../../hunt/animalRig'
@@ -91,7 +91,8 @@ export function GunController() {
     if (struck.length) markHit(now)
     gunFx.flash(muzzle)
     weaponSfx.shot(gun)
-    gunRig.kick += recoilOf(gun, gunRig.aiming, false)
+    gunRig.kick += recoilOf(gun, gunRig.aiming, (gunRig.optic?.mag ?? 1) > 1)
+    gunRig.viewKick = VIEW_MODEL.kick
   }
 
   useFrame(() => {
@@ -108,12 +109,16 @@ export function GunController() {
     const reloadKey = takeReloadPress()
     if (!gun) {
       gunRig.aiming = false
+      gunRig.optic = null
       return
     }
     // 총을 들었을 때만 누른 것을 가져간다 (아니면 MeleeController 가 휘두르기로 가져간다)
     const press = takeAttackPress()
     const ready = canShoot()
     gunRig.aiming = ready && isAimHeld()
+    // 조준 중인 소총·저격총은 고른 배율로 조준경을 본다 (휠로 바꾼다)
+    const zoom = GUNS[gun].zoom
+    gunRig.optic = gunRig.aiming && zoom ? zoom[gunRig.zoomStep[gun]] : null
     if (!ready) return
     if (reloadKey) tryReload(gun, now, true)
     const want = GUNS[gun].auto ? isTriggerHeld() || press === 'primary' : press === 'primary'
```

- [ ] **Step 4: 카메라 (Player): 1인칭·어깨 너머·FOV·감도**

FOV 와 카메라 자리는 `useFrame` 인자 카메라로 바꾼다 (hook 이 준 `camera` 를 고치면 oxlint `immutability` 경고).

`src/game/scene/Player.tsx` (바꿀 곳, `git diff -U3`):

```diff
diff --git a/src/game/scene/Player.tsx b/src/game/scene/Player.tsx
--- a/src/game/scene/Player.tsx
+++ b/src/game/scene/Player.tsx
@@ -1,9 +1,10 @@
 import { useEffect, useRef, useState } from 'react'
 import { useFrame, useThree } from '@react-three/fiber'
 import { CapsuleCollider, RigidBody, useRapier, type RapierRigidBody } from '@react-three/rapier'
-import { Vector3, type Group, type Object3D } from 'three'
+import { Vector3, type Group, type Object3D, type PerspectiveCamera } from 'three'
 import { CAMERA_ZOOM, MOVE, PLAYER_BODY } from '../data/balance'
-import { isGun } from '../data/guns'
+import { AIM_VIEW, isGun } from '../data/guns'
+import { aimFov, isFirstPerson } from '../logic/view'
 import { CHARACTER_BASE_HEIGHT } from '../data/characters'
 import { COOK_SCENE } from '../data/cooking'
 import { REPAIR_PLANS, type RepairPlan } from '../data/repair'
@@ -61,8 +62,13 @@ export const playerRig = {
   yaw: 0,
   /** 발바닥에서 눈까지 (m, 키에 따라. 총 광선이 카메라 ~ 눈 사이를 건너뛴다) */
   eyeHeight: 1.66,
+  /** 지금 1인칭으로 그린다 (scene/guns/FirstPersonView 가 무기를 카메라에 붙인다) */
+  firstPerson: false,
 }
 
+/** 마우스·드래그 감도 배율: 조준해서 FOV 가 좁을수록 천천히 (은지 sensFov) */
+const fovScale = (camera: unknown) => ((camera as PerspectiveCamera).fov ?? AIM_VIEW.baseFov) / AIM_VIEW.baseFov
+
 /** 낚시 시작 시 카메라가 물 쪽으로 돌아가는 속도 */
 const FISHING_YAW_SPEED = 4
 /** 서 있던 자리를 저장하는 간격(초) */
@@ -183,6 +189,8 @@ export function Player() {
   const look = useProgressStore((s) => s.look) ?? DEFAULT_LOOK
   /** 총을 겨눈 정도 (0 내림 ~ 1 겨눔) */
   const gunRaise = useRef(0)
+  /** 3인칭 조준 때 카메라를 오른쪽 어깨 너머로 비킨 거리 */
+  const shoulder = useRef(0)
   /** 먹고 있는 요리 (손에 든 음식과 "아구작 냠냠") */
   const eating = useSessionStore((s) => s.playerAction.eat)
   const food = useRef<Group>(null)
@@ -194,13 +202,14 @@ export function Player() {
       const mode = useSessionStore.getState().mode
       if ((mode !== 'explore' && mode !== 'rest' && mode !== 'boat') || !isPointerLocked()) return
       const { lookSensitivity, invertY } = useSettingsStore.getState()
-      const next = applyMouseLook({ yaw: yaw.current, pitch: pitch.current }, e.movementX, e.movementY, lookSensitivity, invertY)
+      // 조준경으로 당겨 보면 그만큼 천천히 돈다 (은지 sensFov)
+      const next = applyMouseLook({ yaw: yaw.current, pitch: pitch.current }, e.movementX, e.movementY, lookSensitivity * fovScale(camera), invertY)
       yaw.current = next.yaw
       pitch.current = next.pitch
     }
     window.addEventListener('pointermove', onMove)
     return () => window.removeEventListener('pointermove', onMove)
-  }, [])
+  }, [camera])
 
   /**
    * 지금 자리 (저장용). 몸의 실제 상태로 정한다: 배 위(키네마틱)·순간이동 직전·바다 위면 없다.
@@ -229,7 +238,7 @@ export function Player() {
     }
   }, [])
 
-  useFrame(({ clock }, delta) => {
+  useFrame(({ clock, camera: frameCamera }, delta) => {
     // 서 있던 자리는 1초에 한 번, 움직였을 때만 저장한다
     if (clock.elapsedTime - saved.current.at > PLACE_SAVE_EVERY) {
       saved.current.at = clock.elapsedTime
@@ -307,7 +316,7 @@ export function Player() {
     // 0-1) 캔버스 드래그(잠금 없는 마우스·한 손가락)로 좌우로 돌리고 위아래로 기울인다. 탐험·쉬기·배 타기가 아닐 때 끈 건 버린다
     const drag = takeDrag()
     if ((mode === 'explore' || mode === 'rest' || mode === 'boat') && !isPointerLocked() && (drag.dx !== 0 || drag.dy !== 0)) {
-      const next = applyMouseLook({ yaw: yaw.current, pitch: pitch.current }, drag.dx, drag.dy, MOUSE_LOOK.dragSensitivity, useSettingsStore.getState().invertY)
+      const next = applyMouseLook({ yaw: yaw.current, pitch: pitch.current }, drag.dx, drag.dy, MOUSE_LOOK.dragSensitivity * fovScale(camera), useSettingsStore.getState().invertY)
       yaw.current = next.yaw
       pitch.current = next.pitch
     }
@@ -382,6 +391,9 @@ export function Player() {
 
     // 3) 바라보는 방향: 낚시 중엔 물 쪽, 아니면 이동 방향
     const gunUp = mode === 'explore' && isGun(session.tool) && gunRig.gun === session.tool && (gunRig.aiming || performance.now() / 1000 - gunRig.firedAt < GUN_HOLD)
+    // 1인칭 (V, 또는 조준경 총으로 조준하는 동안): 내 몸을 숨기고 카메라를 눈높이에, 몸은 보는 쪽을 본다
+    const firstView = isFirstPerson(session.view, mode, gunRig.optic !== null)
+    playerRig.firstPerson = firstView
     if (boatAt) {
       facing.current = boatAt.heading
     } else if (mode === 'fishing' && spot) {
@@ -399,7 +411,7 @@ export function Player() {
     } else if (mode === 'explore' && swingProgress(meleeRig.swing, now) >= 0) {
       // 휘두르는 동안엔 휘두른 쪽(그때 카메라가 보던 쪽)을 본다
       facing.current = meleeRig.yaw + Math.PI
-    } else if (gunUp) {
+    } else if (gunUp || (firstView && mode === 'explore')) {
       // 총을 겨누는 동안(조준·막 쏨)엔 카메라가 보는 쪽 (총알이 나가는 쪽)
       facing.current = yaw.current + Math.PI
     } else if (moveDir.lengthSq() > 0) {
@@ -410,7 +422,10 @@ export function Player() {
     if (shouldFaceCamera(mode, session.zoom, now - movedAt.current, action)) {
       facing.current += shortestAngleDelta(facing.current, yaw.current) * (1 - Math.exp(-delta * CAMERA_ZOOM.faceTurnSpeed))
     }
-    if (visual.current) visual.current.rotation.y = facing.current
+    if (visual.current) {
+      visual.current.rotation.y = facing.current
+      visual.current.visible = !firstView
+    }
     if (boatRef.current) boatRef.current.visible = boatAt !== null
     playerRig.facing = facing.current
     playerRig.yaw = yaw.current
@@ -468,9 +483,28 @@ export function Player() {
     }
     rodTip.current?.getWorldPosition(playerRig.rodTip)
 
+    // 5-1) 조준하면 FOV 를 좁힌다 (배율 조준경은 그 배율만큼). 놓으면 돌아온다
+    const fovTo = gunRig.aiming && gunRig.gun ? aimFov(gunRig.gun, gunRig.optic) : AIM_VIEW.baseFov
+    const lens = frameCamera as PerspectiveCamera
+    if (Math.abs(lens.fov - fovTo) > 0.01) {
+      lens.fov += (fovTo - lens.fov) * Math.min(1, delta * AIM_VIEW.fovSpeed)
+      lens.updateProjectionMatrix()
+    }
+
+    // 5-2) 1인칭: 눈높이에서 보는 쪽을 본다 (기울기가 클수록 내려다본다. 3인칭과 같은 손맛)
+    if (firstView) {
+      const e = Math.max(-AIM_VIEW.firstPitch, Math.min(AIM_VIEW.firstPitch, -pitch.current))
+      camera.position.set(x, y + FOOT_Y + playerRig.eyeHeight, z)
+      lookTarget.set(x - sin * Math.cos(e), camera.position.y + Math.sin(e), z - cos * Math.cos(e))
+      camera.lookAt(lookTarget)
+      return
+    }
+
     // 6) 3인칭 카메라: 가까이 당길수록 얼굴 높이로 내려와 얼굴을 본다.
-    //    수평 위치는 플레이어에 바로 붙이고, 오프셋(방향·거리·높이)·발 높이(점프)만 부드럽게 따라간다
-    const distance = session.zoom
+    //    수평 위치는 플레이어에 바로 붙이고, 오프셋(방향·거리·높이)·발 높이(점프)만 부드럽게 따라간다.
+    //    총으로 조준하면 가까이(1.9m) 당기고 오른쪽 어깨 너머로 비킨다 (은지 AIM_DIST·SHOULDER)
+    const aimCam = mode === 'explore' && gunRig.aiming && isGun(session.tool)
+    const distance = aimCam ? Math.min(session.zoom, AIM_VIEW.aimDistance) : session.zoom
     const rig = cameraRig(distance, CHARACTER_BASE_HEIGHT * look.height)
     const orbit = pitchedOffset(distance, rig.height, rig.lookAtY, pitch.current)
     cameraTarget.set(sin * orbit.horizontal, orbit.height, cos * orbit.horizontal)
@@ -482,6 +516,14 @@ export function Player() {
     c.feetY += (y + FOOT_Y - c.feetY) * k
     camera.position.set(x + c.offset.x, c.feetY + c.offset.y, z + c.offset.z)
     lookTarget.set(x, c.feetY + c.lookY, z)
+    shoulder.current += (Number(aimCam) * AIM_VIEW.shoulder - shoulder.current) * k
+    if (shoulder.current > 1e-3) {
+      const sx = cos * shoulder.current
+      const sz = -sin * shoulder.current
+      camera.position.set(camera.position.x + sx, camera.position.y, camera.position.z + sz)
+      lookTarget.x += sx
+      lookTarget.z += sz
+    }
 
     // 6-1) 초원(은지 집·마을)에선 카메라가 천장·벽을 뚫지 않게: 실내면 천장 아래로 낮추고,
     //      시선점에서 카메라 쪽 광선이 고정 충돌체(벽·건물)에 닿으면 그 앞으로 당긴다 (내 몸·감지 상자는 빼고)
```

- [ ] **Step 5: 1인칭 무기·조준경 화면**

조준경 그림은 은지가 쓴 Kenney Crosshair Pack (CC0):

```bash
mkdir -p public/meadow/models/crosshair
cp /private/tmp/claude-501/-Users-ihyelin-proten-hrlee-----threejs/e476c70e-362f-4ed3-9ff7-d8664da04e4b/scratchpad/eunji/repo2/public/models/crosshair/{scope.svg,holo.svg,License.txt} public/meadow/models/crosshair/
```

`src/game/scene/guns/viewModel.ts` (새 파일):

```ts
import { Vector3, type Group, type Mesh } from 'three'
import { buildWeaponModel } from '../../../meadow/vendor/weapons.js'
import { VIEW_MODEL } from '../../data/guns'
import type { ToolId } from '../../data/tools'

/** 1인칭에 붙이는 무기 (주먹은 은지 맨손 모델). 낚싯대·빈손은 없다 */
export type ViewTool = Exclude<ToolId, 'rod'>

/** 1인칭 무기 모델 (은지 buildView): 그림자 없이, 벽에 파묻혀도 위에 그린다 */
export function buildViewModel(id: ViewTool): Group {
  const g = buildWeaponModel(id, { shadows: false })
  g.traverse((o) => {
    o.frustumCulled = false
    if ((o as Mesh).isMesh) o.renderOrder = 10
  })
  return g
}

/**
 * 카메라 기준 무기 자리 (은지 animateView). 총은 허리 → 조준하면 가늠쇠(sight)가 화면 가운데 (눈 앞 eyeDist), 칼·주먹은 제자리
 */
export function viewModelRest(id: ViewTool, aiming: boolean, ud: { sight?: Vector3; eyeDist?: number }, out: Vector3): Vector3 {
  if (id === 'fists') return out.fromArray(VIEW_MODEL.fists)
  if (id === 'knife') return out.fromArray(VIEW_MODEL.knife)
  if (aiming && ud.sight && ud.eyeDist !== undefined) return out.set(-ud.sight.x, -ud.sight.y, -ud.eyeDist - ud.sight.z)
  return out.fromArray(VIEW_MODEL.hip)
}
```

`src/game/scene/guns/FirstPersonView.tsx` (새 파일):

```tsx
import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Vector3, type Group, type Material, type Mesh, type Object3D } from 'three'
import { VIEW_MODEL, isGun } from '../../data/guns'
import { gunRig } from '../../guns/gunRig'
import { meleeRig } from '../../hunt/meleeRig'
import { swingProgress } from '../../logic/melee'
import { useSessionStore } from '../../stores/sessionStore'
import { playerRig } from '../Player'
import { buildViewModel, viewModelRest, type ViewTool } from './viewModel'

const rest = new Vector3()
/** 무기가 따라가는 자리 (반동·휘두르기는 그 위에 더한다) */
const base = new Vector3()
const muzzleAt = new Vector3()

/**
 * 1인칭일 때 든 무기를 카메라에 붙여 그린다 (은지 view). 총은 조준하면 가늠쇠가 화면 가운데로 오고, 쏘면 뒤로 밀렸다 돌아온다.
 * 칼·주먹은 휘두르는 동안 앞으로 뻗는다. 소총·저격총 조준경으로 보는 동안은 숨긴다 (ui/ScopeOverlay 가 십자선·둥근 화면을 그린다).
 * Player 다음에 그려서 이번 프레임 카메라 자리를 쓴다. 총구 자리를 쏘기(궤적·불꽃)에 알려 준다
 */
export function FirstPersonView() {
  const tool = useSessionStore((s) => s.tool)
  const id: ViewTool | null = tool === 'fists' || tool === 'knife' || isGun(tool) ? tool : null
  const model = useMemo(() => (id ? buildViewModel(id) : null), [id])
  const root = useRef<Group>(null)

  useEffect(
    () => () => {
      model?.traverse((o) => {
        const m = o as Mesh
        if (!m.isMesh) return
        m.geometry.dispose()
        for (const mat of ([] as Material[]).concat(m.material)) mat.dispose()
      })
    },
    [model],
  )

  useFrame(({ camera, clock }, delta) => {
    const r = root.current
    const m = r?.children[0]
    if (!r) return
    gunRig.viewKick *= Math.exp(-delta * VIEW_MODEL.kickDecay)
    // 조준경(홀로 포함)으로 보는 동안은 무기를 치우고 ui/ScopeOverlay 의 십자선만 본다
    r.visible = playerRig.firstPerson && !!m && !!id && !gunRig.optic
    if (!r.visible || !m || !id) return
    r.position.copy(camera.position)
    r.quaternion.copy(camera.quaternion)
    viewModelRest(id, gunRig.aiming, m.userData, rest)
    base.lerp(rest, Math.min(1, delta * VIEW_MODEL.follow))
    m.position.copy(base)
    const swing = swingProgress(meleeRig.swing, clock.elapsedTime)
    const reach = swing >= 0 ? Math.sin(Math.PI * swing) : 0
    if (id === 'fists') {
      // 치는 오른 주먹이 가운데로 모이며 앞으로 뻗었다 돌아온다
      const right = m.userData.right as Object3D | undefined
      right?.position.set(0.16 - 0.1 * reach, 0.03 * reach, -0.3 * reach)
    } else if (id === 'knife') {
      m.position.z -= 0.3 * reach
      m.rotation.set(-0.3 * reach, 0.4 * reach, -1.2 * reach)
    } else {
      m.position.z += gunRig.viewKick
      m.rotation.set((0.25 * gunRig.viewKick) / VIEW_MODEL.kick, 0, 0)
      const muzzle = m.userData.muzzle as Object3D | undefined
      if (muzzle) gunRig.muzzle = muzzle.getWorldPosition(muzzleAt)
    }
  })

  return <group ref={root}>{model && <primitive object={model} />}</group>
}
```

`src/game/ui/ScopeOverlay.tsx` — 바깥을 덮는 판은 #000 대신 #0a0a0a (헤드리스 swiftshader 가 완전 검정 판을 그리지 않았다), 구멍은 mask 로 (새 파일):

```tsx
import { useEffect, useState, type CSSProperties } from 'react'
import { gunRig } from '../guns/gunRig'
import { playerRig } from '../scene/Player'

const svg = (name: string) => `url(${import.meta.env.BASE_URL}meadow/models/crosshair/${name}.svg)`
/** 조준경 구멍 반지름 (화면 짧은 변 대비) */
const LENS = '44vmin'

/** 가운데 둥근 구멍만 비운 가림막 */
const lensHole = `radial-gradient(circle at center, transparent ${LENS}, #fff calc(${LENS} + 1px))`

type Optic = { kind: 'scope' | 'holo'; label: string } | null

/**
 * 소총·저격총으로 조준하는 동안 (1인칭): 배율 단계(2.5x·4x·8x)면 둥근 조준경 화면 + 십자선 (Kenney Crosshair Pack, CC0),
 * 소총 홀로(1x)면 화면 가운데 빨간 고리. 은지는 렌즈에 확대 화면을 따로 그렸지만 우리는 FOV 를 좁히고 화면을 덮는다 (한 번만 그린다)
 */
export function ScopeOverlay() {
  const [optic, setOptic] = useState<Optic>(null)
  useEffect(() => {
    let raf = 0
    const tick = () => {
      raf = requestAnimationFrame(tick)
      const o = gunRig.optic && playerRig.firstPerson ? gunRig.optic : null
      const next: Optic = o ? { kind: o.mag > 1 ? 'scope' : 'holo', label: o.label } : null
      setOptic((prev) => (prev?.kind === next?.kind && prev?.label === next?.label ? prev : next))
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [])
  if (!optic) return null
  return (
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 998 }} aria-label={`조준경 ${optic.label}`}>
      {optic.kind === 'scope' ? (
        <>
          {/* 둥근 구멍 바깥을 까맣게 덮는다 */}
          <div style={{ position: 'absolute', inset: 0, background: '#0a0a0a', mask: lensHole, WebkitMask: lensHole }} />
          <div style={{ ...centered, width: `calc(2 * ${LENS})`, height: `calc(2 * ${LENS})`, background: 'rgba(0,0,0,0.92)', mask: `${svg('scope')} center / contain no-repeat`, WebkitMask: `${svg('scope')} center / contain no-repeat` }} />
          <div style={{ ...centered, width: 6, height: 6, borderRadius: '50%', background: 'rgba(200,0,0,0.9)' }} />
        </>
      ) : (
        <div style={{ ...centered, width: 96, height: 96, background: '#ff4040', filter: 'drop-shadow(0 0 4px rgba(255,70,70,1))', mask: `${svg('holo')} center / contain no-repeat`, WebkitMask: `${svg('holo')} center / contain no-repeat` }} />
      )}
      <div style={{ position: 'absolute', left: '50%', bottom: '12%', transform: 'translateX(-50%)', color: '#fff', fontSize: 14, textShadow: '0 1px 2px #000' }}>배율 {optic.label} · 휠로 바꾸기</div>
    </div>
  )
}

const centered: CSSProperties = { position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%, -50%)' }
```

`src/game/ui/GunHud.tsx` (바꿀 곳, `git diff -U3`):

```diff
diff --git a/src/game/ui/GunHud.tsx b/src/game/ui/GunHud.tsx
--- a/src/game/ui/GunHud.tsx
+++ b/src/game/ui/GunHud.tsx
@@ -1,6 +1,7 @@
 import { useEffect, useRef, useState, type CSSProperties } from 'react'
 import { GUNS, isGun } from '../data/guns'
 import { gunRig } from '../guns/gunRig'
+import { playerRig } from '../scene/Player'
 import { useTouchUi } from '../input/touchDevice'
 import { heatNow, reloadProgress, spreadOf } from '../logic/gun'
 import { useProgressStore } from '../stores/progressStore'
@@ -36,6 +37,8 @@ export function GunHud() {
       if (!gun) return
       const gap = 6 + spreadOf(gun, gunRig.aiming, heatNow(gunRig, now)) * 900
       cross.current?.style.setProperty('--gap', `${gap}px`)
+      // 조준경·홀로로 볼 땐 그쪽 십자선을 쓴다 (은지 opticAim)
+      if (cross.current) cross.current.style.visibility = gunRig.optic && playerRig.firstPerson ? 'hidden' : 'visible'
       if (mark.current) mark.current.style.opacity = now - gunRig.hitAt < HIT_MARK ? '1' : '0'
       const r = reloadProgress(gunRig, now) >= 0
       setReloading((prev) => (prev === r ? prev : r))
```

`src/game/ui/Hud.tsx` (바꿀 곳, `git diff -U3`):

```diff
diff --git a/src/game/ui/Hud.tsx b/src/game/ui/Hud.tsx
--- a/src/game/ui/Hud.tsx
+++ b/src/game/ui/Hud.tsx
@@ -133,7 +133,7 @@ export function Hud() {
           {mouseLook && !locked && <div style={lookHint}>클릭하면 마우스로 시점 회전 · ESC 해제</div>}
           {!touchUi && (
             <div style={{ position: 'absolute', bottom: 8, left: 16, right: 16, textAlign: 'center', opacity: 0.7, fontSize: 12 }}>
-              WASD 이동 · Shift 달리기 · Space 점프 · 1~7 도구 · X 넣기 · {tool === 'fists' ? '클릭 주먹 · ' : tool === 'knife' ? '클릭 베기 · 오른쪽 클릭 찌르기 · ' : isGun(tool) ? '클릭 쏘기 · 오른쪽 클릭 조준 · R 장전 · ' : ''}I 가방 · F 먹기 · T 꾹 감정 표현 · Tab 지도 · 휠 확대 · M 음악 · {mouseLook ? (locked ? '마우스로 시점 회전 · ESC 메뉴' : '클릭 후 마우스로 시점 회전') : '드래그로 카메라 회전'}
+              WASD 이동 · Shift 달리기 · Space 점프 · 1~7 도구 · X 넣기 · {tool === 'fists' ? '클릭 주먹 · ' : tool === 'knife' ? '클릭 베기 · 오른쪽 클릭 찌르기 · ' : isGun(tool) ? '클릭 쏘기 · 오른쪽 클릭 조준 · R 장전 · ' : ''}V 시점 · I 가방 · F 먹기 · T 꾹 감정 표현 · Tab 지도 · 휠 확대 · M 음악 · {mouseLook ? (locked ? '마우스로 시점 회전 · ESC 메뉴' : '클릭 후 마우스로 시점 회전') : '드래그로 카메라 회전'}
             </div>
           )}
         </>
```

`src/game/scene/World.tsx` — FirstPersonView 는 Player 바로 다음 (이번 프레임 카메라) (바꿀 곳, `git diff -U3`):

```diff
diff --git a/src/game/scene/World.tsx b/src/game/scene/World.tsx
--- a/src/game/scene/World.tsx
+++ b/src/game/scene/World.tsx
@@ -10,6 +10,7 @@ import { LootItems } from './animals/LootItems'
 import { MeleeController } from './melee/MeleeController'
 import { GunController } from './guns/GunController'
 import { GunEffects } from './guns/GunEffects'
+import { FirstPersonView } from './guns/FirstPersonView'
 import { Docks } from './boat/Docks'
 import { DayCycle } from './day/DayCycle'
 import { FishingSpots } from './facilities/FishingSpots'
@@ -50,6 +51,7 @@ export function World() {
       <ZoneGates />
       <RepairCutscene />
       <Player />
+      <FirstPersonView />
       <NetBridge />
       <RemotePlayers />
       <FishingSpots />
```

`src/game/Game.tsx` (바꿀 곳, `git diff -U3`):

```diff
diff --git a/src/game/Game.tsx b/src/game/Game.tsx
--- a/src/game/Game.tsx
+++ b/src/game/Game.tsx
@@ -29,6 +29,7 @@ import { Hud, NoticeLayer } from './ui/Hud'
 import { Hotbar } from './ui/Hotbar'
 import { HurtFlash } from './ui/HurtFlash'
 import { GunHud } from './ui/GunHud'
+import { ScopeOverlay } from './ui/ScopeOverlay'
 import { resetGunRig } from './guns/gunRig'
 import { LoadingScreen } from './ui/LoadingScreen'
 import { SleepOverlay } from './ui/SleepOverlay'
@@ -116,6 +117,7 @@ export function Game({ onExit, hub }: GameProps) {
       </div>
       <WeaknessOverlay />
       <HurtFlash />
+      <ScopeOverlay />
       <Hud />
       <GunHud />
       <Hotbar />
```

- [ ] **Step 6: 테스트 통과 확인**

Run: `npx vitest run && npx tsc -b && npm run lint 2>&1 | grep -c warning`
Expected: 모든 테스트 PASS, tsc 오류 없음, 경고 6

- [ ] **Step 7: 눈으로 확인**

V → 내 몸이 사라지고 눈높이 카메라, 오른쪽 아래에 든 무기(권총·칼·주먹 모두). V 다시 → 3인칭. 3인칭 권총으로 오른쪽 클릭 → 가까이 오른쪽 어깨 너머, 조준선이 머리 오른쪽. 소총으로 오른쪽 클릭 → 그동안 1인칭 빨간 홀로 고리, 휠을 위로 → 2.5x 둥근 조준경(바깥 검정), 놓으면 3인칭. 저격총 4x/8x. 조준하면 시점이 천천히 돈다.

- [ ] **Step 8: 커밋**

```bash
git add public/meadow/models/crosshair/License.txt \
  public/meadow/models/crosshair/holo.svg \
  public/meadow/models/crosshair/scope.svg \
  src/game/Game.tsx \
  src/game/data/guns.ts \
  src/game/guns/gunRig.ts \
  src/game/input/useInteractionKeys.ts \
  src/game/input/useWheelZoom.ts \
  src/game/logic/interaction.test.ts \
  src/game/logic/interaction.ts \
  src/game/logic/view.test.ts \
  src/game/logic/view.ts \
  src/game/scene/Player.tsx \
  src/game/scene/World.tsx \
  src/game/scene/guns/FirstPersonView.tsx \
  src/game/scene/guns/GunController.tsx \
  src/game/scene/guns/viewModel.ts \
  src/game/stores/sessionStore.test.ts \
  src/game/stores/sessionStore.ts \
  src/game/ui/GunHud.tsx \
  src/game/ui/Hud.tsx \
  src/game/ui/ScopeOverlay.tsx
git commit -F - <<'EOF'
feat: 1인칭(V)과 조준·조준경

- V 로 1인칭/3인칭. 1인칭은 내 몸을 숨기고 눈높이 카메라, 든 무기(총·칼·주먹)를 화면에 붙인다 (은지 view 자리·반동)
- 1인칭으로 볼 수 있는 화면을 Mode 마다 정한다 (낚시·벤치·배·연출·잠·꾸미기·어항 크게 보기·로비는 3인칭)
- 오른쪽 클릭 조준: FOV 를 은지 aimFov 비율로 좁히고, 3인칭은 1.9m 로 당겨 오른쪽 어깨 너머로 비킨다. 조준하면 감도도 그만큼 낮춘다
- 소총·저격총은 조준하는 동안 1인칭 조준경 (홀로·2.5x / 4x·8x, 휠로 바꾼다). 은지 렌즈 확대 대신 FOV 를 좁히고 둥근 화면·십자선(Kenney Crosshair, CC0)을 덮는다
EOF
```

검증한 스크래치 커밋: `a98918a` (이 커밋의 diff 를 그대로 적용해도 된다: `git -C /private/tmp/claude-501/-Users-ihyelin-proten-hrlee-----threejs/e476c70e-362f-4ed3-9ff7-d8664da04e4b/scratchpad/plan-3-4/repo format-patch -1 --binary a98918a --stdout | git apply --index` 한 뒤 위 커밋 명령. 스크래치 커밋의 작성자는 scratch 라 `git am` 은 쓰지 않는다)

### Task 6: 사격장 표적·무기 선반·연습 게임  — 스크래치 `6f6cf4b`

**Files:**
- Create: `src/game/ui/RackPanel.tsx`, `src/game/ui/RangeHud.tsx`, `src/meadow/RangeRunner.tsx`, `src/meadow/canvasStub.ts`, `src/meadow/rangeActions.ts`, `src/meadow/vendor/range.d.ts`, `src/meadow/vendor/range.js`
- Modify: `src/game/Game.tsx`, `src/game/data/meadow.ts`, `src/game/input/useInteractionKeys.ts`, `src/game/logic/interaction.ts`, `src/game/logic/meadowInteract.ts`, `src/game/logic/view.ts`, `src/game/scene/World.tsx`, `src/game/scene/guns/GunController.tsx`, `src/game/ui/GunHud.tsx`, `src/game/ui/Panels.tsx`, `src/game/ui/interactLabel.ts`, `src/meadow/meadowSingleton.ts`, `src/meadow/vendor/world.d.ts`, `src/meadow/vendor/world.js`
- Test: `src/game/logic/interaction.test.ts`, `src/meadow/meadowActions.test.ts`, `src/meadow/meadowSingleton.test.ts`, `src/meadow/rangeActions.test.ts`, `src/meadow/vendor.test.ts`

**Interfaces:**
- Consumes: Task 3 (vendor `weapons.js`·`audio.js`), Task 4 (`GunController`·`markHit`·`gunFx.hole(point, normal, parent)`), Task 5 (`FIRST_PERSON_OK`), progressStore `rangeBest`·`recordRangeScore` (Task 1), `MEADOW_ROOMS`·`toMeadowLocal` (`data/meadow`), `meadowSpots` (3-2)
- Produces: vendor `range.js` (`buildRange`, `RANGE_ROOM`, `EunjiRange = { targets; rack; hit(target, point, meleeScore?); update(dt); game; startGame(); stopGame(); dismissGame(); onShot(); onHit(score) }`), `EunjiWorld.range`; `inRangeRoom(x, z)` (`data/meadow`); `meadowRange()` (`meadow/meadowSingleton`); `toggleRangeGame()`·`stepRange(dt, now)`·`countRangeShot(best)`·`RANGE_RESULT_SECONDS = 6` (`meadow/rangeActions`); Interactable `{ kind: 'rack' }`, Mode `'rack'`, `KeyAction` `{ type: 'rangeGame' }` (G), `MEADOW_REACH.rack = 1.6`; `stubCanvas2d()` (`meadow/canvasStub`, 테스트용); `<RangeRunner />`·`<RangeHud />`·`<RackPanel />`

- [ ] **Step 1: 은지 사격장을 vendor 로 복사하고 빈 방에 세운다**

```bash
cp /private/tmp/claude-501/-Users-ihyelin-proten-hrlee-----threejs/e476c70e-362f-4ed3-9ff7-d8664da04e4b/scratchpad/eunji/repo2/src/range.js src/meadow/vendor/range.js
```

빛 3개·localStorage 최고 기록만 뺀다 (은지 원본 대비):

```diff
--- 은지 src/range.js
+++ src/meadow/vendor/range.js
@@ -16,7 +16,7 @@
 const GAME_DOWN_TIME = 0.6;      // 게임 중에는 표적이 빨리 다시 선다
 const MOVE_AMP = 1.3;            // 표적 좌우 왕복 폭(m). 레인 간격 3m 이므로 이웃과 겹치지 않는다
 const MOVE_SPEED = [0.9, 1.5, 1.2]; // 레인별 기본 속도(m/s). 시간이 갈수록 빨라진다
-const BEST_KEY = 'range.best';
+// rinfish: 최고 기록은 낚시섬 저장본(progressStore.rangeBest)에 둔다 (localStorage range.best 를 쓰지 않는다)
 
 function canvasTexture(w, h, draw) {
   const c = document.createElement('canvas');
@@ -151,9 +151,7 @@
     const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.05, 8), lampMat);
     lamp.position.set(x, 2.96, 0);
     group.add(lamp);
-    const pl = new THREE.PointLight(0xffffff, 3, 8, 2);
-    pl.position.set(x, 2.6, 0);
-    group.add(pl);
+    // rinfish: 보조 PointLight 3개는 뺐다 (빛 개수를 늘리지 않는다. 사격장 방 조명이 이미 있다)
   }
 
   // --- 무기 선반 (북쪽 벽 앞 테이블 + 걸이판). E 키로 무기 선택 패널을 연다 ---
@@ -182,7 +180,7 @@
     total: GAME_TIME, // 제한 시간 (UI 표시용)
     time: 0,          // countdown/running 에서 남은 시간
     score: 0, hits: 0, shots: 0,
-    best: Number(localStorage.getItem(BEST_KEY) || 0),
+    best: 0, // rinfish: 낚시섬이 저장본 값으로 채운다
     isBest: false,    // 방금 끝난 판이 최고 기록인지
     lastBeep: -1,     // 카운트다운 소리를 초마다 한 번만 내기 위한 기억
   };
@@ -204,7 +202,6 @@
     if (game.score > game.best) {
       game.best = game.score;
       game.isBest = game.score > 0;
-      localStorage.setItem(BEST_KEY, String(game.best));
     }
     playBuzzer();
   }
```

`src/meadow/vendor/world.js` — 1·2단계에서 뺀 사격장 설비를 되살린다 (바꿀 곳, `git diff -U3`):

```diff
diff --git a/src/meadow/vendor/world.js b/src/meadow/vendor/world.js
--- a/src/meadow/vendor/world.js
+++ b/src/meadow/vendor/world.js
@@ -2,8 +2,7 @@ import * as THREE from 'three';
 import { asset } from './paths.js';
 // rinfish: 거울(Reflector)은 매 프레임 한 번 더 그려서 뺐다
 import { Door } from './door.js';
-// rinfish: range.js 는 무기·소리 코드를 끌고 와서 복사하지 않았다. 방 크기만 옮겨 둔다 (빈 방으로 남는다)
-const RANGE_ROOM = { id: 'range', name: '사격장', minX: 15, maxX: 27, minZ: -5, maxZ: 5, floor: 0x8f8f8c, wall: 0xd6d6cf };
+import { RANGE_ROOM, buildRange } from './range.js';
 import { createKit, KENNEY_SCALE } from './furniture.js';
 import { buildOutdoor, YARD, WILD, GROUND } from './outdoor.js';
 // rinfish: 동물(animals.js)은 3단계에서
@@ -208,7 +207,7 @@ export function createWorld() {
   })();
 
   // 사격장 (표적, 사대, 무기 선반 등)
-  const range = null; // rinfish: 사격장 설비 뺌
+  const range = buildRange({ group, std, box, shootables });
 
   // --- 집 밖: 땅, 울타리, 나무 (22단계) / 동물 (23단계) ---
   const outdoor = buildOutdoor({ group, colliders, shootables, wallMeshes, house: HOUSE });
```

`src/meadow/vendor/range.d.ts` (새 파일):

```ts
import type { Group, Mesh, Vector3 } from 'three'
import type { EunjiRoom } from './world.js'

export const RANGE_ROOM: EunjiRoom
/** 연습 게임 시간 (초) */
export const GAME_TIME: number

/** 표적 하나 (레인 1~3). pivot 이 넘어지고 좌우로 움직인다. board: 과녁판 (총알 자국을 붙인다) */
export type EunjiTarget = { lane: number; pivot: Group; board: Mesh; down: boolean; timer: number; homeZ: number; phase: number }

/** 연습 게임: idle → countdown(3초) → running(60초) → over */
export type EunjiRangeGame = { state: 'idle' | 'countdown' | 'running' | 'over'; total: number; time: number; score: number; hits: number; shots: number; best: number; isBest: boolean; lastBeep: number }

export type EunjiRange = {
  targets: EunjiTarget[]
  /** 무기 선반 (E 기준점, 은지 좌표) */
  rack: { center: Vector3; label: string }
  /** 표적 명중: 링 점수 1~10 (넘어져 있으면 0) */
  hit(target: EunjiTarget, point: Vector3, meleeScore?: number): number
  update(dt: number): void
  game: EunjiRangeGame
  startGame(): void
  stopGame(): void
  dismissGame(): void
  onShot(): void
  onHit(score: number): void
}

export function buildRange(ctx: { group: Group; std: unknown; box: unknown; shootables: unknown[] }): EunjiRange
```

`src/meadow/vendor/world.d.ts` (바꿀 곳, `git diff -U3`):

```diff
diff --git a/src/meadow/vendor/world.d.ts b/src/meadow/vendor/world.d.ts
--- a/src/meadow/vendor/world.d.ts
+++ b/src/meadow/vendor/world.d.ts
@@ -1,4 +1,5 @@
 import type { Box3, BoxGeometry, DirectionalLight, Group, HemisphereLight, Light, Mesh, Object3D, Vector3 } from 'three'
+import type { EunjiRange } from './range.js'
 
 /** outdoor: 마당·광장·들판 (실내 방엔 없다) */
 export type EunjiRoom = { id: string; name: string; minX: number; maxX: number; minZ: number; maxZ: number; outdoor?: boolean }
@@ -42,6 +43,8 @@ export type EunjiWorld = {
   /** 은지 좌표 (x, z) 의 방: 실내 방 → 마당 → 광장 → 들판 순 */
   roomAt(x: number, z: number): EunjiRoom
   bedSpot: { center: Vector3; label: string }
+  /** 사격장 표적·무기 선반·연습 게임 (3-4) */
+  range: EunjiRange
 }
 
 export function createWorld(): EunjiWorld
```

- [ ] **Step 2: 실패하는 테스트 쓰기**

은지 맵을 만드는 테스트는 사격장 과녁·글씨 캔버스 때문에 가짜 2D 를 쓴다.

`src/meadow/canvasStub.ts` (새 파일):

```ts
/**
 * 테스트용: jsdom 캔버스엔 2D 그리기가 없어서(getContext 가 null) 은지 사격장 글씨·과녁 그림이 깨진다.
 * 무엇을 불러도 아무 일도 없는 가짜 2D 를 돌려준다. 되돌리는 함수를 돌려준다
 */
export function stubCanvas2d(): () => void {
  const proto = HTMLCanvasElement.prototype
  const original = proto.getContext
  const fake = new Proxy({}, { get: (_, key) => (key === 'measureText' ? () => ({ width: 0 }) : () => undefined), set: () => true })
  proto.getContext = (() => fake) as unknown as typeof proto.getContext
  return () => {
    proto.getContext = original
  }
}
```

`src/meadow/vendor.test.ts` (바꿀 곳, `git diff -U3`):

```diff
diff --git a/src/meadow/vendor.test.ts b/src/meadow/vendor.test.ts
--- a/src/meadow/vendor.test.ts
+++ b/src/meadow/vendor.test.ts
@@ -1,9 +1,18 @@
 // @vitest-environment jsdom
 import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
+import { stubCanvas2d } from './canvasStub'
 
 // 모델 파일은 테스트에서 받지 않는다 (로딩 실패는 allSettled 로 넘긴다)
-beforeAll(() => vi.stubGlobal('fetch', () => Promise.reject(new Error('offline'))))
-afterAll(() => vi.unstubAllGlobals())
+let restoreCanvas = () => {}
+beforeAll(() => {
+  vi.stubGlobal('fetch', () => Promise.reject(new Error('offline')))
+  // 사격장 글씨·과녁 그림 (jsdom 엔 2D 캔버스가 없다)
+  restoreCanvas = stubCanvas2d()
+})
+afterAll(() => {
+  vi.unstubAllGlobals()
+  restoreCanvas()
+})
 
 describe('은지 맵 복사본', () => {
   it('createWorld 가 사격장·동물·상인·거울 파일 없이 만들어지고 충돌 상자가 땅 안에 있다', async () => {
@@ -73,6 +82,20 @@ describe('은지 맵 복사본', () => {
     expect(GUN_IDS.map((id) => pick(GUNS[id]))).toEqual(WEAPONS.filter((w) => w.type === 'gun').map((w) => pick(w)))
     for (const id of GUN_IDS) expect(buildWeaponModel(id, { shadows: false }).userData.muzzle.position.z).toBeLessThan(0)
   })
+  it('사격장: 표적 3개(은지 x 25.6)와 무기 선반이 사격장 방 안에 있고, 사격장 빛은 더하지 않는다', async () => {
+    const { createWorld } = await import('./vendor/world.js')
+    const { inRangeRoom, toWorld } = await import('../game/data/meadow')
+    const w = createWorld()
+    expect(w.range.targets.map((t) => [t.lane, t.pivot.position.x])).toEqual([
+      [1, 25.6],
+      [2, 25.6],
+      [3, 25.6],
+    ])
+    expect(inRangeRoom(...toWorld(w.range.rack.center.x, w.range.rack.center.z))).toBe(true)
+    expect(inRangeRoom(...toWorld(10, 0))).toBe(false)
+    expect(w.group.children.filter((o) => (o as { isPointLight?: boolean }).isPointLight).length).toBe(4 + w.lights.lamps.length)
+    await Promise.allSettled([w.furnitureReady, w.outdoor.ready, w.town.ready])
+  })
   it('모델 주소는 meadow/ 아래', async () => {
     const { asset } = await import('./vendor/paths.js')
     expect(asset('models/kenney/desk.glb')).toBe('/meadow/models/kenney/desk.glb')
```

`src/meadow/meadowSingleton.test.ts` (바꿀 곳, `git diff -U3`):

```diff
diff --git a/src/meadow/meadowSingleton.test.ts b/src/meadow/meadowSingleton.test.ts
--- a/src/meadow/meadowSingleton.test.ts
+++ b/src/meadow/meadowSingleton.test.ts
@@ -1,10 +1,19 @@
 // @vitest-environment jsdom
 import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
+import { stubCanvas2d } from './canvasStub'
 import { Vector3, type Light, type Object3D } from 'three'
 
 // 모델 파일은 테스트에서 받지 않는다
-beforeAll(() => vi.stubGlobal('fetch', () => Promise.reject(new Error('offline'))))
-afterAll(() => vi.unstubAllGlobals())
+let restoreCanvas = () => {}
+beforeAll(() => {
+  vi.stubGlobal('fetch', () => Promise.reject(new Error('offline')))
+  // 사격장 글씨·과녁 그림 (jsdom 엔 2D 캔버스가 없다)
+  restoreCanvas = stubCanvas2d()
+})
+afterAll(() => {
+  vi.unstubAllGlobals()
+  restoreCanvas()
+})
 
 const isLight = (o: Object3D): o is Light => (o as Light).isLight === true
 /** 은지 좌표: 침실 가운데, 마당 */
```

`src/meadow/meadowActions.test.ts` (바꿀 곳, `git diff -U3`):

```diff
diff --git a/src/meadow/meadowActions.test.ts b/src/meadow/meadowActions.test.ts
--- a/src/meadow/meadowActions.test.ts
+++ b/src/meadow/meadowActions.test.ts
@@ -1,12 +1,21 @@
 // @vitest-environment jsdom
 import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
+import { stubCanvas2d } from './canvasStub'
 import { NO_ITEMS } from '../game/logic/inventory'
 import { INITIAL_PROGRESS, useProgressStore } from '../game/stores/progressStore'
 import { useSessionStore } from '../game/stores/sessionStore'
 import { startStoveCook, stepStoveCook, stoveCookLeft } from './meadowActions'
 
-beforeAll(() => vi.stubGlobal('fetch', () => Promise.reject(new Error('offline'))))
-afterAll(() => vi.unstubAllGlobals())
+let restoreCanvas = () => {}
+beforeAll(() => {
+  vi.stubGlobal('fetch', () => Promise.reject(new Error('offline')))
+  // 사격장 글씨·과녁 그림 (jsdom 엔 2D 캔버스가 없다)
+  restoreCanvas = stubCanvas2d()
+})
+afterAll(() => {
+  vi.unstubAllGlobals()
+  restoreCanvas()
+})
 
 beforeEach(() => {
   localStorage.clear()
```

`src/meadow/rangeActions.test.ts` (새 파일):

```ts
// @vitest-environment jsdom
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { stubCanvas2d } from './canvasStub'
import { Vector3 } from 'three'
import { INITIAL_PROGRESS, useProgressStore } from '../game/stores/progressStore'
import { useSessionStore } from '../game/stores/sessionStore'

// 모델 파일은 테스트에서 받지 않는다
let restoreCanvas = () => {}
beforeAll(() => {
  vi.stubGlobal('fetch', () => Promise.reject(new Error('offline')))
  // 사격장 글씨·과녁 그림 (jsdom 엔 2D 캔버스가 없다)
  restoreCanvas = stubCanvas2d()
})
afterAll(async () => {
  // 모델 받기(실패)를 다 기다린 뒤 되돌린다 (테스트가 끝난 뒤 진짜 fetch 로 가지 않게)
  await (await import('./meadowSingleton')).meadowReady()
  vi.unstubAllGlobals()
  restoreCanvas()
})

beforeEach(() => {
  localStorage.clear()
  useProgressStore.setState({ ...INITIAL_PROGRESS })
  useSessionStore.getState().resetSession()
})

const at = async (x: number, z: number) => (await import('../game/scene/Player')).playerRig.position.set(x, 1, z)

describe('사격장 연습 게임 (G)', () => {
  it('사격장 밖에선 시작하지 않고 알린다, 안에선 3초 카운트다운 → 60초', async () => {
    const { toggleRangeGame, stepRange } = await import('./rangeActions')
    const { meadowRange } = await import('./meadowSingleton')
    await at(188, -12)
    toggleRangeGame()
    expect(meadowRange().game.state).toBe('idle')
    expect(useSessionStore.getState().notice?.text).toContain('사격장 안에서')
    await at(180, 0)
    toggleRangeGame()
    expect(meadowRange().game.state).toBe('countdown')
    stepRange(3.01, 0)
    expect(meadowRange().game.state).toBe('running')
    toggleRangeGame()
    expect(meadowRange().game.state).toBe('over')
    stepRange(0.016, 100)
    stepRange(0.016, 106)
    expect(meadowRange().game.state).toBe('idle')
  })

  it('표적을 맞히면 점수, 끝나면 최고 점수를 저장한다 (더 높을 때만). 결과는 6초 뒤 닫힌다', async () => {
    const { toggleRangeGame, stepRange, countRangeShot, RANGE_RESULT_SECONDS } = await import('./rangeActions')
    const { meadowRange } = await import('./meadowSingleton')
    useProgressStore.setState({ rangeBest: 5 })
    await at(180, 0)
    toggleRangeGame()
    stepRange(3.01, 0)
    const range = meadowRange()
    const t = range.targets[0]
    t.board.updateWorldMatrix(true, false)
    const score = range.hit(t, t.board.localToWorld(new Vector3(0, 0, 0)), 0)
    expect(score).toBe(10)
    countRangeShot(score)
    countRangeShot(0)
    expect([range.game.score, range.game.hits, range.game.shots]).toEqual([10, 1, 2])
    stepRange(60, 10)
    expect(range.game.state).toBe('over')
    expect(range.game.isBest).toBe(true)
    expect(useProgressStore.getState().rangeBest).toBe(10)
    stepRange(0.016, 10 + RANGE_RESULT_SECONDS - 0.1)
    expect(range.game.state).toBe('over')
    stepRange(0.016, 10 + RANGE_RESULT_SECONDS)
    expect(range.game.state).toBe('idle')
  })

  it('사격장 밖에서 쏜 것은 세지 않는다', async () => {
    const { toggleRangeGame, stepRange, countRangeShot } = await import('./rangeActions')
    const { meadowRange } = await import('./meadowSingleton')
    await at(180, 0)
    toggleRangeGame()
    stepRange(3.01, 0)
    const before = meadowRange().game.shots
    await at(188, -12)
    countRangeShot(10)
    expect(meadowRange().game.shots).toBe(before)
    meadowRange().stopGame()
  })
})
```

`src/game/logic/interaction.test.ts` (바꿀 곳, `git diff -U3`):

```diff
diff --git a/src/game/logic/interaction.test.ts b/src/game/logic/interaction.test.ts
--- a/src/game/logic/interaction.test.ts
+++ b/src/game/logic/interaction.test.ts
@@ -151,6 +151,10 @@ describe('resolveKeyAction', () => {
     expect(resolveKeyAction('KeyR', 'bag', null)).toEqual({ type: 'none' })
     expect(resolveKeyAction('KeyV', 'explore', null)).toEqual({ type: 'toggleView' })
     expect(resolveKeyAction('KeyV', 'fishing', null)).toEqual({ type: 'none' })
+    expect(resolveKeyAction('KeyG', 'explore', null)).toEqual({ type: 'rangeGame' })
+    expect(resolveKeyAction('KeyG', 'rack', null)).toEqual({ type: 'none' })
+    expect(resolveKeyAction('KeyE', 'explore', { kind: 'rack' })).toEqual({ type: 'openMode', mode: 'rack' })
+    expect(resolveKeyAction('Escape', 'rack', null)).toEqual({ type: 'closePanel' })
     // 낚시 중 숫자는 그대로 미끼, 패널에선 무시
     expect(resolveKeyAction('Digit2', 'fishing', null)).toEqual({ type: 'selectBait', bait: 'shrimp' })
     expect(resolveKeyAction('KeyX', 'fishing', null)).toEqual({ type: 'none' })
```

- [ ] **Step 3: 실행해 실패 확인**

Run: `npx vitest run src/meadow src/game/logic/interaction.test.ts`
Expected: FAIL — `Failed to resolve import "./rangeActions"`, vendor.test `inRangeRoom is not a function`, interaction `KeyG` 가 `none`·`rack` 대상 없음

- [ ] **Step 4: 사격장 규칙·E 대상·G**

`src/game/data/meadow.ts` (바꿀 곳, `git diff -U3`):

```diff
diff --git a/src/game/data/meadow.ts b/src/game/data/meadow.ts
--- a/src/game/data/meadow.ts
+++ b/src/game/data/meadow.ts
@@ -53,6 +53,13 @@ export function isIndoor(x: number, z: number): boolean {
   return MEADOW_ROOMS.some((r) => lx >= r.minX && lx < r.maxX && lz >= r.minZ && lz <= r.maxZ)
 }
 
+/** 세계 (x, z) 가 사격장 방 안인가 (은지 roomAt 'range': 은지 x 15..27, z -5..5 → 세계 x 173..185). G 연습 게임은 여기서만 */
+export function inRangeRoom(x: number, z: number): boolean {
+  const [lx, lz] = toMeadowLocal(x, z)
+  const r = MEADOW_ROOMS[3]
+  return lx >= r.minX && lx < r.maxX && lz >= r.minZ && lz <= r.maxZ
+}
+
 /** 은지 침실 침대 (은지 world.bedSpot 3.5, 3.6) */
 export const BED_SPOT: [number, number] = toWorld(3.5, 3.6)
 /** E "잠자기" 감지 상자: 침대와 그 앞을 덮고 침실 벽(은지 x 5, z 5) 밖으로 나가지 않는다 (은지 2m 와 비슷) */
```

`src/game/logic/meadowInteract.ts` (바꿀 곳, `git diff -U3`):

```diff
diff --git a/src/game/logic/meadowInteract.ts b/src/game/logic/meadowInteract.ts
--- a/src/game/logic/meadowInteract.ts
+++ b/src/game/logic/meadowInteract.ts
@@ -1,7 +1,7 @@
 import { isSameInteractable, type Interactable } from './interaction'
 
 /** E 가 닿는 거리 (은지 값, 바닥 거리 m) */
-export const MEADOW_REACH = { pickup: 1.6, stove: 1.6, door: 2.5, vendor: 2.8 }
+export const MEADOW_REACH = { pickup: 1.6, stove: 1.6, door: 2.5, vendor: 2.8, rack: 1.6 }
 
 /** 초원(은지 좌표)의 E 대상 하나 */
 export type MeadowSpot = { target: Interactable; x: number; z: number; reach: number }
@@ -24,7 +24,7 @@ export function nearestSpot(px: number, pz: number, spots: readonly MeadowSpot[]
 }
 
 /** 초원 감시자(MeadowInteractions)가 정하는 E 대상 종류 (전리품 포함). 그 밖(침대 감지 상자·물가 낚시 등)은 건드리지 않는다 */
-const MEADOW_KINDS: ReadonlySet<string> = new Set(['pickup', 'stove', 'door', 'vendor', 'loot'])
+const MEADOW_KINDS: ReadonlySet<string> = new Set(['pickup', 'stove', 'door', 'vendor', 'loot', 'rack'])
 
 /**
  * 이번 프레임에 찾은 초원 대상(found)으로 nearby 를 어떻게 할까: 'keep' 그대로, 'clear' 지우기, 아니면 그 대상으로 바꾸기.
```

`src/meadow/meadowSingleton.ts` (바꿀 곳, `git diff -U3`):

```diff
diff --git a/src/meadow/meadowSingleton.ts b/src/meadow/meadowSingleton.ts
--- a/src/meadow/meadowSingleton.ts
+++ b/src/meadow/meadowSingleton.ts
@@ -5,6 +5,7 @@ import { skyNow } from '../game/scene/skyNow'
 import { DayNight } from './vendor/daynight.js'
 import { boxesToCuboids, doorBox, type Cuboid } from '../game/logic/meadowColliders'
 import { MEADOW_REACH, type MeadowSpot } from '../game/logic/meadowInteract'
+import type { EunjiRange } from './vendor/range.js'
 import { ROOMS, createWorld, type EunjiPickup, type EunjiWorld } from './vendor/world.js'
 
 let world: EunjiWorld | null = null
@@ -125,7 +126,12 @@ export function regrowPickups(dt: number) {
 let spots: MeadowSpot[] = []
 let spotsKey = ''
 
-/** 초원 E 대상 (은지 좌표): 가스레인지·문·상인·버섯·호박. 모델이 들어와 자리·개수가 바뀔 때만 다시 만든다 */
+/** 사격장 표적·무기 선반·연습 게임 (은지 range.js) */
+export function meadowRange(): EunjiRange {
+  return meadowWorld().range
+}
+
+/** 초원 E 대상 (은지 좌표): 가스레인지·문·상인·사격장 무기 선반·버섯·호박. 모델이 들어와 자리·개수가 바뀔 때만 다시 만든다 */
 export function meadowSpots(): MeadowSpot[] {
   const w = meadowWorld()
   const pickups = w.outdoor.pickups
@@ -136,6 +142,7 @@ export function meadowSpots(): MeadowSpot[] {
       { target: { kind: 'stove' }, x: w.stove.center.x, z: w.stove.center.z, reach: MEADOW_REACH.stove },
       ...w.doors.map((d, index): MeadowSpot => ({ target: { kind: 'door', index }, x: d.center.x, z: d.center.z, reach: MEADOW_REACH.door })),
       ...MEADOW_VENDORS.map((v): MeadowSpot => ({ target: { kind: 'vendor', id: v.id }, x: v.at[0], z: v.at[1], reach: MEADOW_REACH.vendor })),
+      { target: { kind: 'rack' }, x: w.range.rack.center.x, z: w.range.rack.center.z, reach: MEADOW_REACH.rack },
       ...pickups.map((p, index): MeadowSpot => ({ target: { kind: 'pickup', index, item: p.id }, x: p.center.x, z: p.center.z, reach: MEADOW_REACH.pickup })),
     ]
   }
```

`src/meadow/rangeActions.ts` (새 파일):

```ts
import { inRangeRoom } from '../game/data/meadow'
import { playerRig } from '../game/scene/Player'
import { useProgressStore } from '../game/stores/progressStore'
import { useSessionStore } from '../game/stores/sessionStore'
import { meadowRange } from './meadowSingleton'

/** 연습 게임 결과를 띄워 두는 시간(초). 그 뒤 저절로 닫는다 (은지는 결과 창 닫기 버튼) */
export const RANGE_RESULT_SECONDS = 6

/** G (또는 사격장 안 "연습 게임" 버튼): 하는 중이면 그만, 아니면 사격장 안에서만 시작 (은지 toggleGame) */
export function toggleRangeGame() {
  const range = meadowRange()
  const session = useSessionStore.getState()
  if (range.game.state === 'running' || range.game.state === 'countdown') {
    range.stopGame()
    session.notify('연습 게임을 그만했어요')
    return
  }
  if (!inRangeRoom(playerRig.position.x, playerRig.position.z)) {
    session.notify('연습 게임은 사격장 안에서 G 로 시작해요 (은지 집 거실 오른쪽 문)')
    return
  }
  // 은지 최고 기록은 저장본 값에서 (신기록 판정이 같은 값을 본다)
  range.game.best = Math.max(range.game.best, useProgressStore.getState().rangeBest)
  range.startGame()
}

let lastState = 'idle'
let overAt = 0

/**
 * 매 프레임 (dt 초, now: performance.now() 초): 표적이 넘어지고 움직이고 게임 시간이 간다.
 * 게임이 끝나면 점수를 최고 기록으로 저장하고(더 높을 때만) 결과를 RANGE_RESULT_SECONDS 보인 뒤 닫는다
 */
export function stepRange(dt: number, now: number) {
  const range = meadowRange()
  range.update(dt)
  const g = range.game
  if (g.state === 'over' && lastState !== 'over') {
    overAt = now
    useProgressStore.getState().recordRangeScore(g.score)
  }
  if (g.state === 'over' && now - overAt >= RANGE_RESULT_SECONDS) range.dismissGame()
  lastState = g.state
}

/** 사격장 안에서 쏜 한 발 (게임 중이면 쏜 수에 센다). best: 이번 발에서 가장 높은 표적 점수 (못 맞혔으면 0) */
export function countRangeShot(best: number) {
  if (!inRangeRoom(playerRig.position.x, playerRig.position.z)) return
  const range = meadowRange()
  range.onShot()
  if (best > 0) range.onHit(best)
}
```

`src/meadow/RangeRunner.tsx` (새 파일):

```tsx
import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { inRangeRoom } from '../game/data/meadow'
import { clampDelta } from '../game/logic/time'
import { playerRig } from '../game/scene/Player'
import { useSessionStore } from '../game/stores/sessionStore'
import { stepRange } from './rangeActions'

/** 화면엔 아무것도 그리지 않는다. 사격장 표적·연습 게임을 매 프레임 돌리고, 처음 사격장에 들어오면 할 수 있는 일을 알려 준다 (은지 ROOM_HINTS) */
export function RangeRunner() {
  const hinted = useRef(false)
  useFrame((_, delta) => {
    stepRange(clampDelta(delta), performance.now() / 1000)
    if (!hinted.current && inRangeRoom(playerRig.position.x, playerRig.position.z)) {
      hinted.current = true
      useSessionStore.getState().notify('🎯 사격장이에요. 선반에서 E 로 무기를 고르고, G 로 연습 게임을 시작해요')
    }
  })
  return null
}
```

`src/game/logic/interaction.ts` (바꿀 곳, `git diff -U3`):

```diff
diff --git a/src/game/logic/interaction.ts b/src/game/logic/interaction.ts
--- a/src/game/logic/interaction.ts
+++ b/src/game/logic/interaction.ts
@@ -11,7 +11,7 @@ import type { FishingPlace } from './fishingEdge'
  * unlock = 잠긴 구역 문 앞에서 여는 창, cutscene = 수리기사님 연출 (조작 없음), boat = 배 타고 건너는 중 (조작 없음),
  * map = 큰 지도 (이동·E 막힘, ESC·Tab 으로 닫는다), sleep = 잠·죽음으로 화면이 어두워지는 중이거나 같이 하기에서 침대에 누워 아침을 기다리는 중 (이동 막힘),
  * emote = T 를 누르고 있는 동안 감정 표현 바퀴 (이동·E 막힘, 떼면 고른 것을 한다. ui/EmoteWheel), bag = 가방 (I, 가스레인지에선 요리법),
- * vendor = 마을 상인 사고팔기 (어느 상인인지는 sessionStore.vendor)
+ * vendor = 마을 상인 사고팔기 (어느 상인인지는 sessionStore.vendor), rack = 사격장 무기 선반에서 무기 고르기
  */
 export type Mode =
   | 'explore'
@@ -34,6 +34,7 @@ export type Mode =
   | 'emote'
   | 'bag'
   | 'vendor'
+  | 'rack'
 
 /** E 키로 상호작용할 수 있는 대상. fishingSpot 은 물가에 선 자리에서 그때그때 만든 낚시 자리 (logic/fishingEdge) */
 export type Interactable =
@@ -57,6 +58,8 @@ export type Interactable =
   | { kind: 'vendor'; id: VendorId }
   /** 바닥에 떨어진 사냥 전리품 (key: hunt/animalRig 번호) */
   | { kind: 'loot'; key: number; item: RawItemId }
+  /** 사격장 무기 선반 */
+  | { kind: 'rack' }
 
 export function isSameInteractable(a: Interactable | null, b: Interactable): boolean {
   if (!a || a.kind !== b.kind) return false
@@ -92,6 +95,8 @@ export type KeyAction =
   | { type: 'reload' }
   /** V: 1인칭 / 3인칭 */
   | { type: 'toggleView' }
+  /** G: 사격장 연습 게임 시작·그만 */
+  | { type: 'rangeGame' }
   /** 버섯·호박 따기 */
   | { type: 'harvest'; index: number }
   /** 문 열기/닫기 */
@@ -135,6 +140,7 @@ export function resolveKeyAction(code: string, mode: Mode, nearby: Interactable
     if (code === 'KeyF') return { type: 'eatBest' }
     if (code === 'KeyR') return { type: 'reload' }
     if (code === 'KeyV') return { type: 'toggleView' }
+    if (code === 'KeyG') return { type: 'rangeGame' }
     if (code === 'KeyI') return { type: 'openMode', mode: 'bag' }
   }
   // 가방은 I 로도 닫는다
@@ -171,6 +177,8 @@ export function resolveKeyAction(code: string, mode: Mode, nearby: Interactable
         return { type: 'openVendor', id: nearby.id }
       case 'loot':
         return { type: 'pickLoot', key: nearby.key }
+      case 'rack':
+        return { type: 'openMode', mode: 'rack' }
       case 'stove':
         // 가방의 요리법 탭이 열린다 (BagPanel 이 가스레인지 앞인지 본다)
         return { type: 'openMode', mode: 'bag' }
```

`src/game/logic/view.ts` — 새 Mode rack (바꿀 곳, `git diff -U3`):

```diff
diff --git a/src/game/logic/view.ts b/src/game/logic/view.ts
--- a/src/game/logic/view.ts
+++ b/src/game/logic/view.ts
@@ -21,6 +21,7 @@ const FIRST_PERSON_OK: Record<Mode, boolean> = {
   market: true,
   aquarium: true,
   unlock: true,
+  rack: true,
   fishing: false,
   rest: false,
   boat: false,
```

`src/game/input/useInteractionKeys.ts` (바꿀 곳, `git diff -U3`):

```diff
diff --git a/src/game/input/useInteractionKeys.ts b/src/game/input/useInteractionKeys.ts
--- a/src/game/input/useInteractionKeys.ts
+++ b/src/game/input/useInteractionKeys.ts
@@ -1,6 +1,7 @@
 import { useEffect } from 'react'
 import { isCookingSkipKey, resolveKeyAction } from '../logic/interaction'
 import { harvest, toggleDoor } from '../../meadow/meadowActions'
+import { toggleRangeGame } from '../../meadow/rangeActions'
 import { pickLoot } from '../hunt/huntActions'
 import { pressReload } from './pointer'
 import { finishCooking } from '../scene/cooking/finishCooking'
@@ -94,6 +95,9 @@ export function runKeyAction(code: string): boolean {
     case 'toggleView':
       session.toggleView()
       break
+    case 'rangeGame':
+      toggleRangeGame()
+      break
     case 'toggleMap':
       if (session.mode === 'map') session.closeMap()
       else session.openMap()
```

`src/game/ui/interactLabel.ts` (바꿀 곳, `git diff -U3`):

```diff
diff --git a/src/game/ui/interactLabel.ts b/src/game/ui/interactLabel.ts
--- a/src/game/ui/interactLabel.ts
+++ b/src/game/ui/interactLabel.ts
@@ -13,6 +13,7 @@ const LABEL: Record<Exclude<Interactable['kind'], 'zoneGate' | 'dock' | 'pickup'
   wardrobe: '옷장 (꾸미기)',
   bed: '🛏️ 잠자기',
   stove: '🍳 요리하기 (요리법 보기)',
+  rack: '🔫 무기 고르기',
 }
 
 const GATE_LABEL: Record<string, string> = {
```

- [ ] **Step 5: 표적판 맞히기 (GunController)**

`src/game/scene/guns/GunController.tsx` (바꿀 곳, `git diff -U3`):

```diff
diff --git a/src/game/scene/guns/GunController.tsx b/src/game/scene/guns/GunController.tsx
--- a/src/game/scene/guns/GunController.tsx
+++ b/src/game/scene/guns/GunController.tsx
@@ -1,7 +1,9 @@
 import { useRef } from 'react'
 import { useFrame, useThree } from '@react-three/fiber'
 import { useRapier } from '@react-three/rapier'
-import { Vector3 } from 'three'
+import { Raycaster, Vector3, type Mesh, type Object3D } from 'three'
+import { meadowRange } from '../../../meadow/meadowSingleton'
+import { countRangeShot } from '../../../meadow/rangeActions'
 import { weaponSfx } from '../../audio/weaponSfx'
 import { GUNS, GUN_RANGE, VIEW_MODEL, isGun, type GunId } from '../../data/guns'
 import { gunFx } from '../../guns/gunFx'
@@ -28,6 +30,15 @@ const eye = new Vector3()
 const end = new Vector3()
 const from = new Vector3()
 const normal = new Vector3()
+const start = new Vector3()
+const along = new Vector3()
+const boardHit = new Raycaster()
+
+/** 장면에 붙어 있나 (초원 모델이 다 오기 전엔 사격장이 은지 좌표 그대로라 섬 근처에 유령 표적이 생긴다) */
+function inScene(o: Object3D): boolean {
+  for (let p: Object3D | null = o; p; p = p.parent) if ((p as { isScene?: boolean }).isScene) return true
+  return false
+}
 
 /** 쏠 수 있는 때: 탐험 중, 먹거나 감정 표현 중이 아닐 때 (낚시·배·잠·패널·T 바퀴는 mode 가 explore 가 아니다) */
 function canShoot(): boolean {
@@ -49,7 +60,7 @@ function tryReload(gun: GunId, now: number, manual: boolean) {
 
 /**
  * 화면엔 아무것도 그리지 않는다. 총을 든 채 마우스 왼쪽(연사 총은 누르고 있는 동안)·폰 쏘기 버튼으로 쏘고, 오른쪽으로 조준, R 로 장전한다 (은지 WeaponSystem).
- * 화면 가운데(카메라)에서 광선: 알마다 처음 닿는 것 = 동물(판정 기둥) · 벽(Rapier 고정 충돌체, 총알 자국). 반동·퍼짐·연사는 은지 수치
+ * 화면 가운데(카메라)에서 광선: 알마다 처음 닿는 것 = 동물(판정 기둥) · 사격장 표적판(점수, 판에 자국) · 벽(Rapier 고정 충돌체, 총알 자국). 반동·퍼짐·연사는 은지 수치
  */
 export function GunController() {
   const { world, rapier } = useRapier()
@@ -67,18 +78,32 @@ export function GunController() {
     const r = (ray.current ??= new rapier.Ray({ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 1 }))
     const struck: number[] = []
     let first: LastShot['hit'] | undefined
+    const range = meadowRange()
+    const boards: Mesh[] = range.targets.map((t) => t.board).filter(inScene)
+    let best = 0
     for (const d of pelletDirs(dir, spread, GUNS[gun].pellets, Math.random)) {
       const body = firstBodyHit(origin, d, near, GUN_RANGE, animals, [])
       r.origin = { x: origin.x + d.x * near, y: origin.y + d.y * near, z: origin.z + d.z * near }
       r.dir = d
       const wall = world.castRayAndGetNormal(r, GUN_RANGE - near, true, rapier.QueryFilterFlags.ONLY_FIXED | rapier.QueryFilterFlags.EXCLUDE_SENSORS)
       const wallT = wall ? near + wall.timeOfImpact : Infinity
-      const t = Math.min(body?.t ?? Infinity, wallT, GUN_RANGE)
+      boardHit.set(start.set(r.origin.x, r.origin.y, r.origin.z), along.set(d.x, d.y, d.z))
+      boardHit.far = GUN_RANGE - near
+      const board = boards.length ? boardHit.intersectObjects(boards, false)[0] : undefined
+      const boardT = board ? near + board.distance : Infinity
+      const t = Math.min(body?.t ?? Infinity, wallT, boardT, GUN_RANGE)
       end.set(origin.x + d.x * t, origin.y + d.y * t, origin.z + d.z * t)
       let hit: LastShot['hit'] = null
-      if (body && body.t <= wallT) {
+      if (body && body.t <= Math.min(wallT, boardT)) {
         hit = body.kind
         if (body.kind === 'animal') struck.push(body.id)
+      } else if (board && boardT <= wallT) {
+        hit = 'target'
+        const target = range.targets.find((x) => x.board === board.object)
+        if (target) {
+          best = Math.max(best, range.hit(target, board.point, 0))
+          gunFx.hole(board.point, normal.set(0, 0, 1), target.board)
+        }
       } else if (wall) {
         hit = 'wall'
         gunFx.hole(end, normal.set(wall.normal.x, wall.normal.y, wall.normal.z))
@@ -88,7 +113,9 @@ export function GunController() {
     }
     gunRig.lastShot = { o: { x: origin.x, y: origin.y, z: origin.z }, d: { x: dir.x, y: dir.y, z: dir.z }, hit: first ?? null }
     for (const [id, n] of countHits(struck)) shootAnimal(id, gun, n)
-    if (struck.length) markHit(now)
+    countRangeShot(best)
+    if (best > 0) markHit(now, `+${best}`)
+    else if (struck.length) markHit(now)
     gunFx.flash(muzzle)
     weaponSfx.shot(gun)
     gunRig.kick += recoilOf(gun, gunRig.aiming, (gunRig.optic?.mag ?? 1) > 1)
```

- [ ] **Step 6: 화면 (선반 창·연습 게임·점수 표시)**

`src/game/ui/RackPanel.tsx` (새 파일):

```tsx
import { GUNS, GUN_IDS } from '../data/guns'
import { toolDef, type ToolId } from '../data/tools'
import { useProgressStore } from '../stores/progressStore'
import { useSessionStore } from '../stores/sessionStore'
import { Panel } from './Panel'
import { button } from './styles'

/** 선반에 걸린 무기 (은지 WEAPONS 순서: 총 4종 + 칼, 그리고 맨손) */
const RACK: ToolId[] = [...GUN_IDS, 'knife', 'fists']

/** 사격장 무기 선반 (E): 고르면 그 무기를 들고 창을 닫는다 (도구 칸에서 고른 것과 같다) */
export function RackPanel() {
  const tool = useSessionStore((s) => s.tool)
  const ammo = useProgressStore((s) => s.ammo)
  const reserve = useProgressStore((s) => s.reserve)
  const pick = (id: ToolId) => {
    const session = useSessionStore.getState()
    session.equip(id)
    session.setMode('explore')
  }
  return (
    <Panel title="🔫 무기 선반">
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 8 }}>
        {RACK.map((id) => {
          const def = toolDef(id)
          const gun = id in GUNS ? GUNS[id as keyof typeof GUNS] : null
          return (
            <button key={id} style={{ ...button, padding: '10px 12px', textAlign: 'left', background: id === tool ? '#ffd166' : '#f1f3f5' }} aria-pressed={id === tool} onClick={() => pick(id)}>
              <div style={{ fontSize: 16 }}>
                {def.icon} {def.name}
              </div>
              <div style={{ fontSize: 12, fontWeight: 400, opacity: 0.75 }}>{gun ? `탄창 ${ammo[gun.id]}/${gun.mag} · 예비 ${reserve[gun.id]}${gun.auto ? ' · 연사' : ''}${gun.zoom ? ' · 조준경' : ''}` : id === 'knife' ? '근접 · 베기·찌르기' : '근접 · 주먹'}</div>
            </button>
          )
        })}
      </div>
      <p style={{ fontSize: 12, opacity: 0.7, marginBottom: 0 }}>탄약은 마을 잡화점에서 사요 · 사격장 안에서 G 로 60초 연습 게임</p>
    </Panel>
  )
}
```

`src/game/ui/RangeHud.tsx` (새 파일):

```tsx
import { useEffect, useState, type CSSProperties } from 'react'
import { meadowRange } from '../../meadow/meadowSingleton'
import { toggleRangeGame } from '../../meadow/rangeActions'
import { inRangeRoom } from '../data/meadow'
import { playerRig } from '../scene/Player'
import { useSessionStore } from '../stores/sessionStore'
import { button, safeTop } from './styles'

type View = { state: 'idle' | 'countdown' | 'running' | 'over'; time: number; score: number; hits: number; shots: number; best: number; isBest: boolean; inside: boolean }

/**
 * 사격장 연습 게임 (은지 setGame): 카운트다운 숫자, 위쪽 남은 시간·점수·명중, 끝나면 결과와 최고 기록.
 * 사격장 안에서 쉬고 있으면 "연습 게임 시작 (G)" 버튼 (폰은 G 키가 없다)
 */
export function RangeHud() {
  const mode = useSessionStore((s) => s.mode)
  const [v, setV] = useState<View | null>(null)
  useEffect(() => {
    let raf = 0
    const tick = () => {
      raf = requestAnimationFrame(tick)
      const g = meadowRange().game
      const next: View = { state: g.state, time: Math.round(g.time * 10) / 10, score: g.score, hits: g.hits, shots: g.shots, best: g.best, isBest: g.isBest, inside: inRangeRoom(playerRig.position.x, playerRig.position.z) }
      setV((prev) => (prev && (Object.keys(next) as (keyof View)[]).every((k) => prev[k] === next[k]) ? prev : next))
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [])
  if (!v || mode !== 'explore') return null
  if (v.state === 'idle') {
    if (!v.inside) return null
    return (
      <div style={{ ...top, pointerEvents: 'auto' }}>
        <button style={button} onClick={(e) => { e.currentTarget.blur(); toggleRangeGame() }}>
          🎯 연습 게임 시작 (G)
        </button>
      </div>
    )
  }
  if (v.state === 'countdown') return <div style={count}>{Math.ceil(v.time)}</div>
  const acc = v.shots ? Math.round((v.hits / v.shots) * 100) : 0
  if (v.state === 'over') {
    return (
      <div style={{ ...top, ...card }} aria-label="연습 게임 결과">
        <div style={{ fontSize: 28, fontWeight: 800 }}>
          {v.score}
          <small style={{ fontSize: 14 }}>점</small>
        </div>
        <div>
          명중 {v.hits} / {v.shots} ({acc}%)
        </div>
        <div>
          최고 기록 {v.best}점{v.isBest && <b> 🏆 신기록!</b>}
        </div>
      </div>
    )
  }
  return (
    <div style={{ ...top, ...card, color: v.time < 10 ? '#ff8a80' : '#fff' }} aria-label="연습 게임">
      <div style={{ fontSize: 24, fontWeight: 800 }}>⏱ {v.time.toFixed(1)}</div>
      <div style={{ fontSize: 13 }}>
        점수 {v.score} · 명중 {v.hits} / {v.shots}
      </div>
    </div>
  )
}

const top: CSSProperties = { position: 'absolute', top: safeTop(100), left: '50%', transform: 'translateX(-50%)', zIndex: 1000, textAlign: 'center' }
const card: CSSProperties = { pointerEvents: 'none', background: 'rgba(15, 20, 30, 0.7)', color: '#fff', padding: '8px 18px', borderRadius: 12, textShadow: '0 1px 2px #000' }
const count: CSSProperties = { position: 'absolute', left: '50%', top: '38%', transform: 'translate(-50%, -50%)', fontSize: 96, fontWeight: 900, color: '#ffd166', textShadow: '0 3px 8px #000', pointerEvents: 'none', zIndex: 1000 }
```

`src/game/ui/GunHud.tsx` — 명중 표시에 사격장 점수 (바꿀 곳, `git diff -U3`):

```diff
diff --git a/src/game/ui/GunHud.tsx b/src/game/ui/GunHud.tsx
--- a/src/game/ui/GunHud.tsx
+++ b/src/game/ui/GunHud.tsx
@@ -39,7 +39,11 @@ export function GunHud() {
       cross.current?.style.setProperty('--gap', `${gap}px`)
       // 조준경·홀로로 볼 땐 그쪽 십자선을 쓴다 (은지 opticAim)
       if (cross.current) cross.current.style.visibility = gunRig.optic && playerRig.firstPerson ? 'hidden' : 'visible'
-      if (mark.current) mark.current.style.opacity = now - gunRig.hitAt < HIT_MARK ? '1' : '0'
+      if (mark.current) {
+        mark.current.style.opacity = now - gunRig.hitAt < HIT_MARK ? '1' : '0'
+        // 사격장 표적은 점수 (은지 flashHit)
+        mark.current.textContent = gunRig.hitText || '✕'
+      }
       const r = reloadProgress(gunRig, now) >= 0
       setReloading((prev) => (prev === r ? prev : r))
     }
@@ -74,5 +78,5 @@ export function GunHud() {
 
 const crossBox: CSSProperties = { position: 'absolute', left: '50%', top: '50%', width: 0, height: 0 }
 const tick: CSSProperties = { position: 'absolute', left: -1, top: -5, width: 2, height: 8, background: 'rgba(255,255,255,0.9)', boxShadow: '0 0 2px #000', transformOrigin: '1px 5px' }
-const hitMark: CSSProperties = { position: 'absolute', left: -9, top: -13, width: 18, textAlign: 'center', fontSize: 18, fontWeight: 900, color: '#ff5252', textShadow: '0 0 3px #000', opacity: 0, transition: 'opacity 0.08s' }
+const hitMark: CSSProperties = { position: 'absolute', left: -24, top: -13, width: 48, textAlign: 'center', fontSize: 18, fontWeight: 900, color: '#ff5252', textShadow: '0 0 3px #000', opacity: 0, transition: 'opacity 0.08s' }
 const panel: CSSProperties = { position: 'absolute', right: safeRight(16), bottom: safeBottom(52), textAlign: 'right', background: 'rgba(15, 20, 30, 0.55)', padding: '6px 12px', borderRadius: 10, textShadow: '0 1px 2px #000' }
```

`src/game/ui/Panels.tsx` (바꿀 곳, `git diff -U3`):

```diff
diff --git a/src/game/ui/Panels.tsx b/src/game/ui/Panels.tsx
--- a/src/game/ui/Panels.tsx
+++ b/src/game/ui/Panels.tsx
@@ -10,6 +10,7 @@ import { GearShopPanel } from './GearShopPanel'
 import { Lobby } from './Lobby'
 import { MarketPanel } from './MarketPanel'
 import { MenuPanel } from './MenuPanel'
+import { RackPanel } from './RackPanel'
 import { SellPanel } from './SellPanel'
 import { UnlockPanel } from './UnlockPanel'
 import { VendorPanel } from './VendorPanel'
@@ -41,6 +42,8 @@ export function Panels({ onExit, hub }: { onExit?: () => void; hub?: HubHint })
       return <BagPanel />
     case 'vendor':
       return <VendorPanel />
+    case 'rack':
+      return <RackPanel />
     case 'wardrobe':
       return <CharacterCreator firstTime={!look} />
     default:
```

`src/game/scene/World.tsx` (바꿀 곳, `git diff -U3`):

```diff
diff --git a/src/game/scene/World.tsx b/src/game/scene/World.tsx
--- a/src/game/scene/World.tsx
+++ b/src/game/scene/World.tsx
@@ -1,6 +1,7 @@
 import { Suspense } from 'react'
 import { MeadowLighting } from '../../meadow/MeadowLighting'
 import { MeadowInteractions } from '../../meadow/MeadowInteractions'
+import { RangeRunner } from '../../meadow/RangeRunner'
 import { MeadowVendors } from '../../meadow/MeadowVendors'
 import { MeadowWorld } from '../../meadow/MeadowWorld'
 import { NetBridge } from '../net/NetBridge'
@@ -43,6 +44,7 @@ export function World() {
       <MeadowLighting />
       <MeadowWorld />
       <MeadowInteractions />
+      <RangeRunner />
       <MeadowVendors />
       <Docks />
       <Island />
```

`src/game/Game.tsx` (바꿀 곳, `git diff -U3`):

```diff
diff --git a/src/game/Game.tsx b/src/game/Game.tsx
--- a/src/game/Game.tsx
+++ b/src/game/Game.tsx
@@ -30,6 +30,7 @@ import { Hotbar } from './ui/Hotbar'
 import { HurtFlash } from './ui/HurtFlash'
 import { GunHud } from './ui/GunHud'
 import { ScopeOverlay } from './ui/ScopeOverlay'
+import { RangeHud } from './ui/RangeHud'
 import { resetGunRig } from './guns/gunRig'
 import { LoadingScreen } from './ui/LoadingScreen'
 import { SleepOverlay } from './ui/SleepOverlay'
@@ -120,6 +121,7 @@ export function Game({ onExit, hub }: GameProps) {
       <ScopeOverlay />
       <Hud />
       <GunHud />
+      <RangeHud />
       <Hotbar />
       <RoomBadge />
       <MiniMap />
```

- [ ] **Step 7: 테스트 통과 확인**

Run: `npx vitest run && npx tsc -b && npm run lint 2>&1 | grep -c warning`
Expected: 모든 테스트 PASS, tsc 오류 없음, 경고 6

- [ ] **Step 8: 눈으로 확인**

은지 집 거실 오른쪽 문(사격장 문, 3-2 에선 닫혀 있다)으로 사격장에 들어가면 "🎯 사격장이에요…" 알림, 표적 3개·사대·무기 선반·"실내 사격장" 간판. 권총으로 표적을 쏘면 넘어지고 조준선 옆에 점수(+9 등), 판에 자국. 선반 앞 E → 무기 선반 창 → 저격총을 고르면 든다. G → 3·2·1 → 60초, 위쪽에 남은 시간·점수, 표적이 좌우로 움직인다. G 로 그만 → 결과·최고 기록(🏆 신기록!) 6초. 사격장 밖에서 G → "사격장 안에서…" 알림.

- [ ] **Step 9: 커밋**

```bash
git add src/game/Game.tsx \
  src/game/data/meadow.ts \
  src/game/input/useInteractionKeys.ts \
  src/game/logic/interaction.test.ts \
  src/game/logic/interaction.ts \
  src/game/logic/meadowInteract.ts \
  src/game/logic/view.ts \
  src/game/scene/World.tsx \
  src/game/scene/guns/GunController.tsx \
  src/game/ui/GunHud.tsx \
  src/game/ui/Panels.tsx \
  src/game/ui/RackPanel.tsx \
  src/game/ui/RangeHud.tsx \
  src/game/ui/interactLabel.ts \
  src/meadow/RangeRunner.tsx \
  src/meadow/canvasStub.ts \
  src/meadow/meadowActions.test.ts \
  src/meadow/meadowSingleton.test.ts \
  src/meadow/meadowSingleton.ts \
  src/meadow/rangeActions.test.ts \
  src/meadow/rangeActions.ts \
  src/meadow/vendor.test.ts \
  src/meadow/vendor/range.d.ts \
  src/meadow/vendor/range.js \
  src/meadow/vendor/world.d.ts \
  src/meadow/vendor/world.js
git commit -F - <<'EOF'
feat: 사격장 표적·무기 선반·연습 게임

- 은지 range.js 를 복사해 빈 사격장 방에 표적 3개·사대·무기 선반을 세운다. 보조 PointLight 3개는 빼고(빛 개수 그대로), 최고 기록은 localStorage 대신 저장본(rangeBest)
- 총알이 표적판에 맞으면 링 점수(1~10), 판에 자국이 붙는다. 조준선 옆에 점수를 잠깐 띄운다
- 무기 선반 E → 무기 고르기 창(mode rack): 고르면 그 무기를 든다
- G: 사격장 안에서 60초 연습 게임 (3초 카운트다운, 움직이는 표적). 위쪽에 남은 시간·점수·명중, 끝나면 결과·최고 기록을 6초 보이고 닫는다. 사격장 안에선 "연습 게임 시작 (G)" 버튼도 (폰)
- 테스트: jsdom 엔 2D 캔버스가 없어서 은지 맵을 만드는 테스트에 가짜 2D 를 쓴다
EOF
```

검증한 스크래치 커밋: `6f6cf4b` (이 커밋의 diff 를 그대로 적용해도 된다: `git -C /private/tmp/claude-501/-Users-ihyelin-proten-hrlee-----threejs/e476c70e-362f-4ed3-9ff7-d8664da04e4b/scratchpad/plan-3-4/repo format-patch -1 --binary 6f6cf4b --stdout | git apply --index` 한 뒤 위 커밋 명령. 스크래치 커밋의 작성자는 scratch 라 `git am` 은 쓰지 않는다)

### Task 7: PvP·사격 중계 메시지와 서버 검사  — 스크래치 `1120ddd`

**Files:**
- Modify: `server/src/room.ts`, `server/src/roomRules.ts`, `src/game/data/net.ts`, `src/game/logic/netProtocol.ts`, `tools/room-smoke.mjs`
- Test: `server/src/roomRules.test.ts`, `src/game/logic/netProtocol.test.ts`

**Interfaces:**
- Consumes: Task 1 (`GUNS`·`GUN_IDS`·`GUN_RANGE`·`PEER_HIT`·`PVP`·`PVP_WEAPONS`·`isGun`·`GunId`·`PvpWeapon`), 3-3 `judgeAnimalHit`·`minHitGap`·`Member`·`memberFrom`·`handleMemberMsg`, `allowEvery`·`allowPerSecond` (`logic/rateLimit`)
- Produces: `HitWeapon = MeleeId | GunId`, `HurtBy = 'animal' | 'pvp'`, ClientMsg `animalHit { id, dmg, w: HitWeapon, n? }`·`pvpHit { target, weapon, n }`·`shot { o, d, w }`·`died { by? }`, ServerMsg `shot { id, o, d, w }`·`kill { victim, killer? }`, `NetState.hp?`, `roundShot(o, d)` (`logic/netProtocol`); `NET.serverGunHitPerSecond = 12`·`serverShotEvery = 0.05`·`serverDiedEvery = 5`·`shotOriginSlack = 6`·`killCredit = 10`; `Member.pvpAt`·`pvpBy`·`lastShot`·`lastDied`, `hitGap(prev, next)`, `judgePvpHit(shooter, msg, victim, nowSec)`, `judgeDied(member, by, killerHere, nowSec)` (`server/src/roomRules`)

- [ ] **Step 1: 실패하는 테스트 쓰기**

`src/game/logic/netProtocol.test.ts` (바꿀 곳, `git diff -U3`):

```diff
diff --git a/src/game/logic/netProtocol.test.ts b/src/game/logic/netProtocol.test.ts
--- a/src/game/logic/netProtocol.test.ts
+++ b/src/game/logic/netProtocol.test.ts
@@ -3,7 +3,7 @@ import { DEFAULT_LOOK } from '../data/characterParts'
 import { DISHES } from '../data/dishes'
 import { SNACK_IDS } from '../data/snacks'
 import { IDLE_ACTION, type PlayerAction } from './playerMotion'
-import { fromNetAct, packAnimals, parseClientMsg, parseServerMsg, roundState, stateKey, stateSendDue, toNetAct, unpackAnimals, type NetState } from './netProtocol'
+import { fromNetAct, packAnimals, parseClientMsg, parseServerMsg, roundShot, roundState, stateKey, stateSendDue, toNetAct, unpackAnimals, type NetState } from './netProtocol'
 
 const state = (over: Partial<NetState> = {}): NetState => ({
   p: [1, 2, 3], f: 0.5, v: 1, rest: false, fish: null, rod: 0.5, rodOn: true, bob: null,
@@ -92,8 +92,8 @@ describe('시계·잠 투표 메시지 (3-1)', () => {
     expect(parseServerMsg(json({ type: 'morning', day: 4 }))).toEqual({ type: 'morning', day: 4 })
     expect(parseServerMsg(json({ type: 'morning', day: 'x' }))).toBeNull()
   })
-  it('아직 모르는 종류(3-4 이후 kill 등)는 버린다', () => {
-    expect(parseServerMsg(json({ type: 'kill', victim: 'a', killer: 'b' }))).toBeNull()
+  it('아직 모르는 종류는 버린다 (옛 빌드는 새 종류를 버린다)', () => {
+    expect(parseServerMsg(json({ type: 'fireworks', at: [0, 0, 0] }))).toBeNull()
   })
 })
 
@@ -230,7 +230,7 @@ describe('동물·사냥 메시지 (3-3)', () => {
   it('animalHit {id, dmg, w} 를 읽고, 틀리면 null', () => {
     expect(parseClientMsg(json({ type: 'animalHit', id: 4, dmg: 2, w: 'stab' }))).toEqual({ type: 'animalHit', id: 4, dmg: 2, w: 'stab' })
     expect(parseClientMsg(json({ type: 'animalHit', id: 0, dmg: 1, w: 'knife' }))).toBeNull()
-    expect(parseClientMsg(json({ type: 'animalHit', id: 4, dmg: 1, w: 'pistol' }))).toBeNull()
+    expect(parseClientMsg(json({ type: 'animalHit', id: 4, dmg: 1, w: 'bow' }))).toBeNull()
     expect(parseClientMsg(json({ type: 'animalHit', id: 4, dmg: 99, w: 'fists' }))).toBeNull()
     expect(parseClientMsg(json({ type: 'animalHit', id: 1.5, dmg: 1, w: 'fists' }))).toBeNull()
   })
@@ -261,6 +261,45 @@ describe('동물·사냥 메시지 (3-3)', () => {
   })
 })
 
+describe('총·PvP 메시지 (3-4)', () => {
+  it('animalHit 에 총과 맞은 알 수 n (1~8, 1 이면 뺀다)', () => {
+    expect(parseClientMsg(json({ type: 'animalHit', id: 4, dmg: 3, w: 'shotgun', n: 3 }))).toEqual({ type: 'animalHit', id: 4, dmg: 3, w: 'shotgun', n: 3 })
+    expect(parseClientMsg(json({ type: 'animalHit', id: 4, dmg: 3, w: 'sniper', n: 1 }))).toEqual({ type: 'animalHit', id: 4, dmg: 3, w: 'sniper' })
+    expect(parseClientMsg(json({ type: 'animalHit', id: 4, dmg: 3, w: 'shotgun', n: 9 }))).toBeNull()
+  })
+  it('pvpHit {target, weapon, n}: 은지 무기 이름 (칼 찌르기 stab · 주먹 fists), 알 수 1~8', () => {
+    expect(parseClientMsg(json({ type: 'pvpHit', target: 'ab12', weapon: 'shotgun', n: 5 }))).toEqual({ type: 'pvpHit', target: 'ab12', weapon: 'shotgun', n: 5 })
+    expect(parseClientMsg(json({ type: 'pvpHit', target: 'ab12', weapon: 'stab', n: 1 }))).toEqual({ type: 'pvpHit', target: 'ab12', weapon: 'stab', n: 1 })
+    expect(parseClientMsg(json({ type: 'pvpHit', target: 'ab12', weapon: 'rod', n: 1 }))).toBeNull()
+    expect(parseClientMsg(json({ type: 'pvpHit', target: '', weapon: 'pistol', n: 1 }))).toBeNull()
+    expect(parseClientMsg(json({ type: 'pvpHit', target: 'ab12', weapon: 'pistol', n: 0 }))).toBeNull()
+  })
+  it('shot {o, d, w}: 방향은 길이 0.9~1.1 만 받아 1 로 맞춘다. 서버가 쏜 사람 id 를 붙여 돌린다', () => {
+    expect(parseClientMsg(json({ type: 'shot', o: [180, 1.5, -40], d: [0, 0, -1], w: 'rifle' }))).toEqual({ type: 'shot', o: [180, 1.5, -40], d: [0, 0, -1], w: 'rifle' })
+    expect(parseClientMsg(json({ type: 'shot', o: [180, 1.5, -40], d: [0, 0, -0.5], w: 'rifle' }))).toBeNull()
+    expect(parseClientMsg(json({ type: 'shot', o: [180, 1.5, -40], d: [0, 0, -1], w: 'knife' }))).toBeNull()
+    expect(parseServerMsg(json({ type: 'shot', id: 'ab12', o: [1, 2, 3], d: [1, 0, 0], w: 'sniper' }))).toEqual({ type: 'shot', id: 'ab12', o: [1, 2, 3], d: [1, 0, 0], w: 'sniper' })
+    expect(roundShot([1.2345, 2, 3], [0.123456, 0, -0.99233])).toEqual({ o: [1.23, 2, 3], d: [0.123, 0, -0.992] })
+  })
+  it('died {by?} → kill {victim, killer?}, hurt 에 pvp', () => {
+    expect(parseClientMsg(json({ type: 'died', by: 'ab12' }))).toEqual({ type: 'died', by: 'ab12' })
+    expect(parseClientMsg(json({ type: 'died' }))).toEqual({ type: 'died' })
+    expect(parseClientMsg(json({ type: 'died', by: 5 }))).toBeNull()
+    expect(parseServerMsg(json({ type: 'kill', victim: 'v1', killer: 'k1' }))).toEqual({ type: 'kill', victim: 'v1', killer: 'k1' })
+    expect(parseServerMsg(json({ type: 'kill', victim: 'v1' }))).toEqual({ type: 'kill', victim: 'v1' })
+    expect(parseServerMsg(json({ type: 'hurt', dmg: 70, by: 'pvp', from: 'k1' }))).toEqual({ type: 'hurt', dmg: 70, by: 'pvp', from: 'k1' })
+  })
+  it('모습의 체력 hp (0~100 정수): 틀리면 그 필드만 버리고, 바뀌면 다시 보낸다', () => {
+    expect(parseServerMsg(json({ type: 'state', id: 'a', s: state({ hp: 64 }) }))).toEqual({ type: 'state', id: 'a', s: state({ hp: 64 }) })
+    expect(parseServerMsg(json({ type: 'state', id: 'a', s: { ...state(), hp: 150 } }))).toEqual({ type: 'state', id: 'a', s: state() })
+    expect(roundState(state({ hp: 63.6 })).hp).toBe(64)
+    expect(stateKey(state({ hp: 64 }))).not.toBe(stateKey(state({ hp: 63 })))
+  })
+  it('총을 든 모습 (도구 칸 4~7)', () => {
+    expect(parseServerMsg(json({ type: 'state', id: 'a', s: state({ tool: 'sniper' }) }))).toEqual({ type: 'state', id: 'a', s: state({ tool: 'sniper' }) })
+  })
+})
+
 describe('stateSendDue (3-3 들판 근처는 5Hz 로 계속)', () => {
   const field = state({ p: [186, 1, -39] })
   const town = state({ p: [0, 1, 0] })
```

`server/src/roomRules.test.ts` (바꿀 곳, `git diff -U3`):

```diff
diff --git a/server/src/roomRules.test.ts b/server/src/roomRules.test.ts
--- a/server/src/roomRules.test.ts
+++ b/server/src/roomRules.test.ts
@@ -3,7 +3,7 @@ import { DEFAULT_LOOK } from '../../src/game/data/characterParts'
 import type { ClientMsg, NetState } from '../../src/game/logic/netProtocol'
 import { NEW_WINDOW } from '../../src/game/logic/rateLimit'
 import type { AnimalView } from '../../src/game/logic/animalSim'
-import { HERD_STEP_MIN, handleMemberMsg, herdStepDt, judgeAnimalHit, judgeHello, justAfterMorning, memberFrom, minHitGap, sleepGuardEnd, tallySleep, type Member, type RoomMeta } from './roomRules'
+import { HERD_STEP_MIN, handleMemberMsg, herdStepDt, hitGap, judgeAnimalHit, judgeDied, judgeHello, judgePvpHit, justAfterMorning, memberFrom, minHitGap, sleepGuardEnd, tallySleep, type Member, type RoomMeta } from './roomRules'
 
 const hello = (mode: 'create' | 'join', passHash = 'a'.repeat(64)): Extract<ClientMsg, { type: 'hello' }> => ({ type: 'hello', v: 1, mode, passHash, nick: '혜린', look: DEFAULT_LOOK })
 const DAY = 86_400_000
@@ -37,7 +37,7 @@ describe('judgeHello', () => {
 
 describe('handleMemberMsg', () => {
   const s: NetState = { p: [0, 1, 0], f: 0, v: 0, rest: false, fish: null, rod: 0.5, rodOn: true, bob: null, act: { emote: null, emoteAge: 30, airAge: null, landedAge: 30, eat: null, eatAge: 30 } }
-  const me: Member = { id: 'm1', nick: '혜린', look: DEFAULT_LOOK, joinedAt: 0, s: null, stateWin: NEW_WINDOW, lastChat: -Infinity, lastProfile: -Infinity, sleeping: false, sleepWin: NEW_WINDOW, lastHit: -Infinity, lastW: null, hitWin: NEW_WINDOW }
+  const me: Member = memberFrom({ id: 'm1', nick: '혜린', look: DEFAULT_LOOK, joinedAt: 0, s: null, stateWin: NEW_WINDOW, lastChat: -Infinity, lastProfile: -Infinity })
 
   it('state 는 저장하고 내 id 를 붙여 나눠 준다. 초당 10번 넘으면 버린다', () => {
     let m = me
@@ -96,7 +96,7 @@ describe('memberFrom', () => {
   })
   it('3-1 전 붙임 정보(잠 필드 없음)는 안 자는 사람·새 창으로 읽고, phase 같은 다른 필드는 버린다', () => {
     const old = { phase: 'in', id: 'o1', nick: '옛', look: DEFAULT_LOOK, joinedAt: 1, s: null, stateWin: NEW_WINDOW, lastChat: 2, lastProfile: 3 }
-    expect(memberFrom(old)).toEqual({ id: 'o1', nick: '옛', look: DEFAULT_LOOK, joinedAt: 1, s: null, stateWin: NEW_WINDOW, lastChat: 2, lastProfile: 3, sleeping: false, sleepWin: NEW_WINDOW, lastHit: -Infinity, lastW: null, hitWin: NEW_WINDOW })
+    expect(memberFrom(old)).toEqual({ id: 'o1', nick: '옛', look: DEFAULT_LOOK, joinedAt: 1, s: null, stateWin: NEW_WINDOW, lastChat: 2, lastProfile: 3, sleeping: false, sleepWin: NEW_WINDOW, lastHit: -Infinity, lastW: null, hitWin: NEW_WINDOW, pvpAt: {}, pvpBy: null, lastShot: -Infinity, lastDied: -Infinity })
     expect(memberFrom({ ...old, sleeping: true, sleepWin: { start: 5, count: 2 } })).toMatchObject({ sleeping: true, sleepWin: { start: 5, count: 2 } })
   })
 })
@@ -235,3 +235,98 @@ describe('sleepGuardEnd', () => {
     expect(sleepGuardEnd({ epoch: 10_000, day0: 1 }, 10_500)).toBeNull()
   })
 })
+
+describe('총으로 사냥 (3-4 animalHit)', () => {
+  const s: NetState = { p: [180, 1, -40], f: 0, v: 0, rest: false, fish: null, rod: 0.5, rodOn: true, bob: null, act: { emote: null, emoteAge: 30, airAge: null, landedAge: 30, eat: null, eatAge: 30 } }
+  const me = memberFrom({ id: 'm1', nick: '혜린', look: DEFAULT_LOOK, joinedAt: 0, s, stateWin: NEW_WINDOW, lastChat: -Infinity, lastProfile: -Infinity })
+  const cow: AnimalView = { id: 4, sp: 'cow', x: 230, z: -40, h: 0, pose: 'idle', hp: 3 }
+  const shot = (w: 'pistol' | 'rifle' | 'shotgun' | 'sniper', n?: number): Extract<ClientMsg, { type: 'animalHit' }> => ({ type: 'animalHit', id: 4, dmg: 99, w, ...(n ? { n } : {}) })
+
+  it('피해는 알마다 은지 값 × 맞은 알 수 (산탄총만, 최대 8): 저격 3, 산탄 5알 5, 권총 1', () => {
+    expect(judgeAnimalHit(me, shot('sniper'), cow, 10)).toMatchObject({ ok: true, dmg: 3 })
+    expect(judgeAnimalHit(me, shot('shotgun', 5), cow, 10)).toMatchObject({ ok: true, dmg: 5 })
+    expect(judgeAnimalHit(me, shot('pistol', 5), cow, 10)).toMatchObject({ ok: true, dmg: 1 })
+  })
+  it('총 사거리 80m + 판정 원 + 여유 2.5m 까지 (50m 떨어진 소도 맞는다)', () => {
+    expect(judgeAnimalHit(me, shot('rifle'), { ...cow, x: 180 + 83 }, 10)).toMatchObject({ ok: true })
+    expect(judgeAnimalHit(me, shot('rifle'), { ...cow, x: 180 + 83.1 }, 10)).toMatchObject({ ok: false })
+  })
+  it('총마다 최소 간격 (권총 0.15·소총 0.07·산탄 0.6·저격 1.2초), 총이 끼면 다음 무기 간격', () => {
+    expect(hitGap('rifle', 'rifle')).toBeCloseTo(0.07)
+    expect(hitGap('knife', 'sniper')).toBeCloseTo(1.2)
+    expect(hitGap('sniper', 'knife')).toBeCloseTo(0.4)
+    const at10 = { ...me, lastHit: 10, lastW: 'sniper' as const }
+    expect(judgeAnimalHit(at10, shot('sniper'), cow, 11.1)).toMatchObject({ ok: false })
+    expect(judgeAnimalHit(at10, shot('sniper'), cow, 11.21)).toMatchObject({ ok: true })
+  })
+  it('총은 초당 12번까지 (소총 분당 650발), 든 총이 알려져 있으면 그 총이어야 한다', () => {
+    let m: Member = me
+    let ok = 0
+    for (let i = 0; i < 14; i++) {
+      const r = judgeAnimalHit(m, shot('rifle'), cow, 10 + i * 0.071)
+      if (r.ok) ok++
+      m = r.member
+    }
+    expect(ok).toBe(12)
+    const holding = { ...me, s: { ...s, tool: 'pistol' as const } }
+    expect(judgeAnimalHit(holding, shot('rifle'), cow, 10)).toMatchObject({ ok: false })
+    expect(judgeAnimalHit(holding, shot('pistol'), cow, 10)).toMatchObject({ ok: true })
+  })
+})
+
+describe('PvP (3-4 judgePvpHit·judgeDied)', () => {
+  const at = (x: number, tool?: 'pistol' | 'shotgun' | 'knife' | 'fists'): NetState => ({ p: [x, 1, -10], f: 0, v: 0, rest: false, fish: null, rod: 0.5, rodOn: true, bob: null, act: { emote: null, emoteAge: 30, airAge: null, landedAge: 30, eat: null, eatAge: 30 }, ...(tool ? { tool } : {}) })
+  const person = (id: string, s: NetState | null) => memberFrom({ id, nick: id, look: DEFAULT_LOOK, joinedAt: 0, s, stateWin: NEW_WINDOW, lastChat: -Infinity, lastProfile: -Infinity })
+  const a = person('a', at(180, 'pistol'))
+  const b = person('b', at(190))
+  const hit = (weapon: Extract<ClientMsg, { type: 'pvpHit' }>['weapon'], n = 1): Extract<ClientMsg, { type: 'pvpHit' }> => ({ type: 'pvpHit', target: 'b', weapon, n })
+
+  it('은지 피해표: 권총 20 · 소총 14 · 산탄 9×알 수(최대 8) · 저격 70 · 칼 15 · 찌르기 30 · 주먹 5', () => {
+    const free = person('a', at(180))
+    const near = person('b', at(181))
+    expect(judgePvpHit(free, hit('pistol'), b, 10)).toMatchObject({ ok: true, dmg: 20 })
+    expect(judgePvpHit(free, hit('shotgun', 3), b, 10)).toMatchObject({ ok: true, dmg: 27 })
+    expect(judgePvpHit(free, hit('shotgun', 12), b, 10)).toMatchObject({ ok: true, dmg: 72 })
+    expect(judgePvpHit(free, hit('sniper'), b, 10)).toMatchObject({ ok: true, dmg: 70 })
+    expect(judgePvpHit(free, hit('stab'), near, 10)).toMatchObject({ ok: true, dmg: 30 })
+    expect(judgePvpHit(free, hit('fists'), near, 10)).toMatchObject({ ok: true, dmg: 5 })
+  })
+  it('같은 무기는 최소 간격 안에 또 오면 버리고, 다른 무기는 따로 센다', () => {
+    const r = judgePvpHit(a, hit('pistol'), b, 10)
+    expect(r).toMatchObject({ ok: true, shooter: { pvpAt: { pistol: 10 } } })
+    const shooter = (r as { shooter: Member }).shooter
+    expect(judgePvpHit(shooter, hit('pistol'), b, 10.1)).toEqual({ ok: false })
+    expect(judgePvpHit(shooter, hit('pistol'), b, 10.16)).toMatchObject({ ok: true })
+  })
+  it('나 자신·없는 사람·모습이 없는 사람·든 도구와 다른 무기·너무 먼 사람은 버린다', () => {
+    expect(judgePvpHit(a, { ...hit('pistol'), target: 'a' }, a, 10)).toEqual({ ok: false })
+    expect(judgePvpHit(a, hit('pistol'), undefined, 10)).toEqual({ ok: false })
+    expect(judgePvpHit(a, hit('pistol'), person('b', null), 10)).toEqual({ ok: false })
+    expect(judgePvpHit(a, hit('sniper'), b, 10)).toEqual({ ok: false })
+    // 칼: 1.8 + 몸 0.32 + 여유 2.5 = 4.62m
+    const knife = person('a', at(180, 'knife'))
+    expect(judgePvpHit(knife, hit('knife'), person('b', at(184.6)), 10)).toMatchObject({ ok: true })
+    expect(judgePvpHit(knife, hit('knife'), person('b', at(184.7)), 10)).toEqual({ ok: false })
+  })
+  it('쓰러짐: 10초 안에 나를 맞힌 사람이 방에 있으면 그 사람이 쓰러뜨린 것. 아니면 혼자 쓰러짐. 5초에 한 번', () => {
+    const hitByA = { ...b, pvpBy: { id: 'a', at: 20 } }
+    expect(judgeDied(hitByA, 'a', true, 25)).toEqual({ ok: true, member: { ...hitByA, lastDied: 25, pvpBy: null }, out: { type: 'kill', victim: 'b', killer: 'a' } })
+    expect(judgeDied(hitByA, 'c', true, 25)).toMatchObject({ out: { type: 'kill', victim: 'b' } })
+    expect(judgeDied(hitByA, 'a', true, 31)).toEqual(expect.objectContaining({ out: { type: 'kill', victim: 'b' } }))
+    expect(judgeDied(hitByA, 'a', false, 25)).toEqual(expect.objectContaining({ out: { type: 'kill', victim: 'b' } }))
+    expect(judgeDied(b, undefined, false, 25)).toMatchObject({ ok: true, out: { type: 'kill', victim: 'b' } })
+    expect(judgeDied({ ...b, lastDied: 22 }, undefined, false, 25)).toEqual({ ok: false })
+  })
+  it('shot 은 쏜 사람 id 를 붙여 남에게 넘긴다 (0.05초에 한 번, 내 자리에서 6m 넘는 총구는 버린다)', () => {
+    const msg = { type: 'shot' as const, o: [180.123, 1.5, -10] as [number, number, number], d: [0, 0, -1] as [number, number, number], w: 'rifle' as const }
+    const r = handleMemberMsg(a, msg, 10)
+    expect(r.out).toEqual({ type: 'shot', id: 'a', o: [180.12, 1.5, -10], d: [0, 0, -1], w: 'rifle' })
+    expect(handleMemberMsg(r.member, msg, 10.03).out).toBeNull()
+    expect(handleMemberMsg(r.member, msg, 10.06).out).not.toBeNull()
+    expect(handleMemberMsg(a, { ...msg, o: [190, 1.5, -10] }, 10).out).toBeNull()
+  })
+  it('pvpHit·died 는 handleMemberMsg 가 넘기지 않는다 (room.ts 가 맞은 사람을 본다)', () => {
+    expect(handleMemberMsg(a, hit('pistol'), 10)).toEqual({ member: a, out: null })
+    expect(handleMemberMsg(a, { type: 'died' }, 10)).toEqual({ member: a, out: null })
+  })
+})
```

- [ ] **Step 2: 실행해 실패 확인**

Run: `npx vitest run src/game/logic/netProtocol.test.ts server/src/roomRules.test.ts`
Expected: FAIL — `roundShot is not a function`, `pvpHit`·`shot`·`died`·`kill` 이 null, `judgePvpHit is not a function`, memberFrom 에 `pvpAt` 없음

- [ ] **Step 3: 메시지 모양**

`src/game/data/net.ts` (바꿀 곳, `git diff -U3`):

```diff
diff --git a/src/game/data/net.ts b/src/game/data/net.ts
--- a/src/game/data/net.ts
+++ b/src/game/data/net.ts
@@ -53,8 +53,16 @@ export const NET = {
   hitSlack: 2.5,
   /** 서버 명중 검사: 공격 종류를 바꿀 때 최소 간격에서 빼 주는 여유(초, 메시지가 몰려 닿는 만큼) */
   hitTimingSlack: 0.1,
-  /** 서버 속도 제한: animalHit 초당 횟수 (버린 것도 센다) */
+  /** 서버 속도 제한: animalHit 초당 횟수 (버린 것도 센다). 총은 연사(소총 분당 650발)라 따로 */
   serverHitPerSecond: 4,
+  serverGunHitPerSecond: 12,
+  /** 서버 속도 제한: 남에게 보여 줄 사격(shot) 최소 간격(초, 은지 SHOT_MIN_MS), 쓰러짐(died) 최소 간격(초) */
+  serverShotEvery: 0.05,
+  serverDiedEvery: 5,
+  /** 쏜 자리(총구)가 내 마지막 모습에서 이보다(m) 멀면 shot 을 버린다 (남의 화면에 엉뚱한 궤적을 그리지 않게) */
+  shotOriginSlack: 6,
+  /** 쓰러뜨린 사람으로 쳐 주는 시간(초): 쓰러지기 이만큼 안에 나를 맞힌 사람만 kill 알림에 나온다 */
+  killCredit: 10,
   /** 방에 사람이 있는 동안 서버가 시계 확인(time)을 보내고 잠 표시를 다시 세는 간격(초). 서버 alarm 은 이것만 건다 */
   clockEvery: 30,
   /** 서버가 받는 메시지 최대 길이(글자) */
```

`src/game/logic/netProtocol.ts` (바꿀 곳, `git diff -U3`):

```diff
diff --git a/src/game/logic/netProtocol.ts b/src/game/logic/netProtocol.ts
--- a/src/game/logic/netProtocol.ts
+++ b/src/game/logic/netProtocol.ts
@@ -2,6 +2,7 @@ import { SPECIES_IDS } from '../data/animals'
 import { DAY_LENGTH } from '../data/balance'
 import { DISHES } from '../data/dishes'
 import { EMOTES, type EmoteId } from '../data/emotes'
+import { GUN_IDS, PVP_WEAPONS, type GunId, type PvpWeapon } from '../data/guns'
 import { MEADOW_DISH_IDS, RAW_ITEM_IDS, isMeadowDish, type MeadowDishId, type RawItemId } from '../data/meadowItems'
 import { MELEE_IDS, type MeleeId } from '../data/melee'
 import { NET } from '../data/net'
@@ -35,9 +36,10 @@ export type NetBoat = { dir: BoatDir; t: number }
 const BOAT_DIRS: BoatDir[] = ['toIsland', 'toMeadow']
 /**
  * 내 모습 한 장면. p: 몸 가운데(캡슐 가운데) 위치, f: 바라보는 각도, v: 수평 속도.
- * tool: 손에 든 도구 (3-2. 빈손이거나 옛 클라이언트면 없다. 낚싯대가 보이는지는 rodOn 이 정한다)
+ * tool: 손에 든 도구 (3-2. 빈손이거나 옛 클라이언트면 없다. 낚싯대가 보이는지는 rodOn 이 정한다).
+ * hp: 체력 0~100 정수 (3-4, 이름표 아래 체력 막대. 옛 클라이언트면 없다)
  */
-export type NetState = { p: Vec3; f: number; v: number; rest: boolean; fish: FishingLook | null; rod: number; rodOn: boolean; bob: Vec3 | null; act: NetAct; boat?: NetBoat; tool?: ToolId }
+export type NetState = { p: Vec3; f: number; v: number; rest: boolean; fish: FishingLook | null; rod: number; rodOn: boolean; bob: Vec3 | null; act: NetAct; boat?: NetBoat; tool?: ToolId; hp?: number }
 export type JoinMode = 'create' | 'join'
 export type ErrorCode = 'bad-hello' | 'room-exists' | 'no-room' | 'bad-password' | 'full' | 'version'
 export const ERROR_CODES: ErrorCode[] = ['bad-hello', 'room-exists', 'no-room', 'bad-password', 'full', 'version']
@@ -50,14 +52,28 @@ export type ClientMsg =
   | { type: 'profile'; nick: string; look: CharacterLook }
   /** 같이 하기 잠 투표: 침대에 누웠다(on) / 일어났다 */
   | { type: 'sleep'; on: boolean }
-  /** 들판 동물을 때렸다 (3-3). 피해는 서버가 공격 종류(w)로 정한다 (dmg 는 내 화면에서 본 값) */
-  | { type: 'animalHit'; id: number; dmg: number; w: MeleeId }
+  /**
+   * 들판 동물을 때렸다 (3-3) · 쐈다 (3-4). 피해는 서버가 무기(w)로 정한다 (dmg 는 내 화면에서 본 값).
+   * n: 맞은 알 수 (산탄총, 최대 8. 없으면 1)
+   */
+  | { type: 'animalHit'; id: number; dmg: number; w: HitWeapon; n?: number }
+  /** 다른 사람을 맞혔다 (3-4 PvP, 쏜 사람 화면이 판정한다). n: 맞은 알 수 (산탄총, 최대 8) */
+  | { type: 'pvpHit'; target: string; weapon: PvpWeapon; n: number }
+  /** 쐈다: 남의 화면에 궤적·불꽃·소리 (판정 없음). o: 총구, d: 방향 (단위 벡터) */
+  | { type: 'shot'; o: Vec3; d: Vec3; w: GunId }
+  /** 내가 쓰러졌다. by: 마지막으로 나를 맞힌 사람 (PvP) */
+  | { type: 'died'; by?: string }
 
 /** 동물 한 마리 보내는 모양: [번호, 종(SPECIES_IDS 순서), x, z, 방향, 동작(ANIMAL_POSES 순서), 체력]. 소수 둘째 자리 */
 export type AnimalTuple = [number, number, number, number, number, number, number]
-/** 누구에게 맞았나: 동물 (3-4 에서 pvp) */
-export type HurtBy = 'animal'
-const HURT_BY: HurtBy[] = ['animal']
+/** 동물을 맞힌 무기: 근접 (3-3) · 총 (3-4) */
+export type HitWeapon = MeleeId | GunId
+const HIT_WEAPONS: HitWeapon[] = [...MELEE_IDS, ...GUN_IDS]
+/** 산탄총 한 발의 알 수 상한 (은지 n ≤ 8) */
+const MAX_PELLETS = 8
+/** 누구에게 맞았나: 동물 (3-3) · 다른 사람 (3-4, from 이 쏜 사람) */
+export type HurtBy = 'animal' | 'pvp'
+const HURT_BY: HurtBy[] = ['animal', 'pvp']
 
 /**
  * 서버 → 클라이언트. 3-1 에서 더한 것: welcome.time (방 시계), time (30초마다 시계 확인), sleepers (자는 사람 수 / 필요한 수), morning (모두 아침).
@@ -79,6 +95,9 @@ export type ServerMsg =
   | { type: 'animals'; list: AnimalTuple[] }
   | { type: 'loot'; items: RawItemId[]; x: number; z: number }
   | { type: 'hurt'; dmg: number; by: HurtBy; from?: string }
+  /** 3-4: 남이 쐈다 (궤적만 그린다), 누가 쓰러졌다 (killer: 쓰러뜨린 사람, 없으면 혼자 쓰러짐) */
+  | { type: 'shot'; id: string; o: Vec3; d: Vec3; w: GunId }
+  | { type: 'kill'; victim: string; killer?: string }
 
 const EMOTE_IDS = EMOTES.map((e) => e.id)
 const FOOD_IDS: FoodId[] = [...DISHES.map((d) => d.id), ...SNACK_IDS, ...MEADOW_DISH_IDS]
@@ -168,12 +187,24 @@ export function readNetState(v: unknown): NetState | null {
   // 배 정보는 틀려도 그 필드만 버린다 (모습 전체를 버리지 않는다)
   const boat = readBoat(v.boat)
   if (boat) out.boat = boat
-  // 도구도 틀리면 그 필드만 버린다 (모르는 도구 = 3-4 의 총을 든 새 클라이언트)
+  // 도구도 틀리면 그 필드만 버린다 (모르는 도구 = 더 새 클라이언트)
   const tool = oneOf(v.tool, TOOL_IDS)
   if (tool) out.tool = tool
+  // 체력도 틀리면 그 필드만 버린다
+  const hp = int(v.hp, 0, 100)
+  if (hp !== null) out.hp = hp
   return out
 }
 
+/** 단위 벡터 (길이 0.9~1.1 만 받고 1 로 맞춘다). 틀리면 null */
+function unit(v: unknown): Vec3 | null {
+  const d = Array.isArray(v) && v.length === 3 ? v.map((x) => num(x, -1.1, 1.1)) : null
+  if (!d || d.some((x) => x === null)) return null
+  const [x, y, z] = d as number[]
+  const l = Math.hypot(x, y, z)
+  return l >= 0.9 && l <= 1.1 ? [x / l, y / l, z / l] : null
+}
+
 function parse(raw: string): Record<string, unknown> | null {
   try {
     const v: unknown = JSON.parse(raw)
@@ -212,9 +243,28 @@ export function parseClientMsg(raw: string): ClientMsg | null {
       return typeof m.on === 'boolean' ? { type: 'sleep', on: m.on } : null
     case 'animalHit': {
       const i = int(m.id, 1, 1e9)
-      const dmg = num(m.dmg, 0, 10)
-      const w = oneOf(m.w, MELEE_IDS)
-      return i !== null && dmg !== null && w ? { type: 'animalHit', id: i, dmg, w } : null
+      const dmg = num(m.dmg, 0, 30)
+      const w = oneOf(m.w, HIT_WEAPONS)
+      const n = m.n === undefined ? 1 : int(m.n, 1, MAX_PELLETS)
+      if (i === null || dmg === null || !w || n === null) return null
+      return n > 1 ? { type: 'animalHit', id: i, dmg, w, n } : { type: 'animalHit', id: i, dmg, w }
+    }
+    case 'pvpHit': {
+      const target = id(m.target)
+      const weapon = oneOf(m.weapon, PVP_WEAPONS)
+      const n = int(m.n, 1, MAX_PELLETS)
+      return target && weapon && n !== null ? { type: 'pvpHit', target, weapon, n } : null
+    }
+    case 'shot': {
+      const o = vec3(m.o)
+      const d = unit(m.d)
+      const w = oneOf(m.w, GUN_IDS)
+      return o && d && w ? { type: 'shot', o, d, w } : null
+    }
+    case 'died': {
+      if (m.by === undefined) return { type: 'died' }
+      const by = id(m.by)
+      return by ? { type: 'died', by } : null
     }
     default:
       return null
@@ -316,6 +366,20 @@ export function parseServerMsg(raw: string): ServerMsg | null {
       const from = id(m.from)
       return from ? { type: 'hurt', dmg, by, from } : { type: 'hurt', dmg, by }
     }
+    case 'shot': {
+      const i = id(m.id)
+      const o = vec3(m.o)
+      const d = unit(m.d)
+      const w = oneOf(m.w, GUN_IDS)
+      return i && o && d && w ? { type: 'shot', id: i, o, d, w } : null
+    }
+    case 'kill': {
+      const victim = id(m.victim)
+      if (!victim) return null
+      if (m.killer === undefined) return { type: 'kill', victim }
+      const killer = id(m.killer)
+      return killer ? { type: 'kill', victim, killer } : null
+    }
     default:
       return null
   }
@@ -352,12 +416,19 @@ export function roundState(s: NetState): NetState {
   if (a.meal) out.act.meal = a.meal
   if (s.boat) out.boat = { dir: s.boat.dir, t: r2(s.boat.t) }
   if (s.tool) out.tool = s.tool
+  if (s.hp !== undefined) out.hp = Math.round(s.hp)
   return out
 }
 
+/** 보내기 전 사격 (총구 소수 둘째, 방향 소수 셋째 자리. 은지 그대로) */
+export function roundShot(o: Vec3, d: Vec3): { o: Vec3; d: Vec3 } {
+  const r3d = (n: number) => Math.round(n * 1000) / 1000 + 0
+  return { o: r3(o), d: [r3d(d[0]), r3d(d[1]), r3d(d[2])] }
+}
+
 /** "바뀐 게 있나" 비교용 열쇠. 저절로 늘어나는 나이(몇 초 전)는 빼고 무엇을 하는지만 넣는다 */
 export function stateKey(s: NetState): string {
-  return JSON.stringify([s.p, s.f, s.v, s.rest, s.fish, s.rod, s.rodOn, s.bob, s.act.emote, s.act.eat, s.act.meal ?? null, s.act.airAge !== null, s.boat?.dir ?? null, s.tool ?? null])
+  return JSON.stringify([s.p, s.f, s.v, s.rest, s.fish, s.rod, s.rodOn, s.bob, s.act.emote, s.act.eat, s.act.meal ?? null, s.act.airAge !== null, s.boat?.dir ?? null, s.tool ?? null, s.hp ?? null])
 }
 
 /**
```

- [ ] **Step 4: 서버 검사·중계**

`server/src/roomRules.ts` (바꿀 곳, `git diff -U3`):

```diff
diff --git a/server/src/roomRules.ts b/server/src/roomRules.ts
--- a/server/src/roomRules.ts
+++ b/server/src/roomRules.ts
@@ -1,10 +1,11 @@
 import { hitRadius } from '../../src/game/data/animals'
-import { MELEE, hitDelay, meleeFor, type MeleeId } from '../../src/game/data/melee'
+import { GUNS, GUN_RANGE, PEER_HIT, PVP, isGun, type PvpWeapon } from '../../src/game/data/guns'
+import { MELEE, MELEE_IDS, hitDelay, meleeFor, type MeleeId } from '../../src/game/data/melee'
 import { NET } from '../../src/game/data/net'
 import type { CharacterLook } from '../../src/game/data/types'
 import type { AnimalView } from '../../src/game/logic/animalSim'
 import type { RoomClock } from '../../src/game/logic/dayClock'
-import type { ClientMsg, ErrorCode, NetState, ServerMsg } from '../../src/game/logic/netProtocol'
+import { roundShot, type ClientMsg, type ErrorCode, type HitWeapon, type NetState, type ServerMsg } from '../../src/game/logic/netProtocol'
 import { NEW_WINDOW, allowEvery, allowPerSecond, type RateWindow } from '../../src/game/logic/rateLimit'
 
 /** 방 저장소에 두는 것: 암호 해시와 만든·마지막으로 쓴 시각(ms) */
@@ -12,7 +13,8 @@ export type RoomMeta = { passHash: string; createdAt: number; lastActive: number
 
 /**
  * 방에 들어온 사람 (웹소켓 붙임 정보). 시각은 초. sleeping: 잠 투표 중 (침대에 누워 있다).
- * lastHit·lastW: 마지막으로 받은 동물 명중과 그 공격 종류, hitWin: animalHit 메시지 1초 창 (버린 것도 센다)
+ * lastHit·lastW: 마지막으로 받은 동물 명중과 그 무기, hitWin: animalHit 메시지 1초 창 (버린 것도 센다).
+ * 3-4: pvpAt: 무기마다 마지막으로 받은 PvP 명중, pvpBy: 마지막으로 나를 맞힌 사람과 때 (쓰러뜨린 사람 알림), lastShot·lastDied: 마지막 shot·died
  */
 export type Member = {
   id: string
@@ -26,15 +28,19 @@ export type Member = {
   sleeping: boolean
   sleepWin: RateWindow
   lastHit: number
-  lastW: MeleeId | null
+  lastW: HitWeapon | null
   hitWin: RateWindow
+  pvpAt: Partial<Record<PvpWeapon, number>>
+  pvpBy: { id: string; at: number } | null
+  lastShot: number
+  lastDied: number
 }
 
 /**
  * 웹소켓 붙임 정보 → 사람. 3-1 전에 붙은 소켓(배포 중 살아 있던 방)엔 잠 필드가 없다: 안 자는 사람·새 창으로 본다.
- * 3-3 전 소켓엔 lastHit 이 없다: 한 번도 안 때린 사람. lastW·hitWin 이 없으면 모르는 종류·새 창
+ * 3-3 전 소켓엔 lastHit 이 없다: 한 번도 안 때린 사람. lastW·hitWin 이 없으면 모르는 종류·새 창. 3-4 전 소켓은 PvP·사격을 한 적 없는 사람
  */
-type Optional = 'sleeping' | 'sleepWin' | 'lastHit' | 'lastW' | 'hitWin'
+type Optional = 'sleeping' | 'sleepWin' | 'lastHit' | 'lastW' | 'hitWin' | 'pvpAt' | 'pvpBy' | 'lastShot' | 'lastDied'
 export function memberFrom(a: Omit<Member, Optional> & Partial<Pick<Member, Optional>>): Member {
   return {
     id: a.id,
@@ -50,6 +56,10 @@ export function memberFrom(a: Omit<Member, Optional> & Partial<Pick<Member, Opti
     lastHit: a.lastHit ?? -Infinity,
     lastW: a.lastW ?? null,
     hitWin: a.hitWin ?? NEW_WINDOW,
+    pvpAt: a.pvpAt ?? {},
+    pvpBy: a.pvpBy ?? null,
+    lastShot: a.lastShot ?? -Infinity,
+    lastDied: a.lastDied ?? -Infinity,
   }
 }
 
@@ -94,13 +104,36 @@ export function handleMemberMsg(member: Member, msg: ClientMsg, nowSec: number):
       if (!r.ok) return { member: { ...member, sleeping: msg.on }, out: null, quiet: true }
       return { member: { ...member, sleeping: msg.on, sleepWin: r.w }, out: null }
     }
+    case 'shot': {
+      // 남의 화면에 궤적만 그린다 (판정 없음, 은지 그대로). 너무 잦거나 내 자리에서 먼 총구는 버린다
+      if (!allowEvery(member.lastShot, nowSec, NET.serverShotEvery)) return { member, out: null }
+      const p = member.s?.p
+      if (p && Math.hypot(msg.o[0] - p[0], msg.o[1] - p[1], msg.o[2] - p[2]) > NET.shotOriginSlack) return { member, out: null }
+      return { member: { ...member, lastShot: nowSec }, out: { type: 'shot', id: member.id, ...roundShot(msg.o, msg.d), w: msg.w } }
+    }
     case 'hello':
     case 'animalHit':
-      // 동물 명중은 방의 동물을 봐야 해서 room.ts 가 judgeAnimalHit 로 본다
+    case 'pvpHit':
+    case 'died':
+      // 동물 명중은 방의 동물을, PvP·쓰러짐은 맞은 사람을 봐야 해서 room.ts 가 judgeAnimalHit·judgePvpHit·judgeDied 로 본다
       return { member, out: null }
   }
 }
 
+const isMelee = (w: HitWeapon | PvpWeapon): w is MeleeId => (MELEE_IDS as string[]).includes(w)
+
+/** 든 도구로 할 수 있는 공격인가 (도구를 모르면(옛 클라이언트) 믿는다). 총은 그 총을 들고 있어야 한다 */
+function toolAllows(s: NetState, w: HitWeapon | PvpWeapon): boolean {
+  if (!s.tool) return true
+  return isMelee(w) ? meleeFor(s.tool, w === 'stab') === w : s.tool === w
+}
+
+/** 무기 사거리 (m): 근접은 공격 표, 총은 은지 MAX_RANGE */
+const reachOf = (w: HitWeapon | PvpWeapon) => (isMelee(w) ? MELEE[w].reach : GUN_RANGE)
+
+/** 산탄총 알 수 (1 ~ 그 총의 알 수). 다른 무기는 1 */
+const pellets = (w: HitWeapon | PvpWeapon, n: number | undefined) => (isGun(w) ? Math.min(GUNS[w].pellets, Math.max(1, Math.floor(n ?? 1))) : 1)
+
 /**
  * 앞 명중(prev)에서 다음 명중(next)까지 받는 최소 간격(초). 화면에선 앞 공격 간격(cool)이 지나야 다시 휘두르고
  * 맞는 순간은 공격마다 달라서, 종류를 바꾸면 cool(prev) + 맞는 순간(next) − 맞는 순간(prev) 이 된다 (여유 NET.hitTimingSlack 을 뺀다).
@@ -111,23 +144,59 @@ export function minHitGap(prev: MeleeId, next: MeleeId): number {
 }
 
 /**
- * 동물 명중 검사 (같이 하기). 받아들이면 피해(공격 종류 표의 값, 보낸 dmg 는 믿지 않는다)와 마지막 명중 시각·종류를 고친 사람.
- * 버리는 것: 초당 NET.serverHitPerSecond 번 넘게 온 것(버린 것도 센다), 모습을 아직 안 보낸 사람, 든 도구로 할 수 없는 공격,
- * 없거나 쓰러진 동물, 앞 명중에서 minHitGap 안에 또 온 것, 내 마지막 모습에서 사거리 + 판정 원 + 여유(NET.hitSlack) 보다 먼 동물.
+ * 앞 명중(prev 무기)에서 다음 명중(next)까지 받는 동물 명중 최소 간격(초). 근접끼리는 minHitGap,
+ * 총이 끼면 다음 무기의 간격 (총은 은지 HIT_COOL: 권총 0.15·소총 0.07·산탄 0.6·저격 1.2초, 근접은 serverCool)
+ */
+export function hitGap(prev: HitWeapon, next: HitWeapon): number {
+  if (isMelee(prev) && isMelee(next)) return minHitGap(prev, next)
+  return isMelee(next) ? MELEE[next].serverCool : PVP[next].cool
+}
+
+/**
+ * 동물 명중 검사 (같이 하기). 받아들이면 피해(무기 표의 값, 보낸 dmg 는 믿지 않는다)와 마지막 명중 시각·무기를 고친 사람.
+ * 피해: 근접은 공격 표, 총은 알마다 은지 피해(저격 3, 나머지 1) × 맞은 알 수 (산탄총만 여럿, 최대 8).
+ * 버리는 것: 초당 NET.serverHitPerSecond 번(총은 serverGunHitPerSecond) 넘게 온 것(버린 것도 센다), 모습을 아직 안 보낸 사람,
+ * 든 도구로 할 수 없는 공격, 없거나 쓰러진 동물, 앞 명중에서 hitGap 안에 또 온 것, 내 마지막 모습에서 사거리 + 판정 원 + 여유(NET.hitSlack) 보다 먼 동물.
  * 버려도 member 를 돌려준다 (1초 창을 남긴다)
  */
 export function judgeAnimalHit(member: Member, msg: Extract<ClientMsg, { type: 'animalHit' }>, animal: AnimalView | undefined, nowSec: number): { ok: true; dmg: number; member: Member } | { ok: false; member: Member } {
-  const rate = allowPerSecond(member.hitWin, nowSec, NET.serverHitPerSecond)
+  const rate = allowPerSecond(member.hitWin, nowSec, isMelee(msg.w) ? NET.serverHitPerSecond : NET.serverGunHitPerSecond)
   if (!rate.ok) return { ok: false, member }
   const counted: Member = { ...member, hitWin: rate.w }
   const no = { ok: false as const, member: counted }
-  const m = MELEE[msg.w]
   if (!member.s || !animal || animal.pose === 'dead') return no
-  if (member.s.tool && meleeFor(member.s.tool, msg.w === 'stab') !== msg.w) return no
-  if (nowSec - member.lastHit < minHitGap(member.lastW ?? msg.w, msg.w)) return no
+  if (!toolAllows(member.s, msg.w)) return no
+  if (nowSec - member.lastHit < hitGap(member.lastW ?? msg.w, msg.w)) return no
   const d = Math.hypot(member.s.p[0] - animal.x, member.s.p[2] - animal.z)
-  if (d > m.reach + hitRadius(animal.sp) + NET.hitSlack) return no
-  return { ok: true, dmg: m.dmg, member: { ...counted, lastHit: nowSec, lastW: msg.w } }
+  if (d > reachOf(msg.w) + hitRadius(animal.sp) + NET.hitSlack) return no
+  const dmg = isMelee(msg.w) ? MELEE[msg.w].dmg : GUNS[msg.w].dmg * pellets(msg.w, msg.n)
+  return { ok: true, dmg, member: { ...counted, lastHit: nowSec, lastW: msg.w } }
+}
+
+/**
+ * PvP 명중 검사 (은지 server hit). 쏜 사람 화면이 판정한 것을 무기 피해표(PVP)와 무기마다 최소 간격으로만 본다.
+ * 받아들이면 피해(권총 20 · 소총 14 · 산탄 9×알 수(최대 8) · 저격 70 · 칼 15 · 찌르기 30 · 주먹 5)와 그 무기 시각을 고친 쏜 사람.
+ * 버리는 것: 없거나 나 자신인 사람, 모습을 아직 안 보낸 사람(쏜 사람·맞은 사람), 든 도구로 할 수 없는 무기,
+ * 같은 무기로 최소 간격 안에 또 온 것, 서로의 마지막 모습이 사거리 + 몸 반지름 + 여유(NET.hitSlack) 보다 먼 것
+ */
+export function judgePvpHit(shooter: Member, msg: Extract<ClientMsg, { type: 'pvpHit' }>, victim: Member | undefined, nowSec: number): { ok: true; dmg: number; shooter: Member } | { ok: false } {
+  const w = msg.weapon
+  if (!victim || victim.id === shooter.id || !shooter.s || !victim.s) return { ok: false }
+  if (!toolAllows(shooter.s, w)) return { ok: false }
+  if (nowSec - (shooter.pvpAt[w] ?? -Infinity) < PVP[w].cool) return { ok: false }
+  const [a, b] = [shooter.s.p, victim.s.p]
+  if (Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]) > reachOf(w) + PEER_HIT.radius + NET.hitSlack) return { ok: false }
+  return { ok: true, dmg: PVP[w].dmg * pellets(w, msg.n), shooter: { ...shooter, pvpAt: { ...shooter.pvpAt, [w]: nowSec } } }
+}
+
+/**
+ * 쓰러짐 알림 (died). 너무 잦으면(NET.serverDiedEvery 안) 버린다. 쓰러뜨린 사람(killer)은 by 가 정말 NET.killCredit 초 안에
+ * 나를 맞힌 사람이고 아직 방에 있을 때만 (거짓 알림을 막는다). 알린 뒤 맞힌 기록을 지운다
+ */
+export function judgeDied(member: Member, by: string | undefined, killerHere: boolean, nowSec: number): { ok: true; member: Member; out: ServerMsg } | { ok: false } {
+  if (!allowEvery(member.lastDied, nowSec, NET.serverDiedEvery)) return { ok: false }
+  const credited = by !== undefined && killerHere && member.pvpBy?.id === by && nowSec - member.pvpBy.at <= NET.killCredit
+  return { ok: true, member: { ...member, lastDied: nowSec, pvpBy: null }, out: credited ? { type: 'kill', victim: member.id, killer: by } : { type: 'kill', victim: member.id } }
 }
 
 /** 동물을 움직이는 최소 간격(초): 사람 메시지(5Hz)가 올 때 움직이되, 0.2초에 조금 못 미쳐 와도 건너뛰지 않게 0.75 × NET.animalEvery */
```

`server/src/room.ts` (바꿀 곳, `git diff -U3`):

```diff
diff --git a/server/src/room.ts b/server/src/room.ts
--- a/server/src/room.ts
+++ b/server/src/room.ts
@@ -6,7 +6,7 @@ import { herdViews, hitAnimal, newHerd, stepHerd, type Herd, type HerdPlayer } f
 import { newRoomClock, roomMorning, roomTime, type RoomClock } from '../../src/game/logic/dayClock'
 import { packAnimals, parseClientMsg, type ClientMsg, type ErrorCode, type PeerInfo, type ServerMsg } from '../../src/game/logic/netProtocol'
 import { NEW_WINDOW } from '../../src/game/logic/rateLimit'
-import { handleMemberMsg, herdStepDt, judgeAnimalHit, judgeHello, memberFrom, sleepGuardEnd, tallySleep, type Member, type RoomMeta } from './roomRules'
+import { handleMemberMsg, herdStepDt, judgeAnimalHit, judgeDied, judgeHello, judgePvpHit, memberFrom, sleepGuardEnd, tallySleep, type Member, type RoomMeta } from './roomRules'
 
 /** 웹소켓 붙임 정보: 아직 hello 전이거나, 들어온 사람 */
 type Attachment = { phase: 'hello' } | ({ phase: 'in' } & Member)
@@ -21,7 +21,8 @@ const toMember = (a: Extract<Attachment, { phase: 'in' }>): Member => memberFrom
  * 들판 동물은 alarm 없이 사람 메시지가 올 때 지난번부터 지난 만큼(0.15초에 한 번까지, 최대 1초) 움직여 모두에게 보낸다:
  * 들판 근처 사람은 가만히 있어도 5Hz 로 모습을 보내므로 그동안 5Hz 로 움직이고, 아무도 안 보내면 멈춘다 (메시지는 alarm 보다 20배 싸다).
  * alarm 은 사람이 있는 동안만 30초마다 건다 (시계 확인·잠 표시 다시 세기). 미룬 잠 표시가 있으면 그때 잠깐 당겨 건다.
- * 동물은 메모리에만 둔다 (방이 비거나 메모리가 사라지면 버리고 다음 메시지에 새로 만든다)
+ * 동물은 메모리에만 둔다 (방이 비거나 메모리가 사라지면 버리고 다음 메시지에 새로 만든다).
+ * PvP (3-4): 쏜 사람의 pvpHit 를 무기 표·간격으로 검사해 맞은 사람에게만 hurt, 쓰러진 사람의 died 로 모두에게 kill
  */
 export class Room extends DurableObject<Env> {
   /** 들판 동물과 마지막으로 움직인 때(ms, 무리가 없으면 null) */
@@ -65,6 +66,10 @@ export class Room extends DurableObject<Env> {
         lastHit: -Infinity,
         lastW: null,
         hitWin: NEW_WINDOW,
+        pvpAt: {},
+        pvpBy: null,
+        lastShot: -Infinity,
+        lastDied: -Infinity,
       }
       ws.serializeAttachment({ phase: 'in', ...me } satisfies Attachment)
       const players: PeerInfo[] = this.members(ws).map(({ m }) => ({ id: m.id, nick: m.nick, look: m.look, s: m.s }))
@@ -82,6 +87,8 @@ export class Room extends DurableObject<Env> {
     const member = toMember(att)
     const now = Date.now()
     if (msg.type === 'animalHit') return this.hitAnimal(ws, member, msg, now)
+    if (msg.type === 'pvpHit') return this.hitPeer(ws, member, msg, now)
+    if (msg.type === 'died') return this.died(ws, member, msg.by, now)
     const r = handleMemberMsg(member, msg, now / 1000)
     if (r.member !== member) ws.serializeAttachment({ phase: 'in', ...r.member } satisfies Attachment)
     if (r.out) this.broadcast(r.out, ws)
@@ -107,6 +114,24 @@ export class Room extends DurableObject<Env> {
     this.sendAnimals(all)
   }
 
+  /** PvP 명중: 검사해서 맞은 사람에게만 hurt (그 사람 화면이 체력을 깎는다). 맞은 사람에게 누가 맞혔는지 남긴다 (kill 알림) */
+  private hitPeer(ws: WebSocket, member: Member, msg: Extract<ClientMsg, { type: 'pvpHit' }>, now: number) {
+    const target = this.members().find(({ m }) => m.id === msg.target)
+    const v = judgePvpHit(member, msg, target?.m, now / 1000)
+    if (!v.ok || !target) return
+    ws.serializeAttachment({ phase: 'in', ...v.shooter } satisfies Attachment)
+    target.ws.serializeAttachment({ phase: 'in', ...target.m, pvpBy: { id: member.id, at: now / 1000 } } satisfies Attachment)
+    send(target.ws, { type: 'hurt', dmg: v.dmg, by: 'pvp', from: member.id })
+  }
+
+  /** 쓰러짐: 모두에게 kill (쓰러뜨린 사람은 정말 방금 맞힌 사람일 때만) */
+  private died(ws: WebSocket, member: Member, by: string | undefined, now: number) {
+    const v = judgeDied(member, by, by !== undefined && this.members(ws).some(({ m }) => m.id === by), now / 1000)
+    if (!v.ok) return
+    ws.serializeAttachment({ phase: 'in', ...v.member } satisfies Attachment)
+    this.broadcastAll(v.out)
+  }
+
   /** 동물을 움직일 때가 됐으면(force 면 늘) 움직이고 모두에게 보낸다 */
   private stepAnimals(now: number, force = false) {
     const all = this.members()
```

- [ ] **Step 5: 테스트 통과 확인**

Run: `npx vitest run && npx tsc -b && npm run lint 2>&1 | grep -c warning`
Expected: 모든 테스트 PASS, tsc 오류 없음, 경고 6

- [ ] **Step 6: 서버 점검**

`tools/room-smoke.mjs` (바꿀 곳, `git diff -U3`):

```diff
diff --git a/tools/room-smoke.mjs b/tools/room-smoke.mjs
--- a/tools/room-smoke.mjs
+++ b/tools/room-smoke.mjs
@@ -1,4 +1,4 @@
-// 로컬 방 서버(npm run server:dev) 확인: 만들기·틀린 암호·들어가기·state·chat·나가기, 방 시계·잠 투표·잠 표시 횟수 제한·아침 직후 눕기 미루기, 들판 동물(메시지에 맞춰 움직임)·명중·전리품·반격
+// 로컬 방 서버(npm run server:dev) 확인: 만들기·틀린 암호·들어가기·state·chat·나가기, 방 시계·잠 투표·잠 표시 횟수 제한·아침 직후 눕기 미루기, 들판 동물(메시지에 맞춰 움직임)·명중·전리품·반격, PvP·사격 중계·쓰러짐 알림·총 사냥
 // 사용: node tools/room-smoke.mjs [ws://127.0.0.1:8787]
 import { createHash } from 'node:crypto'
 
@@ -182,5 +182,52 @@ await wait(1900)
 const idleN = animalsOf(i1).length - idle0
 assert(idleN <= 2, `섬에 혼자 가만히(2초마다 state) 4초 동안 animals ${idleN}번 (예전 alarm 이면 20번)`)
 i1.ws.close()
+// PvP (3-4): 쏜 사람의 pvpHit 를 무기 표·간격·든 총으로 검사해 맞은 사람에게만 hurt. shot 은 남에게만, died → 모두에게 kill
+const room6 = sha(`rinfish-room|smoke-pvp-${Date.now()}`).slice(0, 32)
+const p1 = await open('create', 'secret1', 'P1', room6)
+const p2 = await open('join', 'secret1', 'P2', room6)
+const armed = (x, z, tool) => ({ ...hstate(x, z), tool, hp: 100 })
+p1.ws.send(JSON.stringify({ type: 'state', s: armed(180, -10, 'pistol') }))
+p2.ws.send(JSON.stringify({ type: 'state', s: armed(190, -10, 'shotgun') }))
+await wait(150)
+assert(p2.inbox.some((m) => m.type === 'state' && m.s.tool === 'pistol' && m.s.hp === 100), '모습에 든 총·체력이 같이 간다')
+p1.ws.send(JSON.stringify({ type: 'pvpHit', target: p2.first.you, weapon: 'pistol', n: 1 }))
+p1.ws.send(JSON.stringify({ type: 'pvpHit', target: p2.first.you, weapon: 'pistol', n: 1 }))
+p1.ws.send(JSON.stringify({ type: 'pvpHit', target: p2.first.you, weapon: 'sniper', n: 1 }))
+await wait(200)
+const hurts2 = p2.inbox.filter((m) => m.type === 'hurt')
+assert(hurts2.length === 1 && hurts2[0].dmg === 20 && hurts2[0].by === 'pvp' && hurts2[0].from === p1.first.you, `권총에 맞은 사람에게만 hurt 20 (곧바로 또·들지 않은 저격총은 버린다) (${JSON.stringify(hurts2)})`)
+assert(!p1.inbox.some((m) => m.type === 'hurt'), '쏜 사람은 hurt 를 받지 않는다')
+p2.ws.send(JSON.stringify({ type: 'pvpHit', target: p1.first.you, weapon: 'shotgun', n: 8 }))
+await wait(150)
+assert(p1.inbox.some((m) => m.type === 'hurt' && m.dmg === 72), '산탄총 8알 = 9 × 8 = 72')
+p1.ws.send(JSON.stringify({ type: 'shot', o: [180, 1.5, -10], d: [1, 0, 0], w: 'pistol' }))
+p1.ws.send(JSON.stringify({ type: 'shot', o: [100, 1.5, -10], d: [1, 0, 0], w: 'pistol' }))
+await wait(150)
+const shots = p2.inbox.filter((m) => m.type === 'shot')
+assert(shots.length === 1 && shots[0].id === p1.first.you && shots[0].w === 'pistol', `shot 은 남에게만, 너무 잦거나 먼 총구는 버린다 (${shots.length})`)
+assert(!p1.inbox.some((m) => m.type === 'shot'), '쏜 사람에게는 돌려보내지 않는다')
+p2.ws.send(JSON.stringify({ type: 'died', by: p1.first.you }))
+p2.ws.send(JSON.stringify({ type: 'died', by: p1.first.you }))
+await wait(150)
+const kills = p1.inbox.filter((m) => m.type === 'kill')
+assert(kills.length === 1 && kills[0].victim === p2.first.you && kills[0].killer === p1.first.you, `died → 모두에게 kill (쓰러뜨린 사람 = 방금 맞힌 사람, 5초 안에 또 온 것은 버린다)`)
+assert(p2.inbox.some((m) => m.type === 'kill'), '쓰러진 사람도 kill 을 받는다')
+p1.ws.send(JSON.stringify({ type: 'died', by: p2.first.you }))
+await wait(150)
+assert(p2.inbox.some((m) => m.type === 'kill' && m.victim === p1.first.you && m.killer === p2.first.you), '산탄총에 맞은 P1 이 쓰러지면 P2 가 쓰러뜨린 것')
+// 총으로 사냥: 멀리(80m 안)서 저격총 한 발 = 피해 3
+const room7 = sha(`rinfish-room|smoke-gunhunt-${Date.now()}`).slice(0, 32)
+const g1 = await open('create', 'secret1', 'G1', room7)
+await wait(100)
+const cow7 = lastAnimals(g1).find((a) => a[0] === 1)
+g1.ws.send(JSON.stringify({ type: 'state', s: armed(cow7[2] + 30, cow7[3], 'sniper') }))
+await wait(50)
+g1.ws.send(JSON.stringify({ type: 'animalHit', id: 1, dmg: 3, w: 'sniper' }))
+await wait(150)
+assert(g1.inbox.some((m) => m.type === 'loot'), '30m 떨어진 소(체력 3)를 저격총 한 발로 잡는다 (전리품)')
+p1.ws.close()
+p2.ws.close()
+g1.ws.close()
 await wait(100)
 process.exit()
```

Run: `npm run server:dev` 를 켜 둔 채 `node tools/room-smoke.mjs`
Expected: 모든 줄 `OK` (3-3 까지 34개 + PvP·총 사냥 13개 = 47개)

- [ ] **Step 7: 커밋**

```bash
git add server/src/room.ts \
  server/src/roomRules.test.ts \
  server/src/roomRules.ts \
  src/game/data/net.ts \
  src/game/logic/netProtocol.test.ts \
  src/game/logic/netProtocol.ts \
  tools/room-smoke.mjs
git commit -F - <<'EOF'
feat: PvP·사격 중계 메시지와 서버 검사

- 메시지 (protocolVersion 1 그대로, 새 종류·선택 필드만): → 서버 pvpHit {target, weapon, n}·shot {o, d, w}·died {by?}, animalHit 에 총과 맞은 알 수 n / 서버 → shot {id, o, d, w}·kill {victim, killer?}, hurt.by 'pvp' / 모습에 체력 hp
- 서버 PvP: 쏜 사람 화면의 판정을 은지 피해표(권총 20·소총 14·산탄 9×알 수·저격 70·칼 15·찌르기 30·주먹 5)와 무기마다 최소 간격, 든 도구, 사거리로 검사해 맞은 사람에게만 hurt
- died 는 5초에 한 번, 쓰러뜨린 사람은 10초 안에 정말 맞힌 사람일 때만 kill 에 넣는다
- shot 은 0.05초에 한 번, 내 자리에서 6m 넘는 총구는 버리고 남에게만 넘긴다
- 총 사냥: 무기마다 간격(은지 HIT_COOL), 사거리 80m, 피해는 알마다 은지 값 × 알 수, 총은 초당 12번까지
- room-smoke 에 PvP·shot·kill·총 사냥
EOF
```

검증한 스크래치 커밋: `1120ddd` (이 커밋의 diff 를 그대로 적용해도 된다: `git -C /private/tmp/claude-501/-Users-ihyelin-proten-hrlee-----threejs/e476c70e-362f-4ed3-9ff7-d8664da04e4b/scratchpad/plan-3-4/repo format-patch -1 --binary 1120ddd --stdout | git apply --index` 한 뒤 위 커밋 명령. 스크래치 커밋의 작성자는 scratch 라 `git am` 은 쓰지 않는다)

### Task 8: 같이 하기 PvP·궤적·이름표 체력  — 스크래치 `5c6d0ee`

**Files:**
- Create: `src/game/guns/gunNet.ts`
- Modify: `src/game/hunt/animalRig.ts`, `src/game/hunt/huntActions.ts`, `src/game/logic/melee.ts`, `src/game/net/NetBridge.tsx`, `src/game/net/remoteRig.ts`, `src/game/scene/RemotePlayer.tsx`, `src/game/scene/day/dayActions.ts`, `src/game/scene/guns/GunController.tsx`, `src/game/scene/melee/MeleeController.tsx`, `src/game/stores/netStore.ts`
- Test: `src/game/hunt/animalRig.test.ts`, `src/game/logic/melee.test.ts`, `src/game/scene/day/dayActions.test.ts`, `src/game/stores/netStore.test.ts`

**Interfaces:**
- Consumes: Task 7 메시지·`roundShot`·`HitWeapon`, Task 2 `firstBodyHit`·`PeerBody`, Task 4 `GunController`·`gunFx`·`weaponSfx`, `sampleAt` (`logic/interpolate`), `takeHit`·`startDeath`·`wake` (`scene/day/dayActions`), 3-3 `receiveHurt`·`setHurtHandler`
- Produces: netStore `sendAnimalHit(id, dmg, w, n?)`·`sendPvpHit(target, weapon, n)`·`sendShot(o, d, w)`·`sendDied(by?)`; `setShotHandler(f)`·`receiveShot(o, d, w)` (`guns/gunNet`); `peerBodies(now): PeerBody[]` (`net/remoteRig`); `meleePeer(x, z, dx, dz, reach, peers)` (`logic/melee`); hurt 처리기 `(dmg, from?)`; `takeHit(dmg, from?)`·`startDeath(by?)`; 모습 `hp`, 이름표 체력 막대

- [ ] **Step 1: 실패하는 테스트 쓰기**

`src/game/stores/netStore.test.ts` (바꿀 곳, `git diff -U3`):

```diff
diff --git a/src/game/stores/netStore.test.ts b/src/game/stores/netStore.test.ts
--- a/src/game/stores/netStore.test.ts
+++ b/src/game/stores/netStore.test.ts
@@ -5,6 +5,7 @@ import type { ClientMsg, NetState, ServerMsg } from '../logic/netProtocol'
 import type { ConnStatus, Connector } from '../net/connection'
 import { remoteRig, selfBubble } from '../net/remoteRig'
 import { animalViews, lootList, resetAnimalRig, setHurtHandler } from '../hunt/animalRig'
+import { setShotHandler } from '../guns/gunNet'
 import { liveClock, useDayStore } from './dayStore'
 import { useNetStore } from './netStore'
 import { useProgressStore } from './progressStore'
@@ -289,7 +290,7 @@ describe('들판 동물 메시지 (3-3)', () => {
     const hurt = vi.fn()
     setHurtHandler(hurt)
     push({ type: 'hurt', dmg: 15, by: 'animal' })
-    expect(hurt).toHaveBeenCalledWith(15)
+    expect(hurt).toHaveBeenCalledWith(15, undefined)
     useNetStore.getState().leave()
     expect(animalViews(true, performance.now() / 1000 + 1)).toEqual([])
   })
@@ -302,3 +303,46 @@ describe('들판 동물 메시지 (3-3)', () => {
     expect(sent.at(-1)).toEqual({ type: 'animalHit', id: 3, dmg: 2, w: 'stab' })
   })
 })
+
+describe('PvP·사격 메시지 (3-4)', () => {
+  it('맞힌 것·쏜 것·쓰러짐은 같이 하는 중에만 보낸다 (사격은 소수 둘째·셋째 자리)', async () => {
+    useNetStore.getState().sendPvpHit('p1', 'pistol', 1)
+    useNetStore.getState().sendShot([1, 2, 3], [1, 0, 0], 'pistol')
+    useNetStore.getState().sendDied('p1')
+    expect(sent).toEqual([])
+    await join()
+    push({ type: 'welcome', you: 'me', players: [] })
+    useNetStore.getState().sendPvpHit('p1', 'shotgun', 5)
+    useNetStore.getState().sendShot([180.1234, 1.5, -40], [0.70712, 0, -0.70712], 'rifle')
+    useNetStore.getState().sendDied('p1')
+    useNetStore.getState().sendDied()
+    useNetStore.getState().sendAnimalHit(4, 3, 'shotgun', 3)
+    expect(sent.slice(-5)).toEqual([
+      { type: 'pvpHit', target: 'p1', weapon: 'shotgun', n: 5 },
+      { type: 'shot', o: [180.12, 1.5, -40], d: [0.707, 0, -0.707], w: 'rifle' },
+      { type: 'died', by: 'p1' },
+      { type: 'died' },
+      { type: 'animalHit', id: 4, dmg: 3, w: 'shotgun', n: 3 },
+    ])
+  })
+  it('PvP hurt 는 쏜 사람과 함께 처리기로, shot 은 방에 있는 사람 것만 그리고, kill 은 채팅 기록·알림으로', async () => {
+    await join()
+    push({ type: 'welcome', you: 'me', players: [{ id: 'p1', nick: '정빈', look: DEFAULT_LOOK, s: st }] })
+    const hurt = vi.fn()
+    setHurtHandler(hurt)
+    push({ type: 'hurt', dmg: 20, by: 'pvp', from: 'p1' })
+    expect(hurt).toHaveBeenCalledWith(20, 'p1')
+    const shot = vi.fn()
+    setShotHandler(shot)
+    push({ type: 'shot', id: 'p1', o: [1, 2, 3], d: [1, 0, 0], w: 'sniper' })
+    push({ type: 'shot', id: 'ghost', o: [1, 2, 3], d: [1, 0, 0], w: 'sniper' })
+    expect(shot).toHaveBeenCalledTimes(1)
+    expect(shot).toHaveBeenCalledWith([1, 2, 3], [1, 0, 0], 'sniper')
+    push({ type: 'kill', victim: 'me', killer: 'p1' })
+    expect(useNetStore.getState().chat.at(-1)).toMatchObject({ from: '💀', text: '정빈 님이 혜린 님을 쓰러뜨렸어요' })
+    push({ type: 'kill', victim: 'p1' })
+    expect(useNetStore.getState().chat.at(-1)?.text).toBe('정빈 님이 쓰러졌어요')
+    expect(notice()).toBe('💀 정빈 님이 쓰러졌어요')
+    setShotHandler(() => {})
+  })
+})
```

`src/game/scene/day/dayActions.test.ts` (바꿀 곳, `git diff -U3`):

```diff
diff --git a/src/game/scene/day/dayActions.test.ts b/src/game/scene/day/dayActions.test.ts
--- a/src/game/scene/day/dayActions.test.ts
+++ b/src/game/scene/day/dayActions.test.ts
@@ -192,3 +192,30 @@ describe('동물에게 맞기 (3-3)', () => {
     calmSolo()
   })
 })
+
+describe('PvP 로 쓰러지기 (3-4)', () => {
+  const sendDied = vi.fn()
+  const realSendDied = useNetStore.getState().sendDied
+  beforeEach(() => sendDied.mockClear())
+  afterEach(() => useNetStore.setState({ sendDied: realSendDied }))
+
+  it('같이 하는 중 맞아서 쓰러지면 마지막으로 맞힌 사람과 함께 died 를 보낸다. 굶어 쓰러지면 by 없이', () => {
+    useNetStore.setState({ phase: 'online', sendDied })
+    takeHit(70, 'k1')
+    expect(sendDied).toHaveBeenCalledWith('k1')
+    expect(day().seq?.kind).toBe('death')
+    runSeq()
+    startDeath()
+    expect(sendDied).toHaveBeenLastCalledWith(undefined)
+  })
+  it('침대에 누워 잠 투표 중에 맞으면 깬다', () => {
+    useNetStore.setState({ phase: 'online', sendDied })
+    useProgressStore.setState({ survival: { stamina: 90, hunger: 50, graceLeft: null, buffs: [] } })
+    startSleep(100)
+    expect(day().voting).toBe(true)
+    takeHit(20, 'k1')
+    expect(day().voting).toBe(false)
+    expect(sendSleep).toHaveBeenLastCalledWith(false)
+    expect(sendDied).not.toHaveBeenCalled()
+  })
+})
```

`src/game/logic/melee.test.ts` (바꿀 곳, `git diff -U3`):

```diff
diff --git a/src/game/logic/melee.test.ts b/src/game/logic/melee.test.ts
--- a/src/game/logic/melee.test.ts
+++ b/src/game/logic/melee.test.ts
@@ -1,6 +1,6 @@
 import { describe, expect, it } from 'vitest'
 import type { AnimalView } from './animalSim'
-import { MELEE_IDLE, canSwing, hitDue, meleeTarget, startSwing, swingProgress } from './melee'
+import { MELEE_IDLE, canSwing, hitDue, meleePeer, meleeTarget, startSwing, swingProgress } from './melee'
 import { IDLE_ACTION } from './playerMotion'
 
 const at = (id: number, x: number, z: number, over: Partial<AnimalView> = {}): AnimalView => ({ id, sp: 'cow', x, z, h: 0, pose: 'idle', hp: 3, ...over })
@@ -54,3 +54,16 @@ describe('canSwing', () => {
     expect(canSwing('explore', IDLE_ACTION, false)).toBe(false)
   })
 })
+
+describe('다른 사람 근접 판정 (3-4 PvP)', () => {
+  it('바닥 선분이 몸 원(반지름 0.32)에 처음 닿는 사람. 사거리 밖·뒤쪽은 아니다', () => {
+    const peers = [
+      { id: 'far', x: 0, y: 1, z: -3 },
+      { id: 'near', x: 0.2, y: 1, z: -1.5 },
+      { id: 'behind', x: 0, y: 1, z: 1 },
+    ]
+    expect(meleePeer(0, 0, 0, -1, 1.8, peers)).toEqual({ id: 'near', dist: expect.closeTo(1.5 - Math.sqrt(0.32 ** 2 - 0.04)) })
+    expect(meleePeer(0, 0, 0, -1, 1.0, peers)).toBeNull()
+    expect(meleePeer(0, 0, 0, 1, 1.0, peers)).toEqual({ id: 'behind', dist: expect.closeTo(0.68) })
+  })
+})
```

`src/game/hunt/animalRig.test.ts` (바꿀 곳, `git diff -U3`):

```diff
diff --git a/src/game/hunt/animalRig.test.ts b/src/game/hunt/animalRig.test.ts
--- a/src/game/hunt/animalRig.test.ts
+++ b/src/game/hunt/animalRig.test.ts
@@ -28,11 +28,13 @@ describe('animalRig', () => {
     expect(takeLoot(2)).toBeNull()
     expect(lootList().map((l) => l.key)).toEqual([1, 3])
   })
-  it('hurt 는 붙여 둔 처리기로 간다 (없으면 아무 일도 없다)', () => {
+  it('hurt 는 붙여 둔 처리기로 간다 (없으면 아무 일도 없다). PvP 면 맞힌 사람도', () => {
     receiveHurt(5)
     const f = vi.fn()
     setHurtHandler(f)
     receiveHurt(15)
-    expect(f).toHaveBeenCalledWith(15)
+    expect(f).toHaveBeenCalledWith(15, undefined)
+    receiveHurt(20, 'k1')
+    expect(f).toHaveBeenLastCalledWith(20, 'k1')
   })
 })
```

- [ ] **Step 2: 실행해 실패 확인**

Run: `npx vitest run src/game/stores/netStore.test.ts src/game/scene/day src/game/logic/melee.test.ts src/game/hunt`
Expected: FAIL — `sendPvpHit is not a function`, `Failed to resolve import "../guns/gunNet"`, hurt 처리기가 `(15)` 로만 불린다, `meleePeer is not a function`, 죽어도 `sendDied` 가 불리지 않는다

- [ ] **Step 3: 주고받기**

`src/game/guns/gunNet.ts` (새 파일):

```ts
import type { GunId } from '../data/guns'
import type { Vec3 } from '../logic/netProtocol'

/**
 * 남이 쏜 것 (같이 하기 shot): 궤적·불꽃·소리를 그릴 처리기. scene/guns/GunController 가 붙인다 (벽에 닿는 곳을 Rapier 로 찾는다).
 * 스토어(stores/*)는 장면을 import 하지 않아서 이 모듈로 넘긴다 (hunt/animalRig 의 hurt 처리기와 같은 방식)
 */
let shotHandler: (o: Vec3, d: Vec3, w: GunId) => void = () => {}

export function setShotHandler(f: (o: Vec3, d: Vec3, w: GunId) => void) {
  shotHandler = f
}

export function receiveShot(o: Vec3, d: Vec3, w: GunId) {
  shotHandler(o, d, w)
}
```

`src/game/stores/netStore.ts` (바꿀 곳, `git diff -U3`):

```diff
diff --git a/src/game/stores/netStore.ts b/src/game/stores/netStore.ts
--- a/src/game/stores/netStore.ts
+++ b/src/game/stores/netStore.ts
@@ -2,8 +2,9 @@ import { create } from 'zustand'
 import { createJSONStorage, persist } from 'zustand/middleware'
 import { NET, NET_SAVE_KEY } from '../data/net'
 import type { CharacterLook } from '../data/types'
-import type { MeleeId } from '../data/melee'
-import { unpackAnimals, type ClientMsg, type ErrorCode, type JoinMode, type NetState, type ServerMsg } from '../logic/netProtocol'
+import type { GunId, PvpWeapon } from '../data/guns'
+import { roundShot, unpackAnimals, type ClientMsg, type ErrorCode, type HitWeapon, type JoinMode, type NetState, type ServerMsg, type Vec3 } from '../logic/netProtocol'
+import { receiveShot } from '../guns/gunNet'
 import { forgetRoomAnimals, receiveAnimals, receiveHurt, spawnLoot } from '../hunt/animalRig'
 import { hubRoomName, hubRoomPassword } from '../logic/hubParams'
 import { allowEvery } from '../logic/rateLimit'
@@ -43,8 +44,14 @@ type NetStore = {
   sendProfile: (nick: string, look: CharacterLook) => void
   /** 잠 투표: 침대에 누웠다(true) / 일어났다(false). 같이 하는 중에만 보낸다 */
   sendSleep: (on: boolean) => void
-  /** 들판 동물을 때렸다 (서버가 검사한다). 같이 하는 중에만 보낸다 */
-  sendAnimalHit: (id: number, dmg: number, w: MeleeId) => void
+  /** 들판 동물을 때렸다·쐈다 (서버가 검사한다). n: 맞은 알 수 (산탄총). 같이 하는 중에만 보낸다 */
+  sendAnimalHit: (id: number, dmg: number, w: HitWeapon, n?: number) => void
+  /** 다른 사람을 맞혔다 (PvP, 서버가 무기 표로 피해를 정한다). 같이 하는 중에만 */
+  sendPvpHit: (target: string, weapon: PvpWeapon, n: number) => void
+  /** 쐈다: 남의 화면에 궤적 (o: 총구, d: 방향). 같이 하는 중에만 */
+  sendShot: (o: Vec3, d: Vec3, w: GunId) => void
+  /** 쓰러졌다 (by: 마지막으로 나를 맞힌 사람). 같이 하는 중에만 */
+  sendDied: (by?: string) => void
   /** 테스트에서 가짜 연결로 바꾼다 */
   _setConnector: (c: Connector) => void
 }
@@ -157,8 +164,19 @@ export const useNetStore = create<NetStore>()(
             notify('사냥 성공! 재료를 떨어뜨렸어요 (E 로 줍기)')
             return
           case 'hurt':
-            receiveHurt(m.dmg)
+            receiveHurt(m.dmg, m.by === 'pvp' ? m.from : undefined)
             return
+          case 'shot':
+            if (get().peers[m.id]) receiveShot(m.o, m.d, m.w)
+            return
+          case 'kill': {
+            // 모두에게: "A 님이 B 님을 쓰러뜨렸어요" (채팅 기록에도). 쓰러진 사람은 자기 화면에 따로 알림이 뜬다
+            const name = (id: string) => (id === get().you ? get().nick : (get().peers[id]?.nick ?? '누군가'))
+            const text = m.killer ? `${name(m.killer)} 님이 ${name(m.victim)} 님을 쓰러뜨렸어요` : `${name(m.victim)} 님이 쓰러졌어요`
+            addChat({ from: '💀', text, at: now, mine: false })
+            if (m.victim !== get().you) notify(`💀 ${text}`)
+            return
+          }
         }
       }
 
@@ -280,8 +298,20 @@ export const useNetStore = create<NetStore>()(
           if (get().phase === 'online') conn?.send({ type: 'sleep', on })
         },
 
-        sendAnimalHit(id, dmg, w) {
-          if (get().phase === 'online') conn?.send({ type: 'animalHit', id, dmg, w })
+        sendAnimalHit(id, dmg, w, n = 1) {
+          if (get().phase === 'online') conn?.send(n > 1 ? { type: 'animalHit', id, dmg, w, n } : { type: 'animalHit', id, dmg, w })
+        },
+
+        sendPvpHit(target, weapon, n) {
+          if (get().phase === 'online') conn?.send({ type: 'pvpHit', target, weapon, n })
+        },
+
+        sendShot(o, d, w) {
+          if (get().phase === 'online') conn?.send({ type: 'shot', ...roundShot(o, d), w })
+        },
+
+        sendDied(by) {
+          if (get().phase === 'online') conn?.send(by ? { type: 'died', by } : { type: 'died' })
         },
 
         _setConnector(c) {
```

`src/game/net/remoteRig.ts` (바꿀 곳, `git diff -U3`):

```diff
diff --git a/src/game/net/remoteRig.ts b/src/game/net/remoteRig.ts
--- a/src/game/net/remoteRig.ts
+++ b/src/game/net/remoteRig.ts
@@ -1,5 +1,6 @@
 import { NET } from '../data/net'
-import { pushSample, type Sample } from '../logic/interpolate'
+import type { PeerBody } from '../logic/hitscan'
+import { pushSample, sampleAt, type Sample } from '../logic/interpolate'
 import { fromNetAct, type NetState } from '../logic/netProtocol'
 import { IDLE_ACTION, type PlayerAction } from '../logic/playerMotion'
 
@@ -35,5 +36,15 @@ export function forgetRemote(id?: string) {
   else remoteRig.delete(id)
 }
 
+/** 다른 사람 몸 (총·주먹 판정): 내 화면에 그리는 그 시점(NET.interpDelay 늦게) 자리. now: netNow 초 */
+export function peerBodies(now: number): PeerBody[] {
+  const out: PeerBody[] = []
+  for (const [id, e] of remoteRig) {
+    const c = sampleAt(e.buf, now - NET.interpDelay)
+    if (c) out.push({ id, x: c.x, y: c.y, z: c.z })
+  }
+  return out
+}
+
 /** 내 말풍선 (내 머리 위) */
 export const selfBubble = { text: '', at: -Infinity }
```

`src/game/hunt/animalRig.ts` (바꿀 곳, `git diff -U3`):

```diff
diff --git a/src/game/hunt/animalRig.ts b/src/game/hunt/animalRig.ts
--- a/src/game/hunt/animalRig.ts
+++ b/src/game/hunt/animalRig.ts
@@ -71,13 +71,16 @@ export function takeLoot(key: number): Loot | null {
   return l
 }
 
-/** 맞았을 때 할 일 (scene/animals/HerdRunner 가 붙인다: 체력을 깎고 죽음). 서버 hurt 와 혼자 시뮬레이션이 같이 쓴다 */
-let hurtHandler: (dmg: number) => void = () => {}
-export function setHurtHandler(f: (dmg: number) => void) {
+/**
+ * 맞았을 때 할 일 (scene/animals/HerdRunner 가 붙인다: 체력을 깎고 죽음). 서버 hurt 와 혼자 시뮬레이션이 같이 쓴다.
+ * from: PvP 로 맞았으면 쏜 사람 id (쓰러지면 died 로 알린다)
+ */
+let hurtHandler: (dmg: number, from?: string) => void = () => {}
+export function setHurtHandler(f: (dmg: number, from?: string) => void) {
   hurtHandler = f
 }
-export function receiveHurt(dmg: number) {
-  hurtHandler(dmg)
+export function receiveHurt(dmg: number, from?: string) {
+  hurtHandler(dmg, from)
 }
 
 /** 테스트용: 다 지운다 */
```

`src/game/hunt/huntActions.ts` — 같이 하면 총 사냥도 서버로 (바꿀 곳, `git diff -U3`):

```diff
diff --git a/src/game/hunt/huntActions.ts b/src/game/hunt/huntActions.ts
--- a/src/game/hunt/huntActions.ts
+++ b/src/game/hunt/huntActions.ts
@@ -21,9 +21,16 @@ export function strikeAnimal(id: number, kind: MeleeId) {
   hitSolo(id, MELEE[kind].dmg)
 }
 
-/** 내 총알 n 알(산탄총은 여러 알)이 동물 id 에 맞았다. 혼자면 알마다 은지 피해(저격 3, 나머지 1)만큼 바로 때린다 */
+/**
+ * 내 총알 n 알(산탄총은 여러 알)이 동물 id 에 맞았다. 알마다 은지 피해(저격 3, 나머지 1).
+ * 같이 하면 서버에 알리고 (서버가 검사·체력·전리품), 혼자면 바로 때린다
+ */
 export function shootAnimal(id: number, gun: GunId, n: number) {
-  if (useNetStore.getState().phase !== 'off') return
+  const net = useNetStore.getState()
+  if (net.phase !== 'off') {
+    net.sendAnimalHit(id, GUNS[gun].dmg * n, gun, n)
+    return
+  }
   hitSolo(id, GUNS[gun].dmg * n)
 }
```

`src/game/scene/day/dayActions.ts` (바꿀 곳, `git diff -U3`):

```diff
diff --git a/src/game/scene/day/dayActions.ts b/src/game/scene/day/dayActions.ts
--- a/src/game/scene/day/dayActions.ts
+++ b/src/game/scene/day/dayActions.ts
@@ -59,11 +59,13 @@ export function wake(now = perfNow()) {
 
 /**
  * 죽음 (굶주림, 3-3·3-4 의 동물·PvP). 화면이 1.6초 어두워진 뒤 침대 옆에서 깨어난다.
- * 낚시 중이면 그만두고, 잠 투표 중이면 깬 것으로 알린다. 배 타는 중이면 깨어날 때 순간이동이 배를 끝낸다
+ * 낚시 중이면 그만두고, 잠 투표 중이면 깬 것으로 알린다. 배 타는 중이면 깨어날 때 순간이동이 배를 끝낸다.
+ * 같이 하는 중이면 방에 쓰러졌다고 알린다 (by: PvP 로 쓰러뜨린 사람 → 모두에게 "A 님이 B 님을 쓰러뜨렸어요")
  */
-export function startDeath() {
+export function startDeath(by?: string) {
   const day = useDayStore.getState()
   if (day.seq?.kind === 'death') return
+  useNetStore.getState().sendDied(by)
   if (day.voting) {
     day.setVoting(false)
     useNetStore.getState().sendSleep(false)
@@ -78,14 +80,16 @@ export function startDeath() {
 }
 
 /**
- * 동물(3-3)·PvP(3-4) 에게 맞았다: 체력을 깎고 화면 가장자리를 번쩍인다. 0 이 되면 죽음 (침대).
- * 잠·죽음으로 화면이 어두워지는 중엔 맞지 않는다 (은지 그대로). 피해가 0 이하·숫자가 아니면 아무것도 하지 않는다
+ * 동물(3-3)·PvP(3-4) 에게 맞았다: 체력을 깎고 화면 가장자리를 번쩍인다. 0 이 되면 죽음 (침대). from: PvP 로 맞힌 사람.
+ * 잠·죽음으로 화면이 어두워지는 중엔 맞지 않는다 (은지 그대로). 침대에 누워 잠 투표 중이면 깬다 (스펙 3-1 "맞으면 깬다").
+ * 피해가 0 이하·숫자가 아니면 아무것도 하지 않는다
  */
-export function takeHit(dmg: number) {
+export function takeHit(dmg: number, from?: string) {
   if (!(dmg > 0) || useDayStore.getState().seq) return
+  if (useDayStore.getState().voting) wake()
   const died = useProgressStore.getState().hurt(dmg)
   useSessionStore.getState().flashHurt()
-  if (died) startDeath()
+  if (died) startDeath(from)
 }
 
 /** 다 어두워진 순간: 자고 일어나기 / 침대에서 깨어나기. 같이 하는 중엔 시계가 방 것이라 건드리지 않는다 */
```

`src/game/net/NetBridge.tsx` (바꿀 곳, `git diff -U3`):

```diff
diff --git a/src/game/net/NetBridge.tsx b/src/game/net/NetBridge.tsx
--- a/src/game/net/NetBridge.tsx
+++ b/src/game/net/NetBridge.tsx
@@ -49,6 +49,8 @@ export function NetBridge() {
     // 배 타는 동안 내내 보낸다 (mode 는 잠깐 lobby·menu 일 수 있어 session.boat 기준)
     if (session.boat) raw.boat = { dir: session.boat.dir, t: boatProgress(performance.now() / 1000 - session.boat.startedAt) }
     if (session.tool) raw.tool = session.tool
+    // 이름표 아래 체력 막대 (정수로 보내서 회복 중에도 1초에 한 번쯤만 바뀐다)
+    raw.hp = Math.round(useProgressStore.getState().survival.stamina)
     const s = roundState(raw)
     const key = stateKey(s)
     const since = now - last.current.at
```

- [ ] **Step 4: 사람 맞히기·남이 쏜 것 그리기·체력 막대**

`src/game/logic/melee.ts` (바꿀 곳, `git diff -U3`):

```diff
diff --git a/src/game/logic/melee.ts b/src/game/logic/melee.ts
--- a/src/game/logic/melee.ts
+++ b/src/game/logic/melee.ts
@@ -1,6 +1,8 @@
 import { hitRadius } from '../data/animals'
 import { MELEE, hitDelay, type MeleeId } from '../data/melee'
+import { PEER_HIT } from '../data/guns'
 import type { AnimalView } from './animalSim'
+import type { PeerBody } from './hitscan'
 import type { Mode } from './interaction'
 import type { PlayerAction } from './playerMotion'
 
@@ -42,15 +44,27 @@ export function meleeTarget(x: number, z: number, dx: number, dz: number, reach:
   let best: { id: number; dist: number } | null = null
   for (const a of animals) {
     if (a.pose === 'dead') continue
-    const r = hitRadius(a.sp)
-    const cx = a.x - x
-    const cz = a.z - z
-    const t = cx * dx + cz * dz
-    const perp2 = cx * cx + cz * cz - t * t
-    if (perp2 > r * r) continue
-    const enter = Math.max(0, t - Math.sqrt(r * r - perp2))
-    if (t + r < 0 || enter > reach) continue
-    if (!best || enter < best.dist) best = { id: a.id, dist: enter }
+    const enter = segmentEnter(a.x - x, a.z - z, dx, dz, reach, hitRadius(a.sp))
+    if (enter !== null && (!best || enter < best.dist)) best = { id: a.id, dist: enter }
   }
   return best
 }
+
+/** 같은 판정으로 다른 사람 (PvP, 몸 반지름 0.32 원). 없으면 null */
+export function meleePeer(x: number, z: number, dx: number, dz: number, reach: number, peers: readonly PeerBody[]): { id: string; dist: number } | null {
+  let best: { id: string; dist: number } | null = null
+  for (const p of peers) {
+    const enter = segmentEnter(p.x - x, p.z - z, dx, dz, reach, PEER_HIT.radius)
+    if (enter !== null && (!best || enter < best.dist)) best = { id: p.id, dist: enter }
+  }
+  return best
+}
+
+/** 내 자리에서 (cx, cz) 만큼 떨어진 반지름 r 원에, 방향 (dx, dz) 로 reach 만큼 그은 선분이 닿는 거리 (원 안이면 0). 안 닿으면 null */
+function segmentEnter(cx: number, cz: number, dx: number, dz: number, reach: number, r: number): number | null {
+  const t = cx * dx + cz * dz
+  const perp2 = cx * cx + cz * cz - t * t
+  if (perp2 > r * r) return null
+  const enter = Math.max(0, t - Math.sqrt(r * r - perp2))
+  return t + r < 0 || enter > reach ? null : enter
+}
```

`src/game/scene/melee/MeleeController.tsx` (바꿀 곳, `git diff -U3`):

```diff
diff --git a/src/game/scene/melee/MeleeController.tsx b/src/game/scene/melee/MeleeController.tsx
--- a/src/game/scene/melee/MeleeController.tsx
+++ b/src/game/scene/melee/MeleeController.tsx
@@ -8,8 +8,8 @@ import { animalViews } from '../../hunt/animalRig'
 import { strikeAnimal } from '../../hunt/huntActions'
 import { meleeRig, resetMeleeRig } from '../../hunt/meleeRig'
 import { takeAttackPress } from '../../input/pointer'
-import { canSwing, hitDue, meleeTarget, startSwing, swingProgress } from '../../logic/melee'
-import { netNow } from '../../net/remoteRig'
+import { canSwing, hitDue, meleePeer, meleeTarget, startSwing, swingProgress } from '../../logic/melee'
+import { netNow, peerBodies } from '../../net/remoteRig'
 import { useNetStore } from '../../stores/netStore'
 import { useSessionStore } from '../../stores/sessionStore'
 import { playerRig } from '../Player'
@@ -17,7 +17,8 @@ import { playerGround } from '../playerGround'
 
 /**
  * 화면엔 아무것도 그리지 않는다. 주먹·칼을 든 채 마우스 왼쪽(베기·주먹)·오른쪽(칼 찌르기)이나 폰 휘두르기 버튼을 누르면 휘두르고,
- * 은지처럼 칼이 뻗는 순간(hitAt)에 카메라가 보는 쪽으로 판정한다: 바닥의 선분 → 동물 판정 원, 그 앞에 벽(고정 충돌체)이 있으면 안 맞는다
+ * 은지처럼 칼이 뻗는 순간(hitAt)에 카메라가 보는 쪽으로 판정한다: 바닥의 선분 → 동물 판정 원 (같이 하는 중엔 다른 사람 몸 원도, PvP),
+ * 그 앞에 벽(고정 충돌체)이 있으면 안 맞는다
  */
 export function MeleeController() {
   const { world, rapier } = useRapier()
@@ -49,14 +50,21 @@ export function MeleeController() {
       const dx = -Math.sin(meleeRig.yaw)
       const dz = -Math.cos(meleeRig.yaw)
       const { x, y, z } = playerRig.position
-      const target = meleeTarget(x, z, dx, dz, MELEE[swing.kind].reach, animalViews(useNetStore.getState().phase !== 'off', netNow()))
+      const net = useNetStore.getState()
+      const online = net.phase !== 'off'
+      const reach = MELEE[swing.kind].reach
+      const animal = meleeTarget(x, z, dx, dz, reach, animalViews(online, netNow()))
+      // 같이 하는 중엔 다른 사람도 맞는다 (PvP, 은지 칼 15 · 찌르기 30 · 주먹 5)
+      const peer = online ? meleePeer(x, z, dx, dz, reach, peerBodies(netNow())) : null
+      const target = peer && (!animal || peer.dist < animal.dist) ? peer : animal
       if (target) {
         const r = (ray.current ??= new rapier.Ray({ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 1 }))
         r.origin = { x, y, z }
         r.dir = { x: dx, y: 0, z: dz }
         const wall = target.dist > 0 ? world.castRay(r, target.dist, true, rapier.QueryFilterFlags.ONLY_FIXED | rapier.QueryFilterFlags.EXCLUDE_SENSORS) : null
         if (!wall) {
-          strikeAnimal(target.id, swing.kind)
+          if (typeof target.id === 'string') net.sendPvpHit(target.id, swing.kind, 1)
+          else strikeAnimal(target.id, swing.kind)
           if (swing.kind === 'fists') weaponSfx.punch()
           else weaponSfx.thud()
         }
```

`src/game/scene/guns/GunController.tsx` (바꿀 곳, `git diff -U3`):

```diff
diff --git a/src/game/scene/guns/GunController.tsx b/src/game/scene/guns/GunController.tsx
--- a/src/game/scene/guns/GunController.tsx
+++ b/src/game/scene/guns/GunController.tsx
@@ -1,4 +1,4 @@
-import { useRef } from 'react'
+import { useEffect, useRef } from 'react'
 import { useFrame, useThree } from '@react-three/fiber'
 import { useRapier } from '@react-three/rapier'
 import { Raycaster, Vector3, type Mesh, type Object3D } from 'three'
@@ -7,6 +7,7 @@ import { countRangeShot } from '../../../meadow/rangeActions'
 import { weaponSfx } from '../../audio/weaponSfx'
 import { GUNS, GUN_RANGE, VIEW_MODEL, isGun, type GunId } from '../../data/guns'
 import { gunFx } from '../../guns/gunFx'
+import { setShotHandler } from '../../guns/gunNet'
 import { gunRig, markHit, type LastShot } from '../../guns/gunRig'
 import { animalViews } from '../../hunt/animalRig'
 import { shootAnimal } from '../../hunt/huntActions'
@@ -14,7 +15,7 @@ import { isAimHeld, isTriggerHeld, takeAttackPress, takeReloadPress } from '../.
 import { canReload } from '../../logic/ammo'
 import { finishReload, heatNow, pullTrigger, recoilOf, spreadOf, startReload, swapGun } from '../../logic/gun'
 import { countHits, firstBodyHit, pelletDirs } from '../../logic/hitscan'
-import { netNow } from '../../net/remoteRig'
+import { netNow, peerBodies } from '../../net/remoteRig'
 import { useNetStore } from '../../stores/netStore'
 import { useProgressStore } from '../../stores/progressStore'
 import { useSessionStore } from '../../stores/sessionStore'
@@ -22,6 +23,10 @@ import { FOOT_Y, playerRig } from '../Player'
 
 /** 3인칭: 카메라 ~ 눈 사이(내 몸)는 건너뛰고, 눈보다 이만큼 앞에서부터 맞는다 (은지 aimRay) */
 const EYE_SKIP = 0.35
+/** 남이 쏜 소리는 이만큼(m) 안에서만 (은지 remoteShot) */
+const REMOTE_SOUND = 60
+/** 남이 쏜 궤적은 쏜 사람 몸을 건너뛰고 그린다 (은지 ray.near 0.6) */
+const REMOTE_SKIP = 0.6
 
 // 매 프레임 new 하지 않도록 재사용
 const origin = new Vector3()
@@ -60,21 +65,44 @@ function tryReload(gun: GunId, now: number, manual: boolean) {
 
 /**
  * 화면엔 아무것도 그리지 않는다. 총을 든 채 마우스 왼쪽(연사 총은 누르고 있는 동안)·폰 쏘기 버튼으로 쏘고, 오른쪽으로 조준, R 로 장전한다 (은지 WeaponSystem).
- * 화면 가운데(카메라)에서 광선: 알마다 처음 닿는 것 = 동물(판정 기둥) · 사격장 표적판(점수, 판에 자국) · 벽(Rapier 고정 충돌체, 총알 자국). 반동·퍼짐·연사는 은지 수치
+ * 화면 가운데(카메라)에서 광선: 알마다 처음 닿는 것 = 동물(판정 기둥) · 다른 사람(캡슐, PvP) · 사격장 표적판(점수, 판에 자국) · 벽(Rapier 고정 충돌체, 총알 자국).
+ * 반동·퍼짐·연사는 은지 수치. 같이 하는 중엔 동물·사람 명중을 서버에 알리고(맞은 알 수를 모아 한 번), 남들 화면에 궤적(shot)을 보낸다.
+ * 남이 쏜 것도 여기서 그린다 (벽에 닿는 곳까지 궤적, 총구 불꽃, 60m 안이면 소리)
  */
 export function GunController() {
   const { world, rapier } = useRapier()
   const camera = useThree((s) => s.camera)
   const ray = useRef<InstanceType<typeof rapier.Ray> | null>(null)
 
+  // 남이 쏜 것 (같이 하기 shot): 판정 없이 궤적·불꽃·소리만
+  useEffect(() => {
+    const seen = new rapier.Ray({ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 1 })
+    setShotHandler((o, d, w) => {
+      seen.origin = { x: o[0] + d[0] * REMOTE_SKIP, y: o[1] + d[1] * REMOTE_SKIP, z: o[2] + d[2] * REMOTE_SKIP }
+      seen.dir = { x: d[0], y: d[1], z: d[2] }
+      const wall = world.castRay(seen, GUN_RANGE, true, rapier.QueryFilterFlags.ONLY_FIXED | rapier.QueryFilterFlags.EXCLUDE_SENSORS)
+      const t = REMOTE_SKIP + (wall ? wall.timeOfImpact : GUN_RANGE)
+      const at = new Vector3(o[0], o[1], o[2])
+      gunFx.tracer(at, new Vector3(o[0] + d[0] * t, o[1] + d[1] * t, o[2] + d[2] * t))
+      gunFx.flash(at)
+      if (at.distanceTo(playerRig.position) < REMOTE_SOUND) weaponSfx.shot(w)
+    })
+    return () => setShotHandler(() => {})
+  }, [world, rapier])
+
   /** 한 발 쏘기 (산탄총은 여덟 알) */
   const shoot = (gun: GunId, now: number, spread: number) => {
     camera.getWorldPosition(origin)
     camera.getWorldDirection(dir)
     eye.set(playerRig.position.x, playerRig.position.y + FOOT_Y + playerRig.eyeHeight, playerRig.position.z)
     const near = Math.max(0, origin.distanceTo(eye) - EYE_SKIP)
-    const muzzle = gunRig.muzzle ? from.copy(gunRig.muzzle) : from.copy(origin).addScaledVector(dir, 0.3)
-    const animals = animalViews(useNetStore.getState().phase !== 'off', netNow())
+    // 총구 (없으면 눈 앞 0.3m: 조준경으로 볼 때. 남들이 보는 궤적도 내 몸에서 나가게)
+    const muzzle = gunRig.muzzle ? from.copy(gunRig.muzzle) : from.copy(eye).addScaledVector(dir, 0.3)
+    const net = useNetStore.getState()
+    const online = net.phase !== 'off'
+    const animals = animalViews(online, netNow())
+    const peers = online ? peerBodies(netNow()) : []
+    const hitPeers: string[] = []
     const r = (ray.current ??= new rapier.Ray({ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 1 }))
     const struck: number[] = []
     let first: LastShot['hit'] | undefined
@@ -82,7 +110,7 @@ export function GunController() {
     const boards: Mesh[] = range.targets.map((t) => t.board).filter(inScene)
     let best = 0
     for (const d of pelletDirs(dir, spread, GUNS[gun].pellets, Math.random)) {
-      const body = firstBodyHit(origin, d, near, GUN_RANGE, animals, [])
+      const body = firstBodyHit(origin, d, near, GUN_RANGE, animals, peers)
       r.origin = { x: origin.x + d.x * near, y: origin.y + d.y * near, z: origin.z + d.z * near }
       r.dir = d
       const wall = world.castRayAndGetNormal(r, GUN_RANGE - near, true, rapier.QueryFilterFlags.ONLY_FIXED | rapier.QueryFilterFlags.EXCLUDE_SENSORS)
@@ -97,6 +125,7 @@ export function GunController() {
       if (body && body.t <= Math.min(wallT, boardT)) {
         hit = body.kind
         if (body.kind === 'animal') struck.push(body.id)
+        else hitPeers.push(body.id)
       } else if (board && boardT <= wallT) {
         hit = 'target'
         const target = range.targets.find((x) => x.board === board.object)
@@ -113,9 +142,11 @@ export function GunController() {
     }
     gunRig.lastShot = { o: { x: origin.x, y: origin.y, z: origin.z }, d: { x: dir.x, y: dir.y, z: dir.z }, hit: first ?? null }
     for (const [id, n] of countHits(struck)) shootAnimal(id, gun, n)
+    for (const [id, n] of countHits(hitPeers)) net.sendPvpHit(id, gun, n)
     countRangeShot(best)
     if (best > 0) markHit(now, `+${best}`)
-    else if (struck.length) markHit(now)
+    else if (struck.length || hitPeers.length) markHit(now)
+    net.sendShot([muzzle.x, muzzle.y, muzzle.z], [dir.x, dir.y, dir.z], gun)
     gunFx.flash(muzzle)
     weaponSfx.shot(gun)
     gunRig.kick += recoilOf(gun, gunRig.aiming, (gunRig.optic?.mag ?? 1) > 1)
```

`src/game/scene/RemotePlayer.tsx` (바꿀 곳, `git diff -U3`):

```diff
diff --git a/src/game/scene/RemotePlayer.tsx b/src/game/scene/RemotePlayer.tsx
--- a/src/game/scene/RemotePlayer.tsx
+++ b/src/game/scene/RemotePlayer.tsx
@@ -44,6 +44,8 @@ export function RemotePlayer({ id, nick, look, shown }: { id: string; nick: stri
   const bobber = useRef<Mesh>(null)
   const lineRef = useRef<Line>(null)
   const [bubble, setBubble] = useState('')
+  /** 이름표 아래 체력 막대 (모습의 hp. 옛 클라이언트면 없다) */
+  const [hp, setHp] = useState<number | null>(null)
   /** 지금 그리는 중인가. drei Html 은 부모가 숨겨져도 글씨가 남아서, 그리지 않을 땐 이름표를 아예 빼야 한다 */
   const [drawn, setDrawn] = useState(false)
   const line = useMemo(() => {
@@ -71,6 +73,8 @@ export function RemotePlayer({ id, nick, look, shown }: { id: string; nick: stri
     // 말풍선: 바뀌었을 때만 React 상태를 바꾼다
     const text = e.bubble && now - e.bubble.at < NET.bubbleSeconds ? e.bubble.text : ''
     if (text !== bubble) setBubble(text)
+    const life = s.hp ?? null
+    if (life !== hp) setHp(life)
 
     const m = model.current
     if (!m || !rod.current) return
@@ -143,6 +147,11 @@ export function RemotePlayer({ id, nick, look, shown }: { id: string; nick: stri
             <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
               {bubble && <div style={bubbleStyle}>{bubble}</div>}
               <div style={nameTagStyle}>{nick}</div>
+              {hp !== null && (
+                <div style={hpTrack} aria-label={`체력 ${hp}`}>
+                  <div style={{ width: `${hp}%`, height: '100%', background: hpColor(hp) }} />
+                </div>
+              )}
             </div>
           </Html>
         )}
@@ -155,3 +164,7 @@ export function RemotePlayer({ id, nick, look, shown }: { id: string; nick: stri
     </>
   )
 }
+
+/** 은지 이름표 체력 막대: 50 넘으면 초록, 25 넘으면 노랑, 그 아래 빨강 */
+const hpColor = (hp: number) => (hp > 50 ? '#6fdc6f' : hp > 25 ? '#ffc94d' : '#ff5a5a')
+const hpTrack = { width: 48, height: 5, marginTop: 2, borderRadius: 3, overflow: 'hidden', background: 'rgba(0,0,0,0.5)' } as const
```

- [ ] **Step 5: 테스트 통과 확인**

Run: `npx vitest run && npx tsc -b && npm run lint 2>&1 | grep -c warning`
Expected: 모든 테스트 PASS, tsc 오류 없음, 경고 6

- [ ] **Step 6: 두 사람으로 확인**

서버·Vite 를 켜고 창 두 개로 같은 방에 들어간다. A 가 권총으로 B 를 쏘면 B 체력 −20·화면 가장자리 번쩍, A 화면에서 B 이름표 아래 체력 막대가 준다, B 화면엔 A 의 궤적·총소리. 다섯 발이면 B 가 쓰러지고 둘 다 "에이 님이 비이 님을 쓰러뜨렸어요" (채팅 기록 💀), B 는 침대 옆에서 깨어난다(시간 그대로). 칼로 가까이서 베면 −15. (Task 10 meadow-check 41 이 같은 것을 본다.)

- [ ] **Step 7: 커밋**

```bash
git add src/game/guns/gunNet.ts \
  src/game/hunt/animalRig.test.ts \
  src/game/hunt/animalRig.ts \
  src/game/hunt/huntActions.ts \
  src/game/logic/melee.test.ts \
  src/game/logic/melee.ts \
  src/game/net/NetBridge.tsx \
  src/game/net/remoteRig.ts \
  src/game/scene/RemotePlayer.tsx \
  src/game/scene/day/dayActions.test.ts \
  src/game/scene/day/dayActions.ts \
  src/game/scene/guns/GunController.tsx \
  src/game/scene/melee/MeleeController.tsx \
  src/game/stores/netStore.test.ts \
  src/game/stores/netStore.ts
git commit -F - <<'EOF'
feat: 같이 하기 PvP·궤적·이름표 체력

- 총알이 다른 사람의 몸(보이지 않는 캡슐, 반지름 0.32·기둥 1.3)에 맞으면 맞은 알 수를 모아 pvpHit, 칼·주먹도 같은 판정으로 (바닥 원)
- 같이 하는 중 총으로 동물을 맞히면 서버에 animalHit (총·알 수)
- 쏠 때마다 shot 을 보내고, 남이 쏜 것은 벽에 닿는 곳까지 궤적·총구 불꽃·60m 안이면 소리
- PvP 에 맞으면 체력이 줄고, 쓰러지면 died {by} → 모두에게 "A 님이 B 님을 쓰러뜨렸어요" (채팅 기록·알림). 침대 경로(같이 하기라 시간 그대로)
- 침대에 누워 잠 투표 중에 맞으면 깬다
- 모습에 체력(hp)을 보내 이름표 아래 체력 막대
EOF
```

검증한 스크래치 커밋: `5c6d0ee` (이 커밋의 diff 를 그대로 적용해도 된다: `git -C /private/tmp/claude-501/-Users-ihyelin-proten-hrlee-----threejs/e476c70e-362f-4ed3-9ff7-d8664da04e4b/scratchpad/plan-3-4/repo format-patch -1 --binary 5c6d0ee --stdout | git apply --index` 한 뒤 위 커밋 명령. 스크래치 커밋의 작성자는 scratch 라 `git am` 은 쓰지 않는다)

### Task 9: 폰 쏘기·조준·장전·무기 바꾸기 버튼  — 스크래치 `abe1dda`

**Files:**
- Create: `src/game/ui/TapButton.tsx`, `src/game/ui/WeaponTouchControls.tsx`
- Modify: `src/game/data/touch.ts`, `src/game/input/pointer.ts`, `src/game/logic/view.ts`, `src/game/ui/ChatBox.tsx`, `src/game/ui/Hotbar.tsx`, `src/game/ui/TouchControls.tsx`
- Test: `src/game/logic/view.test.ts`

**Interfaces:**
- Consumes: Task 1 (`nextWeapon`, `TOUCH`), Task 4 (`holdTrigger`·`setTouchAim`·`isTouchAim`·`pressAttack`, `gunRig`, `reloadProgress`), Task 5 (`gunRig.zoomStep`), `runKeyAction` (`KeyR`)
- Produces: `addLookDrag(dx, dy)` (`input/pointer`), `nextTouchAim(aiming, step, steps)` (`logic/view`), `TOUCH.hotbarBottom.portraitWeapon = 352`·`chatBottom.portraitWeapon = 460`, `<TapButton />` (`ui/TapButton`, TouchControls 에서 꺼냄), `<FireButton />`·`<AimButton gun />`·`<ReloadButton />`·`<CycleButton />`·`<KnifeButton stab? />` (`ui/WeaponTouchControls`)

- [ ] **Step 1: 실패하는 테스트 쓰기**

`src/game/logic/view.test.ts` (바꿀 곳, `git diff -U3`):

```diff
diff --git a/src/game/logic/view.test.ts b/src/game/logic/view.test.ts
--- a/src/game/logic/view.test.ts
+++ b/src/game/logic/view.test.ts
@@ -1,5 +1,5 @@
 import { describe, expect, it } from 'vitest'
-import { aimFov, isFirstPerson, scopeFov, stepZoom } from './view'
+import { aimFov, isFirstPerson, nextTouchAim, scopeFov, stepZoom } from './view'
 
 describe('1인칭·조준 카메라', () => {
   it('V 로 고른 1인칭은 탐험·패널에서만. 낚시·벤치·배·연출·잠은 3인칭', () => {
@@ -25,3 +25,13 @@ describe('1인칭·조준 카메라', () => {
     expect(stepZoom(0, 2, Number.NaN)).toBe(0)
   })
 })
+
+describe('폰 조준 버튼', () => {
+  it('누를 때마다: 조준 → (조준경 총은) 다음 배율 → 끄기', () => {
+    expect(nextTouchAim(false, 0, 2)).toEqual({ aiming: true, step: 0 })
+    expect(nextTouchAim(true, 0, 2)).toEqual({ aiming: true, step: 1 })
+    expect(nextTouchAim(true, 1, 2)).toEqual({ aiming: false, step: 0 })
+    // 권총·산탄총 (배율 없음): 켜고 끄기
+    expect(nextTouchAim(true, 0, 0)).toEqual({ aiming: false, step: 0 })
+  })
+})
```

- [ ] **Step 2: 실행해 실패 확인**

Run: `npx vitest run src/game/logic/view.test.ts`
Expected: FAIL — `nextTouchAim is not a function`

- [ ] **Step 3: 구현**

`src/game/logic/view.ts` (바꿀 곳, `git diff -U3`):

```diff
diff --git a/src/game/logic/view.ts b/src/game/logic/view.ts
--- a/src/game/logic/view.ts
+++ b/src/game/logic/view.ts
@@ -48,6 +48,15 @@ export function aimFov(gun: GunId, optic: ZoomStep | null, baseFov = AIM_VIEW.ba
   return (baseFov * GUNS[gun].aimFov) / AIM_VIEW.eunjiBaseFov
 }
 
+/**
+ * 폰 조준 버튼을 한 번 누르면: 조준 안 하는 중이면 조준(첫 배율), 조준경 총은 다음 배율, 마지막 배율이면 조준을 끈다 (폰엔 휠이 없다)
+ */
+export function nextTouchAim(aiming: boolean, step: number, steps: number): { aiming: boolean; step: number } {
+  if (!aiming) return { aiming: true, step: 0 }
+  if (step + 1 < steps) return { aiming: true, step: step + 1 }
+  return { aiming: false, step: 0 }
+}
+
 /** 휠로 배율 단계 바꾸기: 위로(deltaY < 0) 굴리면 다음(더 크게), 아래로 굴리면 이전. 끝에서 멈춘다 */
 export function stepZoom(index: number, steps: number, deltaY: number): number {
   if (!(steps > 0) || !Number.isFinite(deltaY) || deltaY === 0) return index
```

`src/game/input/pointer.ts` (바꿀 곳, `git diff -U3`):

```diff
diff --git a/src/game/input/pointer.ts b/src/game/input/pointer.ts
--- a/src/game/input/pointer.ts
+++ b/src/game/input/pointer.ts
@@ -86,6 +86,12 @@ export function isTouchAim(): boolean {
   return touchAim
 }
 
+/** 폰 쏘기 버튼을 누른 채 끈 만큼 시점을 돌린다 (은지 touch.js 쏘기 버튼 drag). 캔버스를 끈 것과 같은 드래그로 쌓는다 */
+export function addLookDrag(dx: number, dy: number) {
+  dragX += dx
+  dragY += dy
+}
+
 /** R: 장전 */
 export function pressReload() {
   reloadPressed = true
```

`src/game/data/touch.ts` (바꿀 곳, `git diff -U3`):

```diff
diff --git a/src/game/data/touch.ts b/src/game/data/touch.ts
--- a/src/game/data/touch.ts
+++ b/src/game/data/touch.ts
@@ -25,11 +25,12 @@ export const TOUCH = {
   },
   /**
    * 도구 칸 아래 여백: 가로 화면은 아래 가운데(조이스틱·버튼 사이), 세로 화면은 좁아서 오른쪽 버튼 세 줄
-   * (가장자리 20 + 점프 84 + 가방 62 + 상호작용 56 + 사이 12 × 2 = 246) 위로 올린다
+   * (가장자리 20 + 점프 84 + 가방 62 + 상호작용 56 + 사이 12 × 2 = 246) 위로 올린다.
+   * 총·칼을 든 세로 화면(portraitWeapon)은 버튼이 네 줄 (20 + 점프 84 + 쏘기 84 + 가방 62 + 상호작용 56 + 사이 12 × 3 = 342)
    */
-  hotbarBottom: { landscape: 12, portrait: 256 },
+  hotbarBottom: { landscape: 12, portrait: 256, portraitWeapon: 352 },
   /** 채팅 아래 여백: 가로 화면은 조이스틱 바로 위(위쪽 체력 줄과 겹치지 않게), 세로 화면은 도구 칸과 조작 안내(도구 칸 위 54, 세 줄) 위로 */
-  chatBottom: { landscape: 170, portrait: 364 },
+  chatBottom: { landscape: 170, portrait: 364, portraitWeapon: 460 },
   /** 세로 화면 안내를 띄워 두는 시간 (ms). 그 뒤 저절로 사라진다 */
   portraitHintMs: 9000,
 }
```

`src/game/ui/TapButton.tsx` (새 파일):

```tsx
import { useRef, type ReactNode } from 'react'

/**
 * 손가락을 뗄 때 버튼 위면 누른 것으로 친다 (누르는 순간 바로 패널이 열리면, 떼는 손가락이 새로 열린 패널 버튼을 누를 수 있다).
 * 다른 손가락이 조이스틱을 밀고 있어도 따로 받는다
 */
export function TapButton({ className, onTap, ariaLabel, children }: { className: string; onTap: () => void; ariaLabel?: string; children: ReactNode }) {
  const down = useRef<number | null>(null)
  return (
    <button
      className={className}
      aria-label={ariaLabel}
      onPointerDown={(e) => {
        e.preventDefault()
        e.currentTarget.setPointerCapture(e.pointerId)
        down.current = e.pointerId
      }}
      onPointerUp={(e) => {
        if (down.current !== e.pointerId) return
        down.current = null
        const r = e.currentTarget.getBoundingClientRect()
        if (e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom) onTap()
      }}
      onPointerCancel={() => (down.current = null)}
      onClick={(e) => {
        // 키보드(Enter·Space)로 누른 경우만. 포인터는 위에서 처리했다
        if (e.detail === 0) onTap()
      }}
    >
      {children}
    </button>
  )
}
```

`src/game/ui/WeaponTouchControls.tsx` (새 파일):

```tsx
import { useEffect, useRef, useState } from 'react'
import { GUNS, isGun, type GunId } from '../data/guns'
import { nextWeapon } from '../data/tools'
import { gunRig } from '../guns/gunRig'
import { addLookDrag, holdTrigger, isTouchAim, pressAttack, setTouchAim } from '../input/pointer'
import { runKeyAction } from '../input/useInteractionKeys'
import { reloadProgress } from '../logic/gun'
import { nextTouchAim } from '../logic/view'
import { useProgressStore } from '../stores/progressStore'
import { useSessionStore } from '../stores/sessionStore'
import { TapButton } from './TapButton'

/**
 * 폰 쏘기 (은지 touch.js tFire): 누르는 순간 한 발, 누르고 있으면 연사, 누른 채 끌면 시점이 돈다 (손가락이 버튼 밖으로 나가도).
 * 탄창/예비와 장전 중을 버튼에 적는다
 */
export function FireButton() {
  const tool = useSessionStore((s) => s.tool)
  const mag = useProgressStore((s) => (isGun(tool) ? s.ammo[tool] : 0))
  const reserve = useProgressStore((s) => (isGun(tool) ? s.reserve[tool] : 0))
  const [held, setHeld] = useState(false)
  const [reloading, setReloading] = useState(false)
  const last = useRef<{ id: number; x: number; y: number } | null>(null)
  useEffect(() => {
    const id = setInterval(() => setReloading(reloadProgress(gunRig, performance.now() / 1000) >= 0), 150)
    return () => clearInterval(id)
  }, [])
  const release = () => {
    last.current = null
    holdTrigger(false)
    setHeld(false)
  }
  return (
    <button
      className={`tc-btn tc-fire${held ? ' on' : ''}`}
      aria-label="쏘기"
      onPointerDown={(e) => {
        e.preventDefault()
        try {
          e.currentTarget.setPointerCapture(e.pointerId)
        } catch {
          // 진짜 손가락이 아닌 이벤트(헤드리스 점검)는 붙잡을 수 없다
        }
        last.current = { id: e.pointerId, x: e.clientX, y: e.clientY }
        pressAttack('primary')
        holdTrigger(true)
        setHeld(true)
      }}
      onPointerMove={(e) => {
        const l = last.current
        if (!l || l.id !== e.pointerId) return
        addLookDrag(e.clientX - l.x, e.clientY - l.y)
        last.current = { id: l.id, x: e.clientX, y: e.clientY }
      }}
      onPointerUp={release}
      onPointerCancel={release}
      onLostPointerCapture={release}
    >
      <span style={{ fontSize: 24, lineHeight: 1 }}>🔫</span>
      <span style={{ fontSize: 12 }}>{reloading ? '장전 중' : `${mag} / ${reserve}`}</span>
    </button>
  )
}

/** 폰 조준 (은지 tAim 토글): 누를 때마다 조준 → 조준경 총은 다음 배율 → 끄기. 총을 바꾸면 새로 그린다 (key) */
export function AimButton({ gun }: { gun: GunId }) {
  const [on, setOn] = useState(false)
  // 새 총을 들거나 이 버튼이 사라지면 조준을 끈다
  useEffect(() => {
    setTouchAim(false)
    return () => setTouchAim(false)
  }, [])
  const zoom = GUNS[gun].zoom
  const label = on && zoom ? zoom[gunRig.zoomStep[gun]].label : '조준'
  return (
    <TapButton
      className={`tc-btn tc-small${on ? ' on' : ''}`}
      ariaLabel="조준"
      onTap={() => {
        const next = nextTouchAim(isTouchAim(), gunRig.zoomStep[gun], zoom?.length ?? 0)
        gunRig.zoomStep[gun] = next.step
        setTouchAim(next.aiming)
        setOn(next.aiming)
      }}
    >
      <span style={{ fontSize: 22, lineHeight: 1 }}>⌖</span>
      <span style={{ fontSize: 11 }}>{label}</span>
    </TapButton>
  )
}

/** 폰 장전 (R 과 같다) */
export function ReloadButton() {
  return (
    <TapButton className="tc-btn tc-small" ariaLabel="장전" onTap={() => runKeyAction('KeyR')}>
      <span style={{ fontSize: 20, lineHeight: 1, fontWeight: 900 }}>R</span>
      <span style={{ fontSize: 11 }}>장전</span>
    </TapButton>
  )
}

/** 폰 무기 바꾸기 (은지 tWeapon): 주먹 → 칼 → 권총 → 소총 → 산탄총 → 저격총 → 주먹 */
export function CycleButton() {
  return (
    <TapButton
      className="tc-btn tc-small"
      ariaLabel="무기 바꾸기"
      onTap={() => {
        const session = useSessionStore.getState()
        session.equip(nextWeapon(session.tool))
      }}
    >
      <span style={{ fontSize: 22, lineHeight: 1 }}>⇄</span>
      <span style={{ fontSize: 11 }}>무기</span>
    </TapButton>
  )
}

/** 폰 칼: 베기 (크게, 마우스 왼쪽) · 찌르기 (마우스 오른쪽, 3-3 이 미룬 버튼). 누르는 순간 바로 */
export function KnifeButton({ stab }: { stab?: boolean }) {
  return (
    <button
      className={stab ? 'tc-btn tc-small' : 'tc-btn tc-fire'}
      aria-label={stab ? '찌르기' : '휘두르기'}
      onPointerDown={(e) => {
        e.preventDefault()
        pressAttack(stab ? 'secondary' : 'primary')
      }}
    >
      <span style={{ fontSize: stab ? 20 : 24, lineHeight: 1 }}>{stab ? '🗡️' : '🔪'}</span>
      <span style={{ fontSize: stab ? 11 : 12 }}>{stab ? '찌르기' : '베기'}</span>
    </button>
  )
}
```

`src/game/ui/TouchControls.tsx` (바꿀 곳, `git diff -U3`):

```diff
diff --git a/src/game/ui/TouchControls.tsx b/src/game/ui/TouchControls.tsx
--- a/src/game/ui/TouchControls.tsx
+++ b/src/game/ui/TouchControls.tsx
@@ -1,5 +1,6 @@
-import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react'
+import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
 import { EMOTES } from '../data/emotes'
+import { isGun } from '../data/guns'
 import { TOUCH } from '../data/touch'
 import { resetStick, setStick } from '../input/move'
 import { pressAttack, pressFishingButton } from '../input/pointer'
@@ -10,6 +11,8 @@ import { stickFromDrag, type Stick } from '../logic/joystick'
 import { useFishingStore } from '../stores/fishingStore'
 import { useSessionStore } from '../stores/sessionStore'
 import { interactLabel } from './interactLabel'
+import { TapButton } from './TapButton'
+import { AimButton, CycleButton, FireButton, KnifeButton, ReloadButton } from './WeaponTouchControls'
 import { overlayLayer, touchHint } from './styles'
 
 const { joystick: JOY, buttons: BTN } = TOUCH
@@ -44,14 +47,16 @@ function ExploreControls() {
   const tool = useSessionStore((s) => s.tool)
   const [emotesOpen, setEmotesOpen] = useState(false)
   const portrait = useMediaQuery('(orientation: portrait)')
+  /** 총·칼을 들면 무기 버튼 줄 */
+  const weapon = isGun(tool) ? 'gun' : tool === 'knife' ? 'knife' : null
   const bag = (
     <TapButton className="tc-btn tc-small" ariaLabel="가방" onTap={() => useSessionStore.getState().setMode('bag')}>
       <span style={{ fontSize: 22, lineHeight: 1 }}>🎒</span>
       <span style={{ fontSize: 11 }}>가방</span>
     </TapButton>
   )
-  // 주먹·칼을 들면 휘두르기 (누르는 순간 바로. 칼 찌르기 버튼은 3-4 의 총 버튼과 같이). 세로 화면은 가방 줄에
-  const attack = (tool === 'fists' || tool === 'knife') && (
+  // 주먹을 들면 휘두르기 (누르는 순간 바로). 세로 화면은 가방 줄에
+  const attack = tool === 'fists' && (
     <button
       className="tc-btn tc-small"
       aria-label="휘두르기"
@@ -60,38 +65,121 @@ function ExploreControls() {
         pressAttack('primary')
       }}
     >
-      <span style={{ fontSize: 22, lineHeight: 1 }}>{tool === 'fists' ? '✊' : '🔪'}</span>
-      <span style={{ fontSize: 11 }}>{tool === 'fists' ? '치기' : '베기'}</span>
+      <span style={{ fontSize: 22, lineHeight: 1 }}>✊</span>
+      <span style={{ fontSize: 11 }}>치기</span>
     </button>
   )
+  const emote = (
+    <TapButton className={`tc-btn tc-small${emotesOpen ? ' on' : ''}`} ariaLabel="감정 표현" onTap={() => setEmotesOpen((o) => !o)}>
+      <span style={{ fontSize: 22, lineHeight: 1 }}>😀</span>
+      <span style={{ fontSize: 11 }}>표현</span>
+    </TapButton>
+  )
+  // 점프는 누르는 순간 바로
+  const jump = (
+    <button
+      className="tc-btn tc-jump"
+      aria-label="점프"
+      onPointerDown={(e) => {
+        e.preventDefault()
+        pressJump()
+      }}
+    >
+      <span style={{ fontSize: 26, lineHeight: 1 }}>⤒</span>
+      <span style={{ fontSize: 12 }}>점프</span>
+    </button>
+  )
+  const action = nearby && (
+    <TapButton className={`tc-btn tc-pill tc-action${weapon && !portrait ? ' tc-side' : ''}`} onTap={() => runKeyAction('KeyE')}>
+      {interactLabel(nearby)}
+    </TapButton>
+  )
+  const emotes = emotesOpen && (
+    <div className="tc-emotes" role="menu" aria-label="감정 표현">
+      {EMOTES.map((em) => (
+        <TapButton
+          key={em.id}
+          className="tc-btn tc-emote"
+          ariaLabel={em.label}
+          onTap={() => {
+            pressEmote(em.id)
+            setEmotesOpen(false)
+          }}
+        >
+          <span style={{ fontSize: 22, lineHeight: 1 }}>{em.icon}</span>
+          <span style={{ fontSize: 11 }}>{em.label}</span>
+        </TapButton>
+      ))}
+    </div>
+  )
+  if (weapon) {
+    // 총·칼 (3-4): 은지 touch.js 처럼 쏘기(크게, 끌면 시점)·조준·장전·무기 바꾸기 / 베기(크게)·찌르기.
+    // 세로 화면은 세 줄 (표현·무기·가방 / 장전·쏘기 / 조준·점프), 가로 화면은 두 줄 (가방·무기·장전·조준 / 표현·쏘기·점프).
+    // 가로 화면은 키가 낮아(360) 위 줄을 미니맵 왼쪽에 두고, 상호작용 버튼은 그 왼쪽에
+    const gun = weapon === 'gun'
+    const top = gun ? (
+      <>
+        {bag}
+        <CycleButton />
+        <ReloadButton />
+        {isGun(tool) && <AimButton key={tool} gun={tool} />}
+      </>
+    ) : (
+      <>
+        {bag}
+        <CycleButton />
+        <KnifeButton stab />
+      </>
+    )
+    return (
+      <>
+        <Joystick />
+        {!portrait && (
+          <>
+            <div className="tc-row tc-weapon-top">{top}</div>
+            {action && <div style={{ display: 'contents' }} className={gun ? 'tc-side-gun' : 'tc-side-knife'}>{action}</div>}
+          </>
+        )}
+        <div className="tc-right">
+          {emotes}
+          {portrait ? (
+            <>
+              {action}
+              <div className="tc-row">
+                {emote}
+                <CycleButton />
+                {bag}
+              </div>
+              <div className="tc-row">
+                {gun ? <ReloadButton /> : <KnifeButton stab />}
+                {gun ? <FireButton /> : <KnifeButton />}
+              </div>
+              <div className="tc-row">
+                {isGun(tool) && <AimButton key={tool} gun={tool} />}
+                {jump}
+              </div>
+            </>
+          ) : (
+            <>
+              <div className="tc-row">
+                {emote}
+                {gun ? <FireButton /> : <KnifeButton />}
+                {jump}
+              </div>
+            </>
+          )}
+        </div>
+        {!emotesOpen && <TouchHelp weapon={weapon} />}
+      </>
+    )
+  }
   return (
     <>
       <Joystick />
       <div className="tc-right">
-        {emotesOpen && (
-          <div className="tc-emotes" role="menu" aria-label="감정 표현">
-            {EMOTES.map((em) => (
-              <TapButton
-                key={em.id}
-                className="tc-btn tc-emote"
-                ariaLabel={em.label}
-                onTap={() => {
-                  pressEmote(em.id)
-                  setEmotesOpen(false)
-                }}
-              >
-                <span style={{ fontSize: 22, lineHeight: 1 }}>{em.icon}</span>
-                <span style={{ fontSize: 11 }}>{em.label}</span>
-              </TapButton>
-            ))}
-          </div>
-        )}
+        {emotes}
         {/* 가까이 있는 대상이 있을 때만: E 와 같은 길로 (낚시 시작·가게 열기·구역 문 살펴보기). 글이 길어도 조이스틱 위에 오도록 가방 줄 위 */}
-        {nearby && (
-          <TapButton className="tc-btn tc-pill tc-action" onTap={() => runKeyAction('KeyE')}>
-            {interactLabel(nearby)}
-          </TapButton>
-        )}
+        {action}
         {/* 세로 화면은 좁아서 가방(과 휘두르기)을 점프 위 오른쪽 끝에 둔다 (한 줄에 셋이면 조이스틱 자리와 겹친다). 가로 화면은 한 줄 그대로 */}
         {portrait && (
           <div className="tc-row">
@@ -101,23 +189,9 @@ function ExploreControls() {
         )}
         <div className="tc-row">
           {!portrait && bag}
-          <TapButton className={`tc-btn tc-small${emotesOpen ? ' on' : ''}`} ariaLabel="감정 표현" onTap={() => setEmotesOpen((o) => !o)}>
-            <span style={{ fontSize: 22, lineHeight: 1 }}>😀</span>
-            <span style={{ fontSize: 11 }}>표현</span>
-          </TapButton>
+          {emote}
           {!portrait && attack}
-          {/* 점프는 누르는 순간 바로 */}
-          <button
-            className="tc-btn tc-jump"
-            aria-label="점프"
-            onPointerDown={(e) => {
-              e.preventDefault()
-              pressJump()
-            }}
-          >
-            <span style={{ fontSize: 26, lineHeight: 1 }}>⤒</span>
-            <span style={{ fontSize: 12 }}>점프</span>
-          </button>
+          {jump}
         </div>
       </div>
       {/* 감정 표현 메뉴를 펼치면 안내 글씨와 겹치므로 잠깐 숨긴다 */}
@@ -126,8 +200,8 @@ function ExploreControls() {
   )
 }
 
-/** 조작 안내 (키보드 안내 대신) + 세로 화면이면 가로로 돌려 보라는 안내 */
-function TouchHelp() {
+/** 조작 안내 (키보드 안내 대신) + 세로 화면이면 가로로 돌려 보라는 안내. weapon: 총·칼 버튼 줄 (세로 화면은 도구 칸이 더 위) */
+function TouchHelp({ weapon = null }: { weapon?: 'gun' | 'knife' | null }) {
   const portrait = useMediaQuery('(orientation: portrait)')
   const [hintGone, setHintGone] = useState(false)
   useEffect(() => {
@@ -137,7 +211,13 @@ function TouchHelp() {
   }, [portrait, hintGone])
   return (
     <>
-      <div className="tc-help">왼쪽 스틱으로 이동 · 끝까지 밀면 달리기 · 화면을 끌어 시점 회전 · 두 손가락으로 확대·축소</div>
+      <div className={`tc-help${weapon ? ' tc-weapon' : ''}`}>
+        {weapon === 'gun'
+          ? '쏘기 버튼을 누른 채 끌면 시점 회전 · ⌖ 조준(누를 때마다 배율) · R 장전 · ⇄ 무기 바꾸기'
+          : weapon === 'knife'
+            ? '베기 · 찌르기 · ⇄ 무기 바꾸기 · 화면을 끌어 시점 회전'
+            : '왼쪽 스틱으로 이동 · 끝까지 밀면 달리기 · 화면을 끌어 시점 회전 · 두 손가락으로 확대·축소'}
+      </div>
       {portrait && !hintGone && (
         <div style={{ ...touchHint, pointerEvents: 'auto', display: 'flex', alignItems: 'center', gap: 10, fontSize: 14 }}>
           <span>📱↻ 가로로 돌리면 더 넓게 볼 수 있어요</span>
@@ -192,38 +272,6 @@ function FishingButton({ stage, biting }: { stage: 'aiming' | 'waiting' | 'fight
   )
 }
 
-/**
- * 손가락을 뗄 때 버튼 위면 누른 것으로 친다 (누르는 순간 바로 패널이 열리면, 떼는 손가락이 새로 열린 패널 버튼을 누를 수 있다).
- * 다른 손가락이 조이스틱을 밀고 있어도 따로 받는다
- */
-function TapButton({ className, onTap, ariaLabel, children }: { className: string; onTap: () => void; ariaLabel?: string; children: ReactNode }) {
-  const down = useRef<number | null>(null)
-  return (
-    <button
-      className={className}
-      aria-label={ariaLabel}
-      onPointerDown={(e) => {
-        e.preventDefault()
-        e.currentTarget.setPointerCapture(e.pointerId)
-        down.current = e.pointerId
-      }}
-      onPointerUp={(e) => {
-        if (down.current !== e.pointerId) return
-        down.current = null
-        const r = e.currentTarget.getBoundingClientRect()
-        if (e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom) onTap()
-      }}
-      onPointerCancel={() => (down.current = null)}
-      onClick={(e) => {
-        // 키보드(Enter·Space)로 누른 경우만. 포인터는 위에서 처리했다
-        if (e.detail === 0) onTap()
-      }}
-    >
-      {children}
-    </button>
-  )
-}
-
 /** 왼쪽 아래 가상 조이스틱. 받침 어디를 눌러도 되고, 누른 손가락 하나만 따라간다 */
 function Joystick() {
   const base = useRef<HTMLDivElement>(null)
@@ -283,6 +331,11 @@ const JOY_PAD = 18
 const ROW_WIDTH = BTN.margin + BTN.big + 3 * (BTN.small + BTN.gap)
 /** 조이스틱 오른쪽 끝 */
 const JOY_RIGHT = JOY.margin + JOY.radius * 2
+/** 폰 가로 화면 미니맵 왼쪽 끝 (오른쪽 16 + 지름 110, ui/MiniMap) */
+const MINIMAP_LEFT = 16 + 110
+/** 가로 화면 무기 위 줄(총: 가방·무기·장전·조준, 칼: 가방·무기·찌르기)의 왼쪽 끝. 상호작용 버튼은 이 왼쪽에 */
+const GUN_TOP_LEFT = MINIMAP_LEFT + BTN.gap + 4 * BTN.small + 3 * BTN.gap + BTN.gap
+const KNIFE_TOP_LEFT = MINIMAP_LEFT + BTN.gap + 3 * BTN.small + 2 * BTN.gap + BTN.gap
 
 const CSS = `
 .tc button { font-family: inherit; -webkit-tap-highlight-color: transparent; }
@@ -296,6 +349,12 @@ const CSS = `
 .tc-small { width: ${px(BTN.small)}; height: ${px(BTN.small)}; border-radius: 50%; background: rgba(20, 30, 45, 0.55); color: #fff; }
 .tc-small.on { background: rgba(255, 209, 102, 0.85); color: #222; }
 .tc-jump { width: ${px(BTN.big)}; height: ${px(BTN.big)}; border-radius: 50%; }
+.tc-fire { width: ${px(BTN.big)}; height: ${px(BTN.big)}; border-radius: 50%; background: rgba(239, 83, 80, 0.85); color: #fff; text-shadow: 0 1px 2px rgba(0,0,0,0.4); }
+.tc-fire.on, .tc-fire:active { background: rgba(255, 138, 128, 0.95); }
+.tc-weapon-top { position: absolute; pointer-events: none; bottom: ${safe('bottom', BTN.margin + BTN.big + BTN.gap)}; right: ${safe('right', MINIMAP_LEFT + BTN.gap)}; }
+.tc-side { position: absolute; bottom: ${safe('bottom', BTN.margin + BTN.big + BTN.gap)}; overflow: hidden; text-overflow: ellipsis; display: block; line-height: 52px; }
+.tc-side-gun .tc-side { right: ${safe('right', GUN_TOP_LEFT)}; max-width: calc(100vw - ${px(GUN_TOP_LEFT + JOY_RIGHT + 24)}); }
+.tc-side-knife .tc-side { right: ${safe('right', KNIFE_TOP_LEFT)}; max-width: calc(100vw - ${px(KNIFE_TOP_LEFT + JOY_RIGHT + 24)}); }
 .tc-pill { min-height: 56px; min-width: ${px(BTN.big)}; padding: 0 20px; border-radius: 999px; font-size: 17px; white-space: nowrap; }
 .tc-action { background: rgba(102, 187, 106, 0.88); color: #fff; text-shadow: 0 1px 2px rgba(0,0,0,0.35); max-width: calc(100vw - 2 * ${px(BTN.margin)}); }
 .tc-quit { position: absolute; top: ${safe('top', 16)}; right: ${safe('right', 16)}; min-height: 44px; font-size: 15px; background: rgba(20, 30, 45, 0.7); color: #fff; }
@@ -320,6 +379,7 @@ const CSS = `
 @media (orientation: portrait) {
   .tc-help { left: ${safe('left', 16)}; right: auto; text-align: left; max-width: 60%;
     bottom: ${safe('bottom', TOUCH.hotbarBottom.portrait + 54)}; }
+  .tc-help.tc-weapon { bottom: ${safe('bottom', TOUCH.hotbarBottom.portraitWeapon + 54)}; }
 }
 `
```

`src/game/ui/Hotbar.tsx` (바꿀 곳, `git diff -U3`):

```diff
diff --git a/src/game/ui/Hotbar.tsx b/src/game/ui/Hotbar.tsx
--- a/src/game/ui/Hotbar.tsx
+++ b/src/game/ui/Hotbar.tsx
@@ -24,7 +24,9 @@ export function Hotbar() {
   const portrait = useMediaQuery('(orientation: portrait)')
   if (mode !== 'explore') return null
   // 컴퓨터: 아래 조작 안내가 좁은 창에서 두 줄이 되어도 겹치지 않게 띄운다
-  const bottom = touchUi ? TOUCH.hotbarBottom[portrait ? 'portrait' : 'landscape'] : 44
+  // 폰 세로 화면에서 총·칼을 들면 무기 버튼이 한 줄 더라 그 위로
+  const weaponRows = isGun(tool) || tool === 'knife'
+  const bottom = touchUi ? TOUCH.hotbarBottom[portrait ? (weaponRows ? 'portraitWeapon' : 'portrait') : 'landscape'] : 44
   const slots: { id: ToolId | null; key: number }[] = touchUi ? touchHotbar(lastGun).map((id) => ({ id, key: HOTBAR.indexOf(id) })) : HOTBAR.map((id, key) => ({ id, key }))
   return (
     <div style={{ position: 'absolute', left: '50%', bottom: safeBottom(bottom), transform: 'translateX(-50%)', display: 'flex', gap: 4, pointerEvents: 'auto', zIndex: 1000 }} aria-label="도구 칸">
```

`src/game/ui/ChatBox.tsx` (바꿀 곳, `git diff -U3`):

```diff
diff --git a/src/game/ui/ChatBox.tsx b/src/game/ui/ChatBox.tsx
--- a/src/game/ui/ChatBox.tsx
+++ b/src/game/ui/ChatBox.tsx
@@ -1,5 +1,6 @@
 import { useEffect, useRef, useState } from 'react'
 import { NET } from '../data/net'
+import { isGun } from '../data/guns'
 import { TOUCH } from '../data/touch'
 import { useMediaQuery, useTouchUi } from '../input/touchDevice'
 import { isTypingTarget } from '../input/typing'
@@ -21,6 +22,8 @@ export function ChatBox() {
   const phase = useNetStore((s) => s.phase)
   const chat = useNetStore((s) => s.chat)
   const mode = useSessionStore((s) => s.mode)
+  // 폰 세로 화면에서 총·칼을 들면 도구 칸이 더 위라 채팅도 그 위로
+  const weaponRows = useSessionStore((s) => isGun(s.tool) || s.tool === 'knife')
   const touchUi = useTouchUi()
   const portrait = useMediaQuery('(orientation: portrait)')
   const [open, setOpen] = useState(false)
@@ -60,7 +63,7 @@ export function ChatBox() {
   }
 
   return (
-    <div style={{ position: 'absolute', left: safeLeft(16), bottom: safeBottom(touchUi ? TOUCH.chatBottom[portrait ? 'portrait' : 'landscape'] : DESKTOP_CHAT_BOTTOM), width: 'min(340px, 58vw)', pointerEvents: 'none', display: 'flex', flexDirection: 'column', gap: 4 }}>
+    <div style={{ position: 'absolute', left: safeLeft(16), bottom: safeBottom(touchUi ? TOUCH.chatBottom[portrait ? (weaponRows ? 'portraitWeapon' : 'portrait') : 'landscape'] : DESKTOP_CHAT_BOTTOM), width: 'min(340px, 58vw)', pointerEvents: 'none', display: 'flex', flexDirection: 'column', gap: 4 }}>
       <div style={{ display: 'flex', flexDirection: 'column', gap: 2, maxHeight: touchUi ? (portrait ? '24vh' : '18vh') : '30vh', overflow: 'hidden', justifyContent: 'flex-end' }}>
         {chat.map((line) => {
           const age = now - line.at
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npx vitest run && npx tsc -b && npm run lint 2>&1 | grep -c warning`
Expected: 모든 테스트 PASS, tsc 오류 없음, 경고 6

- [ ] **Step 5: 폰 화면으로 확인**

개발자 도구 기기 모드(또는 `useTouchUiStore.setState({ touchUi: true })`)로 390×844·360×780·844×390·780×360 에서 권총·칼을 들고, 잡화점 앞(상호작용 버튼)에서도 조이스틱·도구 칸·안내·미니맵·버튼이 겹치지 않는지 본다. 쏘기 버튼을 누른 채 끌면 시점이 돈다, 조준 버튼은 저격총에서 4x → 8x → 끄기, ⇄ 는 주먹 → 칼 → 총 4종 → 주먹. (Task 10 meadow-check 40 이 같은 것을 본다.)

- [ ] **Step 6: 커밋**

```bash
git add src/game/data/touch.ts \
  src/game/input/pointer.ts \
  src/game/logic/view.test.ts \
  src/game/logic/view.ts \
  src/game/ui/ChatBox.tsx \
  src/game/ui/Hotbar.tsx \
  src/game/ui/TapButton.tsx \
  src/game/ui/TouchControls.tsx \
  src/game/ui/WeaponTouchControls.tsx
git commit -F - <<'EOF'
feat: 폰 쏘기·조준·장전·무기 바꾸기 버튼

- 총을 들면 은지 touch.js 처럼: 쏘기(크게, 누르고 있으면 연사, 누른 채 끌면 시점 회전, 탄창/예비 표시)·조준(누를 때마다 조준 → 다음 배율 → 끄기)·장전·무기 바꾸기
- 칼을 들면 베기(크게)·찌르기 버튼 (3-3 이 미룬 것)
- 세로 화면은 세 줄(표현·무기·가방 / 장전·쏘기 / 조준·점프)이라 도구 칸·채팅·안내를 더 위로, 가로 화면은 두 줄로 위 줄을 미니맵 왼쪽에, 상호작용 버튼은 그 왼쪽에 (길면 …)
- 버튼 묶음 TapButton 을 따로 꺼냈다
EOF
```

검증한 스크래치 커밋: `abe1dda` (이 커밋의 diff 를 그대로 적용해도 된다: `git -C /private/tmp/claude-501/-Users-ihyelin-proten-hrlee-----threejs/e476c70e-362f-4ed3-9ff7-d8664da04e4b/scratchpad/plan-3-4/repo format-patch -1 --binary abe1dda --stdout | git apply --index` 한 뒤 위 커밋 명령. 스크래치 커밋의 작성자는 scratch 라 `git am` 은 쓰지 않는다)

### Task 10: 총·사격장·PvP 헤드리스 점검과 마무리  — 스크래치 `fac763b`

**Files:**
- Modify: `tools/meadow-check.mjs`

**Interfaces:**
- Consumes: Task 1~9 전부, `tools/meadow-check.mjs` 도우미(`open`·`teleport`·`turnTo`·`camYaw`·`check`)
- Produces: meadow-check 37~41 (잡화점 탄약 / 쏘기·장전·산탄 사냥·벽 자국·1인칭·조준경 / 사격장 표적·G 게임·최고 점수 저장·무기 선반 / 폰 무기 버튼 겹침·쏘기 끌기·조준 배율·무기 바꾸기 / 두 사람 PvP)

- [ ] **Step 1: 점검을 더한다**

`tools/meadow-check.mjs` (바꿀 곳, `git diff -U3`):

```diff
diff --git a/tools/meadow-check.mjs b/tools/meadow-check.mjs
--- a/tools/meadow-check.mjs
+++ b/tools/meadow-check.mjs
@@ -1,4 +1,4 @@
-// 초원 + 배 + 은지 기능(3-1 시간·생존, 3-2 도구·가방·상인, 3-3 동물·사냥) 점검 (헤드리스 Chrome). 스크린샷을 남긴다
+// 초원 + 배 + 은지 기능(3-1 시간·생존, 3-2 도구·가방·상인, 3-3 동물·사냥, 3-4 총·사격장·PvP) 점검 (헤드리스 Chrome). 스크린샷을 남긴다
 // 준비: npm run server:dev (8787) 와 VITE_ROOM_SERVER=ws://127.0.0.1:8787 npx vite --port 5190 --strictPort
 // 사용: node tools/meadow-check.mjs [게임 주소] [스크린샷 폴더]
 import { spawn } from 'node:child_process'
@@ -890,6 +890,278 @@ await B5.shot('36-phone-landscape-room')
 A5.close()
 B5.close()
 
+// ── 3-4 총·사격장·PvP ──
+const GSESS = `(await __mod('/src/game/stores/sessionStore.ts')).useSessionStore`
+const GPROG = `(await __mod('/src/game/stores/progressStore.ts')).useProgressStore`
+const GRIG = `(await __mod('/src/game/guns/gunRig.ts')).gunRig`
+const GRANGE = `(await __mod('/src/meadow/meadowSingleton.ts')).meadowRange()`
+const gkey = async (b, code, k = code) => { await b.key('keydown', code, k); await b.key('keyup', code, k); await wait(200) }
+const gequip = (b, tool) => b.evaluate(`(async () => { ${GSESS}.getState().equip('${tool}'); return true })()`)
+/**
+ * 쏘고 그 한 발을 처리할 때까지 기다린다 (헤드리스는 몇 fps 라). 쏘지 못했으면 false.
+ * 총을 바꾼 뒤 0.25초·연사 간격·장전 중엔 누른 것이 버려지므로(은지 그대로) 쏠 수 있을 때까지 먼저 기다린다
+ */
+const gfire = async (b) => {
+  await b.until(`(async () => { const g = ${GRIG}; return g.gun !== null && g.gun === ${GSESS}.getState().tool && !g.reload && performance.now() / 1000 > g.readyAt + 0.05 })()`, 20000)
+  const before = JSON.stringify(await b.evaluate(`(async () => ${GRIG}.lastShot)()`))
+  await b.evaluate(`(async () => { (await __mod('/src/game/input/pointer.ts')).pressAttack('primary'); return true })()`)
+  return b.until(`(async () => JSON.stringify(${GRIG}.lastShot) !== ${JSON.stringify(before)})()`, 20000)
+}
+const gammo = (b, gun) => b.evaluate(`(async () => ${GPROG}.getState().ammo.${gun})()`)
+
+// 37) 잡화점: 탄약 묶음을 코인으로 산다 (예비 탄약에 더한다)
+const G = await open(9745, 0)
+await G.evaluate(`__click('혼자 하기')`)
+await wait(3000)
+await G.evaluate(`(async () => { ${GPROG}.setState({ coins: 300 }); return true })()`)
+await G.evaluate(teleport(148, -12.6))
+check(await G.until(`document.body.innerText.includes('잡화점 — 탄약을 팝니다')`, 5000), '37) 잡화점 앞 "탄약을 팝니다"')
+await gkey(G, 'KeyE', 'e')
+await G.evaluate(`__click('사기')`)
+await wait(300)
+await G.shot('37-ammo-shop')
+const res0 = await G.evaluate(`(async () => ${GPROG}.getState().reserve.pistol)()`)
+await G.evaluate(`[...document.querySelectorAll('button')].find((b) => b.textContent.startsWith('1묶음 사기')).click(), true`)
+await wait(300)
+const bought = await G.evaluate(`(async () => { const p = ${GPROG}.getState(); return [p.coins, p.reserve.pistol] })()`)
+check(bought[0] === 220 && bought[1] === res0 + 12, `37) 권총 탄약 12발을 80 코인에 산다 (${bought})`)
+await gkey(G, 'Escape')
+
+// 38) 총: 쏘면 탄창이 줄고 R 로 장전, 동물을 맞히면 체력이 준다 (혼자), 벽엔 총알 자국. 소총 조준은 1인칭 조준경, 휠로 배율
+await G.evaluate(teleport(186, -20))
+await wait(1500)
+await gkey(G, 'Digit4', '4')
+check((await G.evaluate(`(async () => ${GSESS}.getState().tool)()`)) === 'pistol', '38) 4 → 권총')
+await turnTo(G, 0, -110)
+await wait(600)
+check(await gfire(G), '38) 권총을 쏜다')
+check((await gammo(G, 'pistol')) === 11, '38) 탄창 12 → 11')
+await gkey(G, 'KeyR', 'r')
+check(await G.until(`(async () => ${GPROG}.getState().ammo.pistol === 12)()`, 15000), '38) R 장전 (권총 1.3초) → 탄창 12, 예비에서 1')
+await G.shot('38-pistol')
+// 광선이 높이 0.6m 를 지나는 곳에 소(1번)를 세우고 산탄총으로 쏜다
+await gkey(G, 'Digit6', '6')
+await wait(500)
+const cowAt = await G.evaluate(`(async () => {
+  const r = (await __mod('/src/game/hunt/animalRig.ts')); const s = ${GRIG}.lastShot
+  const t = (s.o.y - 0.6) / -s.d.y
+  const x = s.o.x + s.d.x * t, z = s.o.z + s.d.z * t
+  const h = r.soloHerd()
+  r.setSoloHerd({ ...h, animals: h.animals.map((a) => a.id === 1 ? { ...a, x, z, state: 'idle', target: null } : a) })
+  return [x, z, t]
+})()`)
+await wait(600)
+check(await gfire(G), '38) 산탄총을 쏜다')
+const cow38 = await G.evaluate(`(async () => (await __mod('/src/game/hunt/animalRig.ts')).soloHerd().animals.find((a) => a.id === 1))()`)
+check(cow38.hp < 3, `38) 산탄 여러 알이 소에 맞아 체력이 준다 (${cowAt[2].toFixed(1)}m, 체력 ${cow38.hp}, ${cow38.state})`)
+await G.shot('38-shotgun-cow')
+await G.evaluate(teleport(201, -8))
+await wait(1200)
+await gequip(G, 'pistol')
+await turnTo(G, -Math.PI / 2, 0)
+await wait(600)
+await gfire(G)
+check((await G.evaluate(`(async () => ${GRIG}.lastShot.hit)()`)) === 'wall', '38) 집 벽을 쏘면 벽에 맞는다 (총알 자국)')
+await G.shot('38-wall-hole')
+await gkey(G, 'Digit5', '5')
+await gkey(G, 'KeyV', 'v')
+check(await G.until(`(async () => (await __mod('/src/game/scene/Player.tsx')).playerRig.firstPerson)()`, 3000), '38) V → 1인칭')
+await G.shot('38-first-person')
+await gkey(G, 'KeyV', 'v')
+await G.evaluate(`(async () => { (await __mod('/src/game/input/pointer.ts')).setTouchAim(true); return true })()`)
+check(await G.until(`(async () => (await __mod('/src/game/scene/Player.tsx')).playerRig.firstPerson && ${GRIG}.optic?.label === '홀로')()`, 3000), '38) 3인칭에서 소총으로 조준하면 그동안 1인칭 홀로 조준기')
+await G.evaluate(`(async () => { document.querySelector('canvas').parentElement.dispatchEvent(new WheelEvent('wheel', { deltaY: -100, bubbles: true, cancelable: true })); return true })()`)
+check(await G.until(`(async () => ${GRIG}.optic?.label === '2.5x' && !!document.querySelector('[aria-label="조준경 2.5x"]'))()`, 3000), '38) 휠을 올리면 2.5x 조준경 화면')
+await G.shot('38-scope')
+await G.evaluate(`(async () => { (await __mod('/src/game/input/pointer.ts')).setTouchAim(false); return true })()`)
+check(await G.until(`(async () => !(await __mod('/src/game/scene/Player.tsx')).playerRig.firstPerson)()`, 3000), '38) 조준을 놓으면 3인칭으로')
+
+// 39) 사격장: 표적판을 맞히면 점수, G 60초 연습 게임 (사격장 안에서만), 최고 점수 저장, 무기 선반 E → 고르기
+await G.evaluate(teleport(181.5, 0))
+await wait(1500)
+await gequip(G, 'pistol')
+await gkey(G, 'KeyV', 'v')
+// 기울기를 끝(1.2)까지 내린 뒤 1.2 만큼 올려 수평(0)으로 맞춘다 (앞 점검에서 고개를 든 채로 남아 있다)
+await turnTo(G, Math.PI / 2, 400)
+await turnTo(G, Math.PI / 2, -240)
+await wait(600)
+await G.shot('39-range')
+check(await gfire(G), '39) 사격장에서 쏜다')
+/**
+ * 마지막 한 발의 광선이 표적판 면(세계 x 174.4)을 지나는 곳으로 표적(lane 0..2)을 옮긴다.
+ * hold: 게임 중엔 표적이 좌우로 움직이므로, 사격장 update 가 끝날 때마다 그 자리로 되돌린다 (게임 시간·점수는 그대로)
+ */
+const holdTarget = (lane, hold) => G.evaluate(`(async () => {
+  const s = ${GRIG}.lastShot; const r = ${GRANGE}; const tg = r.targets[${lane}]
+  const t = (174.4 - s.o.x) / s.d.x
+  const y = s.o.y + s.d.y * t, z = -(s.o.z + s.d.z * t)
+  const put = () => { tg.homeZ = z; tg.phase = 0; tg.down = false; tg.pivot.position.y = y - 1.3; tg.pivot.position.z = z }
+  put()
+  if (${hold} && !r.__held) {
+    const update = r.update
+    r.update = (dt) => { update(dt); if (r.game.state === 'running') put() }
+    r.__held = true
+  }
+  return true
+})()`)
+await holdTarget(1, false)
+await wait(1500)
+await gfire(G)
+check((await G.evaluate(`(async () => ${GRIG}.lastShot.hit)()`)) === 'target', '39) 표적판에 맞는다')
+await G.shot('39-target')
+await G.evaluate(teleport(188, -12))
+await wait(800)
+await gkey(G, 'KeyG', 'g')
+check((await G.evaluate(`(async () => ${GRANGE}.game.state)()`)) === 'idle' && (await G.evaluate(`document.body.innerText.includes('사격장 안에서')`)), '39) 사격장 밖에선 G 를 눌러도 시작하지 않는다')
+await G.evaluate(teleport(181.5, 0))
+await wait(1500)
+await gkey(G, 'KeyG', 'g')
+check((await G.evaluate(`(async () => ${GRANGE}.game.state)()`)) === 'countdown', '39) G → 3초 카운트다운')
+check(await G.until(`(async () => ${GRANGE}.game.state === 'running')()`, 30000), '39) 연습 게임 시작 (움직이는 표적)')
+await gfire(G)
+await holdTarget(0, true)
+await wait(1500)
+// 표적은 매 프레임 광선 위로 되돌리지만 프레임 사이에 조금 움직인다: 맞을 때까지 몇 발
+for (let i = 0; i < 8; i++) {
+  await gfire(G)
+  if ((await G.evaluate(`(async () => ${GRANGE}.game.score)()`)) > 0) break
+}
+const game39 = await G.evaluate(`(async () => { const g = ${GRANGE}.game; return { score: g.score, hits: g.hits, shots: g.shots } })()`)
+check(game39.score > 0 && game39.hits > 0 && game39.shots >= game39.hits, `39) 게임 중 맞히면 점수 (${JSON.stringify(game39)})`)
+await G.shot('39-running')
+await gkey(G, 'KeyG', 'g')
+check((await G.evaluate(`(async () => ${GRANGE}.game.state)()`)) === 'over', '39) G 로 그만 → 결과')
+check(await G.until(`(async () => ${GPROG}.getState().rangeBest === ${GRANGE}.game.score && ${GRANGE}.game.score > 0)()`, 10000), '39) 최고 점수를 저장한다')
+await G.shot('39-result')
+await gkey(G, 'KeyV', 'v')
+await G.evaluate(teleport(183.3, 4.0))
+check(await G.until(`document.body.innerText.includes('무기 고르기')`, 15000), '39) 무기 선반 앞 "E 무기 고르기"')
+await gkey(G, 'KeyE', 'e')
+check((await G.evaluate(`(async () => ${GSESS}.getState().mode)()`)) === 'rack', '39) E → 무기 선반 창')
+await G.shot('39-rack')
+await G.evaluate(`[...document.querySelectorAll('button')].find((b) => b.textContent.includes('저격총')).click(), true`)
+await wait(300)
+const rack39 = await G.evaluate(`(async () => { const s = ${GSESS}.getState(); return [s.mode, s.tool] })()`)
+check(rack39[0] === 'explore' && rack39[1] === 'sniper', `39) 저격총을 고르면 들고 창을 닫는다 (${rack39})`)
+const saved39 = await G.evaluate(`(() => { const s = JSON.parse(localStorage.getItem('fishing-island-save-v1')); return [s.version, s.state.ammo, s.state.reserve, s.state.rangeBest] })()`)
+check(saved39[0] === 5 && saved39[1]?.pistol >= 0 && saved39[2]?.pistol >= 0 && saved39[3] > 0, `39) 저장본 version 5 에 탄창·예비·사격장 최고 점수 (${JSON.stringify(saved39)})`)
+
+// 40) 폰: 총·칼을 들면 쏘기·조준·장전·무기 바꾸기 / 베기·찌르기 버튼. 세로·가로(360·390·780·844)에서 미니맵·조이스틱·도구 칸·안내·상호작용과 겹치지 않는다
+const weaponClash = `(() => {
+  const q = (s) => document.querySelector(s)
+  const pick = {
+    minimap: q('canvas[aria-label^="미니맵"]'), joy: q('.tc-joy-base'), help: q('.tc-help'), hotbar: q('[aria-label="도구 칸"]'),
+    action: q('.tc-action'), jump: q('button[aria-label="점프"]'), bag: q('button[aria-label="가방"]'), emote: q('button[aria-label="감정 표현"]'),
+    fire: q('button[aria-label="쏘기"]'), aim: q('button[aria-label="조준"]'), reload: q('button[aria-label="장전"]'), cycle: q('button[aria-label="무기 바꾸기"]'),
+    slash: q('button[aria-label="휘두르기"]'), stab: q('button[aria-label="찌르기"]'),
+  }
+  const r = Object.entries(pick).filter(([, e]) => e && e.getClientRects().length).map(([k, e]) => [k, e.getBoundingClientRect()])
+  const out = []
+  for (let i = 0; i < r.length; i++) for (let j = i + 1; j < r.length; j++) {
+    const [a, A] = r[i], [b, B] = r[j]
+    if (A.left < B.right - 1 && A.right > B.left + 1 && A.top < B.bottom - 1 && A.bottom > B.top + 1) out.push(a + '/' + b)
+  }
+  return [...out, ...r.filter(([, R]) => R.left < -1 || R.right > innerWidth + 1).map(([k]) => k + ':밖')]
+})()`
+await G.evaluate(`(async () => { (await __mod('/src/game/input/touchDevice.ts')).useTouchUiStore.setState({ touchUi: true }); return true })()`)
+for (const near of [false, true]) {
+  await G.evaluate(teleport(near ? 148 : 160, near ? -12.6 : -25))
+  await wait(1500)
+  for (const tool of ['pistol', 'knife']) {
+    await gequip(G, tool)
+    for (const [w, h] of [[390, 844], [360, 780], [844, 390], [780, 360]]) {
+      await G.send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 2, mobile: true })
+      // 화면 크기가 바뀐 뒤 다시 그릴 때까지 (바쁜 기계에선 몇 초) 기다린다
+      await G.until(`innerWidth === ${w} && JSON.stringify(${weaponClash}) === '[]'`, 8000)
+      const clash = await G.evaluate(weaponClash)
+      check(Array.isArray(clash) && clash.length === 0, `40) 폰 ${w}×${h} ${tool}${near ? ' + 상호작용' : ''}: 버튼이 서로·미니맵·도구 칸과 겹치지 않는다 (${JSON.stringify(clash)})`)
+      if (near && (w === 360 || w === 780)) await G.shot(`40-phone-${tool}-${w}x${h}`)
+    }
+  }
+}
+await G.send('Emulation.setDeviceMetricsOverride', { width: 844, height: 390, deviceScaleFactor: 2, mobile: true })
+await G.evaluate(teleport(160, -25))
+await gequip(G, 'pistol')
+await wait(1000)
+await G.evaluate(`(async () => { ${GPROG}.setState({ ammo: { ...${GPROG}.getState().ammo, pistol: 12 } }); return true })()`)
+await G.until(`(async () => { const g = ${GRIG}; return g.gun === 'pistol' && !g.reload && performance.now() / 1000 > g.readyAt + 0.05 })()`, 20000)
+const yaw40 = await G.evaluate(camYaw)
+const ammo40 = await gammo(G, 'pistol')
+await G.evaluate(`(() => {
+  const b = document.querySelector('button[aria-label="쏘기"]'); const r = b.getBoundingClientRect(); const x = r.left + r.width / 2, y = r.top + r.height / 2
+  b.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true, pointerId: 31, clientX: x, clientY: y }))
+  b.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, pointerId: 31, clientX: x - 120, clientY: y }))
+  return true
+})()`)
+await wait(800)
+check(await G.until(`(async () => ${GPROG}.getState().ammo.pistol === ${ammo40 - 1})()`, 15000), '40) 폰 쏘기 버튼을 누르면 한 발')
+check(await G.until(`(async () => Math.abs((await __mod('/src/game/scene/Player.tsx')).playerRig.yaw - ${yaw40}) > 0.3)()`, 15000), '40) 쏘기 버튼을 누른 채 끌면 시점이 돈다')
+await G.evaluate(`(document.querySelector('button[aria-label="쏘기"]').dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerId: 31 })), true)`)
+await wait(300)
+await gequip(G, 'sniper')
+await wait(500)
+const optic40 = []
+for (const want of ['4x', '8x', null]) {
+  await G.evaluate(`(document.querySelector('button[aria-label="조준"]').click(), true)`)
+  await G.until(`(async () => (${GRIG}.optic?.label ?? null) === ${JSON.stringify(want)})()`, 10000)
+  optic40.push(await G.evaluate(`(async () => ${GRIG}.optic?.label ?? null)()`))
+  if (want === '4x') await G.shot('40-phone-scope')
+}
+check(JSON.stringify(optic40) === '["4x","8x",null]', `40) 폰 조준 버튼: 4x → 8x → 끄기 (${optic40})`)
+await G.evaluate(`(document.querySelector('button[aria-label="무기 바꾸기"]').click(), true)`)
+await wait(300)
+check((await G.evaluate(`(async () => ${GSESS}.getState().tool)()`)) === 'fists', '40) 무기 바꾸기: 저격총 → 주먹 (한 바퀴)')
+await G.send('Emulation.clearDeviceMetricsOverride')
+await G.evaluate(`(async () => { (await __mod('/src/game/input/touchDevice.ts')).useTouchUiStore.setState({ touchUi: false }); return true })()`)
+G.close()
+
+// 41) PvP 두 사람: A 의 권총이 B 의 몸에 맞으면 B 체력 −20, A 화면의 B 이름표 체력 막대가 줄고, B 화면엔 A 의 궤적. 쓰러뜨리면 모두에게 알림, B 는 침대에서
+const RUN34 = Date.now().toString(36)
+const A6 = await open(9746, 0, `?room=pvp-${RUN34}`)
+await A6.evaluate(`__click('🔒 방 만들기')`)
+await A6.evaluate(`__fill('암호', 'secret1') && __fill('닉네임', '에이')`)
+await A6.evaluate(`__click('방 만들고 들어가기')`)
+check(await A6.until(`document.body.innerText.includes('👥 1명')`, 20000), '41) A 방 만들기')
+const B6 = await open(9747, 1, `?room=pvp-${RUN34}`)
+await B6.evaluate(`__fill('암호', 'secret1') && __fill('닉네임', '비이')`)
+await B6.evaluate(`__click('들어가기')`)
+check(await B6.until(`document.body.innerText.includes('👥 2명')`, 20000), '41) B 들어가기')
+await A6.evaluate(teleport(150, -5))
+await B6.evaluate(teleport(150, 5))
+await wait(1500)
+await gkey(A6, 'Digit4', '4')
+await gkey(A6, 'KeyV', 'v')
+await turnTo(A6, 0, 25)
+await wait(800)
+check(await gfire(A6), '41) A 첫 발')
+const ray41 = await A6.evaluate(`(async () => ${GRIG}.lastShot)()`)
+// 광선이 B 의 허리(땅 + 1m)를 지나는 곳에 B 를 세운다
+const t41 = ray41.d.y < -0.02 ? Math.min(14, Math.max(3, (1.0 - ray41.o.y) / ray41.d.y)) : 6
+await B6.evaluate(teleport(ray41.o.x + ray41.d.x * t41, ray41.o.z + ray41.d.z * t41))
+await wait(2500)
+await B6.evaluate(`(async () => { const fx = (await __mod('/src/game/guns/gunFx.ts')).gunFx; const t = fx.tracer; window.__tracers = 0; fx.tracer = (a, b) => { window.__tracers++; t(a, b) }; return true })()`)
+const hp41 = await B6.evaluate(`(async () => ${GPROG}.getState().survival.stamina)()`)
+await gfire(A6)
+check((await A6.evaluate(`(async () => ${GRIG}.lastShot.hit)()`)) === 'peer', '41) A 의 총알이 B 의 몸(보이지 않는 캡슐)에 맞는다')
+// 배가 부르면 초당 0.8 씩 회복하므로(3-1) 바쁜 기계에서 늦게 보면 조금 차 있다: 15 넘게 줄었으면 권총 한 발(20)
+check(await B6.until(`(async () => ${GPROG}.getState().survival.stamina < ${hp41 - 15})()`, 8000), `41) B 체력이 권총 피해 20 만큼 준다 (서버가 무기 표로 정한다)`)
+check(await B6.until(`window.__tracers > 0`, 3000), '41) B 화면에 A 의 총알 궤적 (shot)')
+check(await A6.until(`!!document.querySelector('[aria-label^="체력 "]') && Number(document.querySelector('[aria-label^="체력 "]').getAttribute('aria-label').slice(3)) < 85`, 8000), '41) A 화면에서 B 이름표 아래 체력 막대가 준다')
+await A6.shot('41-pvp-A')
+await B6.shot('41-pvp-B')
+for (let i = 0; i < 6; i++) {
+  if (await B6.evaluate(`(async () => (await __mod('/src/game/stores/dayStore.ts')).useDayStore.getState().seq?.kind === 'death')()`)) break
+  await wait(250)
+  await gfire(A6)
+}
+check(await B6.until(`(async () => (await __mod('/src/game/stores/dayStore.ts')).useDayStore.getState().seq?.kind === 'death')()`, 5000), '41) B 가 쓰러진다')
+check(await A6.until(`document.body.innerText.includes('에이 님이 비이 님을 쓰러뜨렸어요')`, 5000), '41) A 화면에 "에이 님이 비이 님을 쓰러뜨렸어요"')
+check(await B6.until(`(async () => (await __mod('/src/game/stores/netStore.ts')).useNetStore.getState().chat.some((l) => l.text === '에이 님이 비이 님을 쓰러뜨렸어요'))()`, 5000), '41) B 채팅 기록에도')
+await A6.shot('41-kill')
+check(await B6.until(`(async () => { const { playerRig } = await __mod('/src/game/scene/Player.tsx'); return !(await __mod('/src/game/stores/dayStore.ts')).useDayStore.getState().seq && Math.hypot(playerRig.position.x - 197.8, playerRig.position.z + 2.4) < 1.5 })()`, 15000), '41) B 는 침대 옆에서 깨어난다 (체력 100)')
+A6.close()
+B6.close()
+
 check(!consoleErrors.some((e) => /shader|WebGLProgram/i.test(e)), '셰이더 컴파일 오류가 없다')
 if (consoleErrors.length) console.log(`콘솔 오류·경고 ${consoleErrors.length}개:\n${consoleErrors.slice(0, 20).join('\n')}`)
```

- [ ] **Step 2: 전체 확인**

Run: `npx vitest run && npx tsc -b && npm run lint 2>&1 | grep -c warning && npm run build`
Expected: 86 파일 / 840 개 PASS, 경고 6, 빌드 성공

- [ ] **Step 3: 서버 점검**

Run: `npm run server:dev` 를 켜고 `node tools/room-smoke.mjs`
Expected: 47개 모두 `OK`

- [ ] **Step 4: 헤드리스 점검**

Run: (Vite 를 **새로** 띄운 뒤) `node tools/meadow-check.mjs http://localhost:5190 /tmp/meadow-check`
Expected: 37~41 의 56개 모두 `OK` (3-3 까지의 점검도 그대로 `OK`, 3-2 의 26 은 폰 도구 칸 4칸). 스크린샷 `37-ammo-shop`·`38-scope`·`39-running`·`39-rack`·`40-phone-*`·`41-kill` 을 눈으로 본다.

- [ ] **Step 5: 폰 실기기 (Vercel 미리보기)**

스펙 "폰 확인: 총 버튼": 가로·세로에서 쏘기·조준·장전·⇄ 와 칼 베기·찌르기를 손가락으로 눌러 본다 (쏘기를 누른 채 끌기, 다른 손으로 조이스틱).

- [ ] **Step 6: 커밋**

```bash
git add tools/meadow-check.mjs
git commit -F - <<'EOF'
test: 총·사격장·PvP 헤드리스 점검

- 37 잡화점 탄약 묶음 사기
- 38 쏘기·R 장전·산탄총 사냥·벽 자국·V 1인칭·소총 조준(홀로 → 휠 2.5x)
- 39 사격장 표적판 점수·G 연습 게임(사격장 안에서만)·최고 점수 저장(version 5)·무기 선반 E
- 40 폰 360·390·780·844 에서 총·칼 버튼이 미니맵·조이스틱·도구 칸·상호작용과 겹치지 않는다, 쏘기 끌기·조준 배율·무기 바꾸기
- 41 두 사람 PvP: 몸 캡슐 명중·체력 −20·궤적·이름표 체력 막대·쓰러뜨림 알림·침대
- 총을 바꾼 뒤 0.25초 안에 누른 것은 버려지므로(은지 그대로) 쏠 수 있을 때까지 기다렸다 쏜다
EOF
```

검증한 스크래치 커밋: `fac763b` (이 커밋의 diff 를 그대로 적용해도 된다: `git -C /private/tmp/claude-501/-Users-ihyelin-proten-hrlee-----threejs/e476c70e-362f-4ed3-9ff7-d8664da04e4b/scratchpad/plan-3-4/repo format-patch -1 --binary fac763b --stdout | git apply --index` 한 뒤 위 커밋 명령. 스크래치 커밋의 작성자는 scratch 라 `git am` 은 쓰지 않는다)

- [ ] **Step 7: 배포는 사용자에게 묻는다**

push·main 합치기·`npm run server:deploy` 는 묻고 한다. 배포는 **서버 먼저** (Global Constraints).

---

## 스펙 맞춤표 (Self-review)

| 스펙 | Task |
|---|---|
| 은지 `WEAPONS` 수치 그대로, 탄창·예비 저장 (version 5) | 1 (+3 vendor 비교 테스트) |
| 예비 탄약은 잡화점에서 (권총 12발 80 · 소총 30발 150 · 산탄 6발 120 · 저격 5발 250) | 1 |
| 은지 `buildWeaponModel` 을 3인칭 손(`gripPosition`)·1인칭 카메라에 | 3, 5 |
| 화면 가운데 광선: 동물·다른 사람·사격장 표적·벽(Rapier, 총알 자국), 반동·퍼짐·연사 | 2, 4, 6, 8 |
| 은지 `audio.js` (WebAudio) 를 우리 음량으로 | 3 |
| `shot {o, d, w}` 남의 궤적, 든 무기는 3-2 `tool` | 7, 8 (3) |
| V 1인칭/3인칭, 오른쪽 조준, 소총·저격총 조준경 2단계(휠), 3인칭 조준은 그동안 1인칭 | 5 |
| 낚시·배·패널(·잠·T 바퀴)에선 쏘지 않는다 | 4 |
| 사격장: range.js vendor, 무기 선반 E, G 60초, 최고 점수 저장 | 6 |
| PvP: `pvpHit {target, weapon, n}`, 서버 PVP_DMG·쿨다운, `hurt {dmg, by:'pvp', from}` 맞은 사람에게만, `died {by}` → `kill` 모두에게, 침대 경로 | 7, 8 |
| 남의 몸 캡슐 0.32 / 1.3, 이름표 체력 막대 `hp` | 2, 7, 8 |
| R 장전 · G · V · 휠 · 4~7 (키 배치) | 1, 4, 5, 6 |
| 폰: 쏘기(끌면 시점)·조준·장전·무기 바꾸기, 낚싯대면 낚시 버튼 그대로 | 9 (3-3 미룬 찌르기 버튼도) |
| 확인 방법: 명중·쿨다운(roomRules)·프로토콜 파싱 테스트, 사격장·PvP 헤드리스, 폰 총 버튼 | 7, 10 |
