# 낚시섬 캐릭터 꾸미기·벤치 앉기·스크롤 줌 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 성별·피부·머리·옷·키·몸 부위 크기를 자유롭게 고르는 캐릭터 꾸미기(첫 시작 + 선착장 옷장), 벤치에 실제로 앉기, 마우스 휠 줌을 만든다.

**Architecture:** 성별마다 모든 부위가 한 뼈대에 붙은 모듈형 glb(`male.glb`, `female.glb`)를 저장소의 빌드 스크립트로 만든다. 게임은 저장된 `CharacterLook`을 읽어 부위 보이기/숨기기, 재질 색 곱하기, 옷 텍스처 바꾸기, 뼈 배율 적용으로 모습을 만든다. 모습 검증·랜덤·자세·줌 계산은 `logic/`의 순수 함수로 테스트한다.

**Tech Stack:** Vite 8, React 19, TypeScript 6, three 0.186, @react-three/fiber 9, @react-three/drei 10, @react-three/rapier, zustand 5, vitest, oxlint. 빌드 도구: Node + @gltf-transform 4 + sharp (게임 의존성과 분리)

**Spec:** `docs/superpowers/specs/2026-10-21-character-customization-design.md`

## Global Constraints

- 층 규칙: scene/ui → stores → logic → data. `logic/`은 React·three·zustand를 import하지 않는다
- 범위·견본 색·부위 목록·기본 꾸밈 같은 값은 `src/game/data/`에만 둔다(좌표·크기·연출 값 제외)
- 저장 키 `fishing-island-save-v1`, persist `version: 1` 그대로. 새 필드 `look`은 `merge`에서 검증하고 없으면 `null`
- tsconfig: `verbatimModuleSyntax`(타입은 `import type`), `erasableSyntaxOnly`(enum 금지), `noUnusedLocals`/`noUnusedParameters`
- 3D 안의 한글은 drei `<Html>` + `zIndexRange={[100, 0]}`. UI 레이어는 zIndex 1000
- 에셋은 Quaternius 무료(Standard) CC0만. 계정 만들기·로그인 금지. 출처는 `public/models/CREDITS.md`
- 빌드 스크립트 의존성은 `tools/build-characters/package.json`에만. 원본 팩 zip·압축 해제본은 커밋하지 않는다(`tools/build-characters/.cache/`는 git 무시)
- 꾸미기 범위(스펙 3장): 키 0.75~1.3 / 머리 0.7~1.6 / 어깨 0.7~1.5 / 가슴·등 0.7~1.6 / 배 0.7~1.8 / 팔 굵기 0.6~1.8 / 팔 길이 0.8~1.3 / 다리 굵기 0.6~1.8 / 다리 길이 0.8~1.3
- 줌(스펙 7장): 거리 4~18, 기본 10, 높이는 거리 × 0.7
- 커밋 메시지: `feat:`/`chore:`/`fix:`/`test:` 타입만, 괄호 스코프 금지, 짧은 한국어 제목 + 본문. Co-Authored-By나 AI·도구 표기 절대 금지

## Review Focus

1. **깨진·옛 저장본의 look**(필드 누락, 범위 밖 숫자, 없는 머리 id, 여자인데 수염 true) → 크래시 없이 그 성별의 기본값으로 고쳐서 시작. Task 2·4 테스트로 고정한다.
2. **성별을 바꿨다 돌아오기** → 머리·옷 선택이 유효하게 유지되고 여자에게 수염이 남지 않는다. Task 2 `switchGender` 테스트로 고정한다.
3. **처음 생성 화면에서 ESC** → 화면이 닫혀 모습 없이 게임이 진행되면 안 된다. Task 3 `resolveKeyAction` 테스트로 고정한다.
4. **패널이 열린 상태에서 휠** → 카메라가 아니라 패널이 스크롤된다. 줌은 탐험·낚시·휴식 모드에서만. Task 3 `canZoom` 테스트로 고정한다.
5. **다리 길이·키 극단값** → 발이 땅에 파묻히거나 뜨지 않는다. Task 5의 headless 캡처(다리 0.8/1.3 × 키 0.75/1.3)로 확인한다.

---

## 파일 구조

```
tools/build-characters/
  package.json             빌드 전용 의존성 (@gltf-transform/core·functions, sharp)
  fetch-packs.py           itch.io 무료 다운로드(로그인 없음) → .cache/
  build.mjs                팩 → male.glb / female.glb / 옷 대체 텍스처
  inspect.mjs              결과 glb 검사 (부위 노드·재질·클립·뼈 수·크기)
  README.md                다시 만드는 방법
public/models/characters/
  male.glb  female.glb
  textures/peasant_alt.jpg  textures/ranger_alt.jpg
src/game/
  data/types.ts            (수정) Gender, HairId, OutfitId, BodyPart, CharacterLook
  data/characterParts.ts   (새로) 목록·견본 색·범위·노드 이름·기본 꾸밈
  data/characters.ts       (수정) 클립 표 + 앉기 클립, 성별 → 파일
  data/balance.ts          (수정) CAMERA_ZOOM
  data/zones.ts            (수정) FACILITY.wardrobe, BENCH_SEAT
  logic/characterLook.ts   (새로) normalizeLook, switchGender, randomLook (+ test)
  logic/cameraZoom.ts      (새로) nextZoom, canZoom (+ test)
  logic/characterPose.ts   (수정) sit / standUp (+ test)
  logic/interaction.ts     (수정) wardrobe, 첫 생성 ESC 잠금 (+ test)
  stores/progressStore.ts  (수정) look, setLook (+ test)
  stores/sessionStore.ts   (수정) zoom, zoomBy
  input/useWheelZoom.ts    (새로)
  input/useInteractionKeys.ts (수정) 잠금 전달
  scene/characterAppearance.ts (새로) prepareCharacter, applyLook
  scene/PlayerModel.tsx    (수정) look 반영, 앉기·일어나기
  scene/Player.tsx         (수정) 벤치 자리, 줌 거리
  scene/PlayTimeTicker.tsx (수정) 꾸미기 중 시간 정지
  scene/facilities/Wardrobe.tsx (새로)
  scene/World.tsx          (수정)
  ui/CharacterCreator.tsx  (새로) 꾸미기 화면 + 미리보기
  ui/Panels.tsx, ui/Hud.tsx, Game.tsx (수정)
```

---

### Task 1: 캐릭터 빌드 도구와 glb 만들기

**Files:**
- Create: `tools/build-characters/package.json`, `fetch-packs.py`, `build.mjs`, `inspect.mjs`, `README.md`, `.gitignore`
- Create: `public/models/characters/male.glb`, `female.glb`, `textures/peasant_alt.jpg`, `textures/ranger_alt.jpg`
- Modify: `public/models/CREDITS.md`

**Interfaces:**
- Produces (Task 2·5가 그대로 쓰는 이름 — 정확히 지킨다):
  - 노드 이름(성별 공통): `head`, `eyes`, `eyebrows`, `hair_simpleParted`, `hair_buzzed`, `hair_long`, `hair_buns`, `hair_buzzedFemale`, `beard`(남자 파일만), `peasant_arms`, `peasant_body`, `peasant_legs`, `peasant_feet`, `ranger_arms`, `ranger_bracer`, `ranger_body`, `ranger_belt1`, `ranger_belt2`, `ranger_pauldron`, `ranger_legs`, `ranger_feet`, `ranger_hood`
  - 재질 이름: `skin`(머리·목), `skin_hands`(옷 팔 안의 맨손), `hair`(머리카락·수염·눈썹), `peasant`, `ranger`, `eyes`
  - 뼈: 65개, 원본 이름 그대로(`root`, `pelvis`, `spine_01`…`Head`, `clavicle_l`, `upperarm_l`, `hand_l`, `thigh_l`, `foot_l` …). 파일마다 뼈대(skin)는 1개
  - 애니메이션 13개(원본 이름): `Idle_Loop`, `Walk_Loop`, `Jog_Fwd_Loop`, `Pistol_Aim_Up`, `Pistol_Aim_Neutral`, `Pistol_Aim_Down`, `Push_Loop`, `Dance_Loop`, `Death01`, `Crouch_Idle_Loop`, `Sitting_Enter`, `Sitting_Idle_Loop`, `Sitting_Exit`

참고: 이전 조사(같은 팩을 받아 측정한 결과)는 이렇다. 남녀 뼈대는 이름·순서가 같지만 위치가 다르다(최대 10.7cm). 같은 성별의 몸·옷은 같은 뼈대 위에 있다(남자 몸과 남자 옷은 손에서 최대 3.4cm 차이). 머리카락 5종은 `Head` 뼈 하나에만 붙어 있어("Rigged to Head Bone") 각자의 역바인드 행렬을 유지하면 다른 성별 머리에도 정확히 따라간다. UAL 클립은 65개 뼈 모두에 회전·이동·크기 트랙이 있는데 크기는 늘 1, 이동은 골반만 실제로 움직인다.

- [ ] **Step 1: 도구 폴더와 의존성**

`tools/build-characters/package.json`:

```json
{
  "name": "build-characters",
  "private": true,
  "type": "module",
  "scripts": {
    "fetch": "python3 fetch-packs.py",
    "build": "node build.mjs",
    "inspect": "node inspect.mjs"
  },
  "dependencies": {
    "@gltf-transform/core": "^4.5.1",
    "@gltf-transform/functions": "^4.5.1",
    "sharp": "^0.34.0"
  }
}
```

`tools/build-characters/.gitignore`:

```
node_modules/
.cache/
```

루트 `package.json`의 lint 스크립트와 `vite.config.ts`의 vitest exclude에 `tools/**`를 더한다(빌드 스크립트를 앱 린트·테스트가 읽지 않게).

Run: `cd tools/build-characters && npm install`
Expected: 설치 성공

- [ ] **Step 2: 팩 받기 스크립트**

`tools/build-characters/fetch-packs.py`:

```python
"""Quaternius 무료(Standard) 팩을 itch.io 에서 받는다. 로그인 없이 '0원 다운로드' 흐름을 쓴다.
사용: python3 fetch-packs.py   → .cache/<slug>.zip 을 받고 .cache/<slug>/ 에 푼다"""
import http.cookiejar
import json
import os
import re
import urllib.parse
import urllib.request
import zipfile

# slug, 업로드 이름에 들어 있어야 하는 글자 (Standard 판)
PACKS = [
    ("universal-base-characters", "Standard"),
    ("modular-character-outfits-fantasy", "Standard"),
    ("universal-animation-library", "Standard"),
]
CACHE = os.path.join(os.path.dirname(__file__), ".cache")


def fetch(slug, name_filter):
    zip_path = os.path.join(CACHE, f"{slug}.zip")
    if not os.path.exists(zip_path):
        jar = http.cookiejar.CookieJar()
        opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(jar))
        opener.addheaders = [("User-Agent", "Mozilla/5.0")]
        base = f"https://quaternius.itch.io/{slug}"

        def get(url, data=None):
            body = urllib.parse.urlencode(data).encode() if data is not None else None
            return opener.open(url, body).read()

        def csrf(html):
            return re.search(r'name="csrf_token" value="([^"]*)"', html).group(1)

        page = get(base + "/purchase").decode()
        download_page_url = json.loads(get(base + "/download_url", {"csrf_token": csrf(page)}))["url"]
        download_page = get(download_page_url).decode()
        uploads = re.findall(r'data-upload_id="(\d+)"[\s\S]*?title="([^"]*)"', download_page)
        upload_id = next(uid for uid, title in uploads if name_filter in title)
        file_info = json.loads(get(f"{base}/file/{upload_id}?source=game_download", {"csrf_token": csrf(download_page)}))
        with open(zip_path, "wb") as f:
            f.write(opener.open(file_info["url"]).read())
    out_dir = os.path.join(CACHE, slug)
    if not os.path.exists(out_dir):
        with zipfile.ZipFile(zip_path) as z:
            z.extractall(out_dir)
    print(slug, "→", out_dir)


os.makedirs(CACHE, exist_ok=True)
for slug, name_filter in PACKS:
    fetch(slug, name_filter)
```

