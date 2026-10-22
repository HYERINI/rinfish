# 낚시섬 스터디원 물고기·희귀도 묶음 확률 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 희귀도 비율이 어종 수와 무관하게 유지되는 확률 방식, 그리고 해변 희귀 스터디원 물고기 9종(몸 비율·회전·휘청거림·여러 소품·도감 스탯 포함).

**Architecture:** 확률은 `logic/catchTable.ts`에서 희귀도 묶음 가중치를 구한 뒤 같은 희귀도 어종끼리 나눈다. 생김새 표(`data/fishLooks.ts`)에 `stretch`·`rotate`·`wobble`·`accessories[]`를 더하고, 적용 코드(`scene/fishing/fishAppearance.ts`)와 소품 빌더를 확장한다. 도감 스탯은 `FishSpecies.trivia`로 데이터에 두고 도감·결과 카드가 보여 준다.

**Tech Stack:** React 19, R3F 9, drei, three 0.186, vitest, oxlint

**Spec:** `docs/superpowers/specs/2026-10-22-aquarium-view-fish-variety-design.md` 8장

## Global Constraints

- 층 규칙: scene/ui → stores → logic → data. `logic/`은 React·three·zustand를 import하지 않는다
- 값(생김새·도감 문구·확률)은 `src/game/data/`에만
- 모델은 CC0만, 출처는 `public/models/CREDITS.md`
- 저장 키·버전 그대로, 어종 id는 늘어나기만 한다
- tsconfig: `verbatimModuleSyntax`, `erasableSyntaxOnly`, `noUnusedLocals`/`noUnusedParameters`
- 커밋 메시지: 타입만, 괄호 스코프 금지, 짧은 한국어 제목 + 본문, Co-Authored-By·AI 표기 금지

## Review Focus

1. **희귀 어종이 10종으로 늘어난 해변** → 희귀 비율 합계는 이전과 같아야 한다(어종이 늘면 한 종당 확률만 줄어든다). Task 1 테스트로 고정한다.
2. **동굴 전설 덮어쓰기(16)와 세게 던지기 보너스** → 묶음 방식에서도 그대로 적용된다. Task 1 기존 테스트 유지로 고정한다.
3. **도감 스탯이 없는 기존 어종** → 도감·결과 카드가 빈 줄 없이 그대로 보인다. Task 2 캡처로 확인한다.
4. **소품 여러 개 + 몸 비율을 바꾼 물고기** → 소품이 늘어난 몸에 맞게 붙는다(빵빵한 우걱의 숟가락이 몸에 묻히지 않음). Task 2 캡처로 확인한다.
5. **판매가 3코인(연차3원준)** → 무게와 상관없이 판매가가 3 근처여야 웃기다(기본가 3, 무게 범위 좁게). Task 2 데이터로 고정한다.

---

### Task 1: 희귀도 묶음 확률

**Files:** Modify `src/game/logic/catchTable.ts`, `src/game/logic/catchTable.test.ts`

- [ ] **Step 1: 실패하는 테스트**

`catchTable.test.ts`에 추가:

```ts
  it('희귀도 비율은 그 희귀도 어종 수와 상관없다 (같은 희귀도끼리 나눠 가진다)', () => {
    const shareOf = (zone: 'beach' | 'pond' | 'reef', rarity: string, power: number) => {
      const table = catchWeights(zone, power)
      const total = table.reduce((s, e) => s + e.weight, 0)
      return table.filter((e) => e.species.rarity === rarity).reduce((s, e) => s + e.weight, 0) / total
    }
    // 세 구역 모두 잡어·일반·희귀·에픽이 있다 → 비율이 같아야 한다
    for (const power of [0, 1]) {
      const beach = shareOf('beach', 'epic', power)
      expect(shareOf('pond', 'epic', power)).toBeCloseTo(beach)
      expect(shareOf('reef', 'epic', power)).toBeCloseTo(beach)
    }
  })

  it('같은 희귀도 어종끼리는 확률이 똑같다', () => {
    const rares = catchWeights('reef', 0.5).filter((e) => e.species.rarity === 'rare')
    for (const e of rares) expect(e.weight).toBeCloseTo(rares[0].weight)
  })
```

Run: `npx vitest run src/game/logic/catchTable.test.ts` → 첫 테스트 FAIL (암초 에픽이 4종이라 비율이 크다)

