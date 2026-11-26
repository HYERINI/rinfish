# 섬마을 🏝️

https://seommaeul.vercel.app

낚시섬에서 낚시하고, 배를 타고 바다 건너 초원 마을(은지 맵)로 가서 요리·사냥·사격을 하며 친구들과 같이 사는 3D 섬 생활 게임.
React + TypeScript + Vite + Three.js(React Three Fiber) · rapier · zustand. 같이 하기는 Cloudflare Durable Object 방 서버(`server/`).

- 배포: `main` 에 올리면 Vercel 이 자동 배포한다. 옛 주소 `rinfish.vercel.app` 은 새 주소로 넘어간다 (쿼리 그대로)
- 저장은 브라우저 localStorage 라서 주소별로 따로다 (옛 주소 저장본은 새 주소로 오지 않는다)

## 실행 방법

```bash
npm install     # 의존성 설치 (최초 1회)
npm run dev     # 개발 서버 실행 → 터미널에 표시되는 주소(기본 http://localhost:5173) 접속
npm run build   # 타입 체크 + 프로덕션 빌드 (dist/)
```

## 같이 하기 (방 서버)

여러 명이 같은 섬에 들어오는 기능은 Cloudflare Workers + Durable Objects 로 만든 방 서버(`server/`)를 쓴다.

- 로컬: `npm run server:dev` 로 방 서버(ws://127.0.0.1:8787)를 띄우고, `.env.local` 에 `VITE_ROOM_SERVER=ws://127.0.0.1:8787` 을 넣은 뒤 `npm run dev`. (`.env.example` 참고)
- 확인: `node tools/room-smoke.mjs` (서버만), `node tools/multiplayer-check.mjs http://localhost:5173` (브라우저 두 개로 끝까지).
- 배포: `npx wrangler login` (한 번) → `npm run server:deploy` → 나온 주소(https://rinfish-rooms.<계정>.workers.dev)를 `wss://` 로 바꿔 Vercel 환경변수 `VITE_ROOM_SERVER` 에 넣고 다시 배포.
- `VITE_ROOM_SERVER` 가 없으면 로비 없이 혼자 하기만 된다.

## 주요 라이브러리

| 패키지 | 역할 |
| --- | --- |
| `three` | 3D 렌더링 엔진 |
| `@react-three/fiber` (R3F) | three.js를 React 컴포넌트(`<mesh>`, `<Canvas>` 등)로 쓰게 해줌 |
| `@react-three/drei` | R3F용 편의 컴포넌트 모음 (OrbitControls, GLTF 로더 등) |
| `zustand` | 가벼운 전역 상태 관리 (HTML UI ↔ 3D 씬 상태 공유) |

## 폴더 구조

```
public/
  models/          # GLTF/GLB 등 3D 모델 파일 위치 (예: /models/foo.glb 로 로드)
src/
  main.tsx         # React 진입점
  App.tsx          # 개발용 하니스: <Game />을 전체 화면에 띄움 (로비 앱 대역)
  index.css        # 전체 화면 캔버스용 기본 스타일
  game/
    Game.tsx       # 게임 루트 컴포넌트: 3D 캔버스 + HTML UI 오버레이
    store.ts       # zustand 게임 상태 (phase: ready/playing/result, score)
    scene/
      World.tsx    # 3D 씬 (조명, 바닥, 오브젝트, 카메라 컨트롤)
    ui/
      Hud.tsx      # 캔버스 위에 겹치는 HTML UI (제목, 점수, 나가기 버튼)
```

- 3D 관련 코드는 `scene/`, 일반 HTML UI는 `ui/`에 둡니다.
- 게임 코드는 전부 `src/game/` 안에만 둡니다. 로비에 붙일 때 이 폴더만 옮기면 되도록 하기 위함입니다.

## 진행 저장 (서버)

진행(코인·가방·도감·장비·어항 등, `progressStore`)은 브라우저에 사본을 두고 방 서버(`rinfish-rooms`)의 `/save` 에 정본을 저장한다. 설정·마지막 위치·닉네임은 브라우저에만 둔다.

- 처음 열면 **복구 코드**(20자)가 생긴다. ESC 메뉴 「☁️ 진행 저장」에서 보고 복사할 수 있고, 시작 창·처음 꾸미기 화면의 「🔑 코드로 이어 하기」로 다른 브라우저에서 되찾는다.
- 서버나 인터넷이 끊겨도 플레이는 계속되고, 돌아오면 밀린 저장을 올린다. 같은 코드로 두 곳에서 하면 늦게 올린 쪽이 최신을 받아 이어 하고, 덮어쓰기 전 진행은 백업해 두어 ESC 메뉴 「☁️ 진행 저장」에서 되돌릴 수 있다.
- 한 브라우저에서 게임 탭은 하나만 돈다. 두 번째 탭은 "다른 탭에서 섬마을을 하고 있어요" 안내만 보인다.
- 서버는 `/save` 를 IP 마다 1분에 60번으로 제한하고(`SAVE_LIMIT`), 256KB 를 넘는 본문은 읽기 전에 거절한다.
- `VITE_ROOM_SERVER` 가 없으면 서버 저장이 꺼지고 지금처럼 브라우저에만 저장한다.
- ⚠️ 복구 코드는 허브 로그인이 생기기 전까지 쓰는 임시 방식이다. **허브 로그인이 구현되면 로그인 방식으로 바꾼다** (설계: `docs/superpowers/specs/2026-11-26-server-save-design.md` 「허브 로그인 전환」).
- 확인: `node tools/save-smoke.mjs` (서버), `node tools/cloud-check.mjs http://127.0.0.1:5190` (브라우저).

## 허브 로비 연결 (game-entry-contract v3)

팀 허브 로비는 섬마을을 iframe 이나 import 없이 **주소로** 연다: `https://seommaeul.vercel.app/?hub_return=<복귀 주소>&hub_name=<이름>&hub_room=<방 코드>`.

- 등록 정보: `id: rinfish` (그대로), `title: 섬마을`, `url: https://seommaeul.vercel.app/`. 옛 주소로 등록돼 있어도 넘어가긴 하지만 허브 쪽 등록을 새 이름·주소로 바꾼다
- `hub_return`: http(s) 일 때만 받아 이번 탭(sessionStorage)에 기억한다. 첫 화면과 ESC 메뉴에 「🏠 허브 로비로」가 생기고, 누르면 방 연결을 닫고 그 주소로 **고치지 않고** 이동한다. 없으면 버튼도 없다.
- `hub_name`: 닉네임 칸을 미리 채운다 (10자로 자름). 표시용 힌트일 뿐이고 서버가 다시 검사한다.
- `hub_room`: 형식(6자, `23456789abcdefghjkmnpqrstuvwxyz`)이 맞으면 「👥 허브 방 친구들과 같이 하기」 버튼이 생긴다. 섬마을 방 `hub-<코드>` 로 들어가고, 없으면 만든다. 이 방의 암호는 코드에서 만들므로 비밀이 아니다.
- 읽는 곳: `src/App.tsx` → `logic/hubParams.ts`. 확인: `node tools/hub-entry-check.mjs http://localhost:5190` (서버·Vite 준비는 스크립트 머리말).