Run: `cd tools/build-characters && npm run fetch`
Expected: `.cache/` 아래 세 폴더. 각 팩의 License 파일을 열어 CC0인지 확인한다(`grep -ril "creative commons zero\|cc0" .cache/*/ | head`).

- [ ] **Step 3: 합치는 스크립트**

`tools/build-characters/build.mjs`. 아래 흐름을 그대로 구현한다. 원본 파일 경로는 `.cache` 안을 `find`로 확인해서 상수에 적는다(조사 때 경로: `Universal Base Characters[Standard]/Base Characters/Godot - UE/Superhero_<Gender>_FullBody.gltf`, `Hairstyles/Rigged to Head Bone/glTF (Godot -Unreal)/Hair_*.gltf`, `Modular Character Outfits - Fantasy[Standard]/Exports/glTF (Godot-Unreal)/Modular Parts/<Gender>_<Outfit>_<Part>.gltf`, `Universal Animation Library[Standard]/Unreal-Godot/UAL1_Standard.glb`).

```js
import { NodeIO, Document } from '@gltf-transform/core'
import { compactPrimitive, dedup, mergeDocuments, prune, resample, textureCompress, unpartition } from '@gltf-transform/functions'
import sharp from 'sharp'
import fs from 'node:fs'
import path from 'node:path'

const OUT = path.resolve('../../public/models/characters')
const io = new NodeIO()

// ---- 1. 성별별 부위 목록: [원본 파일, 노드 이름] ----
// 노드 이름은 게임 코드(data/characterParts.ts)가 그대로 쓴다. 바꾸면 거기도 바꿔야 한다
const PARTS = {
  male: [
    [BASE_MALE_BODY, 'body'], // 머리·목만 남기고 잘라 'head' 로 이름 붙인다 (아래 3단계)
    [HAIR('SimpleParted'), 'hair_simpleParted'], [HAIR('Buzzed'), 'hair_buzzed'], [HAIR('Long'), 'hair_long'],
    [HAIR('Buns'), 'hair_buns'], [HAIR('BuzzedFemale'), 'hair_buzzedFemale'], [HAIR('Beard'), 'beard'],
    [OUTFIT('Male_Peasant_Arms'), 'peasant_arms'], [OUTFIT('Male_Peasant_Body'), 'peasant_body'],
    [OUTFIT('Male_Peasant_Legs'), 'peasant_legs'], [OUTFIT('Male_Peasant_Feet'), 'peasant_feet'],
    [OUTFIT('Male_Ranger_Arms'), 'ranger_arms'], [OUTFIT('Male_Ranger_Arms_Bracer'), 'ranger_bracer'],
    [OUTFIT('Male_Ranger_Body'), 'ranger_body'], [OUTFIT('Male_Ranger_Body_Belt_1'), 'ranger_belt1'],
    [OUTFIT('Male_Ranger_Body_Belt_2'), 'ranger_belt2'], [OUTFIT('Male_Ranger_Acc_Pauldron'), 'ranger_pauldron'],
    [OUTFIT('Male_Ranger_Legs'), 'ranger_legs'], [OUTFIT('Male_Ranger_Feet_Boots'), 'ranger_feet'],
    [OUTFIT('Male_Ranger_Head_Hood'), 'ranger_hood'],
  ],
  female: [/* 같은 구성. 수염 없음, Female_* 옷, 레인저 신발은 Female_Ranger_Feet */],
}
```

(실제 파일 이름은 `.cache`에서 확인해 맞춘다. 어깨받이 파일 이름이 다르면 그 이름을 쓴다.)

성별마다 다음 순서로 처리한다:

1. **기준 뼈대**: 그 성별의 첫 번째 **옷** 파일(`*_Peasant_Body`)을 읽어 새 `Document`의 기준으로 삼는다. 남자 옷·머리카락은 서로 뼈 위치가 같아서 이것을 기준으로 하면 몸통이 아닌 머리(몸에서 잘라 낸 부분)만 최대 3.4cm 어긋난다(목·머리 쪽은 거의 0).
2. **부위 합치기**: 나머지 파일을 `mergeDocuments(doc, other)`로 합친 뒤, 새로 들어온 각 스킨드 메시 노드의 skin 관절(joint) 목록을 **기준 뼈대의 같은 이름 노드로 바꾼다**. 역바인드 행렬(inverseBindMatrices)은 그 부위 것을 그대로 둔다. 그다음 들어온 쪽의 뼈 노드 트리(관절 루트)를 장면에서 떼고 지운다. 결과적으로 장면에는 뼈대 하나 + 부위 메시들만 남는다.
3. **몸 → 머리만 남기기**: 몸 메시의 삼각형 중 세 꼭짓점 모두 가장 큰 가중치의 뼈가 `neck_01` 또는 `Head`인 것만 남기고 `compactPrimitive`로 정리한다. 노드 이름을 `head`, 눈은 `eyes`, 눈썹은 `eyebrows`로 바꾼다. 옷 깃 아래로 목에 틈이 보이지 않는지는 Step 5 캡처로 확인하고, 틈이 있으면 `spine_03`에 붙은 꼭짓점 중 `neck_01` 가중치가 0.3 이상인 것도 남긴다.
4. **노드·재질 이름 정리**: 각 부위 메시를 가진 노드에 표의 이름을 붙인다. 재질 이름을 `MI_Superhero_*` → `skin`, `MI_Regular_*` → `skin_hands`, `MI_Hair_*`와 눈썹 재질 → `hair`, `MI_Peasant*` → `peasant`, `MI_Ranger*` → `ranger`, 눈 → `eyes`로 바꾼다(같은 이름끼리는 `dedup`이 합친다). 모든 재질의 normal·occlusion·metallicRoughness 텍스처를 떼어 낸다.
5. **피부·머리 텍스처 밝히기**: `skin`, `skin_hands`의 baseColor 이미지를 sharp로 `modulate({ saturation: 0.15, brightness: 1.6 })` 처리해 거의 흰 살색으로 만든다(게임에서 피부색을 곱한다). 머리카락 텍스처는 이미 흰 결이라 그대로.
6. **애니메이션**: UAL1_Standard.glb를 읽어 위 13개 클립만 남기고, 크기(scale) 채널 전부와 `pelvis`를 뺀 이동(translation) 채널 전부를 지운다. 남은 채널의 대상 노드를 이름으로 기준 뼈대 노드로 바꾼다. 골반 이동 값은 `기준 뼈대 골반 높이 / UAL 골반 높이` 비율로 곱해 발이 뜨거나 묻히지 않게 한다. 그 뒤 UAL 노드·메시를 지운다.
7. **정리·압축**: `unpartition()`, `dedup()`, `prune()`, `resample()`, `textureCompress({ encoder: sharp, targetFormat: 'jpeg', resize: [1024, 1024], quality: 80 })`. `glb`로 `OUT/<gender>.glb`에 쓴다.
8. **옷 대체 텍스처**: `T_Peasant_2_BaseColor`, `T_Ranger_3_BaseColor` 원본을 sharp로 1024 jpg(q80)로 줄여 `OUT/textures/peasant_alt.jpg`, `ranger_alt.jpg`에 쓴다.

- [ ] **Step 4: 검사 스크립트**

`tools/build-characters/inspect.mjs`:

```js
import { NodeIO } from '@gltf-transform/core'
import fs from 'node:fs'

const EXPECTED_NODES = ['head', 'eyes', 'eyebrows', 'hair_simpleParted', 'hair_buzzed', 'hair_long', 'hair_buns', 'hair_buzzedFemale',
  'peasant_arms', 'peasant_body', 'peasant_legs', 'peasant_feet', 'ranger_arms', 'ranger_bracer', 'ranger_body', 'ranger_belt1',
  'ranger_belt2', 'ranger_pauldron', 'ranger_legs', 'ranger_feet', 'ranger_hood']
const EXPECTED_MATERIALS = ['skin', 'skin_hands', 'hair', 'peasant', 'ranger', 'eyes']
const EXPECTED_CLIPS = ['Idle_Loop', 'Walk_Loop', 'Jog_Fwd_Loop', 'Pistol_Aim_Up', 'Pistol_Aim_Neutral', 'Pistol_Aim_Down', 'Push_Loop',
  'Dance_Loop', 'Death01', 'Crouch_Idle_Loop', 'Sitting_Enter', 'Sitting_Idle_Loop', 'Sitting_Exit']

let failed = false
for (const gender of ['male', 'female']) {
  const file = `../../public/models/characters/${gender}.glb`
  const doc = await new NodeIO().read(file)
  const root = doc.getRoot()
  const nodes = new Set(root.listNodes().map((n) => n.getName()))
  const want = gender === 'male' ? [...EXPECTED_NODES, 'beard'] : EXPECTED_NODES
  const missing = want.filter((n) => !nodes.has(n))
  const mats = new Set(root.listMaterials().map((m) => m.getName()))
  const missingMats = EXPECTED_MATERIALS.filter((m) => !mats.has(m))
  const clips = root.listAnimations().map((a) => a.getName())
  const missingClips = EXPECTED_CLIPS.filter((c) => !clips.includes(c))
  const jointSets = new Set(root.listSkins().map((s) => s.listJoints().map((j) => j.getName()).join(',')))
  const jointNodes = new Set(root.listSkins().flatMap((s) => s.listJoints()))
  const badTracks = root.listAnimations().flatMap((a) => a.listChannels())
    .filter((c) => c.getTargetPath() === 'scale' || (c.getTargetPath() === 'translation' && c.getTargetNode().getName() !== 'pelvis'))
  const size = fs.statSync(file).size
  console.log(gender, { size, skins: root.listSkins().length, jointNodes: jointNodes.size, missing, missingMats, missingClips, badTracks: badTracks.length })
  // 모든 skin 이 같은 65개 뼈 노드를 공유해야 한다
  if (missing.length || missingMats.length || missingClips.length || jointNodes.size !== 65 || jointSets.size !== 1 || badTracks.length || size > 4_000_000) failed = true
}
process.exit(failed ? 1 : 0)
```

Run: `cd tools/build-characters && npm run build && npm run inspect`
Expected: 두 성별 모두 `missing: []`, `missingMats: []`, `missingClips: []`, `jointNodes: 65`, `badTracks: 0`, 크기 4MB 이하, 종료 코드 0

- [ ] **Step 5: 화면으로 확인**

임시 HTML(커밋하지 않음, 스크래치 폴더)에 three.js로 두 glb를 불러 모든 부위를 켠 상태, 농부 옷만 켠 상태(머리 SimpleParted), 레인저 옷+후드 상태를 앞·옆에서 headless Chrome으로 캡처한다(`--headless=new --use-angle=swiftshader --enable-unsafe-swiftshader`). 확인할 것: 부위가 제자리에 있다, 목·옷깃 사이 틈이 없다, 피부가 밝은 살색이다, `Walk_Loop`·`Sitting_Idle_Loop` 재생 시 팔다리 길이가 틀어지지 않는다, 여자 파일에 남자 머리(`hair_simpleParted`)를 켜도 머리에 맞게 붙는다. 문제가 있으면 build.mjs를 고쳐 다시 만든다.

- [ ] **Step 6: 출처·안내 문서**

`public/models/CREDITS.md` 끝에:

```markdown
## 꾸미기용 캐릭터 (characters/male.glb, female.glb)

- 제작: Quaternius, 라이선스 CC0 1.0 (각 팩 zip 안 License 파일)
- Universal Base Characters, Modular Character Outfits - Fantasy, Universal Animation Library 의 무료(Standard) 판을 합쳤다
- 다시 만들기: `tools/build-characters/README.md`
```

`tools/build-characters/README.md`: 받기(`npm install && npm run fetch`) → 만들기(`npm run build`) → 검사(`npm run inspect`) 순서와 노드·재질 이름이 게임 코드(`src/game/data/characterParts.ts`)와 맞물린다는 주의를 적는다.

- [ ] **Step 7: 커밋**

```bash
git add tools/build-characters public/models/characters public/models/CREDITS.md package.json vite.config.ts
git commit -m "chore: 꾸미기용 캐릭터 빌드 도구와 남녀 모델 추가" -m "Quaternius 무료 팩(몸·머리·옷·애니메이션)을 성별마다 뼈대 하나에 모은 glb로 합치는 스크립트를 tools/build-characters에 두고, 결과 male.glb·female.glb와 옷 대체 텍스처를 넣었다. 피부 텍스처는 밝게 바꿔 게임에서 색을 곱한다. 크기·골반 외 이동 애니메이션 트랙은 지워 뼈 배율 조절이 덮어쓰이지 않게 했다."
```

---

### Task 2: 꾸미기 데이터와 모습 규칙

**Files:**
- Modify: `src/game/data/types.ts`
- Create: `src/game/data/characterParts.ts`, `src/game/logic/characterLook.ts`, `src/game/logic/characterLook.test.ts`

**Interfaces:**
- Consumes: `lerp`, `type Rng` (`logic/rng.ts`)
- Produces:
  - 타입 `Gender`, `HairId`, `OutfitId`, `BodyPart`, `CharacterLook`
  - `HAIRS`, `OUTFITS`, `SKIN_COLORS`, `HAIR_COLORS`, `HEIGHT_RANGE`, `BODY_RANGES`, `BODY_PARTS`, `BODY_PART_LABEL`, `DEFAULT_BODY`, `LOOK_PRESETS`, `DEFAULT_LOOK`, `PART_NODES`, `ALWAYS_VISIBLE_NODES`
  - `normalizeLook(v: unknown): CharacterLook | null`, `switchGender(look, gender): CharacterLook`, `randomLook(rng: Rng): CharacterLook`

- [ ] **Step 1: 타입**

`src/game/data/types.ts` 끝에 추가:

```ts
export type Gender = 'male' | 'female'
export type HairId = 'simpleParted' | 'buzzed' | 'long' | 'buns' | 'buzzedFemale' | 'none'
export type OutfitId = 'peasant' | 'ranger'
export type BodyPart = 'head' | 'shoulders' | 'chest' | 'belly' | 'armThickness' | 'armLength' | 'legThickness' | 'legLength'

/** 플레이어 생김새. 저장된다 */
export type CharacterLook = {
  gender: Gender
  /** '#rrggbb' */
  skinColor: string
  hair: HairId
  hairColor: string
  /** 남자만 */
  beard: boolean
  top: OutfitId
  bottom: OutfitId
  shoes: OutfitId
  /** 레인저 후드. 쓰면 머리카락을 숨긴다 */
  hood: boolean
  outfitColor: 'base' | 'alt'
  /** 전체 키 배율 */
  height: number
  /** 부위별 배율 */
  body: Record<BodyPart, number>
}
```

- [ ] **Step 2: 꾸미기 데이터**

`src/game/data/characterParts.ts`:

```ts
import type { BodyPart, CharacterLook, Gender, HairId, OutfitId } from './types'

export const GENDER_LABEL: Record<Gender, string> = { male: '남자', female: '여자' }

export const HAIRS: { id: HairId; name: string }[] = [
  { id: 'simpleParted', name: '가르마' },
  { id: 'buzzed', name: '짧은 머리' },
  { id: 'long', name: '긴 머리' },
  { id: 'buns', name: '올림머리' },
  { id: 'buzzedFemale', name: '숏컷' },
  { id: 'none', name: '민머리' },
]

export const OUTFITS: { id: OutfitId; name: string }[] = [
  { id: 'peasant', name: '농부' },
  { id: 'ranger', name: '레인저' },
]

/** 피부 견본 (밝게 만든 피부 텍스처에 곱한다) */
export const SKIN_COLORS = ['#ffe3cc', '#f7cfae', '#eab892', '#d9a274', '#c08457', '#9a6440', '#70462c', '#4a2f1f']
export const HAIR_COLORS = ['#1c1c1c', '#4a3020', '#7a4b2a', '#b07a45', '#e2c27c', '#bdbdbd', '#f4f4f4', '#b23a3a', '#d77fae', '#3d6fd6']

export const HEIGHT_RANGE: [number, number] = [0.75, 1.3]

export const BODY_PARTS: BodyPart[] = ['head', 'shoulders', 'chest', 'belly', 'armThickness', 'armLength', 'legThickness', 'legLength']

export const BODY_RANGES: Record<BodyPart, [number, number]> = {
  head: [0.7, 1.6],
  shoulders: [0.7, 1.5],
  chest: [0.7, 1.6],
  belly: [0.7, 1.8],
  armThickness: [0.6, 1.8],
  armLength: [0.8, 1.3],
  legThickness: [0.6, 1.8],
  legLength: [0.8, 1.3],
}

export const BODY_PART_LABEL: Record<BodyPart, string> = {
  head: '머리 크기',
  shoulders: '어깨 너비',
  chest: '가슴·등 두께',
  belly: '배',
  armThickness: '팔 굵기',
  armLength: '팔 길이',
  legThickness: '다리 굵기',
  legLength: '다리 길이',
}

export const DEFAULT_BODY: Record<BodyPart, number> = {
  head: 1, shoulders: 1, chest: 1, belly: 1, armThickness: 1, armLength: 1, legThickness: 1, legLength: 1,
}

/** 기본 꾸밈. 첫 번째가 처음 시작할 때의 모습 */
export const LOOK_PRESETS: { id: string; name: string; look: CharacterLook }[] = [
  {
    id: 'grandpa',
    name: '어부 할아버지',
    look: { gender: 'male', skinColor: '#eab892', hair: 'simpleParted', hairColor: '#bdbdbd', beard: true, top: 'peasant', bottom: 'peasant', shoes: 'peasant', hood: false, outfitColor: 'base', height: 1, body: DEFAULT_BODY },
  },
  {
    id: 'lady',
    name: '어부 아가씨',
    look: { gender: 'female', skinColor: '#f7cfae', hair: 'buns', hairColor: '#7a4b2a', beard: false, top: 'peasant', bottom: 'peasant', shoes: 'peasant', hood: false, outfitColor: 'alt', height: 1, body: DEFAULT_BODY },
  },
  {
    id: 'rangerMale',
    name: '레인저 (남)',
    look: { gender: 'male', skinColor: '#c08457', hair: 'buzzed', hairColor: '#1c1c1c', beard: false, top: 'ranger', bottom: 'ranger', shoes: 'ranger', hood: true, outfitColor: 'base', height: 1.05, body: DEFAULT_BODY },
  },
  {
    id: 'rangerFemale',
    name: '레인저 (여)',
    look: { gender: 'female', skinColor: '#d9a274', hair: 'long', hairColor: '#e2c27c', beard: false, top: 'ranger', bottom: 'ranger', shoes: 'ranger', hood: false, outfitColor: 'alt', height: 1, body: DEFAULT_BODY },
  },
]

export const DEFAULT_LOOK: CharacterLook = LOOK_PRESETS[0].look

/** 생김새 → glb 노드 이름 (tools/build-characters 가 붙인 이름) */
export const PART_NODES = {
  hair: {
    simpleParted: 'hair_simpleParted',
    buzzed: 'hair_buzzed',
    long: 'hair_long',
    buns: 'hair_buns',
    buzzedFemale: 'hair_buzzedFemale',
  } satisfies Record<Exclude<HairId, 'none'>, string>,
  beard: 'beard',
  top: {
    peasant: ['peasant_arms', 'peasant_body'],
    ranger: ['ranger_arms', 'ranger_bracer', 'ranger_body', 'ranger_belt1', 'ranger_belt2', 'ranger_pauldron'],
  } satisfies Record<OutfitId, string[]>,
  bottom: { peasant: ['peasant_legs'], ranger: ['ranger_legs'] } satisfies Record<OutfitId, string[]>,
  shoes: { peasant: ['peasant_feet'], ranger: ['ranger_feet'] } satisfies Record<OutfitId, string[]>,
  hood: 'ranger_hood',
}

/** 늘 보이는 부위 */
export const ALWAYS_VISIBLE_NODES = ['head', 'eyes', 'eyebrows']
```

- [ ] **Step 3: 실패하는 테스트**

`src/game/logic/characterLook.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { BODY_PARTS, BODY_RANGES, DEFAULT_LOOK, HEIGHT_RANGE, LOOK_PRESETS } from '../data/characterParts'
import { normalizeLook, randomLook, switchGender } from './characterLook'
import { fixedRng } from './rng'

describe('normalizeLook', () => {
  it('객체가 아니면 null', () => {
    expect(normalizeLook(undefined)).toBeNull()
    expect(normalizeLook('x')).toBeNull()
    expect(normalizeLook([])).toBeNull()
  })

  it('기본 꾸밈은 모두 그대로 통과한다', () => {
    for (const preset of LOOK_PRESETS) expect(normalizeLook(preset.look)).toEqual(preset.look)
  })

  it('틀린 필드는 기본값으로, 범위 밖 숫자는 범위 안으로 고친다', () => {
    const fixed = normalizeLook({
      gender: 'female',
      skinColor: 'red',
      hair: 'mohawk',
      hairColor: '#ABCDEF',
      beard: true,
      top: 'wizard',
      bottom: 'ranger',
      shoes: 7,
      hood: 'yes',
      outfitColor: 'neon',
      height: 9,
      body: { head: 0.1, belly: 'x', legLength: 1.2 },
    })
    expect(fixed).toEqual({
      gender: 'female',
      skinColor: DEFAULT_LOOK.skinColor,
      hair: DEFAULT_LOOK.hair,
      hairColor: '#abcdef',
      beard: false, // 여자는 수염 없음
      top: DEFAULT_LOOK.top,
      bottom: 'ranger',
      shoes: DEFAULT_LOOK.shoes,
      hood: false,
      outfitColor: 'base',
      height: HEIGHT_RANGE[1],
      body: { ...DEFAULT_LOOK.body, head: BODY_RANGES.head[0], legLength: 1.2 },
    })
  })

  it('성별이 틀리면 기본 꾸밈의 성별을 쓴다', () => {
    expect(normalizeLook({ gender: 'robot' })?.gender).toBe(DEFAULT_LOOK.gender)
  })
})

describe('switchGender', () => {
  it('여자로 바꾸면 수염이 사라지고 나머지 선택은 유지된다', () => {
    const female = switchGender({ ...DEFAULT_LOOK, beard: true, hair: 'buzzed' }, 'female')
    expect(female.gender).toBe('female')
    expect(female.beard).toBe(false)
    expect(female.hair).toBe('buzzed')
    expect(switchGender(female, 'male').beard).toBe(false)
  })
})

describe('randomLook', () => {
  it('어떤 난수가 와도 유효한 모습을 만든다', () => {
    for (const r of [0, 0.25, 0.5, 0.75, 0.999]) {
      const look = randomLook(fixedRng(r))
      expect(normalizeLook(look)).toEqual(look)
    }
  })

  it('키와 몸 배율은 범위 안이다', () => {
    let seed = 1
    const rng = () => ((seed = (seed * 16807) % 2147483647) / 2147483647)
    for (let i = 0; i < 50; i++) {
      const look = randomLook(rng)
      expect(look.height).toBeGreaterThanOrEqual(HEIGHT_RANGE[0])
      expect(look.height).toBeLessThanOrEqual(HEIGHT_RANGE[1])
      for (const part of BODY_PARTS) {
        expect(look.body[part]).toBeGreaterThanOrEqual(BODY_RANGES[part][0])
        expect(look.body[part]).toBeLessThanOrEqual(BODY_RANGES[part][1])
      }
    }
  })
})
```