- [ ] **Step 2: 구현**

`catchWeights(zone, castPower)`: 구역 어종을 희귀도별로 묶고, 각 어종 가중치 = `rarityWeight(zone, rarity, castPower) / 그 희귀도 어종 수`. `rarityWeight`는 지금 그대로(구역 덮어쓰기 + 세게 던지기 보너스). 주석으로 "희귀도 묶음 가중치를 같은 희귀도끼리 나눈다 — 어종이 늘어도 희귀도 비율이 유지된다"를 남긴다.

Run: `npx vitest run` → 전부 PASS (동굴 전설 테스트 포함)

- [ ] **Step 3: 커밋**

```bash
git add src/game/logic/catchTable.ts src/game/logic/catchTable.test.ts
git commit -m "fix: 희귀도 비율을 어종 수와 무관하게" -m "희귀도마다 가중치를 한 묶음으로 계산하고 그 구역의 같은 희귀도 어종끼리 나눈다. 어종을 더해도 구역마다 일반 60 · 희귀 24 · 에픽 8 · 잡어 8 비율(세게 던지기 보너스 포함)이 유지된다. 이전에는 에픽이 4종인 암초에서 세게 던지면 에픽이 37%까지 나왔다."
```

---

### Task 2: 스터디원 물고기 9종

**Files:**
- Modify: `src/game/data/types.ts` (`FishSpecies.trivia?: string`), `src/game/data/fish.ts`, `src/game/data/fishLooks.ts`, `src/game/data/fishLooks.test.ts`
- Modify: `src/game/scene/fishing/fishAppearance.ts`, `FishModel.tsx`, `fishThumbnail.ts` (필요한 만큼), `src/game/scene/fishing/fishAppearance.test.ts`
- Modify: `src/game/ui/DexPanel.tsx`, `src/game/ui/FishingOverlay.tsx` (도감 스탯 한 줄)
- Create: `public/models/fish/squid.glb` (poly.pizza `gReSPnGdkr`, Quaternius, CC0, 정적), Modify: `public/models/CREDITS.md`

**Interfaces:**
- `FishLook`에 추가: `stretch?: [number, number, number]` (모델 x=두께, y=높이, z=길이 배율), `rotate?: [number, number, number]` (모델 자체 회전, 라디안), `wobble?: number` (0~1, 추가 휘청거림), `accessories?: FishAccessoryKind[]` — 기존 `accessory`는 `accessories: [하나]`로 옮기고 필드를 지운다(소품 위치 보정 `accessoryAt`은 첫 소품에 적용)
- `FishModelId`에 `'squid'`
- `FishAccessoryKind`에 추가: `'spoons' | 'googlyEyes' | 'sadBrows' | 'digit3' | 'digits31' | 'darkCircles' | 'priceTag3' | 'furPerm' | 'bossChain' | 'bossScar' | 'bread' | 'grandpaBeard' | 'magnifierGlasses' | 'sheepTowel' | 'cane' | 'bowlCut'`

- [ ] **Step 1: 데이터**

`fish.ts` 해변 블록 끝(새 해변 어종 뒤)에 9종. 모두 `zones: ['beach'], rarity: 'rare'`:

| id | name | description | trivia | pattern | strength | weightRange | basePrice | color |
|---|---|---|---|---|---|---|---|---|
| skinny-anchovy-insik | 개멸치뼈인식 | 잡으면 낚싯바늘이 더 무겁다. 구워 먹으려 했는데 이쑤시개가 됐다. | 체중 ★☆☆☆☆ / 자존심 ★★★★★ | erratic | 2 | [0.01, 0.03] | 40 | #cfd8dc |
| nurungji-eunji | 누룽지이은지 | 노릇노릇 동글동글 형님. 빵 먹을 때 건드리면 손가락을 잘라 간다. | 서열 ★★★★★ / 빵 ★★★★★ | dasher | 6 | [1, 3] | 60 | #c8913a |
| ugeok-kimugeok | 또먹냐김우걱 | 먹이를 주면 잡기 쉬워진다. 단, 먹이가 먼저 사라진다. | 포만감 측정불가 | endurance | 7 | [8, 15] | 70 | #f48fb1 |
| squid-ojeonghun | 마른오징어정훈 | 본인은 물고기라고 주장한다. 아무도 물어본 적 없다. | 물고기력 ★☆☆☆☆ / 억울함 ★★★★★ | erratic | 4 | [0.5, 1.5] | 50 | #d7b98e |
| eelgas-baejeongbin | XXL배정빈 | 한 마리가 출현하면 수조 정원이 초과된다. 사이즈 선택은 불가능하다. | 1인분 기준 8인분 | dasher | 7 | [10, 25] | 80 | #4e342e |
| bigeye-kimgaeun | 눈밖에김가은 | 시야각 340°. 코는 업데이트 예정. | 시야 ★★★★★ / 코 ★☆☆☆☆ | endurance | 3 | [0.5, 1.5] | 50 | #ffe0b2 |
| three-wonjun | 연차3원준 | 연차가 3개 남았다. 체력은 0개 남았다. | 남은 연차 3 / 헤어스타일 이해 불가 | erratic | 3 | [0.29, 0.31] | 3 | #90a4ae |
| hairy-ajumma-jongheon | 털밖에윤종헌 | 털갈이 철에는 개체 수가 두 배로 보인다. 절반은 털이다. | 털 ★★★★★ / 지느러미 확인 불가 | endurance | 5 | [1, 3] | 55 | #8d6e63 |
| grandpa-escapee | 할아범이적범 | 싸사모(싸우나를 사랑하는 모임) 회장님. 오후 8시 이후 발견 기록이 없다. | 사우나 ★★★★★ / 주량 ★☆☆☆☆ / 활동시간 05:30~20:00 | dasher | 5 | [1, 2.5] | 60 | #e53935 |

`fishLooks.ts`에 생김새(시작값 — Step 4 캡처로 다듬는다):

| id | model | tint | glow | size | stretch | rotate | wobble | accessories |
|---|---|---|---|---|---|---|---|---|
| skinny-anchovy-insik | mackerel | #cfd8dc | – | 1.1 | [0.35, 0.4, 1.6] | – | 0.8 | – |
| nurungji-eunji | goldfish | #c8913a | – | 1 | [1.35, 1.35, 0.9] | – | – | sunglasses, bossChain, bossScar, bread |
| ugeok-kimugeok | puffer | #f48fb1 | – | 1.3 | [1.5, 1.4, 1.1] | – | – | spoons |
| squid-ojeonghun | squid | #d7b98e | – | 1 | [1.2, 0.5, 1] | 오징어가 머리 +z로 눕게(캡처로 정함) | – | sadBrows |
| eelgas-baejeongbin | goblin-shark | #4e342e | – | 2.4 | [0.8, 0.8, 1.4] | – | – | digits31 |
| bigeye-kimgaeun | cardinal | #ffe0b2 | – | 1 | – | – | – | googlyEyes |
| three-wonjun | tang | #90a4ae | – | 0.9 | – | – | – | digit3, darkCircles, priceTag3, bowlCut |
| hairy-ajumma-jongheon | red-snapper | #8d6e63 | – | 1 | – | – | – | furPerm |
| grandpa-escapee | koi | #e53935 | – | 1 | – | – | – | grandpaBeard, magnifierGlasses, sheepTowel, cane |

- `fishLooks.test.ts`의 "같은 모델 어종 구분" 키에 `stretch`·`accessories`를 넣는다(배열은 join).
- 기존 `accessory: 'x'` 항목은 모두 `accessories: ['x']`로 바꾼다.

- [ ] **Step 2: 적용 코드**

