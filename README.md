# Three.js 게임 (스켈레톤)

React + TypeScript + Vite + Three.js(React Three Fiber) 기반 게임 프로젝트의 **뼈대**입니다.
게임 테마는 아직 정해지지 않았으며, 지금은 회전하는 상자 하나가 있는 임시 씬만 들어 있습니다.

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

## 허브 로비 연결 (game-entry-contract v3)

팀 허브 로비는 낚시섬을 iframe 이나 import 없이 **주소로** 연다: `https://rinfish.vercel.app/?hub_return=<복귀 주소>&hub_name=<이름>&hub_room=<방 코드>`.

- 등록 정보: `id: rinfish`, `title: 낚시섬`, `url: https://rinfish.vercel.app/`
- `hub_return`: http(s) 일 때만 받아 이번 탭(sessionStorage)에 기억한다. 첫 화면과 ESC 메뉴에 「🏠 허브 로비로」가 생기고, 누르면 방 연결을 닫고 그 주소로 **고치지 않고** 이동한다. 없으면 버튼도 없다.
- `hub_name`: 닉네임 칸을 미리 채운다 (10자로 자름). 표시용 힌트일 뿐이고 서버가 다시 검사한다.
- `hub_room`: 형식(6자, `23456789abcdefghjkmnpqrstuvwxyz`)이 맞으면 「👥 허브 방 친구들과 같이 하기」 버튼이 생긴다. 낚시섬 방 `hub-<코드>` 로 들어가고, 없으면 만든다. 이 방의 암호는 코드에서 만들므로 비밀이 아니다.
- 읽는 곳: `src/App.tsx` → `logic/hubParams.ts`. 확인: `node tools/hub-entry-check.mjs http://localhost:5190` (서버·Vite 준비는 스크립트 머리말).