Run: `npx vitest run src/game/logic/characterLook.test.ts`
Expected: FAIL (`./characterLook` 모듈 없음)

- [ ] **Step 4: 구현**

`src/game/logic/characterLook.ts`:

```ts
import { BODY_PARTS, BODY_RANGES, DEFAULT_LOOK, HAIR_COLORS, HAIRS, HEIGHT_RANGE, OUTFITS, SKIN_COLORS } from '../data/characterParts'
import type { BodyPart, CharacterLook, Gender, HairId, OutfitId } from '../data/types'
import { lerp, type Rng } from './rng'

const COLOR = /^#[0-9a-f]{6}$/i
const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)
const clamp = (v: number, [min, max]: [number, number]) => Math.min(max, Math.max(min, v))

function readColor(v: unknown, fallback: string): string {
  return typeof v === 'string' && COLOR.test(v) ? v.toLowerCase() : fallback
}

function readNumber(v: unknown, range: [number, number], fallback: number): number {
  return typeof v === 'number' && Number.isFinite(v) ? clamp(v, range) : fallback
}

function readOneOf<T extends string>(v: unknown, allowed: readonly T[], fallback: T): T {
  return allowed.includes(v as T) ? (v as T) : fallback
}

const HAIR_IDS = HAIRS.map((h) => h.id)
const OUTFIT_IDS = OUTFITS.map((o) => o.id)

/** 저장본 등에서 읽은 값을 유효한 모습으로 고친다. 객체가 아니면 null(아직 안 만듦) */
export function normalizeLook(v: unknown): CharacterLook | null {
  if (!isRecord(v)) return null
  const d = DEFAULT_LOOK
  const gender = readOneOf<Gender>(v.gender, ['male', 'female'], d.gender)
  const savedBody = isRecord(v.body) ? v.body : {}
  const body = {} as Record<BodyPart, number>
  for (const part of BODY_PARTS) body[part] = readNumber(savedBody[part], BODY_RANGES[part], d.body[part])
  return {
    gender,
    skinColor: readColor(v.skinColor, d.skinColor),
    hair: readOneOf<HairId>(v.hair, HAIR_IDS, d.hair),
    hairColor: readColor(v.hairColor, d.hairColor),
    beard: gender === 'male' && v.beard === true,
    top: readOneOf<OutfitId>(v.top, OUTFIT_IDS, d.top),
    bottom: readOneOf<OutfitId>(v.bottom, OUTFIT_IDS, d.bottom),
    shoes: readOneOf<OutfitId>(v.shoes, OUTFIT_IDS, d.shoes),
    hood: v.hood === true,
    outfitColor: readOneOf(v.outfitColor, ['base', 'alt'] as const, 'base'),
    height: readNumber(v.height, HEIGHT_RANGE, d.height),
    body,
  }
}

/** 성별을 바꾼다. 머리·옷은 남녀 공통이라 유지하고, 수염만 정리한다 */
export function switchGender(look: CharacterLook, gender: Gender): CharacterLook {
  return { ...look, gender, beard: gender === 'male' && look.beard }
}

const pick = <T>(list: readonly T[], r: number): T => list[Math.min(list.length - 1, Math.floor(r * list.length))]
/** 두 난수의 평균: 가운데 값이 잘 나오고 극단값은 덜 나온다 */
const centered = (rng: Rng, range: [number, number]) => lerp(range[0], range[1], (rng() + rng()) / 2)

export function randomLook(rng: Rng): CharacterLook {
  const gender: Gender = rng() < 0.5 ? 'male' : 'female'
  const body = {} as Record<BodyPart, number>
  for (const part of BODY_PARTS) body[part] = centered(rng, BODY_RANGES[part])
  return {
    gender,
    skinColor: pick(SKIN_COLORS, rng()),
    hair: pick(HAIR_IDS, rng()),
    hairColor: pick(HAIR_COLORS, rng()),
    beard: gender === 'male' && rng() < 0.4,
    top: pick(OUTFIT_IDS, rng()),
    bottom: pick(OUTFIT_IDS, rng()),
    shoes: pick(OUTFIT_IDS, rng()),
    hood: rng() < 0.25,
    outfitColor: rng() < 0.5 ? 'base' : 'alt',
    height: centered(rng, HEIGHT_RANGE),
    body,
  }
}
```

Run: `npx vitest run src/game/logic/characterLook.test.ts`
Expected: PASS

- [ ] **Step 5: 커밋**

```bash
git add src/game/data/types.ts src/game/data/characterParts.ts src/game/logic/characterLook.ts src/game/logic/characterLook.test.ts
git commit -m "feat: 캐릭터 꾸미기 데이터와 모습 규칙 추가" -m "성별·피부·머리·수염·옷·후드·옷 색·키·몸 부위 배율을 담는 CharacterLook과 부위 목록·견본 색·범위·기본 꾸밈을 두고, 저장본 값을 고치는 normalizeLook, 성별 바꾸기, 랜덤 꾸미기를 순수 함수로 만들었다."
```

---

### Task 3: 줌·앉기 자세·옷장 상호작용 규칙

**Files:**
- Modify: `src/game/data/balance.ts`, `src/game/data/characters.ts`, `src/game/data/zones.ts`
- Create: `src/game/logic/cameraZoom.ts`, `src/game/logic/cameraZoom.test.ts`
- Modify: `src/game/logic/characterPose.ts`, `src/game/logic/characterPose.test.ts`, `src/game/logic/interaction.ts`, `src/game/logic/interaction.test.ts`

**Interfaces:**
- Produces:
  - `CAMERA_ZOOM = { min: 4, max: 18, initial: 10, heightRatio: 0.7, sensitivity: 0.0015 }`
  - `nextZoom(distance: number, wheelDeltaY: number): number`, `canZoom(mode: Mode): boolean`
  - `CharacterClip`에 `'sitEnter' | 'sitIdle' | 'sitExit'` 추가, `CHARACTER_CLIPS: Record<CharacterClip, string>`, `CHARACTER_FILES: Record<Gender, string>`, `OUTFIT_ALT_TEXTURES: Record<OutfitId, string>`
  - `CharacterPose`에 `'sit' | 'standUp'` 추가. `characterPose(fishing, speed, resting = false, standingUp = false)`, `poseClips(pose, rodAngle, sitEntering = false)`
  - `Mode`에 `'wardrobe'`, `Interactable`에 `{ kind: 'wardrobe' }`. `resolveKeyAction(code, mode, nearby, panelLocked = false)`
  - `FACILITY.wardrobe: [7, 22]`, `BENCH_SEAT: { position: [number, number]; facing: number }`

- [ ] **Step 1: 데이터 추가**

`src/game/data/balance.ts` 끝에:

```ts
/** 마우스 휠 줌. 카메라 높이는 거리 × heightRatio */
export const CAMERA_ZOOM = {
  min: 4,
  max: 18,
  initial: 10,
  heightRatio: 0.7,
  /** 휠 deltaY 1당 거리 배율 변화 (지수) */
  sensitivity: 0.0015,
}
```

`src/game/data/characters.ts` 전체를 교체:

```ts
import type { Gender, OutfitId } from './types'

/** 캐릭터가 쓰는 동작 종류 */
export type CharacterClip =
  | 'idle'
  | 'walk'
  | 'run'
  | 'aimUp'
  | 'aimNeutral'
  | 'aimDown'
  | 'dragged'
  | 'celebrate'
  | 'fallBack'
  | 'dejected'
  | 'sitEnter'
  | 'sitIdle'
  | 'sitExit'

/** 동작 → glb 안의 애니메이션 이름 (Quaternius Universal Animation Library). 남녀 파일이 같다 */
export const CHARACTER_CLIPS: Record<CharacterClip, string> = {
  idle: 'Idle_Loop',
  walk: 'Walk_Loop',
  run: 'Jog_Fwd_Loop',
  aimUp: 'Pistol_Aim_Up',
  aimNeutral: 'Pistol_Aim_Neutral',
  aimDown: 'Pistol_Aim_Down',
  dragged: 'Push_Loop',
  celebrate: 'Dance_Loop',
  fallBack: 'Death01',
  dejected: 'Crouch_Idle_Loop',
  sitEnter: 'Sitting_Enter',
  sitIdle: 'Sitting_Idle_Loop',
  sitExit: 'Sitting_Exit',
}

/** public/models 아래 파일 */
export const CHARACTER_FILES: Record<Gender, string> = {
  male: 'characters/male.glb',
  female: 'characters/female.glb',
}

/** 옷 색 변형 텍스처 (public/models 아래) */
export const OUTFIT_ALT_TEXTURES: Record<OutfitId, string> = {
  peasant: 'characters/textures/peasant_alt.jpg',
  ranger: 'characters/textures/ranger_alt.jpg',
}
```

`src/game/data/zones.ts`: `FACILITY`에 `wardrobe: [7, 22] as [number, number],`를 더하고 끝에:

```ts
/** 벤치에 앉을 때 플레이어가 놓이는 자리와 바라보는 각도(0 = +z, 바다 쪽) */
export const BENCH_SEAT = { position: [FACILITY.bench[0], FACILITY.bench[1]] as [number, number], facing: 0 }
```

- [ ] **Step 2: 줌 테스트와 구현**

`src/game/logic/cameraZoom.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { CAMERA_ZOOM } from '../data/balance'
import { canZoom, nextZoom } from './cameraZoom'

describe('nextZoom', () => {
  it('휠을 아래로 굴리면(양수) 멀어지고, 위로 굴리면 가까워진다', () => {
    expect(nextZoom(10, 100)).toBeGreaterThan(10)
    expect(nextZoom(10, -100)).toBeLessThan(10)
  })

  it('범위를 넘지 않는다', () => {
    expect(nextZoom(10, 100000)).toBe(CAMERA_ZOOM.max)
    expect(nextZoom(10, -100000)).toBe(CAMERA_ZOOM.min)
  })

  it('이상한 입력이면 그대로 둔다', () => {
    expect(nextZoom(10, Number.NaN)).toBe(10)
  })
})

describe('canZoom', () => {
  it('탐험·낚시·휴식 중에만 줌한다 (패널이 열려 있으면 휠은 패널 스크롤)', () => {
    expect(canZoom('explore')).toBe(true)
    expect(canZoom('fishing')).toBe(true)
    expect(canZoom('rest')).toBe(true)
    for (const mode of ['menu', 'dex', 'sell', 'shop', 'market', 'aquarium', 'wardrobe'] as const) expect(canZoom(mode)).toBe(false)
  })
})
```

`src/game/logic/cameraZoom.ts`:

```ts
import { CAMERA_ZOOM } from '../data/balance'
import type { Mode } from './interaction'

/** 휠 한 번 → 새 카메라 거리. 곱셈으로 바꿔서 가까울수록 섬세하게 움직인다 */
export function nextZoom(distance: number, wheelDeltaY: number): number {
  if (!Number.isFinite(wheelDeltaY)) return distance
  const next = distance * Math.exp(wheelDeltaY * CAMERA_ZOOM.sensitivity)
  return Math.min(CAMERA_ZOOM.max, Math.max(CAMERA_ZOOM.min, next))
}

const ZOOM_MODES: Mode[] = ['explore', 'fishing', 'rest']

export function canZoom(mode: Mode): boolean {
  return ZOOM_MODES.includes(mode)
}
```