`fishAppearance.ts`:
- `stretch`: 몸길이 1.2로 맞추기 전에 모델에 축별 배율을 곱한다(그 뒤 `fitFish`가 길이를 다시 1.2×size로 맞추므로 두께·높이 비율만 남는다 — 길이 배율은 비율로 적용되도록 `fitFish` 뒤에 z만 곱하는 방식이 더 자연스러우면 그렇게). 머리·눈 측정(`shape`)은 늘어난 몸 기준으로 다시 잰다.
- `rotate`: 모델 자체 회전(머리 +z 맞추기). `fitFish` 전에 적용.
- `wobble`: `FishModel`이 매 프레임 안쪽 그룹을 `sin(t*8)*wobble*0.25` 라디안만큼 y축으로 흔든다(휘청거림). 사진에는 적용하지 않는다.
- `accessories[]`: 각 소품을 만들어 머리뼈(없으면 몸)에 붙인다. 위치 보정은 첫 소품에 `accessoryAt`, 나머지는 종류별 기본 위치(눈·머리·몸통·입 기준)로.
- 새 소품(기본 도형, 몸길이 1.2 기준):
  - `spoons`: 입 양옆에 은색 숟가락 둘(손잡이 원통 + 납작한 타원 머리)
  - `googlyEyes`: 얼굴을 덮을 만큼 큰 흰 구 둘 + 검은 눈동자(조금 앞으로 튀어나오게), 원래 눈은 가린다
  - `sadBrows`: 눈 위 八자 모양 검은 막대 둘(억울한 눈썹)
  - `digit3`: 머리 위에 떠 있는 굵은 "3" (반원 토러스 둘을 위아래로)
  - `digits31`: 몸통 옆면에 붙은 "31" (3은 위와 같이, 1은 막대)
  - `darkCircles`: 눈 아래 보라빛 납작한 반원 둘
  - `priceTag3`: 목에 끈(가는 토러스) + 흰 사각 꼬리표에 작은 "3"
  - `furPerm`: 몸 전체에 짧은 갈색 원뿔 털 다수(지느러미가 가려질 정도) + 머리 위 뽀글 파마(작은 토러스·구 여러 개) + 분홍 집게핀
  - `bossChain`: 목 둘레 금색 굵은 체인(작은 토러스 고리 여러 개)
  - `bossScar`: 한쪽 눈 위 사선 흉터(붉은 가는 막대 + 가로 바느질 짧은 막대 셋)
  - `bread`: 가슴지느러미 쪽에 소보로빵(눌린 구 + 울퉁불퉁 작은 구)
  - `grandpaBeard`: 입 아래 흰 수염(원뿔·구) + 흰 눈썹
  - `magnifierGlasses`: 두꺼운 렌즈 동그란 돋보기안경(반투명 원판 + 테)
  - `sheepTowel`: 머리 위 양머리 수건(돌돌 만 연분홍 토러스 둘 + 가운데 매듭)
  - `cane`: 몸 옆 갈색 지팡이(긴 원통 + 손잡이 반원)
  - `bowlCut`: 단정하게 각 잡힌 바가지 머리(머리를 덮는 반구, 아래 테두리 일자, 짙은 갈색)
- `fishAppearance.test.ts`: 새 소품 종류마다 `buildAccessory`가 비어 있지 않은 Group을 돌려주는지, `stretch`가 측정한 몸 크기 비율에 반영되는지 테스트를 더한다.

- [ ] **Step 3: 도감 스탯 보이기**

- `DexPanel.tsx`: 잡은 어종의 설명 아래에 `species.trivia`가 있으면 작은 글씨(노란빛, 굵게 X)로 한 줄.
- `FishingOverlay.tsx` 결과 카드: 설명 아래 같은 줄.

- [ ] **Step 4: 화면 확인과 다듬기**

headless Chrome으로 9종을 옆·앞·¾ 방향으로 캡처(임시 디버그 화면, 커밋 안 함), 도감(스탯 줄), 결과 카드, 어항 크게 보기(XXL배정빈이 수조 안에 들어가는지 — 너무 크면 크게 보기에서만 크기 상한을 둔다), 낚아 올린 장면. 각 물고기가 이름을 보고 바로 알아볼 만큼 특징이 드러나게 생김새 값과 소품 모양을 다듬는다.

- [ ] **Step 5: 커밋**

```bash
git add -A public/models src/game
git commit -m "feat: 스터디원 물고기 9종" -m "해변 희귀로 개멸치뼈인식, 누룽지이은지, 또먹냐김우걱, 마른오징어정훈, XXL배정빈, 눈밖에김가은, 연차3원준, 털밖에윤종헌, 할아범이적범을 더했다. 생김새에 몸 비율·모델 회전·휘청거림·여러 소품을 넣고, 숟가락·왕눈이 눈·숫자 3/31·털과 파마·형님 세트·양머리 수건 등 소품 16가지를 만들었다. 도감과 결과 카드에 쓸데없는 스탯 한 줄을 보여 준다. 오징어 모델(Quaternius, CC0)을 추가했다."
```
