# Three.js 게임 (스켈레톤)

React + TypeScript + Vite + Three.js(React Three Fiber) 기반 게임 프로젝트의 **뼈대**입니다.
게임 테마는 아직 정해지지 않았으며, 지금은 회전하는 상자 하나가 있는 임시 씬만 들어 있습니다.

## 실행 방법

```bash
npm install     # 의존성 설치 (최초 1회)
npm run dev     # 개발 서버 실행 → 터미널에 표시되는 주소(기본 http://localhost:5173) 접속
npm run build   # 타입 체크 + 프로덕션 빌드 (dist/)
```

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

## 로비 연동 계약 (Game 컴포넌트 props)

게임은 `src/game/Game.tsx`의 `Game` 컴포넌트 하나로 외부에 노출됩니다.

```tsx
import { Game } from './game/Game'

type GameProps = {
  onExit?: () => void                            // "나가기" 버튼을 눌렀을 때
  onFinish?: (result: { score: number }) => void // 한 판이 끝났을 때 결과 전달
}

<div style={{ width: '100vw', height: '100vh' }}>
  <Game onExit={() => goLobby()} onFinish={(r) => saveScore(r.score)} />
</div>
```

- `Game`은 **부모 요소 크기를 100% 채웁니다.** 로비 쪽에서 감싸는 요소의 크기를 정해 주세요.
- 게임 상태는 마운트될 때마다 초기화됩니다.
- 필요 의존성: `react`, `react-dom`, `three`, `@react-three/fiber`, `@react-three/drei`, `zustand`