Run: `npx vitest run src/game/logic/cameraZoom.test.ts`
Expected: Step 3의 `wardrobe` 모드가 아직 없어서 타입 에러 없이 실행되면 PASS, 실패하면 Step 4 이후 다시 실행

- [ ] **Step 3: 앉기 자세**

`src/game/logic/characterPose.test.ts` 끝에 추가:

```ts
describe('앉기', () => {
  it('벤치에서 쉬는 중이면 앉는다', () => {
    expect(characterPose(null, 0, true)).toBe('sit')
  })

  it('일어나는 중이고 움직이지 않으면 일어서는 자세, 움직이면 바로 걷는다', () => {
    expect(characterPose(null, 0, false, true)).toBe('standUp')
    expect(characterPose(null, 1, false, true)).toBe('walk')
  })

  it('앉는 중엔 앉기 시작 클립, 다 앉으면 앉아 있기 클립, 일어설 땐 일어나기 클립', () => {
    expect(poseClips('sit', 0, true)).toEqual([['sitEnter', 1]])
    expect(poseClips('sit', 0, false)).toEqual([['sitIdle', 1]])
    expect(poseClips('standUp', 0)).toEqual([['sitExit', 1]])
  })
})
```

(파일 상단 import에 `characterPose`, `poseClips`가 이미 있는지 확인하고 없으면 추가한다.)

`src/game/logic/characterPose.ts` 수정:

```ts
export type CharacterPose = 'idle' | 'walk' | 'run' | 'aim' | 'tug' | 'dragged' | 'celebrate' | 'fallBack' | 'dejected' | 'sit' | 'standUp'

export const CHARACTER_POSES: CharacterPose[] = ['idle', 'walk', 'run', 'aim', 'tug', 'dragged', 'celebrate', 'fallBack', 'dejected', 'sit', 'standUp']
```

`characterPose`의 시그니처와 앞부분:

```ts
/** resting: 벤치에 앉아 쉬는 중. standingUp: 막 일어나는 중(일어나기 클립 재생 시간 동안) */
export function characterPose(fishing: FishingState | null, speed: number, resting = false, standingUp = false): CharacterPose {
  if (resting) return 'sit'
  if (!fishing) {
    if (speed < WALK_MIN_SPEED) return standingUp ? 'standUp' : 'idle'
    return speed < RUN_MIN_SPEED ? 'walk' : 'run'
  }
```

`poseClips` 수정:

```ts
/** 자세 하나를 이루는 클립과 비율. sitEntering: 앉기 시작 클립이 아직 끝나지 않았다 */
export function poseClips(pose: CharacterPose, rodAngle: number, sitEntering = false): [CharacterClip, number][] {
  switch (pose) {
    case 'aim':
    case 'tug': {
      const w = aimWeights(rodAngle)
      return [
        ['aimUp', w.up],
        ['aimNeutral', w.neutral],
        ['aimDown', w.down],
      ]
    }
    case 'sit':
      return [[sitEntering ? 'sitEnter' : 'sitIdle', 1]]
    case 'standUp':
      return [['sitExit', 1]]
    default:
      return [[pose, 1]]
  }
}
```

Run: `npx vitest run src/game/logic/characterPose.test.ts`
Expected: PASS

- [ ] **Step 4: 옷장 상호작용과 첫 생성 잠금**

`src/game/logic/interaction.test.ts`의 `describe('resolveKeyAction', ...)` 안 끝에 추가:

```ts
  it('옷장에서 E를 누르면 꾸미기 화면을 연다', () => {
    expect(resolveKeyAction('KeyE', 'explore', { kind: 'wardrobe' })).toEqual({ type: 'openMode', mode: 'wardrobe' })
  })

  it('처음 캐릭터를 만드는 중(잠금)엔 ESC로 닫히지 않는다', () => {
    expect(resolveKeyAction('Escape', 'wardrobe', null, true)).toEqual({ type: 'none' })
    expect(resolveKeyAction('Escape', 'wardrobe', null, false)).toEqual({ type: 'closePanel' })
  })
```

`src/game/logic/interaction.ts`:
- `Mode`에 `| 'wardrobe'` 추가
- `Interactable`에 `| { kind: 'wardrobe' }` 추가
- 함수 시그니처와 Escape 분기:

```ts
/** panelLocked: 지금 패널을 닫으면 안 된다 (처음 캐릭터를 만드는 중) */
export function resolveKeyAction(code: string, mode: Mode, nearby: Interactable | null, panelLocked = false): KeyAction {
  if (code === 'Escape') {
    if (panelLocked) return { type: 'none' }
    if (mode === 'explore') return { type: 'openMode', mode: 'menu' }
```

- `switch (nearby.kind)`에 추가:

```ts
      case 'wardrobe':
        return { type: 'openMode', mode: 'wardrobe' }
```

`src/game/ui/Hud.tsx`의 `PROMPT`에 `wardrobe: 'E  옷장 (꾸미기)',`를 추가한다(타입 에러 방지).

Run: `npx vitest run && npx tsc -b`
Expected: 전부 PASS, 타입 에러 없음

- [ ] **Step 5: 커밋**

```bash
git add src/game/data src/game/logic src/game/ui/Hud.tsx
git commit -m "feat: 줌·앉기 자세·옷장 상호작용 규칙 추가" -m "휠 줌 거리 계산과 줌 가능한 모드, 벤치 앉기·일어나기 자세와 클립, 옷장 상호작용과 첫 캐릭터 생성 중 ESC 잠금을 순수 함수로 만들었다. 캐릭터 파일은 성별별로, 클립 표는 남녀 공통으로 바꿨다."
```

---

### Task 4: 저장 상태에 모습 추가

**Files:**
- Modify: `src/game/stores/progressStore.ts`, `src/game/stores/progressStore.test.ts`

**Interfaces:**
- Consumes: `normalizeLook` (Task 2), `CharacterLook`
- Produces: 필드 `look: CharacterLook | null`, 액션 `setLook(look: CharacterLook): void`

- [ ] **Step 1: 실패하는 테스트**

`progressStore.test.ts` import에 `import { DEFAULT_LOOK, LOOK_PRESETS } from '../data/characterParts'` 추가, `describe` 안 끝에:

```ts
  it('처음엔 모습이 없고, 정하면 저장된다', () => {
    expect(store().look).toBeNull()
    store().setLook(LOOK_PRESETS[1].look)
    expect(store().look).toEqual(LOOK_PRESETS[1].look)
  })

  it('정할 때도 범위 밖 값은 고쳐서 저장한다', () => {
    store().setLook({ ...DEFAULT_LOOK, height: 99 })
    expect(store().look?.height).toBe(1.3)
  })

  it('모습이 없는 예전 저장본은 null, 깨진 모습은 고쳐서 불러온다', async () => {
    localStorage.setItem(SAVE_KEY, JSON.stringify({ state: { coins: 3 }, version: 1 }))
    await useProgressStore.persist.rehydrate()
    expect(store().look).toBeNull()

    localStorage.setItem(SAVE_KEY, JSON.stringify({ state: { look: { ...DEFAULT_LOOK, gender: 'female', beard: true, hair: 'x' } }, version: 1 }))
    await useProgressStore.persist.rehydrate()
    expect(store().look).toMatchObject({ gender: 'female', beard: false, hair: DEFAULT_LOOK.hair })
  })
```

Run: `npx vitest run src/game/stores/progressStore.test.ts`
Expected: FAIL (`setLook` 없음)

- [ ] **Step 2: 구현**

`progressStore.ts`:
- import: `import type { CharacterLook } from '../data/types'`(기존 type import에 합친다), `import { normalizeLook } from '../logic/characterLook'`
- `ProgressData`에 `/** 플레이어 생김새. null 이면 아직 만들지 않았다 */ look: CharacterLook | null`
- `ProgressActions`에 `setLook: (look: CharacterLook) => void`
- `INITIAL_PROGRESS`에 `look: null,`
- 액션: `setLook: (look) => set({ look: normalizeLook(look) }),`
- `merge` 반환 객체에 `look: normalizeLook(saved.look),`

Run: `npx vitest run && npx tsc -b`
Expected: 전부 PASS

- [ ] **Step 3: 커밋**

```bash
git add src/game/stores/progressStore.ts src/game/stores/progressStore.test.ts
git commit -m "feat: 플레이어 모습을 저장 상태에 추가" -m "progressStore에 look 필드와 setLook을 더했다. 모습이 없는 예전 저장본은 null로 불러와 꾸미기 화면을 띄우고, 깨진 값은 normalizeLook으로 고친다."
```

---

### Task 5: 모습 적용과 플레이어 모델

**Files:**
- Create: `src/game/scene/characterAppearance.ts`
- Modify: `src/game/scene/PlayerModel.tsx`, `src/game/scene/Player.tsx`
- Delete: `public/models/fisherman.glb`
- Modify: `public/models/CREDITS.md` (fisherman 항목을 "characters/ 로 대체됨"으로 정리)

**Interfaces:**
- Consumes: `PART_NODES`, `ALWAYS_VISIBLE_NODES` (Task 2), `CHARACTER_CLIPS`, `CHARACTER_FILES`, `OUTFIT_ALT_TEXTURES` (Task 3), `characterPose`/`poseClips` 새 시그니처 (Task 3), progressStore `look` (Task 4), `DEFAULT_LOOK`
- Produces:
  - `prepareCharacter(object: Object3D): CharacterRig`, `applyLook(rig: CharacterRig, look: CharacterLook, altMaps: Record<OutfitId, Texture>): void`
  - `CharacterRig`에 `lift: number` (다리 길이 보정으로 몸을 올리는 높이, 키 배율 포함)
  - `PlayerModel` props `{ look: CharacterLook }`, 핸들 `update(delta, now, fishing, speed, rodAngle, resting)`

- [ ] **Step 1: 모습 적용 함수**

`src/game/scene/characterAppearance.ts`:

```ts
import { Matrix4, Vector3, type Bone, type Material, type MeshStandardMaterial, type Object3D, type SkinnedMesh, type Texture } from 'three'
import { ALWAYS_VISIBLE_NODES, PART_NODES } from '../data/characterParts'
import type { CharacterLook, OutfitId } from '../data/types'

type Axis = 0 | 1 | 2
/** 뼈 하나에 곱할 배율. 축은 그 뼈의 로컬 축 */
type ScaleJob = { bone: Bone; scale: Vector3 }

export type CharacterRig = {
  root: Object3D
  parts: Map<string, Object3D>
  skin: MeshStandardMaterial[]
  hair: MeshStandardMaterial[]
  outfits: Record<OutfitId, { material: MeshStandardMaterial; base: Texture | null }[]>
  bones: Map<string, Bone>
  /** 기본 자세에서 잰 값들 (배율 계산용) */
  rest: {
    /** 허벅지 시작 ~ 발목 거리 */
    legLength: number
    /** 쇄골의 원래 위치 (어깨 너비는 이걸 옆으로 벌린다) */
    clavicle: Map<string, Vector3>
    /** 뼈마다: 길이 방향 축, 모델 옆(x)·앞(z) 방향과 가장 나란한 로컬 축 */
    axes: Map<string, { length: Axis; side: Axis; depth: Axis }>
  }
  /** 다리 길이·키에 맞춰 몸을 올리는 높이. applyLook 이 채운다 */
  lift: number
}

const worldAxis = new Vector3()
const tmp = new Vector3()
const m = new Matrix4()

/** bone 의 로컬 축 중 world 방향 dir 과 가장 나란한 축 */
function axisAlong(bone: Object3D, dir: Vector3): Axis {
  m.extractRotation(bone.matrixWorld)
  let best: Axis = 0
  let bestDot = -1
  for (const i of [0, 1, 2] as Axis[]) {
    worldAxis.setFromMatrixColumn(m, i).normalize()
    const d = Math.abs(worldAxis.dot(dir))
    if (d > bestDot) {
      bestDot = d
      best = i
    }
  }
  return best
}

/** 자식 뼈 쪽을 가리키는 로컬 축 (= 뼈 길이 방향) */
function lengthAxis(bone: Object3D): Axis {
  const child = bone.children.find((c) => (c as Bone).isBone)
  if (!child) return 1
  const p = child.position
  const abs = [Math.abs(p.x), Math.abs(p.y), Math.abs(p.z)]
  return abs.indexOf(Math.max(...abs)) as Axis
}

/**
 * 복제한 캐릭터를 꾸밀 준비를 한다. 재질은 인스턴스마다 복제해서
 * 미리보기와 게임 속 캐릭터가 서로의 색을 바꾸지 않게 한다. 반드시 애니메이션 전 기본 자세에서 부른다
 */
export function prepareCharacter(root: Object3D): CharacterRig {
  const parts = new Map<string, Object3D>()
  const bones = new Map<string, Bone>()
  const skin: MeshStandardMaterial[] = []
  const hair: MeshStandardMaterial[] = []
  const outfits: CharacterRig['outfits'] = { peasant: [], ranger: [] }
  const cloned = new Map<Material, MeshStandardMaterial>()

  root.updateWorldMatrix(true, true)
  root.traverse((o) => {
    if ((o as Bone).isBone) bones.set(o.name, o as Bone)
    if (o.name) parts.set(o.name, o)
    const mesh = o as SkinnedMesh
    if (!mesh.isMesh) return
    const original = mesh.material as MeshStandardMaterial
    let material = cloned.get(original)
    if (!material) {
      material = original.clone()
      cloned.set(original, material)
      if (material.name.startsWith('skin')) skin.push(material)
      else if (material.name === 'hair') hair.push(material)
      else if (material.name === 'peasant' || material.name === 'ranger') outfits[material.name].push({ material, base: material.map })
    }
    mesh.material = material
  })

  const side = new Vector3(1, 0, 0)
  const depth = new Vector3(0, 0, 1)
  const axes: CharacterRig['rest']['axes'] = new Map()
  for (const [name, bone] of bones) axes.set(name, { length: lengthAxis(bone), side: axisAlong(bone, side), depth: axisAlong(bone, depth) })

  const thigh = bones.get('thigh_l')
  const foot = bones.get('foot_l')
  const legLength = thigh && foot ? thigh.getWorldPosition(tmp).y - foot.getWorldPosition(new Vector3()).y : 0.8
  const clavicle = new Map<string, Vector3>()
  for (const name of ['clavicle_l', 'clavicle_r']) {
    const b = bones.get(name)
    if (b) clavicle.set(name, b.position.clone())
  }
  return { root, parts, skin, hair, outfits, bones, rest: { legLength, clavicle, axes }, lift: 0 }
}

function setVisible(rig: CharacterRig, names: string[], visible: boolean) {
  for (const name of names) {
    const node = rig.parts.get(name)
    if (node) node.visible = visible
  }
}

const allPartNodes = [
  ...Object.values(PART_NODES.hair),
  PART_NODES.beard,
  ...Object.values(PART_NODES.top).flat(),
  ...Object.values(PART_NODES.bottom).flat(),
  ...Object.values(PART_NODES.shoes).flat(),
  PART_NODES.hood,
]

/** 축 하나 또는 여럿에 배율 s 를 곱한 벡터 */
function axisScale(axes: Axis[], s: number, into = new Vector3(1, 1, 1)): Vector3 {
  for (const a of axes) into.setComponent(a, into.getComponent(a) * s)
  return into
}

/** 모습 적용: 부위 보이기, 색, 옷 텍스처, 뼈 배율 */
export function applyLook(rig: CharacterRig, look: CharacterLook, altMaps: Record<OutfitId, Texture>) {
  // 1) 부위
  setVisible(rig, allPartNodes, false)
  setVisible(rig, ALWAYS_VISIBLE_NODES, true)
  if (look.hair !== 'none' && !look.hood) setVisible(rig, [PART_NODES.hair[look.hair]], true)
  if (look.gender === 'male' && look.beard) setVisible(rig, [PART_NODES.beard], true)
  setVisible(rig, PART_NODES.top[look.top], true)
  setVisible(rig, PART_NODES.bottom[look.bottom], true)
  setVisible(rig, PART_NODES.shoes[look.shoes], true)
  if (look.hood) setVisible(rig, [PART_NODES.hood], true)

  // 2) 색: 밝게 만든 피부·머리 텍스처에 색을 곱한다
  for (const mat of rig.skin) mat.color.set(look.skinColor)
  for (const mat of rig.hair) mat.color.set(look.hairColor)

  // 3) 옷 색: 텍스처 바꾸기
  for (const outfit of ['peasant', 'ranger'] as OutfitId[]) {
    for (const { material, base } of rig.outfits[outfit]) {
      const map = look.outfitColor === 'alt' ? altMaps[outfit] : base
      if (material.map !== map) {
        material.map = map
        material.needsUpdate = true
      }
    }
  }

  // 4) 뼈 배율. 애니메이션은 크기 트랙이 없어서(빌드에서 지움) 한 번 정해 두면 유지된다
  const { bones, rest } = rig
  const b = look.body
  const jobs = new Map<string, Vector3>()
  const scaleOf = (name: string) => {
    let v = jobs.get(name)
    if (!v) jobs.set(name, (v = new Vector3(1, 1, 1)))
    return v
  }
  const ax = (name: string) => rest.axes.get(name)
  /** 모델 옆·앞뒤 방향 축 (몸통 굵기). 길이 방향 축과 겹치면 뺀다 */
  const both = (name: string): Axis[] => {
    const a = ax(name)
    if (!a) return []
    return [...new Set([a.side, a.depth])].filter((x) => x !== a.length)
  }
  /** 굵기 축(길이 방향이 아닌 두 축) */
  const thickness = (name: string): Axis[] => {
    const a = ax(name)
    return a ? ([0, 1, 2] as Axis[]).filter((x) => x !== a.length) : []
  }
  const lengthOnly = (name: string): Axis[] => {
    const a = ax(name)
    return a ? [a.length] : []
  }

  // 키: 루트 균일 배율 (발이 원점이라 땅에 붙어 있다)
  axisScale([0, 1, 2], look.height, scaleOf('root'))
  // 머리
  axisScale([0, 1, 2], b.head, scaleOf('Head'))
  // 배: 골반 옆·앞뒤. 위(척추)와 아래(허벅지)는 되돌린다
  axisScale(both('pelvis'), b.belly, scaleOf('pelvis'))
  axisScale(both('spine_01'), 1 / b.belly, scaleOf('spine_01'))
  // 가슴·등: 척추 위쪽. 목·쇄골에서 되돌린다
  axisScale(both('spine_03'), b.chest, scaleOf('spine_03'))
  for (const child of ['neck_01', 'clavicle_l', 'clavicle_r']) axisScale(both(child), 1 / b.chest, scaleOf(child))
  // 팔·다리: 위쪽 뼈에 길이·굵기를 주면 아래쪽이 이어받는다. 손·발에서 되돌린다
  for (const s of ['l', 'r']) {
    axisScale(lengthOnly(`upperarm_${s}`), b.armLength, scaleOf(`upperarm_${s}`))
    axisScale(thickness(`upperarm_${s}`), b.armThickness, scaleOf(`upperarm_${s}`))
    axisScale(lengthOnly(`hand_${s}`), 1 / b.armLength, scaleOf(`hand_${s}`))
    axisScale(thickness(`hand_${s}`), 1 / b.armThickness, scaleOf(`hand_${s}`))
    axisScale(lengthOnly(`thigh_${s}`), b.legLength, scaleOf(`thigh_${s}`))
    axisScale(thickness(`thigh_${s}`), b.legThickness, scaleOf(`thigh_${s}`))
    axisScale(both(`thigh_${s}`), 1 / b.belly, scaleOf(`thigh_${s}`))
    axisScale(lengthOnly(`foot_${s}`), 1 / b.legLength, scaleOf(`foot_${s}`))
    axisScale(thickness(`foot_${s}`), 1 / b.legThickness, scaleOf(`foot_${s}`))
  }
  for (const [name, bone] of bones) bone.scale.copy(jobs.get(name) ?? new Vector3(1, 1, 1))

  // 어깨 너비: 쇄골을 옆으로 벌린다 (배율이 아니라 위치라서 팔이 굵어지지 않는다)
  for (const [name, restPos] of rest.clavicle) {
    const bone = bones.get(name)
    const a = ax('spine_03')
    if (!bone || !a) continue
    bone.position.copy(restPos)
    bone.position.setComponent(a.side, restPos.getComponent(a.side) * b.shoulders)
  }

  // 다리가 길어진 만큼 몸을 올려 발이 땅에 닿게 한다
  rig.lift = (b.legLength - 1) * rest.legLength * look.height
}
```

주의(구현자 판단 영역): 위 축 계산은 "뼈 로컬 축 중 모델 옆·앞·길이 방향과 가장 나란한 축"이라는 가정이다. 뼈가 기울어 있으면 근사이므로, Step 4 캡처에서 팔·다리를 굵게 했을 때 납작해지거나 뒤틀리면 해당 뼈의 축 선택을 고치고 그 이유를 주석으로 남긴다. 쇄골 위치는 `clavicle`의 부모가 `spine_03`일 때만 맞다(뼈 이름 목록으로 확인).

- [ ] **Step 2: PlayerModel 고치기**

`src/game/scene/PlayerModel.tsx`:
- `PLAYER_CHARACTER` import를 지우고 `CHARACTER_CLIPS`, `CHARACTER_FILES`, `OUTFIT_ALT_TEXTURES`, `type CharacterClip`을 `../data/characters`에서, `type CharacterLook`, `type OutfitId`를 `../data/types`에서 가져온다.
- 파일 위쪽 preload:

```ts
const modelUrl = (file: string) => `${import.meta.env.BASE_URL}models/${file}`
// 성별을 바꾸면 다른 파일이 필요하므로 둘 다 미리 받아 둔다
for (const file of Object.values(CHARACTER_FILES)) useGLTF.preload(modelUrl(file))
const ALT_URLS = Object.values(OUTFIT_ALT_TEXTURES).map(modelUrl)
```

- `Model`이 `{ look }` prop을 받는다:

```tsx
const Model = forwardRef<PlayerModelHandle, { look: CharacterLook }>(function Model({ look }, ref) {
  const { scene, animations } = useGLTF(modelUrl(CHARACTER_FILES[look.gender]))
  const [peasantAlt, rangerAlt] = useTexture(ALT_URLS)
  const altMaps = useMemo(() => {
    for (const t of [peasantAlt, rangerAlt]) {
      t.flipY = false // glTF 텍스처와 같은 방향
      t.colorSpace = SRGBColorSpace
    }
    return { peasant: peasantAlt, ranger: rangerAlt } as Record<OutfitId, Texture>
  }, [peasantAlt, rangerAlt])
  const object = useMemo(() => cloneSkinned(scene), [scene])
  // 기본 자세에서 축·길이를 재야 하므로 믹서가 돌기 전에 준비한다
  const rig = useMemo(() => prepareCharacter(object), [object])
  useLayoutEffect(() => applyLook(rig, look, altMaps), [rig, look, altMaps])
```

  (`useTexture`는 `@react-three/drei`, `SRGBColorSpace`·`Texture` 타입은 `three`에서 import)
- 클립 맵을 만드는 effect에서 `PLAYER_CHARACTER.clips` 대신 `CHARACTER_CLIPS`를 쓰고, `sitEnter`·`sitExit`도 `fallBack`처럼 `LoopOnce` + `clampWhenFinished = true`로 만든다.
- `update`에 `resting: boolean` 인자를 더하고, 앉기·일어나기 시간을 잰다:

```ts
const anim = useRef({
  pose: 'idle' as CharacterPose,
  weights: /* 기존 */,
  lean: 0,
  /** 앉기 시작 / 일어나기 시작 시각 */
  sitAt: -1,
  standAt: -1,
})
```

```ts
update(delta, now, fishing, speed, rodAngle, resting) {
  const actions = actionsRef.current
  if (!actions) return
  const a = anim.current
  const exitDuration = actions.sitExit.getClip().duration
  const standingUp = a.standAt >= 0 && now - a.standAt < exitDuration
  const pose = characterPose(fishing, speed, resting, standingUp)
  if (pose !== a.pose) {
    if (pose === 'fallBack') actions.fallBack.reset().play()
    if (pose === 'sit') {
      actions.sitEnter.reset().play()
      a.sitAt = now
    }
    if (a.pose === 'sit') {
      // 일어나기
      actions.sitExit.reset().play()
      a.standAt = now
    }
    a.pose = pose
  }
  const sitEntering = pose === 'sit' && now - a.sitAt < actions.sitEnter.getClip().duration
```

  그리고 클립 비율 계산의 `poseClips(p, rodAngle)`를 `poseClips(p, rodAngle, sitEntering)`로 바꾼다. 일어선 자세(`standUp`)가 들어오기 직전 프레임에도 `sit`에서 `idle`로 바뀌는 경우가 있으므로, `pose !== a.pose` 분기에서 `a.pose === 'sit'`이면 항상 일어나기를 시작한다(위 코드).
- 높이: `object.position.y = rig.lift + (기존 깡충·벌러덩 값)`.
- 바깥 `PlayerModel`은 `{ look }` prop을 받아 `Model`에 넘긴다. `key={look.gender}`를 줘서 성별이 바뀌면 새로 만든다.

- [ ] **Step 3: Player가 모습을 넘기기**

`src/game/scene/Player.tsx`:
- `const look = useProgressStore((s) => s.look) ?? DEFAULT_LOOK` (import 추가)
- `<PlayerModel ref={model} look={look} />`
- `m.update(delta, clock.elapsedTime, fishing, speed, rod.current.rotation.x, mode === 'rest')`

이 단계에서는 벤치 자리 옮기기와 줌을 하지 않는다(Task 6).

- [ ] **Step 4: 확인**

Run: `npx tsc -b && npx vitest run && npm run lint && npm run build`
Expected: 통과

headless 확인(스크래치 폴더의 node CDP 스크립트, `npx vite --port 5190 --strictPort`, Chrome `--headless=new --use-angle=swiftshader --enable-unsafe-swiftshader`): `progressStore`를 불러온 모듈 URL로 import해서 `setLook`으로 아래 모습을 차례로 넣고 플레이어를 확대해 캡처한다.
1. 기본 꾸밈 4개
2. 피부 견본 양 끝, 머리색 3개
3. 키 0.75 / 1.3 × 다리 길이 0.8 / 1.3 (4장) — 발이 땅에 닿는지
4. 머리 1.6, 배 1.8, 팔 굵기 1.8, 다리 굵기 1.8, 어깨 1.5 — 뒤틀림이 없는지
5. 남녀 각각 낚시 반응(끌려가기·춤·벌러덩)에서 낚싯대가 손에 붙어 있는지

캡처를 보고 축 선택·되돌리기를 고친다. 범위 끝에서 옷이 심하게 깨지면 `BODY_RANGES`를 줄이고 이유를 커밋 본문에 적는다.

- [ ] **Step 5: 정리·커밋**

`public/models/fisherman.glb`를 지우고 CREDITS의 fisherman 항목을 "꾸미기용 캐릭터로 대체" 한 줄로 줄인다.

```bash
git add -A src/game/scene public/models
git commit -m "feat: 저장된 모습으로 플레이어 캐릭터 꾸미기" -m "성별별 모듈형 모델을 불러와 부위 보이기, 피부·머리색, 옷 색 텍스처, 키·몸 부위 뼈 배율을 적용한다. 재질은 인스턴스마다 복제하고, 다리가 길어지면 몸을 올려 발이 땅에 닿게 한다. 앉기·일어나기 클립을 자세에 연결했다. 이전 fisherman.glb는 남자 모델 + 할아버지 기본 꾸밈으로 대체해 지웠다."
```

---

### Task 6: 벤치에 앉기와 휠 줌

**Files:**
- Modify: `src/game/stores/sessionStore.ts`, `src/game/scene/Player.tsx`, `src/game/Game.tsx`
- Create: `src/game/input/useWheelZoom.ts`

**Interfaces:**
- Consumes: `nextZoom`, `canZoom`, `CAMERA_ZOOM`, `BENCH_SEAT` (Task 3)
- Produces: sessionStore `zoom: number`, `zoomBy(deltaY: number): void`

- [ ] **Step 1: 줌 상태**

`sessionStore.ts`: 필드 `/** 카메라 거리 (휠 줌). 저장하지 않는다 */ zoom: number`, 액션 `zoomBy: (deltaY: number) => void`. 초기값·`resetSession`에서 `zoom: CAMERA_ZOOM.initial`. 구현 `zoomBy: (deltaY) => set((s) => ({ zoom: nextZoom(s.zoom, deltaY) })),`

- [ ] **Step 2: 휠 훅**

`src/game/input/useWheelZoom.ts`:

```ts
import { useEffect, type RefObject } from 'react'
import { canZoom } from '../logic/cameraZoom'
import { useSessionStore } from '../stores/sessionStore'

/** 캔버스 위 마우스 휠 → 카메라 줌. 페이지가 같이 스크롤되지 않게 기본 동작을 막는다 (passive: false 필요) */
export function useWheelZoom(target: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const el = target.current
    if (!el) return
    const onWheel = (e: WheelEvent) => {
      const session = useSessionStore.getState()
      if (!canZoom(session.mode)) return
      e.preventDefault()
      session.zoomBy(e.deltaY)
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [target])
}
```

`Game.tsx`: 캔버스를 감싼 `div`에 `ref={canvasArea}`(`useRef<HTMLDivElement>(null)`)를 주고 `useWheelZoom(canvasArea)`를 부른다. 패널은 이 div 바깥에 있어서 패널 위 휠은 원래대로 스크롤된다.

- [ ] **Step 3: Player — 줌 거리와 벤치 자리**

`Player.tsx`:
- `CAMERA_DISTANCE`, `CAMERA_HEIGHT` 상수를 지우고 카메라 목표를 계산하는 곳에서:

```ts
const distance = useSessionStore.getState().zoom
const height = distance * CAMERA_ZOOM.heightRatio
cameraTarget.set(x + sin * distance, p.y + height, z + cos * distance)
```

- 이동 처리 뒤(섬 가장자리 처리 앞)에 벤치 자리 고정:

```ts
// 벤치에서 쉬는 동안엔 앉는 자리에 고정하고 바다를 본다
if (mode === 'rest') {
  const [sx, sz] = BENCH_SEAT.position
  rb.setTranslation({ x: sx, y: rb.translation().y, z: sz }, true)
  rb.setLinvel({ x: 0, y: velocity.y, z: 0 }, true)
}
```

- 바라보는 방향 분기에 `else if (mode === 'rest') facing.current = BENCH_SEAT.facing`를 낚시 분기 다음에 넣는다.
- 앉은 모델 높이: 앉기 클립의 골반 높이와 벤치 면 높이가 다르면 `SIT_OFFSET`(y, z) 상수를 Player에 두고 `mode === 'rest'`일 때 모델 그룹(`<group position={[0, FOOT_Y, 0]}>`)의 위치에 더한다. 값은 Step 4 캡처로 정한다(엉덩이가 벤치 면에 닿고 등받이에 기대는 위치).

- [ ] **Step 4: 확인**

Run: `npx tsc -b && npx vitest run && npm run lint && npm run build`
Expected: 통과

headless 확인: 벤치까지 걸어가(또는 sessionStore로 nearby 설정 후 E) 앉은 모습을 옆·뒤에서 캡처하고 `SIT_OFFSET`을 맞춘다. 일어날 때(E) 일어나기 동작 후 서 있는지 캡처. 휠 이벤트(`Input.dispatchMouseEvent` type `mouseWheel`, deltaY ±500)로 가까이·멀리 캡처, 도감 패널을 연 상태에서 휠을 보내 줌이 안 바뀌는지 sessionStore 값으로 확인.

- [ ] **Step 5: 커밋**

```bash
git add src/game/stores/sessionStore.ts src/game/input/useWheelZoom.ts src/game/scene/Player.tsx src/game/Game.tsx
git commit -m "feat: 벤치에 앉기와 마우스 휠 줌" -m "벤치에서 쉬는 동안 앉는 자리에 고정해 바다를 보고 앉기 동작을 재생한다. 마우스 휠로 카메라 거리를 4~18 사이에서 바꾸고, 패널이 열려 있으면 휠은 패널 스크롤에 쓴다."
```

---

### Task 7: 옷장과 꾸미기 화면

**Files:**
- Create: `src/game/scene/facilities/Wardrobe.tsx`, `src/game/ui/CharacterCreator.tsx`
- Modify: `src/game/scene/World.tsx`, `src/game/ui/Panels.tsx`, `src/game/input/useInteractionKeys.ts`, `src/game/scene/PlayTimeTicker.tsx`, `src/game/Game.tsx`

**Interfaces:**
- Consumes: Task 2의 데이터·`randomLook`·`switchGender`, Task 4 `look`/`setLook`, Task 5 `PlayerModel`(`look` prop, 핸들 `update`), `FACILITY.wardrobe`, `InteractionZone`
- Produces: `CharacterCreator` (`firstTime: boolean`)

- [ ] **Step 1: 첫 시작·시간 정지·ESC 잠금**

`Game.tsx`의 첫 `useEffect` 끝에:

```ts
    // 아직 캐릭터를 만들지 않았으면 꾸미기 화면부터
    if (!useProgressStore.getState().look) useSessionStore.getState().setMode('wardrobe')
```

`useInteractionKeys.ts`: `resolveKeyAction(e.code, session.mode, session.nearby, session.mode === 'wardrobe' && !useProgressStore.getState().look)`

`PlayTimeTicker.tsx`: 시간을 멈추는 조건을 `session.mode === 'menu' || session.mode === 'wardrobe'`로 넓힌다.

- [ ] **Step 2: 옷장**

`src/game/scene/facilities/Wardrobe.tsx`:

```tsx
import { Html } from '@react-three/drei'
import { RigidBody } from '@react-three/rapier'
import { FACILITY } from '../../data/zones'
import { InteractionZone } from './InteractionZone'

const [X, Z] = FACILITY.wardrobe

/** 선착장 옷장: 열면 캐릭터 꾸미기 화면. 나무 장 + 거울 */
export function Wardrobe() {
  return (
    <group position={[X, 0, Z]} rotation-y={-Math.PI / 2}>
      <RigidBody type="fixed" colliders="cuboid">
        <mesh position={[0, 1.1, 0]} castShadow receiveShadow>
          <boxGeometry args={[1.4, 2.2, 0.6]} />
          <meshStandardMaterial color="#8d6e63" />
        </mesh>
      </RigidBody>
      {/* 문 두 짝과 손잡이 */}
      {[-0.35, 0.35].map((x) => (
        <group key={x}>
          <mesh position={[x, 1.1, 0.31]}>
            <boxGeometry args={[0.66, 2.0, 0.02]} />
            <meshStandardMaterial color="#a1887f" />
          </mesh>
          <mesh position={[x > 0 ? 0.06 : -0.06, 1.1, 0.34]}>
            <sphereGeometry args={[0.04, 8, 8]} />
            <meshStandardMaterial color="#ffd54f" metalness={0.6} roughness={0.3} />
          </mesh>
        </group>
      ))}
      {/* 옆 거울 */}
      <mesh position={[1.0, 1.0, 0]} rotation-y={-0.3}>
        <boxGeometry args={[0.5, 1.6, 0.05]} />
        <meshStandardMaterial color="#cfe8ff" metalness={0.9} roughness={0.05} />
      </mesh>
      <Html center position={[0, 2.6, 0]} zIndexRange={[100, 0]} style={sign}>
        👗 옷장
      </Html>
      <InteractionZone position={[0, 1, 1]} halfSize={[1.2, 1.5, 1]} target={{ kind: 'wardrobe' }} />
    </group>
  )
}

const sign = {
  pointerEvents: 'none' as const,
  whiteSpace: 'nowrap' as const,
  background: 'rgba(0,0,0,0.6)',
  color: '#fff',
  padding: '4px 10px',
  borderRadius: 6,
  fontSize: 14,
  fontWeight: 700,
}
```

`World.tsx`에 `<Wardrobe />` 추가. 옷장이 다른 시설·선착장·물가와 겹치지 않는지 캡처로 확인하고, 겹치면 `FACILITY.wardrobe`를 옮긴다.

- [ ] **Step 3: 꾸미기 화면**

`src/game/ui/CharacterCreator.tsx`:

```tsx
import { Canvas, useFrame } from '@react-three/fiber'
import { Suspense, useRef, useState, type ReactNode } from 'react'
import type { Group } from 'three'
import {
  BODY_PART_LABEL, BODY_PARTS, BODY_RANGES, DEFAULT_BODY, GENDER_LABEL, HAIR_COLORS, HAIRS, HEIGHT_RANGE, LOOK_PRESETS, OUTFITS, SKIN_COLORS,
} from '../data/characterParts'
import type { CharacterLook, Gender, OutfitId } from '../data/types'
import { randomLook, switchGender } from '../logic/characterLook'
import { PlayerModel, type PlayerModelHandle } from '../scene/PlayerModel'
import { useProgressStore } from '../stores/progressStore'
import { useSessionStore } from '../stores/sessionStore'
import { button, panelBox } from './styles'

/** 미리보기: 천천히 돌고, 드래그로 돌릴 수 있다 */
function Preview({ look }: { look: CharacterLook }) {
  const turn = useRef<Group>(null)
  const model = useRef<PlayerModelHandle>(null)
  const drag = useRef({ active: false, x: 0, extra: 0 })
  useFrame(({ clock }, delta) => {
    if (turn.current) turn.current.rotation.y = clock.elapsedTime * 0.4 + drag.current.extra
    model.current?.update(delta, clock.elapsedTime, null, 0, 0.5, false)
  })
  return (
    <group
      ref={turn}
      onPointerDown={(e) => {
        drag.current.active = true
        drag.current.x = e.clientX
      }}
      onPointerUp={() => (drag.current.active = false)}
      onPointerMove={(e) => {
        if (!drag.current.active) return
        drag.current.extra += (e.clientX - drag.current.x) * 0.01
        drag.current.x = e.clientX
      }}
    >
      <PlayerModel ref={model} look={look} />
    </group>
  )
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div style={{ margin: '10px 0' }}>
      <div style={{ fontSize: 13, opacity: 0.75, marginBottom: 4 }}>{label}</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>{children}</div>
    </div>
  )
}

function Choice({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button style={{ ...button, opacity: active ? 1 : 0.5 }} onClick={(e) => { onClick(); e.currentTarget.blur() }}>
      {children}
    </button>
  )
}

function Swatches({ colors, value, onChange }: { colors: string[]; value: string; onChange: (c: string) => void }) {
  return (
    <>
      {colors.map((c) => (
        <button key={c} aria-label={c} onClick={(e) => { onChange(c); e.currentTarget.blur() }}
          style={{ width: 26, height: 26, borderRadius: '50%', background: c, cursor: 'pointer', border: value === c ? '3px solid #ffd166' : '2px solid #555', pointerEvents: 'auto' }} />
      ))}
      {/* 직접 고르기 */}
      <input type="color" value={value} onChange={(e) => onChange(e.target.value)} style={{ width: 34, height: 28, pointerEvents: 'auto', background: 'none', border: 'none' }} />
    </>
  )
}

function Slider({ label, value, range, onChange }: { label: string; value: number; range: [number, number]; onChange: (v: number) => void }) {
  return (
    <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, margin: '4px 0' }}>
      <span style={{ width: 84 }}>{label}</span>
      <input type="range" min={range[0]} max={range[1]} step={0.01} value={value} onChange={(e) => onChange(Number(e.target.value))} style={{ flex: 1, pointerEvents: 'auto' }} />
      <span style={{ width: 40, textAlign: 'right' }}>{value.toFixed(2)}</span>
    </label>
  )
}

/** 캐릭터 꾸미기. firstTime 이면 취소가 없고 완료해야 닫힌다 */
export function CharacterCreator({ firstTime }: { firstTime: boolean }) {
  const saved = useProgressStore((s) => s.look)
  const [draft, setDraft] = useState<CharacterLook>(saved ?? LOOK_PRESETS[0].look)
  const set = (patch: Partial<CharacterLook>) => setDraft((d) => ({ ...d, ...patch }))
  const close = () => useSessionStore.getState().setMode('explore')
  const done = () => {
    useProgressStore.getState().setLook(draft)
    close()
  }

  return (
    <div style={{ ...panelBox, width: 'min(960px, 96vw)', maxHeight: '92vh', display: 'flex', gap: 16, padding: 16 }}>
      <div style={{ flex: '0 0 42%', minHeight: 420, background: 'radial-gradient(#3a5068, #16212e)', borderRadius: 10 }}>
        <Canvas camera={{ position: [0, 1.1, 3.4], fov: 35 }} onCreated={({ camera }) => camera.lookAt(0, 0.95, 0)}>
          <ambientLight intensity={1} />
          <directionalLight position={[2, 4, 3]} intensity={1.8} />
          <Suspense fallback={null}>
            <Preview look={draft} />
          </Suspense>
        </Canvas>
      </div>

      <div style={{ flex: 1, overflowY: 'auto' }}>
        <h2 style={{ margin: '0 0 4px', fontSize: 20 }}>{firstTime ? '나만의 낚시꾼 만들기' : '옷장'}</h2>

        <Row label="기본 꾸밈">
          {LOOK_PRESETS.map((p) => (
            <Choice key={p.id} active={false} onClick={() => setDraft(p.look)}>{p.name}</Choice>
          ))}
          <Choice active onClick={() => setDraft(randomLook(Math.random))}>🎲 랜덤</Choice>
        </Row>

        <Row label="성별">
          {(['male', 'female'] as Gender[]).map((g) => (
            <Choice key={g} active={draft.gender === g} onClick={() => setDraft((d) => switchGender(d, g))}>{GENDER_LABEL[g]}</Choice>
          ))}
        </Row>

        <Row label="피부색"><Swatches colors={SKIN_COLORS} value={draft.skinColor} onChange={(c) => set({ skinColor: c })} /></Row>

        <Row label="머리 모양">
          {HAIRS.map((h) => <Choice key={h.id} active={draft.hair === h.id} onClick={() => set({ hair: h.id })}>{h.name}</Choice>)}
          {draft.gender === 'male' && <Choice active={draft.beard} onClick={() => set({ beard: !draft.beard })}>수염 {draft.beard ? '있음' : '없음'}</Choice>}
        </Row>
        <Row label="머리색"><Swatches colors={HAIR_COLORS} value={draft.hairColor} onChange={(c) => set({ hairColor: c })} /></Row>

        {(['top', 'bottom', 'shoes'] as const).map((slot) => (
          <Row key={slot} label={{ top: '윗옷', bottom: '바지', shoes: '신발' }[slot]}>
            {OUTFITS.map((o) => <Choice key={o.id} active={draft[slot] === o.id} onClick={() => set({ [slot]: o.id as OutfitId })}>{o.name}</Choice>)}
          </Row>
        ))}
        <Row label="소품·옷 색">
          <Choice active={draft.hood} onClick={() => set({ hood: !draft.hood })}>후드 {draft.hood ? '씀' : '벗음'}</Choice>
          <Choice active={draft.outfitColor === 'base'} onClick={() => set({ outfitColor: 'base' })}>기본 색</Choice>
          <Choice active={draft.outfitColor === 'alt'} onClick={() => set({ outfitColor: 'alt' })}>다른 색</Choice>
        </Row>

        <Row label="몸">
          <div style={{ width: '100%' }}>
            <Slider label="키" value={draft.height} range={HEIGHT_RANGE} onChange={(v) => set({ height: v })} />
            {BODY_PARTS.map((part) => (
              <Slider key={part} label={BODY_PART_LABEL[part]} value={draft.body[part]} range={BODY_RANGES[part]}
                onChange={(v) => setDraft((d) => ({ ...d, body: { ...d.body, [part]: v } }))} />
            ))}
            <Choice active={false} onClick={() => set({ height: 1, body: DEFAULT_BODY })}>몸 부위 초기화</Choice>
          </div>
        </Row>

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 }}>
          {!firstTime && <button style={{ ...button, background: '#555', color: '#fff' }} onClick={close}>취소</button>}
          <button style={button} onClick={done}>완료</button>
        </div>
      </div>
    </div>
  )
}
```

`Panels.tsx`: `CharacterCreator`를 import하고, 저장된 모습이 없으면(`look === null`) `firstTime`으로 넘긴다:

```tsx
    case 'wardrobe':
      return <CharacterCreator firstTime={!look} />
```

(`const look = useProgressStore((s) => s.look)`를 Panels 안에서 읽는다.)

- [ ] **Step 4: 확인**

Run: `npx tsc -b && npx vitest run && npm run lint && npm run build`
Expected: 통과

headless 확인(새 프로필 = 저장본 없음): 처음 열면 꾸미기 화면이 뜨고 ESC를 눌러도 닫히지 않는다. 성별·머리·옷·색·슬라이더를 바꾸며 미리보기 캡처 4장. 완료 → 게임 속 캐릭터가 같은 모습. 새로고침 후에도 유지되고 꾸미기 화면이 다시 뜨지 않는다. 옷장 E → 바꾸고 취소 → 원래 모습 유지. 콘솔 에러 없음.

- [ ] **Step 5: 커밋**

```bash
git add src/game
git commit -m "feat: 옷장과 캐릭터 꾸미기 화면 추가" -m "처음 시작하면 꾸미기 화면이 뜨고(ESC로 닫히지 않음), 선착장 옷장에서 언제든 다시 꾸밀 수 있다. 돌아가는 미리보기를 보며 기본 꾸밈·랜덤·성별·피부·머리·수염·옷·후드·옷 색·키·몸 부위 배율을 고른다. 꾸미는 동안 게임 시간은 멈춘다."
```

---

## 마무리 확인

- `npx vitest run`, `npx tsc -b`, `npm run lint`(새 경고 없음), `npm run build`, `cd tools/build-characters && npm run inspect`
- 브라우저 한 바퀴: 첫 생성 → 낚시(남녀 반응) → 벤치 앉기 → 휠 줌 → 옷장에서 성별 바꾸기 → 새로고침 유지
- `public/models/characters/` 두 파일 합계 6MB 이하
