# 3-1 시간과 생존 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 낚시섬 세계에 은지 게임의 낮과 밤(하루 8분)·침대 잠·배고픔·죽음(침대에서 깨어남)을 넣고, 같이 하기에서는 방 서버가 시계와 잠 투표를 맡아 모두 같은 시각을 본다.

**Architecture:** 규칙은 모두 `src/game/logic/` 순수 함수로 둔다: 시계·방 시계 계산(`dayClock.ts`), 화면 어두워지기 시간표(`restSeq.ts`), 배고픔·죽음 판정(`survival.ts`). 매 프레임 바뀌는 시각은 `stores/dayStore.ts` 의 모듈 변수 `liveClock` 에 두고 HUD 글자·밤 여부만 zustand 로 알린다. 잠·죽음 흐름(`scene/day/dayActions.ts`)이 진행 저장(`progressStore` v3: `survival.hunger`·`clock`)과 세션 모드(`sleep`)를 묶는다. 조명은 지금처럼 은지 `DayNight` 한 벌이 해·하늘빛·가로등·섬 등불 세기를 정하고, 배경색·바다 셰이더는 모듈 객체 `skyNow` 를 같이 쓴다. 방 서버(Durable Object)는 시계 기준점 `{epoch, day0}` 만 저장하고 시각은 계산하며, 잠 투표는 소켓 붙임 정보의 `sleeping` 으로 센다.

**Tech Stack:** React 19, @react-three/fiber 9, @react-three/rapier 2, three 0.186, zustand 5, vitest 5, oxlint, Cloudflare Workers Durable Object(hibernation API, alarm).

**Spec:** `docs/superpowers/specs/2026-11-18-eunji-features-design.md` — 이 계획은 "3-1 시간과 생존" 과, "저장"·"같이 하기 메시지"·"확인 방법" 가운데 3-1 몫만 만든다. 3-2~3-4(도구 칸·가방·동물·총)는 하지 않는다.

## Global Constraints

- 브랜치 `feat/eunji-features` 에서 그대로 커밋한다. push·main 합치기·서버 배포(`npm run server:deploy`)는 바깥에 영향을 주므로 **사용자에게 먼저 묻는다** (Task 8). 배포 순서는 **서버 먼저**.
- 은지 값 그대로: 하루 `DAY_LENGTH = 480` 초, `t` 0 = 06:00, 밤 = 20시 이상 또는 5시 전. 배고픔 12분에 100 → 0 (`100/720` /s), 배고픔 0 이면 체력 1.5/s 감소, 배고픔 60 **초과**일 때 0.8/s 회복, 자는 동안 3/s. 잠: 체력 100·배고픔 −15(최소 10). 죽음: 1.6초 어두워짐 + 1.4초 머묾, 체력 100·배고픔 60, 침대 옆 은지 (2.2, 2.4) → 세계 (197.8, −2.4).
- 좌표 변환: 세계 `(x, z) = (200 − x_은지, −z_은지)` (`toWorld`). 침대 은지 (3.5, 3.6) → 세계 (196.5, −3.6).
- 음식 → 배고픔: 김밥 +30 · 컵라면 +50 · 에너지 음료 +10, 미스터찜 요리 +60 (비밀 메뉴 +100). 체력 회복은 지금 그대로.
- 저장 키 `fishing-island-save-v1` 은 그대로, persist **version 3**. 필드만 늘어난다: `survival.hunger`(없으면 100), `clock {t, day}`(없으면 1일차 06:00). 예전 저장본(version 1·2)은 그대로 열린다.
- 같이 하기: `NET.protocolVersion` 은 **1 그대로**. 새 메시지(`sleep`, `time`, `sleepers`, `morning`)와 `welcome.time` 은 선택 필드·새 종류라 옛 클라이언트는 버린다 (`parseServerMsg` 가 null). 서버와 클라이언트는 `src/game/logic/netProtocol.ts` 로 같은 검사를 한다.
- 서버는 hibernation API: 메모리 상태는 잠들면 사라진다. 시계 기준점은 `ctx.storage` 의 `clock = { epoch, day0 }`, 잠 표시는 소켓 붙임 정보(attachment). alarm 은 **사람이 있는 동안만** 30초마다 다시 걸고, 마지막 사람이 나가면 지운다.
- 빛 개수는 첫 프레임부터 같게 (방 조명 4 + 가로등 4 + 섬 등불 2 = PointLight 10개, 해·하늘빛 별도). 밤낮·폰 품질은 `intensity` 만 바꾼다 — `visible`·마운트를 바꾸지 않는다 (셰이더 다시 컴파일로 끊긴다).
- 침대 순간이동도 자리 저장 규칙 `canSavePlace` (몸이 Dynamic, 순간이동 대기 없음, 땅 위)를 그대로 따른다. 순간이동은 `requestTeleport` 만 쓴다 (배를 끝내고 Player 가 Dynamic 으로 돌린다).
- oxlint 경고 기준선 **6** 을 늘리지 않는다 (`npm run lint 2>&1 | grep -c warning`). 컴포넌트 파일(.tsx)은 컴포넌트만 export 한다. hook 에 넘긴 값(`useMemo` 결과 등)을 `useFrame` 에서 고치지 않는다 — 매 프레임 고치는 값은 모듈 변수(`liveClock`, `skyNow`)로 둔다.
- macOS 파일 이름은 대소문자를 가리지 않는다: 대소문자만 다른 두 파일을 만들지 않는다 (예: `dayClock.ts` 와 `DayClock.tsx` 금지 — 그래서 컴포넌트는 `DayCycle.tsx`).
- 테스트 기준선 53 파일 / 525 개. 이 계획을 다 하면 58 파일 / 597 개. `npx tsc -b` 깨끗.
- 커밋 메시지: `feat:`/`fix:`/`docs:`/`test:` 처럼 타입만(괄호 스코프 금지), 제목 짧게, 자세한 건 본문. Co-Authored-By·AI 생성 표기 금지.
- 코드 주석·UI 글은 한국어, 지금 코드 말투(평서형, 짧게).
- 헤드리스 점검 준비: `npm run server:dev` (8787) 와 `VITE_ROOM_SERVER=ws://127.0.0.1:8787 npx vite --port 5190 --strictPort`. Vite 는 `::1` 에 뜨므로 점검 주소는 `http://localhost:5190`.

## Review Focus

1. **배 타는 중·낚시 중에 굶어 죽기** — 죽음은 화면이 다 어두워진 순간(1.6초 뒤) `requestTeleport(BED_WAKE)` 로 옮긴다. 그 사이 배는 계속 가고, 순간이동이 배를 끝내야 하며(`mode` 는 `sleep` 이라 `boat → explore` 강제가 끼어들지 않는다), 끝나면 탐험 모드로 돌아와 침대 옆 자리가 저장돼야 한다. 바다 위 자리를 저장하면 다음에 `START_PLACE` 로 튄다 (Task 5 테스트 "배 타는 중 죽으면", meadow-check 16).
2. **방에서 나오거나 다시 붙을 때 시계가 섞이는 것** — 방 시계로 1초 저장을 하면 혼자 시계가 방 날짜로 덮인다. 같이 하는 동안 `tick(…, null)` 로 저장하지 않고, 나오면 저장된 혼자 시계로 돌아가야 한다. 다시 붙으면(welcome) 서버의 잠 표시가 지워졌으니 내 쪽 잠 투표도 풀어야 한다 (Task 2·4 테스트, meadow-check 17).
3. **화면이 어두워지는 동안의 시간과 키** — 잠·죽음 페이드 중엔 1초 틱을 멈춰야 한다 (안 멈추면 깨어나기 전에 또 굶어 죽거나 진료소 쓰러짐이 겹친다). E·ESC 는 페이드 중 아무 일도 하지 않고, 잠 투표 중에만 "일어나기" (Task 5 테스트 "어두워지는 중에 … 일어나기도 아무 일 없다"·"죽는 중에 또 죽어도 한 번만", meadow-check 16 이 한 번만 깨어나는지).
4. **서버 배포 중 살아 있던 방·옛 클라이언트** — 3-1 전 붙임 정보엔 `sleeping`·`sleepWin` 이 없다. `memberFrom` 이 없는 값을 안 자는 사람·새 창으로 읽어야 하고, 옛 클라이언트는 `time`·`sleepers`·`morning` 을 버린다. 옛 서버에 붙은 새 클라이언트(welcome 에 `time` 없음)는 지금 시각에서 이어 돌린다 (Task 3·4 테스트).
5. **탭을 숨겼다 돌아온 같이 하기 시계** — 프레임 dt 는 0.1초로 잘리므로 dt 로 방 시계를 돌리면 숨긴 만큼 늦는다. 방 시계는 받은 시각 + `performance.now()` 차이로 계산해야 한다 (`anchoredClock`, Task 1·4 테스트).

---

## 결정한 것 (스펙 해석)

- 혼자 시계는 메뉴·꾸미기·**로비** 화면에서 멈춘다 (배고픔과 같은 규칙, `timeStops`). 로비도 멈추게 바꾼 건 저장본이 굶고 있을 때 혼자/같이를 고르는 동안 죽지 않게 하려는 것. 어항 시간도 로비에서는 멈춘다.
- 저절로 회복(0.8/s)은 지금처럼 **탐험 모드에서만** (낚시 대기 중엔 회복하지 않는다 — 낚시 체력 소모가 의미 없어지지 않게).
- 낚시로 지친(약화) 채 배고픔이 0 이 되면 "배고픔 0 인 채로 체력 0" 이라 **죽음**(침대). 쓰러짐(진료소)은 배고픔이 남아 있을 때 유예가 끝난 경우만. 쓰러지면 배고픔은 그대로 둔다.
- 같이 하기 잠 투표로 아침이 오면 자던 사람은 혼자 잠과 똑같이 체력 100·배고픔 −15. 안 자던 사람은 알림과 0.5초 페이드만.
- 방 시계 확인 `time` 은 스펙대로 30초마다(은지는 2초). 그 사이는 받은 시각 + 내 시계로 계산하므로 은지의 `DayNight.sync`(조금씩 당기기)는 쓰지 않는다.
- 다시 붙는 중(`reconnecting`)엔 잘 수 없다 ("연결이 끊겨 지금은 잘 수 없어요").
- 서버 `sleep` 은 초당 4번까지 받는다 (도배 막기). 같은 값이 와도 표시만 다시 쓴다.
- HUD 의 "체력 30 미만" 안내는 배고픔과 헷갈리지 않게 "지쳤어요!" 로 바꾸고, 배고픔 0 경고는 화면 가운데(약화 경고 자리)에 띄운다.
- 섬 등불 자리: 선착장 끝 (1.25, 29.5), 장비 상점과 판매함 사이 (0.5, 15). 스크린샷에서 시설과 겹치면 `ISLAND_LANTERNS` 값만 옮긴다.
- 동물 진정·피해(`takeDamage`)는 3-3 에서 쓰므로, 3-1 에서는 순수 함수와 테스트만 둔다.

---

## 파일 구조

| 파일 | 책임 |
|---|---|
| `src/game/logic/dayClock.ts` (+test) | 시계 `{t, day}`, 시각 글자, 밤, 저장본 시계 검사, 방 시계 계산(epoch)·아침·받은 시각 기준점 |
| `src/game/logic/restSeq.ts` (+test) | 잠·죽음·방 아침 화면 어두워지기 시간표 |
| `src/game/logic/survival.ts` (+test) | 배고픔 틱·저절로 회복·굶주림·죽음/쓰러짐 판정, 먹기, 자고 일어나기, 죽었다 깨어나기 |
| `src/game/logic/stamina.ts` | `Survival` 에 `hunger` 추가 (틱은 survival.ts 로 옮김) |
| `src/game/data/balance.ts` | `HUNGER`, `DAY_LENGTH`, `REST_FADE`, `STAMINA.fedRegenPerSecond`·`sleepRegenPerSecond` |
| `src/game/data/{snacks,dishes}.ts` | 음식별 배고픔 |
| `src/game/stores/progressStore.ts` | 저장 v3: `survival.hunger`, `clock`, `tick` 의 `died`, `sleepWell`, `reviveAtBed` |
| `src/game/logic/netProtocol.ts` (+test), `src/game/data/net.ts` | `sleep`·`time`·`sleepers`·`morning`·`welcome.time` |
| `server/src/roomRules.ts` (+test), `server/src/room.ts`, `tools/room-smoke.mjs` | 잠 표시·잠 투표 세기, 시계 기준점 저장, alarm |
| `src/game/stores/dayStore.ts` (+test) | `liveClock`(모듈 변수), HUD 글자·밤, 혼자/방 시계, 잠 투표 상태, 페이드 상태 |
| `src/game/stores/netStore.ts` (+test) | 새 메시지를 dayStore 로, `sendSleep` |
| `src/game/scene/day/dayActions.ts` (+test) | 잠자기·일어나기·죽음, 다 어두워진 순간의 일 |
| `src/game/scene/day/DayCycle.tsx` | 매 프레임 시계·페이드 진행, 침대 E 감지 상자 |
| `src/game/logic/interaction.ts`, `src/game/input/useInteractionKeys.ts`, `src/game/ui/interactLabel.ts` | `sleep` 모드, 침대 E, 일어나기 |
| `src/game/logic/time.ts` | `timeStops(mode)` |
| `src/game/scene/PlayTimeTicker.tsx` | 배고픔·잠 회복·죽음·혼자 시계 저장 |
| `src/meadow/meadowSingleton.ts` (+test), `src/meadow/MeadowLighting.tsx` | 가로등·섬 등불 꺼내기, 시각으로 해·하늘·등불, 실내 배경, 폰 방 조명 |
| `src/game/scene/skyNow.ts` | 배경·바다가 같이 쓰는 하늘색·해 방향 |
| `src/game/scene/Ocean.tsx` | 바다 `uSky`·`uSunDir` 를 `skyNow` 로 |
| `src/game/scene/decor/IslandLanterns.tsx`, `src/game/data/zones.ts` | 섬 등불 기둥과 자리 |
| `src/game/logic/music.ts`, `src/game/audio/backgroundMusic.ts` | 밤엔 조용한 곡 |
| `src/game/ui/Hud.tsx`, `src/game/ui/WeaknessOverlay.tsx`, `src/game/ui/SleepOverlay.tsx` | 시계·배고픔 막대, 배고파요 경고, 페이드·잠 투표 화면 |
| `src/game/data/meadow.ts`, `src/meadow/vendor/{world,daynight}.d.ts` | 침대 자리, 은지 타입 |
| `tools/meadow-check.mjs` | 헤드리스 점검 14~17 |

---
### Task 1: 시계와 화면 어두워지기 (순수 함수)

**Files:**
- Modify: `src/game/data/balance.ts` (파일 끝에 상수 추가)
- Create: `src/game/logic/dayClock.ts`, `src/game/logic/restSeq.ts`
- Test: `src/game/logic/dayClock.test.ts`, `src/game/logic/restSeq.test.ts`

**Interfaces:**
- Consumes: 없음
- Produces:
  - `DAY_LENGTH: number` (480), `REST_FADE: { sleep: {fade, hold}; death: {fade, hold}; morning: {fade, hold}; out: number }` (`data/balance.ts`)
  - `type Clock = { t: number; day: number }`, `FIRST_MORNING: Clock`, `advanceClock(c: Clock, dt: number): Clock`, `nextMorning(c: Clock): Clock`, `clockHour(t: number): number`, `isNight(t: number): boolean`, `clockText(c: Clock): string`, `readClock(v: unknown): Clock | null` (`logic/dayClock.ts`)
  - `type ClockTime = { tm: number; day: number }`, `type RoomClock = { epoch: number; day0: number }`, `newRoomClock(nowMs): RoomClock`, `roomTime(rc, nowMs): ClockTime`, `roomMorning(rc, nowMs): RoomClock`, `type ClockAnchor = ClockTime & { at: number }`, `anchoredClock(a: ClockAnchor, nowSec: number): Clock`, `toClockTime(c: Clock): ClockTime` (같은 파일, 서버도 import)
  - `type SeqKind = 'sleep' | 'death' | 'morning'`, `seqSwitchAt(kind): number`, `seqEnd(kind): number`, `seqOpacity(kind, t): number` (`logic/restSeq.ts`)

- [ ] **Step 1: 실패하는 테스트 쓰기** — `src/game/logic/dayClock.test.ts`

```ts
import { describe, expect, it } from 'vitest'
import { DAY_LENGTH } from '../data/balance'
import { FIRST_MORNING, advanceClock, anchoredClock, clockText, isNight, nextMorning, readClock, roomMorning, roomTime, toClockTime } from './dayClock'

describe('advanceClock·nextMorning', () => {
  it('하루(480초)가 지나면 다음 날 같은 시각', () => {
    expect(advanceClock({ t: 0.25, day: 2 }, DAY_LENGTH)).toEqual({ t: 0.25, day: 3 })
  })
  it('06:00 를 지나면 날짜가 바뀐다', () => {
    const c = advanceClock({ t: 0.9, day: 1 }, DAY_LENGTH * 0.2)
    expect(c.day).toBe(2)
    expect(c.t).toBeCloseTo(0.1)
  })
  it('거꾸로 가지 않는다', () => {
    expect(advanceClock({ t: 0.5, day: 4 }, -10)).toEqual({ t: 0.5, day: 4 })
  })
  it('다음 날 06:00', () => {
    expect(nextMorning({ t: 0.7, day: 3 })).toEqual({ t: 0, day: 4 })
  })
})

describe('isNight·clockText', () => {
  it('20시부터 5시 전까지가 밤', () => {
    expect(isNight(14 / 24)).toBe(true) // 20:00
    expect(isNight(0.75)).toBe(true) // 00:00
    expect(isNight(23 / 24)).toBe(false) // 05:00
    expect(isNight(0.25)).toBe(false) // 12:00
  })
  it('은지 timeText 그대로: 아이콘·일차·두 자리 시각', () => {
    expect(clockText(FIRST_MORNING)).toBe('🌅 1일차 06:00')
    expect(clockText({ t: 0.125, day: 1 })).toBe('☀️ 1일차 09:00')
    expect(clockText({ t: 8.5 / 24, day: 3 })).toBe('☀️ 3일차 14:30')
    expect(clockText({ t: 0.5, day: 3 })).toBe('🌅 3일차 18:00')
    expect(clockText({ t: 0.75, day: 7 })).toBe('🌙 7일차 00:00')
  })
})

describe('readClock', () => {
  it('맞는 값만 읽는다', () => {
    expect(readClock({ t: 0.3, day: 5 })).toEqual({ t: 0.3, day: 5 })
    for (const bad of [null, 'x', { t: 1, day: 1 }, { t: -0.1, day: 1 }, { t: 0.2, day: 0 }, { t: 0.2, day: 1.5 }, { t: 'x', day: 2 }, { t: Number.NaN, day: 2 }]) {
      expect(readClock(bad)).toBeNull()
    }
  })
})

describe('방 시계', () => {
  const rc = { epoch: 1_000_000, day0: 1 }
  it('저장 없이 지난 시간으로 계산한다', () => {
    expect(roomTime(rc, rc.epoch)).toEqual({ tm: 0, day: 1 })
    expect(roomTime(rc, rc.epoch + 100_000)).toEqual({ tm: 100, day: 1 })
    expect(roomTime(rc, rc.epoch + (DAY_LENGTH * 2 + 30.25) * 1000)).toEqual({ tm: 30.2, day: 3 })
  })
  it('기준점보다 이른 시각이면 기준점 그대로', () => {
    expect(roomTime(rc, rc.epoch - 5000)).toEqual({ tm: 0, day: 1 })
  })
  it('아침: 지금이 다음 날 06:00 가 된다', () => {
    const now = rc.epoch + (DAY_LENGTH + 200) * 1000
    const next = roomMorning(rc, now)
    expect(next).toEqual({ epoch: now, day0: 3 })
    expect(roomTime(next, now + 1000)).toEqual({ tm: 1, day: 3 })
  })
  it('받은 시각에서 내 시계로 이어 간다 (탭을 숨겼다 와도)', () => {
    const a = { tm: 240, day: 2, at: 50 }
    expect(anchoredClock(a, 50)).toEqual({ t: 0.5, day: 2 })
    const later = anchoredClock(a, 50 + 240 + 48)
    expect(later.day).toBe(3)
    expect(later.t).toBeCloseTo(0.1)
    expect(toClockTime({ t: 0.5, day: 2 })).toEqual({ tm: 240, day: 2 })
  })
})
```

`src/game/logic/restSeq.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { seqEnd, seqOpacity, seqSwitchAt } from './restSeq'

describe('잠·죽음 화면 어두워지기', () => {
  it('혼자 잠: 1초 어두워지고 0.4초 머문 뒤 1초 밝아진다', () => {
    expect(seqSwitchAt('sleep')).toBe(1)
    expect(seqEnd('sleep')).toBeCloseTo(2.4)
    expect(seqOpacity('sleep', 0.5)).toBeCloseTo(0.5)
    expect(seqOpacity('sleep', 1.2)).toBe(1)
    expect(seqOpacity('sleep', 1.9)).toBeCloseTo(0.5)
    expect(seqOpacity('sleep', 3)).toBe(0)
  })
  it('죽음: 1.6초 어두워지고 1.4초 머문다 (스펙: 3초쯤 뒤 깨어남)', () => {
    expect(seqSwitchAt('death')).toBe(1.6)
    expect(seqOpacity('death', 2.9)).toBe(1)
    expect(seqEnd('death')).toBeCloseTo(4)
  })
  it('시작 전엔 0', () => {
    expect(seqOpacity('morning', 0)).toBe(0)
    expect(seqOpacity('morning', -1)).toBe(0)
  })
})
```

- [ ] **Step 2: 실행해 실패 확인**

Run: `npx vitest run src/game/logic/dayClock.test.ts src/game/logic/restSeq.test.ts`
Expected: FAIL — `Failed to resolve import "./dayClock"` / `"./restSeq"` (그리고 `DAY_LENGTH` 가 없다)

- [ ] **Step 3: 상수 추가** — `src/game/data/balance.ts` 맨 끝에 붙인다:

```ts
/** 게임 하루 길이(초). 은지 daynight.js DAY_LENGTH 와 같다. 하루 진행도 t 0 = 06:00, 0.5 = 18:00 */
export const DAY_LENGTH = 480

/**
 * 잠·죽음·방 아침 때 화면이 어두워졌다 밝아지는 시간(초, 은지 updateSeq 그대로).
 * fade 동안 어두워지고 다 어두워진 순간 상태를 바꾼 뒤, hold 만큼 머물고 out 동안 밝아진다
 */
export const REST_FADE = {
  sleep: { fade: 1, hold: 0.4 },
  death: { fade: 1.6, hold: 1.4 },
  morning: { fade: 0.5, hold: 0.4 },
  out: 1,
}
```

- [ ] **Step 4: 구현** — `src/game/logic/dayClock.ts`

```ts
import { DAY_LENGTH } from '../data/balance'

/** 하루 진행도 t (0 이상 1 미만, 0 = 06:00, 0.5 = 18:00) 와 날짜 (1일차부터) */
export type Clock = { t: number; day: number }
export const FIRST_MORNING: Clock = { t: 0, day: 1 }

/** dt초 흐른 시계. 06:00 를 지나면 다음 날 */
export function advanceClock(c: Clock, dt: number): Clock {
  const t = c.t + Math.max(0, dt) / DAY_LENGTH
  const days = Math.floor(t)
  return { t: t - days, day: c.day + days }
}

/** 다음 날 06:00 (잠·혼자 죽음) */
export function nextMorning(c: Clock): Clock {
  return { t: 0, day: c.day + 1 }
}

/** 시각 (0 이상 24 미만) */
export function clockHour(t: number): number {
  return (6 + t * 24) % 24
}

/** 밤: 20시부터 5시 전까지 (은지 daynight.js night) */
export function isNight(t: number): boolean {
  const h = clockHour(t)
  return h >= 20 || h < 5
}

/** HUD 글자 "☀️ 3일차 14:20" (은지 timeText). 밤 🌙, 해가 높으면 ☀️, 낮게 뜨거나 지는 중이면 🌅 */
export function clockText(c: Clock): string {
  const h = clockHour(c.t)
  const hh = Math.floor(h)
  const mm = Math.floor((h - hh) * 60)
  const icon = isNight(c.t) ? '🌙' : Math.sin(c.t * Math.PI * 2) > 0.45 ? '☀️' : '🌅'
  return `${icon} ${c.day}일차 ${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`
}

/** 저장본의 시계. 모양이 틀리면 null */
export function readClock(v: unknown): Clock | null {
  if (typeof v !== 'object' || v === null) return null
  const { t, day } = v as Record<string, unknown>
  if (typeof t !== 'number' || !Number.isFinite(t) || t < 0 || t >= 1) return null
  if (typeof day !== 'number' || !Number.isInteger(day) || day < 1) return null
  return { t, day }
}

// --- 같이 하기: 방(서버) 시계 ---

/** 서버가 보내는 시각: tm = 하루 안에서 지난 초 (0 이상 DAY_LENGTH 미만), day = 날짜 */
export type ClockTime = { tm: number; day: number }

/** 방 저장소에 두는 시계 기준점: epoch(ms) 때가 day0 일차 06:00. 시각은 저장하지 않고 계산한다 */
export type RoomClock = { epoch: number; day0: number }

export function newRoomClock(nowMs: number): RoomClock {
  return { epoch: nowMs, day0: 1 }
}

/** 기준점에서 지난 시간으로 지금 날짜·시각 (틱 없이도 맞다). tm 은 0.1초 단위로 내림 */
export function roomTime(rc: RoomClock, nowMs: number): ClockTime {
  const elapsed = Math.max(0, (nowMs - rc.epoch) / 1000)
  const days = Math.floor(elapsed / DAY_LENGTH)
  return { tm: Math.floor((elapsed - days * DAY_LENGTH) * 10) / 10, day: rc.day0 + days }
}

/** 잠 투표가 이기면: 지금이 다음 날 06:00 이 되게 기준점을 옮긴다 */
export function roomMorning(rc: RoomClock, nowMs: number): RoomClock {
  return { epoch: nowMs, day0: roomTime(rc, nowMs).day + 1 }
}

/** 받은 방 시각과 받은 때(내 시계, 초). 그 뒤로는 내 시계로 센다 */
export type ClockAnchor = ClockTime & { at: number }

/** 기준점에서 지금(nowSec) 시계. 탭을 숨겼다 와도 지난 시간만큼 맞게 간다 */
export function anchoredClock(a: ClockAnchor, nowSec: number): Clock {
  return advanceClock({ t: a.tm / DAY_LENGTH, day: a.day }, nowSec - a.at)
}

/** 내 시계 → 방 시각 모양 */
export function toClockTime(c: Clock): ClockTime {
  return { tm: c.t * DAY_LENGTH, day: c.day }
}
```

`src/game/logic/restSeq.ts`:

```ts
import { REST_FADE } from '../data/balance'

/** 화면이 어두워지는 일: 혼자 잠, 죽음(침대에서 깨어남), 같이 하는 방의 아침 */
export type SeqKind = 'sleep' | 'death' | 'morning'

/** 화면이 다 어두워져 상태를 바꾸는 때(시작부터 초) */
export function seqSwitchAt(kind: SeqKind): number {
  return REST_FADE[kind].fade
}

/** 다시 다 밝아져 끝나는 때(초) */
export function seqEnd(kind: SeqKind): number {
  return REST_FADE[kind].fade + REST_FADE[kind].hold + REST_FADE.out
}

/** 시작부터 t초 때 검은 화면 불투명도 (0~1) */
export function seqOpacity(kind: SeqKind, t: number): number {
  const { fade, hold } = REST_FADE[kind]
  if (t <= 0) return 0
  if (t < fade) return t / fade
  if (t < fade + hold) return 1
  return Math.max(0, 1 - (t - fade - hold) / REST_FADE.out)
}
```

- [ ] **Step 5: 실행해 통과 확인**

Run: `npx vitest run src/game/logic/dayClock.test.ts src/game/logic/restSeq.test.ts && npx tsc -b`
Expected: PASS (14 tests), tsc 출력 없음. 전체는 `npx vitest run` 으로 55 파일 / 539 개

- [ ] **Step 6: 커밋**

```bash
git add src/game/data/balance.ts src/game/logic/dayClock.ts src/game/logic/dayClock.test.ts src/game/logic/restSeq.ts src/game/logic/restSeq.test.ts
git commit -m "feat: 하루 시계와 화면 어두워지기 시간표" -m "은지 DayNight 와 같은 하루 480초 시계(t 0 = 06:00), 밤 판정, HUD 시각 글자를 순수 함수로 둔다.
방 시계는 기준점(epoch, day0)에서 지난 시간으로 계산해 서버가 시각을 저장하지 않아도 맞고, 클라이언트는 받은 시각 + 내 시계로 이어 간다.
잠·죽음·방 아침 페이드 시간은 은지 updateSeq 그대로."
```

---

### Task 2: 배고픔·죽음 규칙과 저장 (v3)

**Files:**
- Modify: `src/game/data/balance.ts` (`STAMINA.passiveRegenPerSecond` → `fedRegenPerSecond`·`sleepRegenPerSecond`, `HUNGER` 추가)
- Modify: `src/game/logic/stamina.ts` (`Survival.hunger`, `tickSurvival`·`SurvivalTickContext` 를 survival.ts 로 옮김)
- Create: `src/game/logic/survival.ts`
- Modify: `src/game/data/snacks.ts`, `src/game/data/dishes.ts`, `src/game/logic/snacks.ts`, `src/game/logic/cooking.ts`
- Modify: `src/game/stores/progressStore.ts`
- Test: `src/game/logic/survival.test.ts` (새로), `src/game/logic/stamina.test.ts`, `src/game/logic/snacks.test.ts`, `src/game/logic/cooking.test.ts`, `src/game/stores/progressStore.test.ts`

**Interfaces:**
- Consumes: `Clock`, `FIRST_MORNING`, `readClock` (Task 1)
- Produces:
  - `Survival = { stamina: number; hunger: number; graceLeft: number | null; buffs: Buff[] }`, `FRESH_SURVIVAL` (hunger 100) (`logic/stamina.ts`)
  - `HUNGER = { max: 100, perSecond: 100/720, starvePerSecond: 1.5, regenAbove: 60, sleepCost: 15, sleepFloor: 10, afterDeath: 60 }`, `STAMINA.fedRegenPerSecond` (0.8), `STAMINA.sleepRegenPerSecond` (3) (`data/balance.ts`)
  - `type SurvivalTickContext = { fighting: boolean; resting: boolean; exploring?: boolean; sleeping?: boolean }`, `tickSurvival(s, dt, ctx): { survival; fainted: boolean; died: boolean }`, `takeDamage(s, amount): { survival; died }`, `eatFood(s, heal, hunger): Survival`, `isStarving(s): boolean`, `afterSleep(s): Survival`, `afterDeath(): Survival` (`logic/survival.ts`)
  - `SnackDef.hunger: number`, `DISH_HUNGER: Record<DishCategory, number>`
  - progressStore: `clock: Clock` 필드, `tick(seconds, ctx, clock?: Clock | null): { fainted: boolean; died: boolean; aquarium: AquariumEvent[] }`, `sleepWell(clock: Clock | null): void`, `reviveAtBed(clock: Clock | null): void`, persist version 3

- [ ] **Step 1: 실패하는 테스트 쓰기**

`src/game/logic/survival.test.ts` (새 파일):

```ts
import { describe, expect, it } from 'vitest'
import { HUNGER, STAMINA } from '../data/balance'
import { FRESH_SURVIVAL, isWeak, spendStamina, type Survival } from './stamina'
import { afterDeath, afterSleep, eatFood, isStarving, takeDamage, tickSurvival } from './survival'

const at = (stamina: number, hunger = 100, graceLeft: number | null = null): Survival => ({ stamina, hunger, graceLeft, buffs: [] })
const idle = { fighting: false, resting: false }
const walking = { fighting: false, resting: false, exploring: true }

describe('밸런스', () => {
  it('은지 그대로: 12분에 100 → 0, 굶으면 초당 1.5, 배부르면(60 초과) 초당 0.8, 자는 동안 초당 3', () => {
    expect(HUNGER.perSecond * 720).toBeCloseTo(100)
    expect(HUNGER).toMatchObject({ max: 100, starvePerSecond: 1.5, regenAbove: 60, sleepCost: 15, sleepFloor: 10, afterDeath: 60 })
    expect(STAMINA).toMatchObject({ castCost: 2, fightCostPerSecond: 0.6, benchRegenPerSecond: 6, fedRegenPerSecond: 0.8, sleepRegenPerSecond: 3 })
  })
})

describe('tickSurvival', () => {
  it('배고픔은 언제나 줄고 0 아래로 내려가지 않는다', () => {
    expect(tickSurvival(at(50, 100), 72, idle).survival.hunger).toBeCloseTo(90)
    expect(tickSurvival(at(50, 0.5), 72, idle).survival.hunger).toBe(0)
  })

  it('줄다리기 중이면 체력이 줄고, 벤치에서 쉬면 회복한다', () => {
    expect(tickSurvival(at(50, 50), 2, { fighting: true, resting: false }).survival.stamina).toBeCloseTo(50 - STAMINA.fightCostPerSecond * 2)
    expect(tickSurvival(at(50, 50), 2, { fighting: false, resting: true }).survival.stamina).toBeCloseTo(50 + STAMINA.benchRegenPerSecond * 2)
  })

  it('돌아다닐 때 배고픔이 60 넘으면 초당 0.8 회복, 60 이하면 회복 없음', () => {
    expect(tickSurvival(at(50, 90), 10, walking).survival.stamina).toBeCloseTo(58)
    expect(tickSurvival(at(50, 60), 10, walking).survival.stamina).toBe(50)
    expect(tickSurvival(at(50, 90), 10, idle).survival.stamina).toBe(50)
  })

  it('저절로 회복은 약화(체력 0)를 풀지 않는다', () => {
    const weak = tickSurvival(at(0, 90, 100), 10, walking).survival
    expect(weak.stamina).toBe(0)
    expect(isWeak(weak)).toBe(true)
  })

  it('자는 동안(같이 하기 잠 투표) 초당 3 회복', () => {
    expect(tickSurvival(at(40, 50), 10, { ...idle, sleeping: true }).survival.stamina).toBeCloseTo(70)
  })

  it('배고픔 0 이면 체력이 초당 1.5 줄고, 약화 유예는 시작하지 않는다', () => {
    const r = tickSurvival(at(30, 0), 10, idle)
    expect(r.survival.stamina).toBeCloseTo(15)
    expect(r.survival.graceLeft).toBeNull()
    expect(r).toMatchObject({ fainted: false, died: false })
  })

  it('배고픔 0 인 채로 체력 0 이면 죽음 (쓰러짐이 아니다)', () => {
    const r = tickSurvival(at(1, 0), 1, idle)
    expect(r).toMatchObject({ fainted: false, died: true })
    expect(r.survival.stamina).toBe(0)
  })

  it('낚시로 지쳐(약화) 있는 동안 배고픔이 0 이 되면 죽음', () => {
    expect(tickSurvival(at(0, 0.1, 100), 1, idle)).toMatchObject({ died: true, fainted: false })
  })

  it('배가 차 있으면 체력 0 은 약화: 유예가 끝나면 쓰러진다 (진료소)', () => {
    expect(tickSurvival(at(0, 50, 1.5), 1, idle)).toEqual({ survival: at(0, 50 - HUNGER.perSecond, 0.5), fainted: false, died: false })
    expect(tickSurvival(at(0, 50, 0.5), 1, idle)).toMatchObject({ fainted: true, died: false })
  })

  it('줄다리기로 체력이 0 이 되면 약화가 시작된다 (배가 차 있을 때)', () => {
    const r = tickSurvival(at(0.5, 50), 1, { fighting: true, resting: false })
    expect(r.survival.stamina).toBe(0)
    expect(r.survival.graceLeft).toBeCloseTo(STAMINA.graceSeconds - 1)
    expect(r.died).toBe(false)
  })

  it('약화 중에 벤치에서 쉬면 쓰러지지 않고 정상으로 돌아온다', () => {
    const r = tickSurvival(at(0, 50, 0.5), 1, { fighting: false, resting: true })
    expect(r.fainted).toBe(false)
    expect(isWeak(r.survival)).toBe(false)
  })

  it('버프 남은 시간이 줄고, 다 되면 사라진다', () => {
    const s: Survival = { ...FRESH_SURVIVAL, buffs: [{ kind: 'reel', mul: 1.3, remaining: 1.5 }] }
    const once = tickSurvival(s, 1, idle).survival
    expect(once.buffs[0].remaining).toBeCloseTo(0.5)
    expect(tickSurvival(once, 1, idle).survival.buffs).toEqual([])
  })
})

describe('죽음 판정 (피해)', () => {
  it('동물·PvP 피해로 체력 0 이면 배가 차 있어도 바로 죽음', () => {
    expect(takeDamage(at(10, 100), 15)).toEqual({ survival: at(0, 100), died: true })
    expect(takeDamage(at(30, 100), 15)).toEqual({ survival: at(15, 100), died: false })
  })
})

describe('먹기·잠·깨어나기', () => {
  it('먹으면 체력과 배고픔이 차고(최대 100) 약화가 풀린다', () => {
    expect(eatFood(at(0, 95, 30), 25, 30)).toEqual(at(25, 100))
  })
  it('배고픔 0 이면 굶는 중', () => {
    expect(isStarving(at(50, 0))).toBe(true)
    expect(isStarving(at(50, 1))).toBe(false)
  })
  it('자고 나면 체력 100, 배고픔 −15 (최소 10). 버프는 남는다', () => {
    const buffs = [{ kind: 'reel' as const, mul: 1.3, remaining: 50 }]
    expect(afterSleep({ stamina: 20, hunger: 50, graceLeft: null, buffs })).toEqual({ stamina: 100, hunger: 35, graceLeft: null, buffs })
    expect(afterSleep(at(20, 20)).hunger).toBe(10)
  })
  it('죽었다 깨어나면 체력 100, 배고픔 60', () => {
    expect(afterDeath()).toEqual(at(100, 60))
  })
  it('spendStamina 는 배고픔을 건드리지 않는다', () => {
    expect(spendStamina(at(10, 40), 3).hunger).toBe(40)
  })
})
```

`src/game/logic/stamina.test.ts` — 틱 테스트는 survival.test.ts 로 옮겼으니 지운다:
- import 목록에서 `tickSurvival,` 줄을 지운다.
- 도우미 두 줄을 아래 한 줄로 바꾼다 (`rest` 는 지운다):

```ts
const at = (stamina: number, graceLeft: number | null = null): Survival => ({ stamina, hunger: 100, graceLeft, buffs: [] })
```

- `describe('tickSurvival', () => { … })` 블록 전체(6개 it)를 지운다.
- `describe('fightMods')` 의 `'버프와 약화가 곱해진다'` 안 `const s: Survival = { stamina: 0, graceLeft: 10, …` 에 `hunger: 50,` 을 `stamina: 0,` 다음 줄에 넣는다.

`src/game/logic/snacks.test.ts` — `it('사서 바로 먹으면` 바로 앞에 넣는다:

```ts
  it('배고픔: 김밥 +30, 컵라면 +50, 에너지 음료 +10 (최대 100)', () => {
    expect(SNACKS.map((s) => [s.id, s.hunger])).toEqual([
      ['gimbap', 30],
      ['ramen', 50],
      ['energy', 10],
    ])
    const r = buyAndEatSnack(30, NO_SNACKS, { ...tired, hunger: 20 }, 'ramen')
    if (r.ok) expect(r.survival.hunger).toBe(70)
    const full = eatSnackFromBag(0, { ...NO_SNACKS, gimbap: 1 }, { ...tired, hunger: 90 }, 'gimbap')
    if (full.ok) expect(full.survival.hunger).toBe(100)
  })
```

`src/game/logic/cooking.test.ts`:
- `const hungry: Survival = { stamina: 10, graceLeft: null, buffs: [] }` → `const hungry: Survival = { stamina: 10, hunger: 30, graceLeft: null, buffs: [] }`
- `'조리비를 내고 회복과 버프를 얻는다'` 의 기대값 `survival: { stamina: 50, graceLeft: null, buffs: [...] }` → `survival: { stamina: 50, hunger: 90, graceLeft: null, buffs: [{ kind: 'tension', mul: 0.75, remaining: 90 }] }`
- `cook(10, { stamina: 0, graceLeft: 20, buffs: [] }, …)` → `cook(10, { stamina: 0, hunger: 50, graceLeft: 20, buffs: [] }, …)`
- `describe('찜 메뉴와 재료'` 바로 앞에 넣는다:

```ts
describe('요리와 배고픔', () => {
  it('찜·회·탕은 배고픔 +60, 비밀 메뉴는 +100 (최대 100)', () => {
    const steam = cook(100, { ...hungry, hunger: 10 }, getDish('fishSteam'), 'common')
    expect(steam.ok && steam.survival.hunger).toBe(70)
    const secret = cook(100, { ...hungry, hunger: 0 }, getDish('xxlSteam'), 'rare')
    expect(secret.ok && secret.survival.hunger).toBe(100)
  })
})
```

`src/game/stores/progressStore.test.ts`:
- import 를 `import { AQUARIUM, HUNGER, STAMINA } from '../data/balance'` 로 바꾸고, `import { EMPTY_AQUARIUM } from '../logic/aquarium'` 다음 줄에 `import { FIRST_MORNING } from '../logic/dayClock'`.
- `survival: { stamina: …, graceLeft: …, buffs: [] }` 를 직접 쓰는 네 곳에 `hunger` 를 넣는다: 요리 테스트 `{ stamina: 30, hunger: 100, … }`, 쓰러짐 테스트 `{ stamina: 0, hunger: 50, graceLeft: 0.5, … }`, 간식 테스트 `{ stamina: 10, hunger: 100, … }`, 찜 테스트 `{ stamina: 10, hunger: 100, … }`.
- 쓰러짐 테스트(`'쓰러지면 보관함을 잃고 …'`) 마지막 `expect(store().survival.stamina).toBe(STAMINA.max)` 다음 줄에: `expect(store().survival.hunger).toBeCloseTo(50 - HUNGER.perSecond)` (쓰러져도 배고픔은 그대로).
- `'깨진 체력·어항 필드는 걸러 내고 …'` 의 기대값을 `expect(store().survival).toEqual({ stamina: STAMINA.max, hunger: 100, graceLeft: null, buffs: [{ kind: 'reel', mul: 1.3, remaining: 10 }] })` 로.
- 파일 맨 끝 `})` (describe 닫기) 바로 앞에 넣는다:

```ts
  it('배고픔 0 인 채로 체력이 다 떨어지면 died (가방·코인·물고기는 그대로, 깨우는 건 reviveAtBed)', () => {
    store().addCatch('sleepy-sardine', 0.2)
    useProgressStore.setState({ coins: 50, survival: { stamina: 1, hunger: 0, graceLeft: null, buffs: [] } })
    const events = store().tick(1, { fighting: false, resting: false })
    expect(events).toMatchObject({ fainted: false, died: true })
    expect(store().coins).toBe(50)
    expect(store().inventory).toHaveLength(1)
    store().reviveAtBed({ t: 0, day: 4 })
    expect(store().survival).toEqual({ stamina: STAMINA.max, hunger: 60, graceLeft: null, buffs: [] })
    expect(store().clock).toEqual({ t: 0, day: 4 })
    expect(store().inventory).toHaveLength(1)
  })

  it('같이 하는 중(시계 null)엔 저장된 혼자 시계를 건드리지 않는다', () => {
    useProgressStore.setState({ clock: { t: 0.3, day: 2 } })
    store().tick(1, { fighting: false, resting: false }, null)
    store().reviveAtBed(null)
    store().sleepWell(null)
    expect(store().clock).toEqual({ t: 0.3, day: 2 })
    store().tick(1, { fighting: false, resting: false }, { t: 0.4, day: 2 })
    expect(store().clock).toEqual({ t: 0.4, day: 2 })
  })

  it('자고 나면 체력 가득, 배고픔 −15 (최소 10), 혼자면 시계도', () => {
    useProgressStore.setState({ survival: { stamina: 20, hunger: 50, graceLeft: null, buffs: [] } })
    store().sleepWell({ t: 0, day: 3 })
    expect(store().survival).toMatchObject({ stamina: STAMINA.max, hunger: 35 })
    expect(store().clock).toEqual({ t: 0, day: 3 })
  })

  it('배고픔·시계가 없는 예전 저장본(version 2)은 배고픔 100, 1일차 06:00 로 연다', async () => {
    localStorage.setItem(SAVE_KEY, JSON.stringify({ state: { coins: 4, survival: { stamina: 40, graceLeft: null, buffs: [] } }, version: 2 }))
    await useProgressStore.persist.rehydrate()
    expect(store().coins).toBe(4)
    expect(store().survival).toEqual({ stamina: 40, hunger: 100, graceLeft: null, buffs: [] })
    expect(store().clock).toEqual(FIRST_MORNING)
  })

  it('깨진 배고픔·시계는 기본값으로, 맞는 값은 살린다', async () => {
    localStorage.setItem(SAVE_KEY, JSON.stringify({ state: { survival: { stamina: 40, hunger: 130 }, clock: { t: 1.5, day: 3 } }, version: 3 }))
    await useProgressStore.persist.rehydrate()
    expect(store().survival.hunger).toBe(100)
    expect(store().clock).toEqual(FIRST_MORNING)
    localStorage.setItem(SAVE_KEY, JSON.stringify({ state: { survival: { stamina: 40, hunger: 12.5 }, clock: { t: 0.6, day: 9 } }, version: 3 }))
    await useProgressStore.persist.rehydrate()
    expect(store().survival.hunger).toBe(12.5)
    expect(store().clock).toEqual({ t: 0.6, day: 9 })
  })
```

- [ ] **Step 2: 실행해 실패 확인**

Run: `npx vitest run src/game/logic/survival.test.ts src/game/logic/snacks.test.ts src/game/logic/cooking.test.ts src/game/stores/progressStore.test.ts`
Expected: FAIL — `Failed to resolve import "./survival"`, 그리고 snacks·cooking·progressStore 의 배고픔 기대값(`hunger` 가 undefined)과 `store().clock`·`reviveAtBed` 가 없어 실패

- [ ] **Step 3: 밸런스** — `src/game/data/balance.ts` 의 `STAMINA` 안 `passiveRegenPerSecond` 주석부터 `STAMINA` 를 닫는 `}` 까지를 아래로 바꾼다 (새 블록에 `lowHint` 도 그대로 들어 있고, 닫는 `}` 뒤에 `HUNGER` 가 붙는다):

```ts
  /**
   * 낚시하지 않고 돌아다니는 동안(탐험 모드) 배가 부르면(배고픔 HUNGER.regenAbove 초과) 초당 저절로 회복하는 양 (은지 REGEN).
   * 약화(체력 0) 중엔 회복하지 않는다 — 음식이나 벤치가 필요하다
   */
  fedRegenPerSecond: 0.8,
  /** 같이 하기에서 침대에 누워 아침을 기다리는 동안 초당 회복량 (은지 그대로) */
  sleepRegenPerSecond: 3,
  /** 체력이 이보다 낮으면 HUD 에 "음식을 사 먹거나 벤치에서 쉬세요" 안내를 띄운다 */
  lowHint: 30,
}

/** 배고픔 (은지 vitals.js). 100 에서 12분에 0 */
export const HUNGER = {
  max: 100,
  /** 초당 줄어드는 양 */
  perSecond: 100 / 720,
  /** 배고픔 0 일 때 초당 잃는 체력 */
  starvePerSecond: 1.5,
  /** 배고픔이 이보다 높아야 저절로 회복한다 */
  regenAbove: 60,
  /** 자고 일어나면 이만큼 줄고, 이보다 낮아지지는 않는다 */
  sleepCost: 15,
  sleepFloor: 10,
  /** 죽었다 침대에서 깨어나면 이 값 */
  afterDeath: 60,
}
```

- [ ] **Step 4: 체력 상태에 배고픔** — `src/game/logic/stamina.ts`
- 첫 줄: `import { FAINT_COIN_PENALTY, HUNGER, STAMINA } from '../data/balance'`
- `Survival` 타입과 `FRESH_SURVIVAL`:

```ts
/** 체력, 배고픔, 약화 유예 시간, 요리 버프. 저장되는 상태다 */
export type Survival = {
  stamina: number
  /** 배고픔 0~100 (100 = 배부름). 0 이면 체력이 준다 (logic/survival) */
  hunger: number
  /** 체력 0 이후 쓰러지기까지 남은 시간(초). 약화 상태가 아니면 null */
  graceLeft: number | null
  buffs: Buff[]
}

export const FRESH_SURVIVAL: Survival = { stamina: STAMINA.max, hunger: HUNGER.max, graceLeft: null, buffs: [] }
```

- `/** exploring: 낚시·패널 없이 돌아다니는 중 … */` 부터 `tickSurvival` 함수 끝까지(타입 `SurvivalTickContext` 와 함수) 지운다 — survival.ts 로 옮긴다. `healStamina`·`spendStamina`·`addBuff`·`fightMods`·`faintPenalty` 는 그대로.

- [ ] **Step 5: 배고픔·죽음 규칙** — `src/game/logic/survival.ts`

```ts
import { HUNGER, STAMINA } from '../data/balance'
import { healStamina, spendStamina, type Survival } from './stamina'

/**
 * fighting: 줄다리기 중, resting: 벤치에 앉아 쉬는 중, exploring: 낚시·패널 없이 돌아다니는 중 (배부르면 저절로 회복),
 * sleeping: 같이 하기에서 침대에 누워 아침을 기다리는 중
 */
export type SurvivalTickContext = { fighting: boolean; resting: boolean; exploring?: boolean; sleeping?: boolean }

/** fainted: 약화 유예가 끝나 쓰러짐 (진료소), died: 굶어 죽음 (침대) */
export type SurvivalTick = { survival: Survival; fainted: boolean; died: boolean }

/** 배고픔 0 으로 체력이 준다. 낚시와 달리 약화 유예를 시작하지 않는다 (굶주림은 이미 경고가 떠 있다) */
function starve(s: Survival, amount: number): Survival {
  return { ...s, stamina: Math.max(0, s.stamina - amount) }
}

/**
 * dt초만큼 시간을 진행한다. 배고픔이 줄고, 0 이면 체력이 준다.
 * 체력이 0 인데 배고픔도 0 이면 죽음(침대). 배가 차 있는데 약화 유예가 끝나면 쓰러짐(진료소)
 */
export function tickSurvival(s: Survival, dt: number, ctx: SurvivalTickContext): SurvivalTick {
  const buffs = s.buffs.map((b) => ({ ...b, remaining: b.remaining - dt })).filter((b) => b.remaining > 0)
  let next: Survival = { ...s, buffs, hunger: Math.max(0, s.hunger - HUNGER.perSecond * dt) }
  if (ctx.fighting) next = spendStamina(next, STAMINA.fightCostPerSecond * dt)
  if (ctx.resting) next = healStamina(next, STAMINA.benchRegenPerSecond * dt)
  if (ctx.sleeping) next = healStamina(next, STAMINA.sleepRegenPerSecond * dt)
  // 저절로 회복은 배가 부를 때만, 약화를 풀지 않는다 (체력 0 이 되면 음식이나 벤치로 회복해야 한다)
  if (ctx.exploring && next.graceLeft === null && next.hunger > HUNGER.regenAbove) next = healStamina(next, STAMINA.fedRegenPerSecond * dt)
  if (next.hunger <= 0) next = starve(next, HUNGER.starvePerSecond * dt)
  if (next.stamina <= 0 && next.hunger <= 0) return { survival: { ...next, stamina: 0, graceLeft: null }, fainted: false, died: true }
  if (next.graceLeft === null) return { survival: next, fainted: false, died: false }

  const graceLeft = next.graceLeft - dt
  if (graceLeft <= 0) return { survival: { ...next, graceLeft: 0 }, fainted: true, died: false }
  return { survival: { ...next, graceLeft }, fainted: false, died: false }
}

/** 동물·PvP 피해 (3-3·3-4 에서 쓴다). 체력이 0 이 되면 약화 없이 바로 죽음 */
export function takeDamage(s: Survival, amount: number): { survival: Survival; died: boolean } {
  const stamina = Math.max(0, s.stamina - Math.max(0, amount))
  return { survival: { ...s, stamina }, died: stamina === 0 }
}

/** 먹기: 체력(약화도 풀린다)과 배고픔이 찬다 */
export function eatFood(s: Survival, heal: number, hunger: number): Survival {
  const healed = healStamina(s, heal)
  return { ...healed, hunger: Math.min(HUNGER.max, healed.hunger + Math.max(0, hunger)) }
}

/** 배고픔 0: "배고파요" 경고를 띄운다 */
export function isStarving(s: Survival): boolean {
  return s.hunger <= 0
}

/** 자고 일어나면: 체력 가득, 배고픔 15 줄고 (10 아래로는 안 내려간다) */
export function afterSleep(s: Survival): Survival {
  return { ...s, stamina: STAMINA.max, hunger: Math.max(HUNGER.sleepFloor, s.hunger - HUNGER.sleepCost), graceLeft: null }
}

/** 죽었다 침대에서 깨어나면: 체력 가득, 배고픔 60, 약화·버프 없음 */
export function afterDeath(): Survival {
  return { stamina: STAMINA.max, hunger: HUNGER.afterDeath, graceLeft: null, buffs: [] }
}
```

- [ ] **Step 6: 음식 → 배고픔**

`src/game/data/snacks.ts` — `SnackDef` 의 `heal` 다음에 필드를 더하고 세 간식에 값을 넣는다:

```ts
  /** 먹으면 바로 오르는 체력 */
  heal: number
  /** 먹으면 차는 배고픔 */
  hunger: number
}
```

```ts
  { id: 'gimbap', name: '김밥', description: '든든한 한 줄', price: 10, heal: 25, hunger: 30 },
  { id: 'ramen', name: '컵라면', description: '뜨끈한 국물이 최고', price: 20, heal: 45, hunger: 50 },
  { id: 'energy', name: '에너지 음료', description: '한 캔이면 기운이 번쩍', price: 35, heal: 70, hunger: 10 },
```

`src/game/data/dishes.ts` — `export const BUFF_LABEL` 바로 앞에:

```ts
/** 요리를 먹으면 차는 배고픔: 찜·회·탕 60, 비밀 메뉴 100 */
export const DISH_HUNGER: Record<DishCategory, number> = { steam: 60, raw: 60, secret: 100 }
```

`src/game/logic/snacks.ts` — `import { healStamina, type Survival } from './stamina'` 를

```ts
import type { Survival } from './stamina'
import { eatFood } from './survival'
```

로 바꾸고, 두 먹기 함수의 반환을:

```ts
  return { ok: true, coins: coins - snack.price, snacks, survival: eatFood(survival, snack.heal, snack.hunger) }
```

```ts
  const snack = getSnack(id)
  return { ok: true, coins, snacks: { ...snacks, [id]: snacks[id] - 1 }, survival: eatFood(survival, snack.heal, snack.hunger) }
```

`src/game/logic/cooking.ts` — import 두 줄과 `cook` 의 첫 회복 줄:

```ts
import { DISH_HUNGER, type DishDef } from '../data/dishes'
```

```ts
import { addBuff, type Survival } from './stamina'
import { eatFood } from './survival'
```

```ts
  let next = eatFood(survival, effect.heal, DISH_HUNGER[dish.category])
```

- [ ] **Step 7: 저장 v3** — `src/game/stores/progressStore.ts`

import:

```ts
import { AQUARIUM, HUNGER, STAMINA } from '../data/balance'
```

```ts
import { FIRST_MORNING, readClock, type Clock } from '../logic/dayClock'
import { FRESH_SURVIVAL, faintPenalty, spendStamina, type Survival } from '../logic/stamina'
import { afterDeath, afterSleep, tickSurvival, type SurvivalTickContext } from '../logic/survival'
```

`ProgressData` 끝(`snacks: SnackCounts` 다음)에:

```ts
  /** 혼자 할 때 시계 (다시 들어오면 이어서). 같이 하는 동안엔 방 시계를 따르고 이 값은 건드리지 않는다 */
  clock: Clock
```

(`survival` 주석은 `/** 체력, 배고픔, 약화 유예 시간, 요리 버프 */` 로.)

`TickEvents` 와 액션 타입:

```ts
/** fainted: 지쳐 쓰러짐 (진료소), died: 굶어 죽음 (침대 — 깨우는 건 dayActions 가 화면이 어두워진 뒤 reviveAtBed 로) */
export type TickEvents = { fainted: boolean; died: boolean; aquarium: AquariumEvent[] }

// ProgressActions 안: tick 을 바꾸고 두 액션을 더한다
  /** 1초 안팎마다 호출. 플레이 시간·체력·배고픔·어항 시간을 함께 진행하고 생긴 일을 돌려준다. clock: 혼자 할 때 지금 시계 (같이 하는 중이면 null) */
  tick: (seconds: number, ctx: SurvivalTickContext, clock?: Clock | null) => TickEvents
  /** 자고 일어났다: 체력 가득, 배고픔 −15. clock 이 있으면(혼자) 그 시계로 */
  sleepWell: (clock: Clock | null) => void
  /** 죽었다 침대에서 깨어났다: 체력 가득, 배고픔 60. 가방·코인·물고기는 그대로. clock 이 있으면(혼자) 그 시계로 */
  reviveAtBed: (clock: Clock | null) => void
```

`INITIAL_PROGRESS` 끝(`snacks: NO_SNACKS,` 다음)에 `clock: FIRST_MORNING,`.

`readSurvival` 의 마지막 세 줄:

```ts
  const hunger = isFiniteNumber(v.hunger) && v.hunger >= 0 && v.hunger <= HUNGER.max ? v.hunger : fallback.hunger
  const graceLeft = isFiniteNumber(v.graceLeft) && v.graceLeft > 0 ? v.graceLeft : null
  const buffs = Array.isArray(v.buffs) ? v.buffs.filter(isValidBuff) : fallback.buffs
  return { stamina, hunger, graceLeft, buffs }
```

`tick` 액션 전체를 아래로 바꾸고 바로 뒤에 두 액션을 더한다:

```ts
      tick: (seconds, ctx, clock = null) => {
        const s = get()
        const playTime = s.playTime + seconds
        const survivalTick = tickSurvival(s.survival, seconds, ctx)
        const aquariumTick = tickAquarium(s.aquarium, playTime, seconds)
        const time = clock ? { clock } : {}
        if (survivalTick.fainted) {
          // 쓰러짐: 팔지 않은 물고기를 잃고 진료비를 낸다. 어항·장비·도감·배고픔은 그대로
          set({
            ...time,
            playTime,
            aquarium: aquariumTick.aquarium,
            survival: { ...FRESH_SURVIVAL, hunger: survivalTick.survival.hunger },
            inventory: [],
            coins: s.coins - faintPenalty(s.coins),
          })
        } else {
          set({ ...time, playTime, aquarium: aquariumTick.aquarium, survival: survivalTick.survival })
        }
        return { fainted: survivalTick.fainted, died: survivalTick.died, aquarium: aquariumTick.events }
      },

      sleepWell: (clock) => set((s) => ({ survival: afterSleep(s.survival), ...(clock ? { clock } : {}) })),

      reviveAtBed: (clock) => set({ survival: afterDeath(), ...(clock ? { clock } : {}) }),
```

persist 옵션:

```ts
      // 2: 장비·어항이 5단계 → 10단계. 3: 배고픔(survival.hunger)·혼자 시계(clock) 추가 (필드만 늘어 옮길 것 없다)
      version: 3,
```

`merge` 의 끝(`snacks: readSnacks(…),` 다음)에 `clock: readClock(saved.clock) ?? current.clock,`.

`migrateSave` (`logic/saveMigration.ts`) 는 그대로 둔다: version 2 이상은 손대지 않고 넘기며, 새 필드는 merge 가 기본값으로 채운다.

- [ ] **Step 8: 실행해 통과 확인**

Run: `npx vitest run && npx tsc -b && npm run lint 2>&1 | grep -c warning`
Expected: PASS (56 파일 / 559 개), tsc 출력 없음, warning 6

- [ ] **Step 9: 커밋**

```bash
git add src/game/data/balance.ts src/game/data/snacks.ts src/game/data/dishes.ts src/game/logic/stamina.ts src/game/logic/stamina.test.ts src/game/logic/survival.ts src/game/logic/survival.test.ts src/game/logic/snacks.ts src/game/logic/snacks.test.ts src/game/logic/cooking.ts src/game/logic/cooking.test.ts src/game/stores/progressStore.ts src/game/stores/progressStore.test.ts
git commit -m "feat: 배고픔과 죽음 규칙" -m "체력 저장값에 배고픔(12분에 100 → 0)을 더했다. 배고픔 0 이면 체력이 초당 1.5 줄고, 그 채로 체력 0 이면 죽음(침대).
배가 차 있을 때 체력 0 은 지금처럼 약화 → 쓰러짐(진료소). 돌아다니며 저절로 회복은 배고픔 60 초과일 때 초당 0.8.
간식·요리가 배고픔을 채운다 (김밥 30, 컵라면 50, 에너지 음료 10, 찜·회·탕 60, 비밀 메뉴 100).
저장본 version 3: survival.hunger 와 혼자 시계 clock 을 더했다. 예전 저장본은 배고픔 100, 1일차 06:00 로 연다."
```

---

### Task 3: 같이 하기 메시지와 방 서버 (시계·잠 투표)

**Files:**
- Modify: `src/game/data/net.ts` (`serverSleepPerSecond`, `clockEvery`)
- Modify: `src/game/logic/netProtocol.ts`
- Modify: `server/src/roomRules.ts`, `server/src/room.ts`
- Modify: `tools/room-smoke.mjs`
- Test: `src/game/logic/netProtocol.test.ts`, `server/src/roomRules.test.ts`

**Interfaces:**
- Consumes: `DAY_LENGTH` (Task 1), `ClockTime`, `RoomClock`, `newRoomClock`, `roomTime`, `roomMorning` (Task 1)
- Produces:
  - `ClientMsg` 에 `{ type: 'sleep'; on: boolean }`
  - `ServerMsg` 에 `welcome.time?: ClockTime`, `{ type: 'time'; tm: number; day: number }`, `{ type: 'sleepers'; n: number; need: number }`, `{ type: 'morning'; day: number }`
  - `NET.serverSleepPerSecond = 4`, `NET.clockEvery = 30`
  - `Member` 에 `sleeping: boolean`, `sleepWin: RateWindow`; `memberFrom(a): Member` (붙임 정보 → 사람, 옛 붙임 정보는 안 자는 사람), `tallySleep(sleeping: boolean[]): { n: number; need: number; morning: boolean }` (`server/src/roomRules.ts`)
  - 서버 저장소 키 `clock` (`RoomClock`)

- [ ] **Step 1: 실패하는 테스트 쓰기**

`src/game/logic/netProtocol.test.ts` — `describe('roundState·stateKey', …)` 바로 앞에 넣는다:

```ts
describe('시계·잠 투표 메시지 (3-1)', () => {
  it('sleep {on} 을 읽고, on 이 참/거짓이 아니면 null', () => {
    expect(parseClientMsg(json({ type: 'sleep', on: true }))).toEqual({ type: 'sleep', on: true })
    expect(parseClientMsg(json({ type: 'sleep', on: false }))).toEqual({ type: 'sleep', on: false })
    expect(parseClientMsg(json({ type: 'sleep', on: 'yes' }))).toBeNull()
    expect(parseClientMsg(json({ type: 'sleep' }))).toBeNull()
  })
  it('welcome 의 방 시계: 맞으면 읽고, 틀리거나 없으면(옛 서버) 그 필드만 없다', () => {
    const base = { type: 'welcome', you: 'me', players: [] }
    expect(parseServerMsg(json({ ...base, time: { tm: 12.5, day: 3 } }))).toEqual({ ...base, time: { tm: 12.5, day: 3 } })
    expect(parseServerMsg(json(base))).toEqual(base)
    expect(parseServerMsg(json({ ...base, time: { tm: 480, day: 3 } }))).toEqual(base)
    expect(parseServerMsg(json({ ...base, time: { tm: 5, day: 0 } }))).toEqual(base)
  })
  it('time·sleepers·morning', () => {
    expect(parseServerMsg(json({ type: 'time', tm: 0, day: 1 }))).toEqual({ type: 'time', tm: 0, day: 1 })
    expect(parseServerMsg(json({ type: 'time', tm: -1, day: 1 }))).toBeNull()
    expect(parseServerMsg(json({ type: 'time', tm: 3, day: 2.5 }))).toBeNull()
    expect(parseServerMsg(json({ type: 'sleepers', n: 1, need: 2 }))).toEqual({ type: 'sleepers', n: 1, need: 2 })
    expect(parseServerMsg(json({ type: 'sleepers', n: 0, need: 0 }))).toBeNull()
    expect(parseServerMsg(json({ type: 'sleepers', n: 21, need: 2 }))).toBeNull()
    expect(parseServerMsg(json({ type: 'morning', day: 4 }))).toEqual({ type: 'morning', day: 4 })
    expect(parseServerMsg(json({ type: 'morning', day: 'x' }))).toBeNull()
  })
  it('아직 모르는 종류(3-3 이후 animals 등)는 버린다', () => {
    expect(parseServerMsg(json({ type: 'animals', list: [] }))).toBeNull()
  })
})
```

`server/src/roomRules.test.ts`:
- import 를 `import { handleMemberMsg, judgeHello, memberFrom, tallySleep, type Member, type RoomMeta } from './roomRules'` 로.
- `const me: Member = { … lastProfile: -Infinity }` 끝에 `, sleeping: false, sleepWin: NEW_WINDOW` 를 더한다.
- `describe('handleMemberMsg')` 의 마지막 `it('들어온 뒤 hello 는 무시', …)` 다음에 넣는다:

```ts
  it('sleep 은 잠 표시만 바꾸고 바로 나눠 주지 않는다 (room.ts 가 세서 sleepers 로). 초당 4번 넘으면 버린다', () => {
    let m = me
    const on = handleMemberMsg(m, { type: 'sleep', on: true }, 1)
    expect(on).toEqual({ member: { ...me, sleeping: true, sleepWin: { start: 1, count: 1 } }, out: null })
    m = on.member
    for (let i = 0; i < 3; i++) m = handleMemberMsg(m, { type: 'sleep', on: i % 2 === 0 ? false : true }, 1.1).member
    expect(m.sleeping).toBe(false)
    expect(handleMemberMsg(m, { type: 'sleep', on: true }, 1.2).member.sleeping).toBe(false)
    expect(handleMemberMsg(m, { type: 'sleep', on: true }, 2.1).member.sleeping).toBe(true)
  })
```

- 파일 맨 끝에 넣는다:

```ts
describe('memberFrom', () => {
  it('3-1 전 붙임 정보(잠 필드 없음)는 안 자는 사람·새 창으로 읽고, phase 같은 다른 필드는 버린다', () => {
    const old = { phase: 'in', id: 'o1', nick: '옛', look: DEFAULT_LOOK, joinedAt: 1, s: null, stateWin: NEW_WINDOW, lastChat: 2, lastProfile: 3 }
    expect(memberFrom(old)).toEqual({ id: 'o1', nick: '옛', look: DEFAULT_LOOK, joinedAt: 1, s: null, stateWin: NEW_WINDOW, lastChat: 2, lastProfile: 3, sleeping: false, sleepWin: NEW_WINDOW })
    expect(memberFrom({ ...old, sleeping: true, sleepWin: { start: 5, count: 2 } })).toMatchObject({ sleeping: true, sleepWin: { start: 5, count: 2 } })
  })
})

describe('tallySleep', () => {
  it('방 인원의 절반(올림) 이상이 자면 아침', () => {
    expect(tallySleep([true])).toEqual({ n: 1, need: 1, morning: true })
    expect(tallySleep([true, false])).toEqual({ n: 1, need: 1, morning: true })
    expect(tallySleep([true, false, false])).toEqual({ n: 1, need: 2, morning: false })
    expect(tallySleep([true, true, false])).toEqual({ n: 2, need: 2, morning: true })
    expect(tallySleep([false, false, false, false])).toEqual({ n: 0, need: 2, morning: false })
  })
  it('아무도 없거나 아무도 안 자면 아침이 아니다', () => {
    expect(tallySleep([])).toEqual({ n: 0, need: 1, morning: false })
    expect(tallySleep([false])).toEqual({ n: 0, need: 1, morning: false })
  })
})
```

- [ ] **Step 2: 실행해 실패 확인**

Run: `npx vitest run src/game/logic/netProtocol.test.ts server/src/roomRules.test.ts`
Expected: FAIL — `sleep` 이 null 로 읽히고(`expected null to deeply equal { type: 'sleep', on: true }`), `memberFrom is not a function`, `tallySleep is not a function`

- [ ] **Step 3: 숫자** — `src/game/data/net.ts` 의 `/** 서버가 받는 메시지 최대 길이(글자) */` 바로 앞에:

```ts
  /** 서버 속도 제한: 잠 투표(sleep) 초당 횟수 */
  serverSleepPerSecond: 4,
  /** 방에 사람이 있는 동안 서버가 시계 확인(time)을 보내는 간격(초) */
  clockEvery: 30,
```

- [ ] **Step 4: 메시지 모양과 검사** — `src/game/logic/netProtocol.ts`

import 에 더한다 (`DISHES` 줄 앞, `BoatDir` 줄 뒤):

```ts
import { DAY_LENGTH } from '../data/balance'
```

```ts
import type { ClockTime } from './dayClock'
```

`ClientMsg` 의 마지막 줄(`profile`)부터 `ServerMsg` 끝(`chat` 줄)까지를 아래로 바꾼다:

```ts
  | { type: 'profile'; nick: string; look: CharacterLook }
  /** 같이 하기 잠 투표: 침대에 누웠다(on) / 일어났다 */
  | { type: 'sleep'; on: boolean }

/**
 * 서버 → 클라이언트. 3-1 에서 더한 것: welcome.time (방 시계), time (30초마다 시계 확인), sleepers (자는 사람 수 / 필요한 수), morning (모두 아침).
 * 옛 클라이언트는 모르는 종류를 버리고(parseServerMsg 가 null) welcome 의 time 은 읽지 않는다
 */
export type ServerMsg =
  | { type: 'welcome'; you: string; players: PeerInfo[]; time?: ClockTime }
  | { type: 'error'; code: ErrorCode }
  | { type: 'join'; id: string; nick: string; look: CharacterLook }
  | { type: 'leave'; id: string }
  | { type: 'profile'; id: string; nick: string; look: CharacterLook }
  | { type: 'state'; id: string; s: NetState }
  | { type: 'chat'; id: string; text: string }
  | { type: 'time'; tm: number; day: number }
  | { type: 'sleepers'; n: number; need: number }
  | { type: 'morning'; day: number }
```

`const id = …` 줄 다음에 도우미:

```ts
const int = (v: unknown, lo: number, hi: number): number | null => (Number.isInteger(v) && (v as number) >= lo && (v as number) <= hi ? (v as number) : null)
/** 날짜 상한 (하루 8분이라 백만 일이면 15년) */
const MAX_DAY = 1e6

/** 방 시각. 틀리면 null */
function clockTime(tmRaw: unknown, dayRaw: unknown): ClockTime | null {
  const tm = typeof tmRaw === 'number' && Number.isFinite(tmRaw) && tmRaw >= 0 && tmRaw < DAY_LENGTH ? tmRaw : null
  const day = int(dayRaw, 1, MAX_DAY)
  return tm === null || day === null ? null : { tm, day }
}
```

`parseClientMsg` 의 `case 'profile'` 다음(`default` 앞)에:

```ts
    case 'sleep':
      return typeof m.on === 'boolean' ? { type: 'sleep', on: m.on } : null
```

`parseServerMsg` 의 `case 'welcome'` 본문:

```ts
    case 'welcome': {
      const you = id(m.you)
      if (!you || !Array.isArray(m.players)) return null
      const out: ServerMsg = { type: 'welcome', you, players: m.players.map(readPeer).filter((p): p is PeerInfo => p !== null) }
      // 방 시계는 틀려도 그 필드만 버린다 (옛 서버는 보내지 않는다)
      const time = isRecord(m.time) ? clockTime(m.time.tm, m.time.day) : null
      if (time) out.time = time
      return out
    }
```

`parseServerMsg` 의 `case 'chat'` 다음(`default` 앞)에:

```ts
    case 'time': {
      const time = clockTime(m.tm, m.day)
      return time ? { type: 'time', ...time } : null
    }
    case 'sleepers': {
      const n = int(m.n, 0, NET.maxPlayers)
      const need = int(m.need, 1, NET.maxPlayers)
      return n !== null && need !== null ? { type: 'sleepers', n, need } : null
    }
    case 'morning': {
      const day = int(m.day, 1, MAX_DAY)
      return day !== null ? { type: 'morning', day } : null
    }
```

- [ ] **Step 5: 잠 표시와 투표 세기** — `server/src/roomRules.ts`

import 에 `NEW_WINDOW` 를 더한다: `import { NEW_WINDOW, allowEvery, allowPerSecond, type RateWindow } from '../../src/game/logic/rateLimit'`

`Member` 타입을 바꾸고 바로 뒤에 `memberFrom` 을 둔다 (room.ts 의 `toMember` 가 이걸 쓴다):

```ts
/** 방에 들어온 사람 (웹소켓 붙임 정보). 시각은 초. sleeping: 잠 투표 중 (침대에 누워 있다) */
export type Member = {
  id: string
  nick: string
  look: CharacterLook
  joinedAt: number
  s: NetState | null
  stateWin: RateWindow
  lastChat: number
  lastProfile: number
  sleeping: boolean
  sleepWin: RateWindow
}

/** 웹소켓 붙임 정보 → 사람. 3-1 전에 붙은 소켓(배포 중 살아 있던 방)엔 잠 필드가 없다: 안 자는 사람·새 창으로 본다 */
export function memberFrom(a: Omit<Member, 'sleeping' | 'sleepWin'> & Partial<Pick<Member, 'sleeping' | 'sleepWin'>>): Member {
  return {
    id: a.id,
    nick: a.nick,
    look: a.look,
    joinedAt: a.joinedAt,
    s: a.s,
    stateWin: a.stateWin,
    lastChat: a.lastChat,
    lastProfile: a.lastProfile,
    sleeping: a.sleeping === true,
    sleepWin: a.sleepWin ?? NEW_WINDOW,
  }
}
```

`handleMemberMsg` 의 `case 'hello'` 부터 함수를 닫는 `}` 까지를 아래로 바꾼다 (`case 'sleep'` 을 넣고 함수 뒤에 `tallySleep` 을 둔다):

```ts
    case 'sleep': {
      // 자는 사람 수는 방 전체를 봐야 해서 room.ts 가 센다 (tallySleep). 여기서는 표시만 바꾼다
      const r = allowPerSecond(member.sleepWin, nowSec, NET.serverSleepPerSecond)
      if (!r.ok) return { member, out: null }
      return { member: { ...member, sleeping: msg.on, sleepWin: r.w }, out: null }
    }
    case 'hello':
      return { member, out: null }
  }
}

/** 잠 투표 세기: 방 인원의 절반(올림) 이상이 자면 아침. 아무도 안 자면 아침이 아니다 */
export function tallySleep(sleeping: boolean[]): { n: number; need: number; morning: boolean } {
  const n = sleeping.filter(Boolean).length
  const need = Math.max(1, Math.ceil(sleeping.length / 2))
  return { n, need, morning: n > 0 && n >= need }
}
```

- [ ] **Step 6: 실행해 통과 확인**

Run: `npx vitest run src/game/logic/netProtocol.test.ts server/src/roomRules.test.ts`
Expected: PASS (33 tests)

- [ ] **Step 7: 방 서버** — `server/src/room.ts` 를 아래로 바꾼다 (바뀐 곳: import, `toMember` 가 `memberFrom` 을 쓴다, hello 의 `me`·`welcome.time`·`checkSleep`·alarm, `sleep` 처리, `alarm()`, `clock()`, `checkSleep()`, `broadcastAll()`, `leave()` 끝):

```ts
import { DurableObject } from 'cloudflare:workers'
import { NET } from '../../src/game/data/net'
import { newRoomClock, roomMorning, roomTime, type RoomClock } from '../../src/game/logic/dayClock'
import { parseClientMsg, type ErrorCode, type PeerInfo, type ServerMsg } from '../../src/game/logic/netProtocol'
import { NEW_WINDOW } from '../../src/game/logic/rateLimit'
import { handleMemberMsg, judgeHello, memberFrom, tallySleep, type Member, type RoomMeta } from './roomRules'

/** 웹소켓 붙임 정보: 아직 hello 전이거나, 들어온 사람 */
type Attachment = { phase: 'hello' } | ({ phase: 'in' } & Member)

export type Env = { ROOM: DurableObjectNamespace<Room> }

const toMember = (a: Extract<Attachment, { phase: 'in' }>): Member => memberFrom(a)

/**
 * 방 하나. 웹소켓 Hibernation API 를 써서 조용할 땐 잠들어 요금이 들지 않는다.
 * 사람 정보는 웹소켓마다 붙임 정보(attachment)에, 방 암호 해시와 시계 기준점은 저장소(meta, clock)에 둔다 (잠들면 메모리는 사라진다).
 * 시계 확인 alarm 은 사람이 있는 동안만 다시 건다
 */
export class Room extends DurableObject<Env> {
  async fetch(request: Request): Promise<Response> {
    if (request.headers.get('Upgrade') !== 'websocket') return new Response('websocket only', { status: 426 })
    const [client, server] = Object.values(new WebSocketPair())
    this.ctx.acceptWebSocket(server)
    server.serializeAttachment({ phase: 'hello' } satisfies Attachment)
    return new Response(null, { status: 101, webSocket: client })
  }

  async webSocketMessage(ws: WebSocket, data: string | ArrayBuffer): Promise<void> {
    if (typeof data !== 'string' || data.length > NET.maxMessageLength) return
    const msg = parseClientMsg(data)
    if (!msg) return
    const att = ws.deserializeAttachment() as Attachment
    if (att.phase === 'hello') {
      if (msg.type !== 'hello') return this.reject(ws, 'bad-hello')
      const meta = (await this.ctx.storage.get<RoomMeta>('meta')) ?? null
      const verdict = judgeHello(msg, meta, this.members(ws).length, Date.now())
      if (!verdict.ok) return this.reject(ws, verdict.code)
      await this.ctx.storage.put('meta', verdict.meta)
      const me: Member = {
        id: crypto.randomUUID().slice(0, 8),
        nick: msg.nick,
        look: msg.look,
        joinedAt: Date.now() / 1000,
        s: null,
        stateWin: NEW_WINDOW,
        lastChat: -Infinity,
        lastProfile: -Infinity,
        sleeping: false,
        sleepWin: NEW_WINDOW,
      }
      ws.serializeAttachment({ phase: 'in', ...me } satisfies Attachment)
      const players: PeerInfo[] = this.members(ws).map(({ m }) => ({ id: m.id, nick: m.nick, look: m.look, s: m.s }))
      const time = roomTime(await this.clock(), Date.now())
      send(ws, { type: 'welcome', you: me.id, players, time })
      this.broadcast({ type: 'join', id: me.id, nick: me.nick, look: me.look }, ws)
      // 사람이 늘면 필요한 수가 바뀐다 (자는 사람이 있을 때만 알린다)
      await this.checkSleep(false)
      if ((await this.ctx.storage.getAlarm()) === null) await this.ctx.storage.setAlarm(Date.now() + NET.clockEvery * 1000)
      return
    }
    const member = toMember(att)
    const r = handleMemberMsg(member, msg, Date.now() / 1000)
    if (r.member !== member) ws.serializeAttachment({ phase: 'in', ...r.member } satisfies Attachment)
    if (r.out) this.broadcast(r.out, ws)
    if (msg.type === 'sleep' && r.member.sleeping !== member.sleeping) await this.checkSleep(true)
  }

  async webSocketClose(ws: WebSocket): Promise<void> {
    await this.leave(ws)
  }

  async webSocketError(ws: WebSocket): Promise<void> {
    await this.leave(ws)
  }

  /** 시계 확인: 사람이 있으면 지금 시각을 보내고 다시 건다. 아무도 없으면 다시 걸지 않는다 (방이 잠든다) */
  async alarm(): Promise<void> {
    if (this.members().length === 0) return
    this.broadcastAll({ type: 'time', ...roomTime(await this.clock(), Date.now()) })
    await this.ctx.storage.setAlarm(Date.now() + NET.clockEvery * 1000)
  }

  /** 방 시계 기준점. 처음이면 지금을 1일차 06:00 으로 만들어 저장한다 */
  private async clock(): Promise<RoomClock> {
    const saved = await this.ctx.storage.get<RoomClock>('clock')
    if (saved) return saved
    const fresh = newRoomClock(Date.now())
    await this.ctx.storage.put('clock', fresh)
    return fresh
  }

  /**
   * 잠 투표를 센다. 절반(올림) 이상이 자면 시계를 다음 날 06:00 으로 옮기고 모두에게 morning, 자는 표시를 지운다.
   * tell: 자는 사람이 없어도 sleepers 를 보낸다 (누가 일어나 0명이 됐을 때 화면을 지우게)
   */
  private async checkSleep(tell: boolean) {
    const all = this.members()
    if (all.length === 0) return
    const t = tallySleep(all.map(({ m }) => m.sleeping))
    if (!t.morning) {
      if (tell || t.n > 0) this.broadcastAll({ type: 'sleepers', n: t.n, need: t.need })
      return
    }
    const next = roomMorning(await this.clock(), Date.now())
    await this.ctx.storage.put('clock', next)
    for (const { ws, m } of all) ws.serializeAttachment({ phase: 'in', ...m, sleeping: false } satisfies Attachment)
    this.broadcastAll({ type: 'morning', day: next.day0 })
  }

  /** 들어와 있는 사람들 (except 는 뺀다) */
  private members(except?: WebSocket): { ws: WebSocket; m: Member }[] {
    const out: { ws: WebSocket; m: Member }[] = []
    for (const w of this.ctx.getWebSockets()) {
      if (w === except) continue
      const a = w.deserializeAttachment() as Attachment | null
      if (a?.phase === 'in') out.push({ ws: w, m: toMember(a) })
    }
    return out
  }

  private broadcast(msg: ServerMsg, except: WebSocket) {
    for (const { ws } of this.members(except)) send(ws, msg)
  }

  private broadcastAll(msg: ServerMsg) {
    for (const { ws } of this.members()) send(ws, msg)
  }

  private reject(ws: WebSocket, code: ErrorCode) {
    send(ws, { type: 'error', code })
    ws.serializeAttachment({ phase: 'hello' } satisfies Attachment)
    try {
      ws.close(4000, code)
    } catch {
      // 이미 닫혔다
    }
  }

  private async leave(ws: WebSocket) {
    const a = ws.deserializeAttachment() as Attachment | null
    ws.serializeAttachment({ phase: 'hello' } satisfies Attachment)
    try {
      ws.close(1000, 'bye')
    } catch {
      // 이미 닫혔다
    }
    if (a?.phase !== 'in') return
    this.broadcast({ type: 'leave', id: a.id }, ws)
    const meta = await this.ctx.storage.get<RoomMeta>('meta')
    if (meta) await this.ctx.storage.put('meta', { ...meta, lastActive: Date.now() })
    // 사람이 줄면 필요한 수가 줄어 아침이 올 수 있다. 마지막 사람이 나가면 alarm 을 지운다
    if (this.members().length === 0) await this.ctx.storage.deleteAlarm()
    else await this.checkSleep(a.sleeping === true)
  }
}

function send(ws: WebSocket, msg: ServerMsg) {
  try {
    ws.send(JSON.stringify(msg))
  } catch {
    // 닫히는 중인 소켓
  }
}
```

- [ ] **Step 8: 로컬 서버 점검 스크립트** — `tools/room-smoke.mjs`
- 첫 줄 주석 끝에 `, 방 시계·잠 투표` 를 더한다.
- `open` 이 방 id 를 받게 한다:

```js
function open(mode, pass, nick, id = roomId) {
  return new Promise((resolve) => {
    const ws = new WebSocket(`${base}/rooms/${id}`)
    const inbox = []
    ws.onopen = () => ws.send(JSON.stringify({ type: 'hello', v: 1, mode, passHash: sha(`${id}|${pass}`), nick, look }))
```

- 끝의 `b.ws.close()` 다음, `await wait(100)` / `process.exit()` 앞에 넣는다:

```js
// 방 시계·잠 투표 (새 방). 셋이면 둘이 자야 아침, 사람이 나가면 다시 센다
const room2 = sha(`rinfish-room|smoke-sleep-${Date.now()}`).slice(0, 32)
const s1 = await open('create', 'secret1', 'S1', room2)
assert(s1.first.time?.day === 1 && s1.first.time.tm < 5, 'welcome 에 방 시계 (새 방은 1일차 06:00)')
const s2 = await open('join', 'secret1', 'S2', room2)
const s3 = await open('join', 'secret1', 'S3', room2)
s1.ws.send(JSON.stringify({ type: 'sleep', on: true }))
await wait(300)
assert(s3.inbox.some((m) => m.type === 'sleepers' && m.n === 1 && m.need === 2), '셋 중 한 명이 자면 모두에게 sleepers 1/2')
s2.ws.send(JSON.stringify({ type: 'sleep', on: true }))
await wait(300)
assert(s3.inbox.some((m) => m.type === 'morning' && m.day === 2), '둘이 자면 모두에게 2일차 morning')
const s4 = await open('join', 'secret1', 'S4', room2)
assert(s4.first.time?.day === 2 && s4.first.time.tm < 5, '아침 뒤에 온 사람은 2일차 06:00 근처를 받는다')
s4.ws.close()
s3.ws.send(JSON.stringify({ type: 'sleep', on: true }))
await wait(300)
s2.ws.close()
await wait(500)
assert(s1.inbox.some((m) => m.type === 'morning' && m.day === 3), '사람이 나가 필요한 수가 줄면(2명 중 1명) 아침')
s1.ws.close()
s3.ws.close()
```

- [ ] **Step 9: 서버 확인**

Run: `npx vitest run && npx tsc -b && npm run lint 2>&1 | grep -c warning`
Expected: PASS (56 파일 / 567 개), tsc 출력 없음, warning 6

다른 터미널에서 `npm run server:dev` 를 띄우고:

Run: `node tools/room-smoke.mjs ws://127.0.0.1:8787`
Expected: 모든 줄 `OK`, 마지막 다섯 줄이 `OK   welcome 에 방 시계 (새 방은 1일차 06:00)` · `OK   셋 중 한 명이 자면 모두에게 sleepers 1/2` · `OK   둘이 자면 모두에게 2일차 morning` · `OK   아침 뒤에 온 사람은 2일차 06:00 근처를 받는다` · `OK   사람이 나가 필요한 수가 줄면(2명 중 1명) 아침`

alarm 확인 (30초 걸린다):

```bash
node -e "
const { createHash } = require('crypto'); const sha = (s) => createHash('sha256').update(s).digest('hex')
const id = sha('alarm-' + Date.now()).slice(0, 32); const ws = new WebSocket('ws://127.0.0.1:8787/rooms/' + id); const t0 = Date.now()
const look = { gender: 'male', skinColor: '#e0b089', hair: 'short', hairColor: '#3e2723', beard: false, top: 'peasant', bottom: 'peasant', shoes: 'peasant', hood: false }
ws.onopen = () => ws.send(JSON.stringify({ type: 'hello', v: 1, mode: 'create', passHash: sha(id + '|x'), nick: 'T', look }))
ws.onmessage = (e) => { const m = JSON.parse(e.data); console.log(((Date.now() - t0) / 1000).toFixed(1), m.type, JSON.stringify(m.time ?? m.tm)); if (m.type === 'time') process.exit(0) }
setTimeout(() => { console.log('time 이 안 왔다'); process.exit(1) }, 40000)"
```

Expected: `0.0 welcome {"tm":0,"day":1}` 다음 약 30초 뒤 `30.0 time 30`

- [ ] **Step 10: 커밋**

```bash
git add src/game/data/net.ts src/game/logic/netProtocol.ts src/game/logic/netProtocol.test.ts server/src/roomRules.ts server/src/roomRules.test.ts server/src/room.ts tools/room-smoke.mjs
git commit -m "feat: 방 서버 시계와 잠 투표" -m "방 저장소에 시계 기준점(epoch, day0)만 두고 시각은 계산한다. welcome 에 time 을 더하고, 사람이 있는 동안 30초마다 alarm 으로 time 을 보낸다. 마지막 사람이 나가면 alarm 을 지운다.
sleep {on} 으로 소켓 붙임 정보에 잠 표시를 두고, 방 인원의 절반(올림) 이상이 자면 기준점을 다음 날 06:00 으로 옮겨 morning 을 보낸다. 사람이 들고 날 때 다시 센다.
새 메시지는 선택 필드·새 종류라 protocolVersion 은 1 그대로. 3-1 전에 붙은 소켓은 안 자는 사람으로 본다."
```

---

### Task 4: 시계·잠 투표 상태 (dayStore) 와 방 메시지 잇기

**Files:**
- Modify: `src/game/logic/interaction.ts` (`Mode` 에 `'sleep'`)
- Create: `src/game/stores/dayStore.ts`
- Modify: `src/game/stores/netStore.ts`
- Test: `src/game/stores/dayStore.test.ts` (새로), `src/game/stores/netStore.test.ts`

**Interfaces:**
- Consumes: Task 1 의 시계 함수·`SeqKind`, Task 2 의 `progressStore.clock`·`sleepWell`, Task 3 의 `ServerMsg` (`welcome.time`, `time`, `sleepers`, `morning`)
- Produces:
  - `Mode` 에 `'sleep'` (잠·죽음 페이드 중이거나 같이 하기 잠 투표 중, 이동 막힘)
  - `liveClock: Clock` (모듈 변수, 매 프레임 바뀐다), `type RestSeq = { kind: SeqKind; startedAt: number; switched: boolean }`
  - `useDayStore` 상태: `clockText: string`, `night: boolean`, `roomClock: boolean`, `seq: RestSeq | null`, `voting: boolean`, `sleepers: { n; need } | null`
  - `useDayStore` 액션: `stepClock(dt, paused)`, `toSoloClock()`, `setSoloClock(c)`, `toRoomClock(time?)`, `syncRoomClock(time)`, `roomSleepers(n, need)`, `roomMorning(day)`, `startSeq(kind)`, `markSeqSwitched()`, `endSeq()`, `setVoting(on)`, `reset()`
  - `useNetStore.getState().sendSleep(on: boolean)` (같이 하는 중에만 보낸다)

이름 주의: 액션 이름을 `use…` 로 시작하지 않는다 (`toSoloClock` 처럼) — React hook 규칙 검사가 hook 으로 오해한다.

- [ ] **Step 1: 실패하는 테스트 쓰기** — `src/game/stores/dayStore.test.ts`

```ts
// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DAY_LENGTH } from '../data/balance'
import { INITIAL_PROGRESS, useProgressStore } from './progressStore'
import { liveClock, useDayStore } from './dayStore'
import { useSessionStore } from './sessionStore'

const day = () => useDayStore.getState()
let nowMs = 0

beforeEach(() => {
  nowMs = 1_000_000
  vi.spyOn(performance, 'now').mockImplementation(() => nowMs)
  localStorage.clear()
  useProgressStore.setState({ ...INITIAL_PROGRESS, clock: { t: 0.25, day: 3 } })
  useSessionStore.setState({ mode: 'explore', notice: null })
  day().reset()
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('혼자 시계', () => {
  it('저장된 시계에서 이어서, 프레임마다 흐르고 멈춤(메뉴)이면 멈춘다', () => {
    expect(liveClock).toEqual({ t: 0.25, day: 3 })
    expect(day().clockText).toBe('☀️ 3일차 12:00')
    day().stepClock(DAY_LENGTH / 4, false)
    expect(liveClock.t).toBeCloseTo(0.5)
    day().stepClock(60, true)
    expect(liveClock.t).toBeCloseTo(0.5)
  })

  it('20시가 되면 밤', () => {
    useProgressStore.setState({ clock: { t: 0.58, day: 1 } })
    day().toSoloClock()
    expect(day().night).toBe(false)
    day().stepClock(DAY_LENGTH * 0.01, false)
    expect(day().night).toBe(true)
    expect(day().clockText.startsWith('🌙')).toBe(true)
  })
})

describe('방 시계', () => {
  it('받은 시각에서 내 시계로 이어 가고, 멈춤과 상관없이 흐른다', () => {
    day().toRoomClock({ tm: 240, day: 2 })
    expect(day().roomClock).toBe(true)
    expect(liveClock).toEqual({ t: 0.5, day: 2 })
    nowMs += 48_000
    day().stepClock(0, true)
    expect(liveClock.t).toBeCloseTo(0.6)
    day().syncRoomClock({ tm: 0, day: 5 })
    expect(liveClock).toEqual({ t: 0, day: 5 })
  })

  it('옛 서버(시각 없음)면 지금 시각에서 이어 돌린다', () => {
    day().toRoomClock()
    expect(liveClock).toEqual({ t: 0.25, day: 3 })
    nowMs += DAY_LENGTH * 1000
    day().stepClock(0, false)
    expect(liveClock.day).toBe(4)
  })

  it('방을 나오면 저장된 혼자 시계로 돌아간다 (방 시계는 저장하지 않는다)', () => {
    day().toRoomClock({ tm: 100, day: 9 })
    day().toSoloClock()
    expect(day().roomClock).toBe(false)
    expect(liveClock).toEqual({ t: 0.25, day: 3 })
    expect(useProgressStore.getState().clock).toEqual({ t: 0.25, day: 3 })
  })

  it('혼자일 땐 방 시계 확인을 무시한다', () => {
    day().syncRoomClock({ tm: 0, day: 8 })
    expect(liveClock).toEqual({ t: 0.25, day: 3 })
  })
})

describe('잠 투표', () => {
  it('누가 자기 시작하면 알리고 수를 보인다. 내가 자는 중이면 알리지 않는다', () => {
    day().toRoomClock({ tm: 10, day: 1 })
    day().roomSleepers(1, 2)
    expect(day().sleepers).toEqual({ n: 1, need: 2 })
    expect(useSessionStore.getState().notice?.text).toContain('1 / 2명이 자고 있어요')
    useSessionStore.setState({ notice: null })
    day().setVoting(true)
    day().roomSleepers(2, 3)
    expect(useSessionStore.getState().notice).toBeNull()
    day().roomSleepers(0, 3)
    expect(day().sleepers).toBeNull()
  })

  it('아침이 오면: 자던 사람은 체력 가득·배고픔 −15 로 깨고, 모두 짧게 어두워진다', () => {
    day().toRoomClock({ tm: 300, day: 1 })
    useProgressStore.setState({ survival: { stamina: 20, hunger: 50, graceLeft: null, buffs: [] } })
    day().setVoting(true)
    useSessionStore.setState({ mode: 'sleep' })
    day().roomMorning(2)
    expect(liveClock).toEqual({ t: 0, day: 2 })
    expect(day().voting).toBe(false)
    expect(useSessionStore.getState().mode).toBe('explore')
    expect(useProgressStore.getState().survival).toMatchObject({ stamina: 100, hunger: 35 })
    expect(day().seq?.kind).toBe('morning')
    // 방 시계로 맞춘 아침은 저장된 혼자 시계를 바꾸지 않는다
    expect(useProgressStore.getState().clock).toEqual({ t: 0.25, day: 3 })
  })

  it('안 자던 사람은 알림만, 체력·배고픔 그대로', () => {
    day().toRoomClock({ tm: 300, day: 1 })
    useProgressStore.setState({ survival: { stamina: 20, hunger: 50, graceLeft: null, buffs: [] } })
    day().roomMorning(2)
    expect(useProgressStore.getState().survival).toMatchObject({ stamina: 20, hunger: 50 })
    expect(useSessionStore.getState().notice?.text).toBe('2일차 아침이 됐어요')
  })

  it('다시 연결(welcome)되면 서버의 잠 표시가 지워졌으니 내 쪽도 깬다', () => {
    day().toRoomClock({ tm: 300, day: 1 })
    day().setVoting(true)
    useSessionStore.setState({ mode: 'sleep' })
    day().toRoomClock({ tm: 320, day: 1 })
    expect(day().voting).toBe(false)
    expect(useSessionStore.getState().mode).toBe('explore')
  })
})
```

`src/game/stores/netStore.test.ts`:
- import 에 `import { liveClock, useDayStore } from './dayStore'` (remoteRig 줄 다음) 과 `import { useProgressStore } from './progressStore'` (sessionStore 줄 앞).
- 파일 맨 끝 `})` (describe 닫기) 바로 앞에:

```ts
  it('방 시계: welcome 의 시각을 따르고, time·morning 으로 맞추고, 나가면 혼자 시계로', async () => {
    useProgressStore.setState({ clock: { t: 0.25, day: 3 } })
    useDayStore.getState().reset()
    await join()
    push({ type: 'welcome', you: 'me', players: [], time: { tm: 240, day: 2 } })
    expect(useDayStore.getState().roomClock).toBe(true)
    expect(liveClock.day).toBe(2)
    expect(liveClock.t).toBeCloseTo(0.5)
    push({ type: 'time', tm: 120, day: 6 })
    expect(liveClock.day).toBe(6)
    push({ type: 'sleepers', n: 1, need: 2 })
    expect(useDayStore.getState().sleepers).toEqual({ n: 1, need: 2 })
    push({ type: 'morning', day: 7 })
    expect(liveClock).toEqual({ t: 0, day: 7 })
    useNetStore.getState().leave()
    expect(useDayStore.getState().roomClock).toBe(false)
    expect(liveClock).toEqual({ t: 0.25, day: 3 })
  })

  it('잠 투표는 같이 하는 중에만 보낸다', async () => {
    useNetStore.getState().sendSleep(true)
    expect(sent).toEqual([])
    await join()
    push({ type: 'welcome', you: 'me', players: [] })
    useNetStore.getState().sendSleep(true)
    useNetStore.getState().sendSleep(false)
    expect(sent).toEqual([{ type: 'sleep', on: true }, { type: 'sleep', on: false }])
  })
```

- [ ] **Step 2: 실행해 실패 확인**

Run: `npx vitest run src/game/stores/dayStore.test.ts src/game/stores/netStore.test.ts`
Expected: FAIL — `Failed to resolve import "./dayStore"`

- [ ] **Step 3: 잠 모드** — `src/game/logic/interaction.ts` 의 `Mode` 주석 마지막 줄(` * map = 큰 지도 …`)부터 타입 끝까지를 아래로 바꾼다 (한 줄 union 을 여러 줄로 펴고 `'sleep'` 을 더한다):

```ts
 * map = 큰 지도 (이동·E 막힘, ESC 로 닫는다), sleep = 잠·죽음으로 화면이 어두워지는 중이거나 같이 하기에서 침대에 누워 아침을 기다리는 중 (이동 막힘)
 */
export type Mode =
  | 'explore'
  | 'fishing'
  | 'sell'
  | 'shop'
  | 'dex'
  | 'menu'
  | 'market'
  | 'aquarium'
  | 'rest'
  | 'wardrobe'
  | 'aquariumView'
  | 'unlock'
  | 'cutscene'
  | 'lobby'
  | 'boat'
  | 'map'
  | 'sleep'
```

- [ ] **Step 4: 구현** — `src/game/stores/dayStore.ts`

```ts
import { create } from 'zustand'
import { FIRST_MORNING, advanceClock, anchoredClock, clockText, isNight, toClockTime, type Clock, type ClockAnchor, type ClockTime } from '../logic/dayClock'
import type { SeqKind } from '../logic/restSeq'
import { useProgressStore } from './progressStore'
import { useSessionStore } from './sessionStore'

/** 지금 시각. 매 프레임 바뀌어서 스토어 밖 모듈 변수로 둔다 (조명·바다·1초 저장이 읽는다) */
export const liveClock: Clock = { ...FIRST_MORNING }
/** 같이 하는 중: 마지막으로 받은 방 시각과 받은 때 (performance.now() 초). 그 사이는 내 시계로 센다 */
let anchor: ClockAnchor | null = null

const nowSec = () => performance.now() / 1000
const setLive = (c: Clock) => {
  liveClock.t = c.t
  liveClock.day = c.day
}

/** 화면이 어두워지는 중인 일. startedAt: performance.now() 초, switched: 다 어두워진 순간의 일(잠·깨어나기)을 이미 했다 */
export type RestSeq = { kind: SeqKind; startedAt: number; switched: boolean }

type DayState = {
  /** HUD 시계 글자 ("☀️ 3일차 14:20") */
  clockText: string
  night: boolean
  /** 같이 하는 중: 방(서버) 시계를 따른다. 저장된 혼자 시계는 건드리지 않는다 */
  roomClock: boolean
  seq: RestSeq | null
  /** 같이 하기: 침대에 누워 아침을 기다리는 중 (잠 투표) */
  voting: boolean
  /** 같이 하기: 자는 사람 수 / 아침에 필요한 수. 아무도 안 자면 null */
  sleepers: { n: number; need: number } | null
  /** 매 프레임: 혼자면 dt 만큼 (paused 면 멈춤), 같이면 방 시각에서 계산. 글자·밤이 바뀔 때만 알린다 */
  stepClock: (dt: number, paused: boolean) => void
  /** 혼자 시계로: 저장값에서 이어서. 잠 투표 중이었으면 깬다 */
  toSoloClock: () => void
  /** 혼자 잠·혼자 죽음으로 시계를 옮긴다 */
  setSoloClock: (c: Clock) => void
  /** 방에 들어왔다 (welcome). time 이 없으면(옛 서버) 지금 시각에서 이어 돌린다 */
  toRoomClock: (time?: ClockTime) => void
  /** 방 시계 확인 (time) */
  syncRoomClock: (time: ClockTime) => void
  roomSleepers: (n: number, need: number) => void
  /** 방에 아침이 왔다: 잠 투표 중이었으면 자고 일어난 것으로, 모두 짧게 화면이 어두워진다 */
  roomMorning: (day: number) => void
  startSeq: (kind: SeqKind) => void
  markSeqSwitched: () => void
  endSeq: () => void
  setVoting: (on: boolean) => void
  /** 게임을 새로 열 때 */
  reset: () => void
}

const notify = (text: string) => useSessionStore.getState().notify(text)

export const useDayStore = create<DayState>((set, get) => {
  /** liveClock 이 바뀐 뒤 HUD 글자·밤을 알린다 (바뀐 때만) */
  const publish = () => {
    const text = clockText(liveClock)
    const night = isNight(liveClock.t)
    if (text !== get().clockText || night !== get().night) set({ clockText: text, night })
  }
  /** 잠 투표 화면을 닫는다 (아직 어두워지는 중이 아니면 탐험으로) */
  const stopVoting = () => {
    if (!get().voting) return
    set({ voting: false })
    const session = useSessionStore.getState()
    if (session.mode === 'sleep' && !get().seq) session.setMode('explore')
  }

  return {
    clockText: clockText(FIRST_MORNING),
    night: false,
    roomClock: false,
    seq: null,
    voting: false,
    sleepers: null,

    stepClock: (dt, paused) => {
      if (get().roomClock && anchor) setLive(anchoredClock(anchor, nowSec()))
      else if (!paused) setLive(advanceClock(liveClock, dt))
      publish()
    },

    toSoloClock: () => {
      anchor = null
      stopVoting()
      setLive(useProgressStore.getState().clock)
      set({ roomClock: false, sleepers: null })
      publish()
    },

    setSoloClock: (c) => {
      setLive(c)
      publish()
    },

    toRoomClock: (time) => {
      const now = nowSec()
      anchor = { ...(time ?? toClockTime(liveClock)), at: now }
      // 다시 붙었으면 서버의 잠 표시가 지워져 있다: 내 쪽도 깬다
      stopVoting()
      setLive(anchoredClock(anchor, now))
      set({ roomClock: true, sleepers: null })
      publish()
    },

    syncRoomClock: (time) => {
      if (!get().roomClock) return
      anchor = { ...time, at: nowSec() }
      setLive(anchoredClock(anchor, anchor.at))
      publish()
    },

    roomSleepers: (n, need) => {
      const before = get().sleepers?.n ?? 0
      set({ sleepers: n > 0 ? { n, need } : null })
      if (!get().voting && n > before) notify(`😴 ${n} / ${need}명이 자고 있어요. 침대에서 E 로 같이 자면 아침이 와요`)
    },

    roomMorning: (day) => {
      get().syncRoomClock({ tm: 0, day })
      if (get().voting) {
        useProgressStore.getState().sleepWell(null)
        stopVoting()
        notify(`잘 잤어요. ${day}일차 아침, 체력 회복!`)
      } else {
        notify(`${day}일차 아침이 됐어요`)
      }
      set({ sleepers: null })
      if (!get().seq) get().startSeq('morning')
    },

    startSeq: (kind) => set({ seq: { kind, startedAt: nowSec(), switched: false } }),
    markSeqSwitched: () => set((s) => (s.seq ? { seq: { ...s.seq, switched: true } } : {})),
    endSeq: () => set({ seq: null }),
    setVoting: (on) => set({ voting: on }),

    reset: () => {
      set({ seq: null, voting: false, sleepers: null })
      get().toSoloClock()
    },
  }
})
```

- [ ] **Step 5: 방 메시지 잇기** — `src/game/stores/netStore.ts`
- import: `import { useDayStore } from './dayStore'` (`roomUrl` 줄 다음).
- `NetStore` 타입의 `sendProfile` 다음에:

```ts
  /** 잠 투표: 침대에 누웠다(true) / 일어났다(false). 같이 하는 중에만 보낸다 */
  sendSleep: (on: boolean) => void
```

- `onMessage` 의 `case 'welcome'` 에서 `set({ phase: 'online', … })` 다음 줄:

```ts
            // 시계는 방 것을 따른다 (다시 붙어도 새로 맞춘다)
            useDayStore.getState().toRoomClock(m.time)
```

- `case 'error'` 에서 `set({ phase: 'off', room: null, you: null, peers: {}, error: m.code })` 다음 줄: `useDayStore.getState().toSoloClock()`
- `case 'chat'` 블록 다음(switch 끝)에:

```ts
          case 'time':
            useDayStore.getState().syncRoomClock({ tm: m.tm, day: m.day })
            return
          case 'sleepers':
            useDayStore.getState().roomSleepers(m.n, m.need)
            return
          case 'morning':
            useDayStore.getState().roomMorning(m.day)
            return
```

- `disconnect` 의 `set({ phase: 'off', room: null, you: null, peers: {} })` 다음 줄:

```ts
        // 방을 나오면 저장된 혼자 시계로 돌아간다
        useDayStore.getState().toSoloClock()
```

- 반환 객체의 `_setConnector` 앞에:

```ts
        sendSleep(on) {
          if (get().phase === 'online') conn?.send({ type: 'sleep', on })
        },
```

- [ ] **Step 6: 실행해 통과 확인**

Run: `npx vitest run && npx tsc -b && npm run lint 2>&1 | grep -c warning`
Expected: PASS (57 파일 / 579 개), tsc 출력 없음, warning 6

- [ ] **Step 7: 커밋**

```bash
git add src/game/logic/interaction.ts src/game/stores/dayStore.ts src/game/stores/dayStore.test.ts src/game/stores/netStore.ts src/game/stores/netStore.test.ts
git commit -m "feat: 시계와 잠 투표 상태" -m "지금 시각은 매 프레임 바뀌어 모듈 변수 liveClock 에 두고, HUD 글자와 밤 여부만 스토어로 알린다.
혼자면 저장된 시계에서 이어 dt 로 돌리고(메뉴 등에서 멈춤), 같이 하면 받은 방 시각 + 내 시계로 계산한다 (탭을 숨겼다 와도 맞다).
방 time·sleepers·morning 을 받아 시계·자는 사람 수·아침을 맞추고, 방을 나오면 저장된 혼자 시계로 돌아간다. 잠 모드(sleep)를 더했다."
```

---

### Task 5: 침대·잠·죽음 흐름

**Files:**
- Modify: `src/game/data/meadow.ts` (`BED_SPOT`, `BED_ZONE`, `BED_WAKE`)
- Modify: `src/meadow/vendor/world.d.ts` (`roomAt`, `bedSpot`, `EunjiRoom.outdoor`)
- Modify: `src/game/logic/interaction.ts` (`bed`, `sleep`/`wake` 키), `src/game/ui/interactLabel.ts`, `src/game/input/useInteractionKeys.ts`
- Modify: `src/game/logic/time.ts` (`timeStops`)
- Create: `src/game/scene/day/dayActions.ts`, `src/game/scene/day/DayCycle.tsx`
- Modify: `src/game/scene/PlayTimeTicker.tsx`, `src/game/scene/World.tsx`, `src/game/Game.tsx`, `src/game/ui/ChatBox.tsx`
- Test: `src/game/scene/day/dayActions.test.ts` (새로), `src/game/logic/interaction.test.ts`, `src/game/logic/time.test.ts`, `src/meadow/vendor.test.ts`

**Interfaces:**
- Consumes: Task 4 의 `useDayStore`·`liveClock`·`sendSleep`, Task 2 의 `sleepWell`·`reviveAtBed`·`tick(…, clock)`·`TickEvents.died`, Task 1 의 `nextMorning`·`seqSwitchAt`·`seqEnd`
- Produces:
  - `BED_SPOT: [number, number]` (196.5, −3.6), `BED_ZONE: { center: [number, number]; half: [number, number, number] }`, `BED_WAKE: [number, number]` (197.8, −2.4) (`data/meadow.ts`)
  - `Interactable` 에 `{ kind: 'bed' }`, `KeyAction` 에 `{ type: 'sleep' }`·`{ type: 'wake' }`
  - `timeStops(mode: Mode): boolean` (`logic/time.ts`)
  - `startSleep(): void`, `wake(): void`, `startDeath(): void`, `stepRest(now: number): void` (`scene/day/dayActions.ts`) — 3-3·3-4 의 동물·PvP 죽음도 `startDeath()` 를 부른다
  - `<DayCycle />` (World 에 붙는다)

- [ ] **Step 1: 실패하는 테스트 쓰기**

`src/game/scene/day/dayActions.test.ts` (새 파일):

```ts
// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { BED_WAKE } from '../../data/meadow'
import { seqEnd, seqSwitchAt } from '../../logic/restSeq'
import { liveClock, useDayStore } from '../../stores/dayStore'
import { useNetStore } from '../../stores/netStore'
import { INITIAL_PROGRESS, useProgressStore } from '../../stores/progressStore'
import { useSessionStore } from '../../stores/sessionStore'
import { startDeath, startSleep, stepRest, wake } from './dayActions'

const day = () => useDayStore.getState()
const session = () => useSessionStore.getState()
const sendSleep = vi.fn()
const realSendSleep = useNetStore.getState().sendSleep

/** 화면이 다 어두워진 때와 끝난 때를 조금 넘겨 진행 (시작 시각 + 1.6 - 시작 시각 이 1.6 보다 작을 수 있다) */
const AFTER = 0.01
function runSeq() {
  const seq = day().seq!
  stepRest(seq.startedAt + seqSwitchAt(seq.kind) + AFTER)
  stepRest(seq.startedAt + seqEnd(seq.kind) + AFTER)
}

beforeEach(() => {
  localStorage.clear()
  sendSleep.mockClear()
  useNetStore.setState({ phase: 'off', sendSleep })
  useProgressStore.setState({ ...INITIAL_PROGRESS, clock: { t: 0.6, day: 2 }, survival: { stamina: 20, hunger: 50, graceLeft: null, buffs: [] } })
  session().resetSession()
  day().reset()
})

afterEach(() => {
  useNetStore.setState({ phase: 'off', sendSleep: realSendSleep })
})

describe('혼자 잠', () => {
  it('화면이 1초 어두워졌다가 다음 날 06:00, 체력 100, 배고픔 −15 (저장)', () => {
    startSleep()
    expect(session().mode).toBe('sleep')
    expect(day().seq?.kind).toBe('sleep')
    const seq = day().seq!
    stepRest(seq.startedAt + 0.5)
    expect(liveClock.day).toBe(2)
    stepRest(seq.startedAt + seqSwitchAt('sleep') + AFTER)
    expect(liveClock).toEqual({ t: 0, day: 3 })
    expect(useProgressStore.getState().clock).toEqual({ t: 0, day: 3 })
    expect(useProgressStore.getState().survival).toMatchObject({ stamina: 100, hunger: 35 })
    stepRest(seq.startedAt + seqEnd('sleep') + AFTER)
    expect(day().seq).toBeNull()
    expect(session().mode).toBe('explore')
  })

  it('어두워지는 중에 또 E 를 눌러도 한 번만, 일어나기(E·ESC)도 아무 일 없다', () => {
    startSleep()
    const first = day().seq
    startSleep()
    wake()
    expect(day().seq).toBe(first)
    expect(session().mode).toBe('sleep')
  })
})

describe('같이 하기 잠 투표', () => {
  it('누우면 sleep true 를 보내고 기다린다 (화면은 어두워지지 않는다). 일어나면 false', () => {
    useNetStore.setState({ phase: 'online' })
    day().toRoomClock({ tm: 100, day: 1 })
    startSleep()
    expect(sendSleep).toHaveBeenLastCalledWith(true)
    expect(day().voting).toBe(true)
    expect(day().seq).toBeNull()
    expect(session().mode).toBe('sleep')
    wake()
    expect(sendSleep).toHaveBeenLastCalledWith(false)
    expect(day().voting).toBe(false)
    expect(session().mode).toBe('explore')
  })

  it('다시 붙는 중엔 잘 수 없다', () => {
    day().toRoomClock({ tm: 100, day: 1 })
    useNetStore.setState({ phase: 'reconnecting' })
    startSleep()
    expect(day().seq).toBeNull()
    expect(day().voting).toBe(false)
    expect(session().notice?.text).toContain('잘 수 없어요')
  })
})

describe('죽음 → 침대', () => {
  it('혼자: 침대 옆으로, 체력 100·배고픔 60, 다음 날 06:00. 가방·코인·물고기는 그대로', () => {
    useProgressStore.setState({ coins: 77 })
    useProgressStore.getState().addCatch('sleepy-sardine', 0.2)
    startDeath()
    expect(session().mode).toBe('sleep')
    runSeq()
    expect(session().teleport).toEqual(BED_WAKE)
    expect(useProgressStore.getState().survival).toEqual({ stamina: 100, hunger: 60, graceLeft: null, buffs: [] })
    expect(useProgressStore.getState()).toMatchObject({ coins: 77, clock: { t: 0, day: 3 } })
    expect(useProgressStore.getState().inventory).toHaveLength(1)
    expect(session().mode).toBe('explore')
  })

  it('배 타는 중 죽으면 깨어날 때 배에서 내려 침대로 (순간이동이 배를 끝낸다)', () => {
    session().startBoat('toIsland')
    startDeath()
    expect(session().boat).not.toBeNull()
    runSeq()
    expect(session().boat).toBeNull()
    expect(session().teleport).toEqual(BED_WAKE)
    expect(session().mode).toBe('explore')
  })

  it('같이: 시간은 그대로 (방 시계·저장된 혼자 시계 모두), 잠 투표 중이었으면 깬다고 알린다', () => {
    useNetStore.setState({ phase: 'online' })
    day().toRoomClock({ tm: 100, day: 4 })
    startSleep()
    startDeath()
    expect(sendSleep).toHaveBeenLastCalledWith(false)
    expect(day().voting).toBe(false)
    runSeq()
    expect(liveClock.day).toBe(4)
    expect(useProgressStore.getState().clock).toEqual({ t: 0.6, day: 2 })
    expect(useProgressStore.getState().survival.hunger).toBe(60)
  })

  it('죽는 중에 또 죽어도 한 번만', () => {
    startDeath()
    const first = day().seq
    startDeath()
    expect(day().seq).toBe(first)
  })
})
```

`src/game/logic/interaction.test.ts` — `describe('resolveKeyAction', () => {` 바로 다음 줄에:

```ts
  it('침대에서 E 로 잠자기', () => {
    expect(resolveKeyAction('KeyE', 'explore', { kind: 'bed' })).toEqual({ type: 'sleep' })
  })
  it('누워 있는 동안(sleep) E·ESC 는 일어나기, 그 밖의 키는 무시 (메뉴를 열지 않는다)', () => {
    expect(resolveKeyAction('KeyE', 'sleep', { kind: 'bed' })).toEqual({ type: 'wake' })
    expect(resolveKeyAction('Escape', 'sleep', null)).toEqual({ type: 'wake' })
    for (const code of ['Digit1', 'Space', 'KeyM']) expect(resolveKeyAction(code, 'sleep', { kind: 'bed' })).toEqual({ type: 'none' })
  })
```

`src/game/logic/time.test.ts` — import 두 줄과 파일 끝:

```ts
import type { Mode } from './interaction'
import { clampDelta, timeStops } from './time'
```

```ts
describe('timeStops', () => {
  it('메뉴·꾸미기·로비에서만 시간이 멈춘다 (잠 투표 중엔 흐른다)', () => {
    const stop: Mode[] = ['menu', 'wardrobe', 'lobby']
    const flow: Mode[] = ['explore', 'fishing', 'boat', 'sleep', 'shop']
    expect(stop.every(timeStops)).toBe(true)
    expect(flow.some(timeStops)).toBe(false)
  })
})
```

`src/meadow/vendor.test.ts` — `it('모델 주소는 meadow/ 아래'` 바로 앞에:

```ts
  it('침대 자리·깨어나는 자리는 은지 침대와 침실이다 (감지 상자도 침실 안)', async () => {
    const { createWorld } = await import('./vendor/world.js')
    const { BED_SPOT, BED_WAKE, BED_ZONE, toMeadowLocal } = await import('../game/data/meadow')
    const w = createWorld()
    expect(toMeadowLocal(...BED_SPOT)).toEqual([w.bedSpot.center.x, w.bedSpot.center.z])
    expect(w.roomAt(...toMeadowLocal(...BED_WAKE)).id).toBe('bedroom')
    const [cx, cz] = BED_ZONE.center
    const [hx, , hz] = BED_ZONE.half
    for (const [x, z] of [[cx - hx, cz - hz], [cx + hx, cz + hz]]) expect(w.roomAt(...toMeadowLocal(x, z)).id).toBe('bedroom')
    await Promise.allSettled([w.furnitureReady, w.outdoor.ready, w.town.ready])
  })
```

- [ ] **Step 2: 실행해 실패 확인**

Run: `npx vitest run src/game/scene/day src/game/logic/interaction.test.ts src/game/logic/time.test.ts src/meadow/vendor.test.ts`
Expected: FAIL — `Failed to resolve import "./dayActions"`, `timeStops is not a function`, 침대 E 가 `{ type: 'none' }`, `BED_SPOT` 이 undefined

- [ ] **Step 3: 침대 자리** — `src/game/data/meadow.ts` 의 `/** 처음 시작하는 자리: … */` 앞에:

```ts
/** 은지 침실 침대 (은지 world.bedSpot 3.5, 3.6) */
export const BED_SPOT: [number, number] = toWorld(3.5, 3.6)
/** E "잠자기" 감지 상자: 침대와 그 앞을 덮고 침실 벽(은지 x 5, z 5) 밖으로 나가지 않는다 (은지 2m 와 비슷) */
export const BED_ZONE = { center: toWorld(3, 3), half: [1.9, 1.2, 1.9] as [number, number, number] }
/** 죽은 뒤 깨어나는 침대 옆 (은지 2.2, 2.4) */
export const BED_WAKE: [number, number] = toWorld(2.2, 2.4)
```

`src/meadow/vendor/world.d.ts` 를 아래로 바꾼다 (import 에 `Vector3`, `EunjiRoom.outdoor`, `EunjiWorld` 끝에 `roomAt`·`bedSpot` — 은지 world.js 가 이미 돌려주는 것):

```ts
import type { Box3, DirectionalLight, Group, HemisphereLight, Light, Vector3 } from 'three'

/** outdoor: 마당·광장·들판 (실내 방엔 없다) */
export type EunjiRoom = { id: string; name: string; minX: number; maxX: number; minZ: number; maxZ: number; outdoor?: boolean }
export const ROOMS: EunjiRoom[]

export type EunjiDoor = { setOpen(open: boolean, instant?: boolean): void; collider: Box3 }

export type EunjiWorld = {
  group: Group
  allColliders(): Box3[]
  doors: EunjiDoor[]
  furnitureReady: Promise<unknown>
  outdoor: { ready: Promise<unknown> }
  town: { ready: Promise<unknown> }
  lights: { sun: DirectionalLight; hemi: HemisphereLight; lamps: Light[] }
  /** 은지 좌표 (x, z) 의 방: 실내 방 → 마당 → 광장 → 들판 순 */
  roomAt(x: number, z: number): EunjiRoom
  bedSpot: { center: Vector3; label: string }
}

export function createWorld(): EunjiWorld
```

- [ ] **Step 4: 키** — `src/game/logic/interaction.ts`

`Interactable` 끝에 `| { kind: 'bed' }`, `KeyAction` 끝에:

```ts
  /** 침대에서 잠자기 (혼자: 다음 날 아침 / 같이: 잠 투표) */
  | { type: 'sleep' }
  /** 같이 하기 잠 투표 그만두고 일어나기 */
  | { type: 'wake' }
```

`resolveKeyAction` 첫 줄(`cutscene`·`lobby`·`boat` 는 none) 다음에:

```ts
  // 침대에 누워 있는 동안 E·ESC 는 일어나기 (화면이 어두워지는 중이면 dayActions.wake 가 무시한다)
  if (mode === 'sleep') return code === 'KeyE' || code === 'Escape' ? { type: 'wake' } : { type: 'none' }
```

`switch (nearby.kind)` 의 `case 'dock'` 다음에:

```ts
      case 'bed':
        return { type: 'sleep' }
```

`src/game/ui/interactLabel.ts` 의 `LABEL` 끝(`wardrobe` 다음)에 `bed: '🛏️ 잠자기',`.

`src/game/logic/time.ts`:

```ts
import { MAX_FRAME_DELTA } from '../data/balance'
import type { Mode } from './interaction'

/** 프레임 delta를 0 ~ MAX_FRAME_DELTA 로 제한 */
export function clampDelta(delta: number): number {
  if (!Number.isFinite(delta) || delta < 0) return 0
  return Math.min(delta, MAX_FRAME_DELTA)
}

/** 이 화면을 열어 둔 동안은 게임 시간(배고픔·체력·혼자 시계)이 흐르지 않는다: 메뉴·꾸미기·로비 */
export function timeStops(mode: Mode): boolean {
  return mode === 'menu' || mode === 'wardrobe' || mode === 'lobby'
}
```

- [ ] **Step 5: 잠·죽음 흐름** — `src/game/scene/day/dayActions.ts`

```ts
import { BED_WAKE } from '../../data/meadow'
import { nextMorning } from '../../logic/dayClock'
import { seqEnd, seqSwitchAt, type SeqKind } from '../../logic/restSeq'
import { liveClock, useDayStore } from '../../stores/dayStore'
import { useFishingStore } from '../../stores/fishingStore'
import { useNetStore } from '../../stores/netStore'
import { useProgressStore } from '../../stores/progressStore'
import { useSessionStore } from '../../stores/sessionStore'

/** 침대에서 E. 혼자면 화면이 어두워졌다 다음 날 아침, 같이 하면 잠 투표 (누워서 아침을 기다린다) */
export function startSleep() {
  const day = useDayStore.getState()
  const session = useSessionStore.getState()
  if (day.seq || day.voting) return
  const phase = useNetStore.getState().phase
  if (phase === 'online') {
    day.setVoting(true)
    useNetStore.getState().sendSleep(true)
    session.setMode('sleep')
    return
  }
  // 다시 붙는 중: 방 시계라 혼자 자면 안 되고, 투표도 보낼 수 없다
  if (day.roomClock) {
    session.notify('연결이 끊겨 지금은 잘 수 없어요')
    return
  }
  day.startSeq('sleep')
  session.setMode('sleep')
}

/** 잠 투표를 그만두고 일어난다 (일어나기 버튼·E·ESC). 화면이 어두워지는 중엔 아무 일도 없다 */
export function wake() {
  const day = useDayStore.getState()
  if (!day.voting || day.seq) return
  day.setVoting(false)
  useNetStore.getState().sendSleep(false)
  const session = useSessionStore.getState()
  if (session.mode === 'sleep') session.setMode('explore')
}

/**
 * 죽음 (굶주림, 3-3·3-4 의 동물·PvP). 화면이 1.6초 어두워진 뒤 침대 옆에서 깨어난다.
 * 낚시 중이면 그만두고, 잠 투표 중이면 깬 것으로 알린다. 배 타는 중이면 깨어날 때 순간이동이 배를 끝낸다
 */
export function startDeath() {
  const day = useDayStore.getState()
  if (day.seq?.kind === 'death') return
  if (day.voting) {
    day.setVoting(false)
    useNetStore.getState().sendSleep(false)
  }
  useFishingStore.getState().end()
  day.startSeq('death')
  const session = useSessionStore.getState()
  session.setMode('sleep')
  session.notify('쓰러졌어요… 침대에서 깨어납니다')
}

/** 다 어두워진 순간: 자고 일어나기 / 침대에서 깨어나기. 같이 하는 중엔 시계가 방 것이라 건드리지 않는다 */
function atDark(kind: SeqKind) {
  const day = useDayStore.getState()
  const progress = useProgressStore.getState()
  const session = useSessionStore.getState()
  const morning = day.roomClock ? null : nextMorning(liveClock)
  if (morning) day.setSoloClock(morning)
  if (kind === 'sleep') {
    progress.sleepWell(morning)
    session.notify(`잘 잤어요. ${morning?.day ?? liveClock.day}일차 아침, 체력 회복!`)
  } else if (kind === 'death') {
    progress.reviveAtBed(morning)
    session.requestTeleport(BED_WAKE)
    session.notify(morning ? `${morning.day}일차 아침, 침대에서 깨어났어요. 가방은 그대로예요` : '침대에서 깨어났어요. 가방은 그대로예요')
  }
}

/** 매 프레임 (now: performance.now() 초). 다 어두워지면 잠·깨어나기를 하고, 다 밝아지면 끝내고 탐험으로 */
export function stepRest(now: number) {
  const day = useDayStore.getState()
  const seq = day.seq
  if (!seq) return
  const t = now - seq.startedAt
  if (!seq.switched && t >= seqSwitchAt(seq.kind)) {
    day.markSeqSwitched()
    atDark(seq.kind)
  }
  if (t < seqEnd(seq.kind)) return
  day.endSeq()
  const session = useSessionStore.getState()
  if (seq.kind !== 'morning' && session.mode === 'sleep' && !useDayStore.getState().voting) session.setMode('explore')
}
```

- [ ] **Step 6: 실행해 통과 확인**

Run: `npx vitest run src/game/scene/day src/game/logic/interaction.test.ts src/game/logic/time.test.ts src/meadow/vendor.test.ts`
Expected: PASS (39 tests)

- [ ] **Step 7: 장면·키·틱 잇기**

`src/game/scene/day/DayCycle.tsx`:

```tsx
import { useFrame } from '@react-three/fiber'
import { BED_ZONE } from '../../data/meadow'
import type { Interactable } from '../../logic/interaction'
import { clampDelta, timeStops } from '../../logic/time'
import { useDayStore } from '../../stores/dayStore'
import { useSessionStore } from '../../stores/sessionStore'
import { InteractionZone } from '../facilities/InteractionZone'
import { stepRest } from './dayActions'

const BED: Interactable = { kind: 'bed' }

/** 시계를 돌리고(혼자: 메뉴·로비에서 멈춤, 같이: 방 시계) 잠·죽음 화면 어두워지기를 진행한다. 침대 E 감지 상자 */
export function DayCycle() {
  useFrame((_, delta) => {
    useDayStore.getState().stepClock(clampDelta(delta), timeStops(useSessionStore.getState().mode))
    stepRest(performance.now() / 1000)
  })
  return <InteractionZone position={[BED_ZONE.center[0], 0.8, BED_ZONE.center[1]]} halfSize={BED_ZONE.half} target={BED} />
}
```

`src/game/scene/World.tsx` — `import { DayCycle } from './day/DayCycle'` (Docks import 다음), `<PlayTimeTicker />` 다음 줄에 `<DayCycle />`.

`src/game/input/useInteractionKeys.ts` — `import { startSleep, wake } from '../scene/day/dayActions'` (finishCooking import 다음), `runKeyAction` 의 `case 'boardBoat'` 다음에:

```ts
    case 'sleep':
      startSleep()
      break
    case 'wake':
      wake()
      break
```

`src/game/scene/PlayTimeTicker.tsx` 를 아래로 바꾼다:

```tsx
import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { CLINIC_SPAWN } from '../data/zones'
import type { AquariumEvent } from '../logic/aquarium'
import { clampDelta, timeStops } from '../logic/time'
import { liveClock, useDayStore } from '../stores/dayStore'
import { useFishingStore } from '../stores/fishingStore'
import { useProgressStore } from '../stores/progressStore'
import { useSessionStore } from '../stores/sessionStore'
import { startDeath } from './day/dayActions'

const AQUARIUM_NOTICE: Record<AquariumEvent, string> = {
  hungry: '어항 물고기들이 배고파해요. 수입이 멈췄어요!',
  releaseWarning: '2분 안에 먹이를 주지 않으면 어항 물고기들이 바다로 돌아가요!',
  released: '배고픈 물고기들이 바다로 돌아갔어요… (도감 기록은 남아요)',
}

/**
 * 플레이 시간, 체력(유예·버프)·배고픔, 어항 시간, 혼자 시계 저장을 1초씩 모아서 진행한다.
 * 매 프레임 저장하면 localStorage 쓰기가 너무 잦기 때문
 */
export function PlayTimeTicker() {
  const pending = useRef(0)
  useFrame((_, delta) => {
    const session = useSessionStore.getState()
    const day = useDayStore.getState()
    // 메뉴·꾸미기·로비 화면을 열어 둔 동안이나 잠·죽음으로 화면이 어두워지는 동안은 시간이 흐르지 않는다.
    // 멈춘 시간이 다음 틱에 몰려 들어가지 않게 비운다
    if (timeStops(session.mode) || (day.seq && day.seq.kind !== 'morning')) {
      pending.current = 0
      return
    }
    pending.current += clampDelta(delta)
    if (pending.current < 1) return
    const seconds = pending.current
    pending.current = 0

    const fighting = session.mode === 'fishing' && useFishingStore.getState().state?.stage === 'fighting'
    const ctx = { fighting, resting: session.mode === 'rest', exploring: session.mode === 'explore', sleeping: day.voting }
    // 혼자 할 때만 시계를 저장한다 (같이 하는 동안 방 시계로 덮어쓰지 않게)
    const events = useProgressStore.getState().tick(seconds, ctx, day.roomClock ? null : { ...liveClock })

    for (const event of events.aquarium) session.notify(AQUARIUM_NOTICE[event])
    if (events.died) startDeath()
    else if (events.fainted) {
      useFishingStore.getState().end()
      session.setMode('explore')
      session.requestTeleport(CLINIC_SPAWN)
      session.notify('쓰러졌다… 진료소에서 깨어났어요. 들고 있던 물고기를 잃고 진료비를 냈어요.')
    }
  })
  return null
}
```

`src/game/Game.tsx` — `import { useDayStore } from './stores/dayStore'` (fishingStore import 앞), 첫 `useEffect` 의 `useFishingStore.getState().end()` 다음에:

```ts
    // 시계는 저장된 혼자 시계에서 (같이 하면 welcome 에서 방 시계로 바꾼다)
    useDayStore.getState().reset()
```

`src/game/ui/ChatBox.tsx` — 잠 투표 중에도 채팅한다: `const CHAT_MODES: Mode[] = ['explore', 'fishing', 'rest', 'sleep']`.

- [ ] **Step 8: 확인**

Run: `npx vitest run && npx tsc -b && npm run lint 2>&1 | grep -c warning`
Expected: PASS (58 파일 / 591 개), tsc 출력 없음, warning 6

- [ ] **Step 9: 커밋**

```bash
git add src/game/data/meadow.ts src/meadow/vendor/world.d.ts src/meadow/vendor.test.ts src/game/logic/interaction.ts src/game/logic/interaction.test.ts src/game/ui/interactLabel.ts src/game/input/useInteractionKeys.ts src/game/logic/time.ts src/game/logic/time.test.ts src/game/scene/day src/game/scene/PlayTimeTicker.tsx src/game/scene/World.tsx src/game/Game.tsx src/game/ui/ChatBox.tsx
git commit -m "feat: 침대 잠과 죽음" -m "은지 침실 침대에서 E 로 잔다. 혼자면 화면이 1초 어두워졌다가 다음 날 06:00, 체력 100, 배고픔 −15. 같이 하면 sleep 을 보내고 누워서 아침을 기다린다 (E·ESC 로 일어나기).
굶어 죽으면 화면이 어두워진 뒤 침대 옆에서 깨어난다: 체력 100, 배고픔 60, 가방·코인 그대로. 혼자면 다음 날 아침, 같이 하면 시간 그대로. 배 타는 중이면 순간이동이 배를 끝낸다.
게임 시간은 메뉴·꾸미기·로비와 잠·죽음 페이드 동안 멈춘다. 혼자 할 때만 1초마다 시계를 저장한다."
```

---

### Task 6: 밤 화면 (해·하늘·가로등·섬 등불·바다·음악)

**Files:**
- Create: `src/game/scene/skyNow.ts`
- Modify: `src/meadow/vendor/daynight.d.ts` (`day`, `light`, `offset`)
- Modify: `src/game/data/zones.ts` (`ISLAND_LANTERNS`)
- Modify: `src/meadow/meadowSingleton.ts` (거의 새로), `src/meadow/MeadowLighting.tsx`
- Modify: `src/game/scene/Ocean.tsx`
- Create: `src/game/scene/decor/IslandLanterns.tsx`; Modify: `src/game/scene/World.tsx`
- Modify: `src/game/logic/music.ts`, `src/game/audio/backgroundMusic.ts`
- Test: `src/meadow/meadowSingleton.test.ts` (다시 씀), `src/game/logic/settings.test.ts`

**Interfaces:**
- Consumes: `liveClock` (Task 4), `useDayStore` 의 `night` (Task 4), `EunjiWorld.roomAt` (Task 5)
- Produces:
  - `skyNow: { background: Color; sea: Color; sunDir: Vector3 }` (`scene/skyNow.ts`, 모듈 객체 — 배경과 바다 셰이더가 같은 객체를 쓴다)
  - `ISLAND_LANTERNS: [number, number, number][]` (`data/zones.ts`)
  - `islandLanterns(): PointLight[]`, `followMeadowSun(local: Vector3, t: number): void`, `updateRoomLamps(low: boolean, local: Vector3): void` (`meadow/meadowSingleton.ts`). `NOON_T`·`meadowSkyColor` 는 없앤다
  - `musicTrackFor(mode: Mode, night = false): MusicTrack`

- [ ] **Step 1: 실패하는 테스트 쓰기** — `src/meadow/meadowSingleton.test.ts` 를 아래로 바꾼다:

```ts
// @vitest-environment jsdom
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { Vector3, type Light, type Object3D } from 'three'

// 모델 파일은 테스트에서 받지 않는다
beforeAll(() => vi.stubGlobal('fetch', () => Promise.reject(new Error('offline'))))
afterAll(() => vi.unstubAllGlobals())

const isLight = (o: Object3D): o is Light => (o as Light).isLight === true
/** 은지 좌표: 침실 가운데, 마당 */
const BEDROOM = new Vector3(0, 1, 0)
const YARD = new Vector3(12, 1, 12)

describe('초원 조명 (빛 개수가 처음부터 같게)', () => {
  it('방 조명 4 + 가로등 4 + 섬 등불 2 = 10개를 은지 group 밖으로 꺼내 둔다 (group 이 나중에 붙어도 빛이 늘지 않는다)', async () => {
    const { islandLanterns, meadowReady, meadowRoomLamps, meadowWorld } = await import('./meadowSingleton')
    const { ROOMS } = await import('./vendor/world.js')
    const w = meadowWorld()
    expect(meadowRoomLamps().length).toBe(ROOMS.length)
    const lamps = [...meadowRoomLamps(), ...w.lights.lamps, ...islandLanterns()]
    expect(lamps.length).toBe(10)
    for (const l of lamps) {
      expect(l.isLight).toBe(true)
      expect(l.parent).toBeNull()
      expect(l.visible).toBe(true)
    }
    // 해·하늘빛은 MeadowLighting 이 따로 붙이므로 빼고, group 안에 빛이 없다
    const inside: Light[] = []
    w.group.traverse((o) => {
      if (isLight(o) && o !== w.lights.sun && o !== w.lights.hemi) inside.push(o)
    })
    expect(inside).toEqual([])
    // 모델 받기(실패)를 다 기다린다 (테스트가 끝난 뒤 진짜 fetch 로 가지 않게)
    await meadowReady()
  })
})

describe('낮과 밤', () => {
  it('낮(12:00)엔 가로등·섬 등불 세기 0, 밤(00:00)엔 켜진다', async () => {
    const { followMeadowSun, islandLanterns, meadowWorld } = await import('./meadowSingleton')
    const lamps = [...meadowWorld().lights.lamps, ...islandLanterns()]
    followMeadowSun(YARD, 0.25)
    for (const l of lamps) expect(l.intensity).toBeCloseTo(0)
    followMeadowSun(YARD, 0.75)
    for (const l of lamps) expect(l.intensity).toBeCloseTo(7)
  })

  it('하늘: 낮엔 은지 낮 하늘, 밤엔 밤 하늘. 바다도 같은 색을 비춘다', async () => {
    const { followMeadowSun } = await import('./meadowSingleton')
    const { skyNow } = await import('../game/scene/skyNow')
    followMeadowSun(YARD, 0.25)
    expect(skyNow.background.getHexString()).toBe('a9d4f5')
    expect(skyNow.sea.getHexString()).toBe('a9d4f5')
    followMeadowSun(YARD, 0.75)
    expect(skyNow.background.getHexString()).toBe('0d1326')
    expect(skyNow.sea.getHexString()).toBe('0d1326')
  })

  it('실내에선 배경만 흰빛(밤엔 어둡게), 바다는 바깥 하늘 그대로', async () => {
    const { followMeadowSun } = await import('./meadowSingleton')
    const { skyNow } = await import('../game/scene/skyNow')
    followMeadowSun(BEDROOM, 0.25)
    expect(skyNow.background.getHexString()).toBe('ffffff')
    expect(skyNow.sea.getHexString()).toBe('a9d4f5')
    followMeadowSun(BEDROOM, 0.75)
    expect(skyNow.background.r).toBeLessThan(0.5)
  })

  it('해 방향은 은지 좌표를 180° 돌린 세계 방향 (아침 해는 은지 +x = 세계 -x 쪽)', async () => {
    const { followMeadowSun } = await import('./meadowSingleton')
    const { skyNow } = await import('../game/scene/skyNow')
    followMeadowSun(YARD, 0.05)
    expect(skyNow.sunDir.x).toBeLessThan(0)
    expect(skyNow.sunDir.y).toBeGreaterThan(0)
    expect(skyNow.sunDir.length()).toBeCloseTo(1)
  })

  it('폰(low)은 내가 있는 방 조명만 켜고, 보통은 모두 켠다 (빛 개수는 그대로)', async () => {
    const { meadowRoomLamps, updateRoomLamps } = await import('./meadowSingleton')
    const lamps = meadowRoomLamps()
    const bedroomLamp = lamps.find((l) => l.position.x === 0 && l.position.z === 0)!
    updateRoomLamps(true, BEDROOM)
    expect(bedroomLamp.intensity).toBe(5)
    expect(lamps.filter((l) => l.intensity > 0)).toEqual([bedroomLamp])
    updateRoomLamps(true, YARD)
    expect(lamps.every((l) => l.intensity === 0)).toBe(true)
    updateRoomLamps(false, YARD)
    expect(lamps.every((l) => l.intensity === 5)).toBe(true)
  })
})
```

`src/game/logic/settings.test.ts` — `'어항 크게 보기에서만 조용한 곡'` 테스트 다음에:

```ts
  it('밤엔 어디서든 조용한 곡', () => {
    expect(musicTrackFor('explore', true)).toBe('calm')
    expect(musicTrackFor('fishing', true)).toBe('calm')
    expect(musicTrackFor('explore', false)).toBe('island')
  })
```

- [ ] **Step 2: 실행해 실패 확인**

Run: `npx vitest run src/meadow/meadowSingleton.test.ts src/game/logic/settings.test.ts`
Expected: FAIL — `islandLanterns is not a function` (빛이 4+4 뿐), `Failed to resolve import "../game/scene/skyNow"`, 밤 곡이 `island`

- [ ] **Step 3: 하늘 객체와 은지 타입·등불 자리**

`src/game/scene/skyNow.ts`:

```ts
import { Color, Vector3 } from 'three'
import { SKY_DAY } from '../data/meadow'

/**
 * 지금 하늘. MeadowLighting 이 매 프레임 은지 낮과 밤에 맞춰 고치고, 장면 배경과 바다 셰이더가 같은 객체를 그대로 쓴다.
 * 모듈 변수라 hook 값을 useFrame 에서 고치지 않는다 (react(immutability) 경고)
 * background: 장면 배경 (실내면 흰빛을 어둡게), sea: 바다에 비치는 바깥 하늘, sunDir: 세계 좌표 해(밤엔 달빛) 방향
 */
export const skyNow = {
  background: new Color(SKY_DAY),
  sea: new Color(SKY_DAY),
  sunDir: new Vector3(0, 18, -6).normalize(),
}
```

`src/meadow/vendor/daynight.d.ts` — `t: number` 다음에:

```ts
  day: number
  /** 0 (밤) ~ 1 (낮). update 가 정한다 */
  light: number
  /** 플레이어에서 해까지 (은지 좌표). update 가 정한다 */
  offset: Vector3
```

`src/game/data/zones.ts` — `/** 쓰러지면 깨어나는 곳 (진료소 앞) */` 앞에:

```ts
/** 섬 등불 [x, 등 높이, z]: 선착장 끝·상점가(장비 상점과 판매함 사이). 밤에만 빛 세기를 올린다 (은지 가로등과 같은 식) */
export const ISLAND_LANTERNS: [number, number, number][] = [
  [1.25, 2.3, 29.5],
  [0.5, 2.3, 15],
]
```

- [ ] **Step 4: 조명 싱글턴** — `src/meadow/meadowSingleton.ts` 를 아래로 바꾼다 (가로등도 방 조명처럼 group 에서 꺼내고 숨기지 않는다, 섬 등불 2개를 DayNight 등불에 더한다, 시각으로 해·하늘을 맞춘다, 폰 방 조명):

```ts
import { PointLight, type Object3D, type Vector3 } from 'three'
import { ISLAND_LANTERNS } from '../game/data/zones'
import { skyNow } from '../game/scene/skyNow'
import { DayNight } from './vendor/daynight.js'
import { ROOMS, createWorld, type EunjiWorld } from './vendor/world.js'

let world: EunjiWorld | null = null
let daynight: DayNight | null = null
let roomLamps: PointLight[] = []
/** 방 조명마다 그 방 id (roomLamps 와 같은 순서) */
let roomLampRooms: string[] = []
let lanterns: PointLight[] | null = null
/** 은지 방 조명 세기 */
const ROOM_LAMP = 5

const isPointLight = (o: Object3D): o is PointLight => (o as PointLight).isPointLight === true

/**
 * 은지 맵. 한 번만 만든다 (모델을 내려받기 시작한다). 문은 3-2 전까지 열어 둔다.
 * group 은 모델이 다 온 뒤에 붙으므로 그 안의 빛은 미리 꺼낸다 (빛 개수가 중간에 바뀌면 모든 재질을 다시 컴파일해 끊긴다):
 * 방 조명·가로등은 group 에서 꺼내 MeadowLighting 이 처음부터 붙이고, 밤낮은 세기로만 바꾼다
 */
export function meadowWorld(): EunjiWorld {
  if (!world) {
    world = createWorld()
    for (const d of world.doors) d.setOpen(true, true)
    // 가로등도 같은 group 에 바로 붙어 있다 (처음 세기 0, DayNight 가 밤에 올린다)
    const town = new Set<Object3D>(world.lights.lamps)
    roomLamps = world.group.children.filter((o): o is PointLight => isPointLight(o) && !town.has(o))
    roomLampRooms = roomLamps.map((l) => ROOMS.find((r) => l.position.x >= r.minX && l.position.x <= r.maxX && l.position.z >= r.minZ && l.position.z <= r.maxZ)?.id ?? '')
    for (const l of [...roomLamps, ...world.lights.lamps]) world.group.remove(l)
  }
  return world
}

/** 방 조명 (은지 좌표). MeadowLighting 이 변환 그룹 아래에 붙인다 */
export function meadowRoomLamps(): PointLight[] {
  meadowWorld()
  return roomLamps
}

/** 섬 등불 빛 2개 (세계 좌표). 처음 세기 0 */
export function islandLanterns(): PointLight[] {
  lanterns ??= ISLAND_LANTERNS.map(([x, y, z]) => {
    const l = new PointLight(0xffc070, 0, 12, 2)
    l.position.set(x, y, z)
    return l
  })
  return lanterns
}

/** 은지 낮과 밤 (해·하늘빛·가로등·섬 등불을 움직인다) */
export function meadowDayNight(): DayNight {
  if (!daynight) {
    const { lights } = meadowWorld()
    daynight = new DayNight({ ...lights, lamps: [...lights.lamps, ...islandLanterns()] })
  }
  return daynight
}

/**
 * 가구·들판·마을 모델이 다 들어왔을 때 (실패한 모델은 빼고).
 * 은지 코드는 모델이 올 때 부모까지 포함한 좌표로 충돌 상자를 재므로, 이게 끝나기 전엔 group 을 장면(변환 그룹)에 붙이지 않는다
 */
export function meadowReady(): Promise<void> {
  const w = meadowWorld()
  return Promise.allSettled([w.furnitureReady, w.outdoor.ready, w.town.ready]).then(() => undefined)
}

/**
 * 지금 시각(t)으로 해·하늘빛·등불을 맞추고 플레이어(은지 좌표 local)를 따라 해를 옮긴다.
 * 하늘(skyNow): 배경은 실내면 흰빛을 어둡게(은지 roomAt), 바다는 늘 바깥 하늘. 해 방향은 180° 돌려 세계 좌표로
 */
export function followMeadowSun(local: Vector3, t: number) {
  const dn = meadowDayNight()
  dn.t = t
  dn.update(0, local)
  const outdoor = meadowWorld().roomAt(local.x, local.z).outdoor === true
  skyNow.background.copy(dn.skyFor(outdoor).color)
  skyNow.sea.copy(dn.skyFor(true).color)
  skyNow.sunDir.set(-dn.offset.x, dn.offset.y, -dn.offset.z).normalize()
}

/** 방 조명 세기: 보통은 모두 켠다. 폰(low)은 내가 있는 방만 (빛 개수는 그대로, 세기만) */
export function updateRoomLamps(low: boolean, local: Vector3) {
  const here = low ? meadowWorld().roomAt(local.x, local.z).id : null
  roomLamps.forEach((l, i) => {
    l.intensity = here === null || roomLampRooms[i] === here ? ROOM_LAMP : 0
  })
}

/** 해 그림자 지도 크기를 바꾼다 (지도를 새로 만든다) */
export function setMeadowShadowSize(size: number) {
  const { sun } = meadowWorld().lights
  sun.shadow.mapSize.set(size, size)
  sun.shadow.map?.dispose()
  sun.shadow.map = null
}
```

- [ ] **Step 5: 실행해 통과 확인**

Run: `npx vitest run src/meadow/meadowSingleton.test.ts`
Expected: PASS (6 tests). 이때 `MeadowLighting.tsx` 는 아직 옛 함수(`meadowSkyColor`, 인자 하나짜리 `followMeadowSun`)를 불러 `npx tsc -b` 가 실패한다 — 다음 단계에서 고친다.

- [ ] **Step 6: 장면에 붙이기**

`src/meadow/MeadowLighting.tsx` 를 아래로 바꾼다:

```tsx
import { useEffect } from 'react'
import { useFrame } from '@react-three/fiber'
import { Vector3 } from 'three'
import { MEADOW_POS, MEADOW_YAW, toMeadowLocal } from '../game/data/meadow'
import { useQualityLevel, useQualityPreset } from '../game/input/touchDevice'
import { playerRig } from '../game/scene/Player'
import { skyNow } from '../game/scene/skyNow'
import { liveClock } from '../game/stores/dayStore'
import { followMeadowSun, islandLanterns, meadowRoomLamps, meadowWorld, setMeadowShadowSize, updateRoomLamps } from './meadowSingleton'

// 매 프레임 new 하지 않도록 재사용 (은지 좌표의 플레이어 위치)
const local = new Vector3()

/**
 * 세계 조명은 은지 것 한 벌: 해(그림자)·하늘빛·방 조명 4·가로등 4·섬 등불 2 를 처음부터 여기 붙인다 (빛 개수가 첫 프레임부터 같다).
 * 매 프레임 지금 시각(liveClock)으로 해·하늘·등불 세기를 맞춘다. 해와 그림자 범위(±22m)는 은지 DayNight 가 플레이어를 따라 옮긴다
 */
export function MeadowLighting() {
  const { sun, hemi, lamps } = meadowWorld().lights
  const { shadowMapSize } = useQualityPreset()
  const low = useQualityLevel() === 'low'

  // 그림자 지도 크기는 품질 설정을 따른다 (바뀌면 지도를 새로 만든다)
  useEffect(() => setMeadowShadowSize(shadowMapSize), [shadowMapSize])

  useFrame(() => {
    const [x, z] = toMeadowLocal(playerRig.position.x, playerRig.position.z)
    local.set(x, playerRig.position.y, z)
    followMeadowSun(local, liveClock.t)
    updateRoomLamps(low, local)
  })

  return (
    <>
      {/* 하늘색: 은지 하늘 (매 프레임 skyNow 를 고친다) */}
      <primitive object={skyNow.background} attach="background" />
      {/* 하늘빛은 세계 위치로 "위" 방향을 정한다. 변환 그룹 아래면 (200, 1, 0) 이라 옆을 비추므로 장면에 바로 둔다 */}
      <primitive object={hemi} />
      <group position={MEADOW_POS} rotation-y={MEADOW_YAW}>
        <primitive object={sun} />
        <primitive object={sun.target} />
        {meadowRoomLamps().map((l) => (
          <primitive key={l.uuid} object={l} />
        ))}
        {lamps.map((l) => (
          <primitive key={l.uuid} object={l} />
        ))}
      </group>
      {islandLanterns().map((l) => (
        <primitive key={l.uuid} object={l} />
      ))}
    </>
  )
}
```

`src/game/scene/Ocean.tsx`:
- import: `three` 에서 `Vector3` 를 빼고(`import { Color, PlaneGeometry, ShaderMaterial, Vector2 } from 'three'`), `import { MEADOW_RECT } from '../data/meadow'` (SKY_DAY 빼기), `import { WAVES } from '../logic/waves'` 다음 줄에 `import { skyNow } from './skyNow'`.
- uniforms 두 개:

```ts
          // 하늘과 해 방향은 낮과 밤을 따라 MeadowLighting 이 고치는 객체를 그대로 쓴다
          uSky: { value: skyNow.sea },
```

```ts
          uSunDir: { value: skyNow.sunDir },
```

(`// 은지 해(정오): …` 주석 줄은 지운다. `useFrame` 의 `uTime` 은 그대로 — 기준선 경고 한 줄도 그대로다.)

`src/game/scene/decor/IslandLanterns.tsx`:

```tsx
import { ISLAND_LANTERNS } from '../../data/zones'

/** 선착장 끝·상점가 등불 기둥. 빛은 MeadowLighting 이 처음부터 붙이고 밤에만 세기를 올린다 (빛 개수를 같게) */
export function IslandLanterns() {
  return (
    <>
      {ISLAND_LANTERNS.map(([x, y, z]) => (
        <group key={`${x},${z}`} position={[x, 0, z]}>
          <mesh position={[0, (y - 0.2) / 2, 0]} castShadow>
            <cylinderGeometry args={[0.06, 0.08, y - 0.2, 8]} />
            <meshStandardMaterial color="#5d4037" />
          </mesh>
          <mesh position={[0, y, 0]}>
            <boxGeometry args={[0.28, 0.36, 0.28]} />
            <meshStandardMaterial color="#ffe0a3" emissive="#ffb74d" emissiveIntensity={0.6} />
          </mesh>
        </group>
      ))}
    </>
  )
}
```

`src/game/scene/World.tsx` — `import { IslandLanterns } from './decor/IslandLanterns'` (IslandDecor import 다음), `<IslandDecor />` 다음 줄에 `<IslandLanterns />`.

- [ ] **Step 7: 밤 음악**

`src/game/logic/music.ts`:

```ts
/** 지금 틀 곡: 어항 크게 보기와 밤에는 조용한 곡, 그 밖엔 섬 곡 */
export function musicTrackFor(mode: Mode, night = false): MusicTrack {
  return mode === 'aquariumView' || night ? 'calm' : 'island'
}
```

`src/game/audio/backgroundMusic.ts`:
- `import { useDayStore } from '../stores/dayStore'` (sessionStore import 앞).
- `useBackgroundMusic` 주석의 `화면(어항 크게 보기)에 따라` → `화면(어항 크게 보기)·밤에 따라`.
- `const onGesture` 앞에:

```ts
    // 화면(어항 크게 보기)과 밤을 보고 곡을 고른다
    const track = () => musicTrackFor(useSessionStore.getState().mode, useDayStore.getState().night)
```

- `music.start(musicTrackFor(useSessionStore.getState().mode), volume())` → `music.start(track(), volume())`
- 구독 두 줄과 정리:

```ts
    const unsubMode = useSessionStore.subscribe(() => music.setTrack(track()))
    const unsubNight = useDayStore.subscribe(() => music.setTrack(track()))
```

```ts
      unsubMode()
      unsubNight()
```

- [ ] **Step 8: 확인**

Run: `npx vitest run && npx tsc -b && npm run lint 2>&1 | grep -c warning`
Expected: PASS (58 파일 / 597 개), tsc 출력 없음, warning 6 (Ocean 의 `uTime` 한 줄 그대로, 새 경고 없음)

- [ ] **Step 9: 커밋**

```bash
git add src/game/scene/skyNow.ts src/meadow/vendor/daynight.d.ts src/game/data/zones.ts src/meadow/meadowSingleton.ts src/meadow/meadowSingleton.test.ts src/meadow/MeadowLighting.tsx src/game/scene/Ocean.tsx src/game/scene/decor/IslandLanterns.tsx src/game/scene/World.tsx src/game/logic/music.ts src/game/logic/settings.test.ts src/game/audio/backgroundMusic.ts
git commit -m "feat: 낮과 밤 화면" -m "정오 고정을 풀고 지금 시각으로 은지 해·하늘빛을 움직인다. 배경과 바다 하늘색·해 방향은 skyNow 한 객체를 같이 쓰고, 실내(은지 roomAt)에선 배경만 흰빛을 어둡게 한다. 안개는 그대로 끈다.
마을 가로등 4개를 은지 group 에서 꺼내 처음부터 붙이고, 섬 선착장 끝·상점가에 등불 2개를 더했다 (빛 10개, 밤에만 세기). 폰(low)은 방 조명을 내가 있는 방만 켠다.
밤에는 조용한 곡."
```

---

### Task 7: HUD 시계·배고픔, 배고파요 경고, 잠 화면

**Files:**
- Modify: `src/game/ui/Hud.tsx`, `src/game/ui/WeaknessOverlay.tsx`
- Create: `src/game/ui/SleepOverlay.tsx`
- Modify: `src/game/Game.tsx`

**Interfaces:**
- Consumes: `useDayStore` 의 `clockText`·`seq`·`voting`·`sleepers` (Task 4), `wake()` (Task 5), `seqOpacity` (Task 1), `isStarving` (Task 2), `HUNGER` (Task 2)
- Produces: `<SleepOverlay />` (Game 에서 `NoticeLayer` 바로 앞)

UI 라 단위 테스트 대신 Task 8 의 헤드리스 점검(14~17)이 확인한다. 이 Task 는 화면만 바꾸고 규칙은 바꾸지 않는다.

- [ ] **Step 1: HUD** — `src/game/ui/Hud.tsx`
- import: `import { HUNGER, STAMINA } from '../data/balance'`, 그리고 progressStore import 앞에

```ts
import { isStarving } from '../logic/survival'
import { useDayStore } from '../stores/dayStore'
```

- `const survival = …` 다음 줄: `const clock = useDayStore((s) => s.clockText)`
- `const ratio = …` 다음 줄: `const hungerRatio = survival.hunger / HUNGER.max`
- `<strong>코인 {coins}</strong>` 을 코인 + 시계 한 줄로 (좁으면 시계가 다음 줄로 내려간다):

```tsx
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'baseline', columnGap: 10 }}>
          <strong>코인 {coins}</strong>
          <span style={{ fontSize: 14, whiteSpace: 'nowrap' }}>{clock}</span>
        </div>
```

- 체력 막대 다음의 낮은 체력 안내(`{survival.stamina < STAMINA.lowHint && (…배고파요!…)}`)를 배고픔 막대 + "지쳤어요" 안내로 바꾼다:

```tsx
        <div style={{ fontSize: 13, marginTop: 4 }}>배고픔 {Math.ceil(survival.hunger)}</div>
        <div style={{ height: 6, background: '#333', borderRadius: 3, overflow: 'hidden', marginTop: 2 }}>
          <div style={{ width: `${hungerRatio * 100}%`, height: '100%', background: hungerRatio < 0.25 ? '#ef5350' : '#ffb74d' }} />
        </div>
        {/* 굶을 때 경고는 WeaknessOverlay 가 화면 가운데에 띄운다 */}
        {survival.stamina < STAMINA.lowHint && !isStarving(survival) && (
          <div style={{ fontSize: 12, marginTop: 4, color: '#ffab91', textShadow: '0 1px 2px #000' }}>지쳤어요! {MARKET.name}에서 음식을 사 먹거나 벤치에서 쉬세요</div>
        )}
```

- [ ] **Step 2: 배고파요 경고** — `src/game/ui/WeaknessOverlay.tsx` 를 아래로 바꾼다 (약화 경고는 그대로, 약화가 아닐 때 배고픔 0 이면 주황 경고):

```tsx
import { useEffect } from 'react'
import { isStarving } from '../logic/survival'
import { useProgressStore } from '../stores/progressStore'
import { playHeartbeat } from './heartbeat'

/**
 * 약화 상태: 화면 가장자리 붉은 효과 + 쓰러지기까지 남은 시간 + 심장 소리.
 * 굶는 중(배고픔 0): 주황 가장자리 + "배고파요!" (체력이 다 떨어지면 침대에서 깨어난다)
 */
export function WeaknessOverlay() {
  const graceLeft = useProgressStore((s) => s.survival.graceLeft)
  const starving = useProgressStore((s) => isStarving(s.survival))
  const weak = graceLeft !== null

  useEffect(() => {
    if (!weak) return
    playHeartbeat()
    const id = setInterval(playHeartbeat, 1000)
    return () => clearInterval(id)
  }, [weak])

  if (graceLeft === null) {
    if (!starving) return null
    return (
      <div style={{ position: 'absolute', inset: 0, zIndex: 900, pointerEvents: 'none', boxShadow: 'inset 0 0 120px 30px rgba(230, 120, 0, 0.45)' }}>
        {/* 위쪽 가운데 목표 안내(GoalTracker) 아래에 띄운다 */}
        <div style={{ position: 'absolute', top: 120, width: '100%', textAlign: 'center', color: '#ffcc80', fontWeight: 800, fontSize: 18, textShadow: '0 1px 3px #000' }}>
          배고파요! 뭐라도 먹어야 해요
        </div>
      </div>
    )
  }
  const minutes = Math.floor(graceLeft / 60)
  const seconds = Math.floor(graceLeft % 60)
  return (
    <div style={{ position: 'absolute', inset: 0, zIndex: 900, pointerEvents: 'none', boxShadow: 'inset 0 0 140px 40px rgba(200, 0, 0, 0.55)' }}>
      <div style={{ position: 'absolute', top: 56, width: '100%', textAlign: 'center', color: '#ff8a80', fontWeight: 800, fontSize: 18, textShadow: '0 1px 3px #000' }}>
        기진맥진! {minutes}:{String(seconds).padStart(2, '0')} 안에 먹거나 쉬지 않으면 쓰러져요
      </div>
    </div>
  )
}
```

- [ ] **Step 3: 잠 화면** — `src/game/ui/SleepOverlay.tsx`

```tsx
import { useEffect, useRef } from 'react'
import { seqOpacity } from '../logic/restSeq'
import { wake } from '../scene/day/dayActions'
import { useDayStore } from '../stores/dayStore'
import { button } from './styles'

/**
 * 잠·죽음·방 아침 때 화면을 어둡게 한다 (불투명도만 매 프레임 바꾼다, React 다시 그리기 없이).
 * 같이 하기 잠 투표 중엔 "😴 잠자는 중 (n/필요 수)" 와 일어나기 버튼. 알림(NoticeLayer)은 이 위에 뜬다
 */
export function SleepOverlay() {
  const fade = useRef<HTMLDivElement>(null)
  const voting = useDayStore((s) => s.voting)
  const sleepers = useDayStore((s) => s.sleepers)

  useEffect(() => {
    let raf = 0
    const tick = () => {
      raf = requestAnimationFrame(tick)
      const seq = useDayStore.getState().seq
      const o = seq ? seqOpacity(seq.kind, performance.now() / 1000 - seq.startedAt) : 0
      if (fade.current) fade.current.style.opacity = String(o)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [])

  return (
    <>
      {voting && (
        <div style={{ position: 'absolute', inset: 0, zIndex: 1000, background: 'rgba(5, 10, 30, 0.55)', color: '#fff', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, pointerEvents: 'auto' }}>
          <div style={{ fontSize: 22, fontWeight: 800 }}>{sleepers ? `😴 잠자는 중 (${sleepers.n}/${sleepers.need})` : '😴 잠자는 중…'}</div>
          {sleepers && <div style={{ fontSize: 14, opacity: 0.85 }}>{Math.max(0, sleepers.need - sleepers.n)}명 더 자면 모두 아침이 와요</div>}
          <button style={button} onClick={wake}>
            일어나기
          </button>
        </div>
      )}
      <div ref={fade} style={{ position: 'absolute', inset: 0, zIndex: 1000, background: '#000', opacity: 0, pointerEvents: 'none' }} />
    </>
  )
}
```

`src/game/Game.tsx` — `import { SleepOverlay } from './ui/SleepOverlay'` (WeaknessOverlay import 다음), `<NoticeLayer />` 바로 앞에 `<SleepOverlay />` (페이드가 HUD·패널을 덮고 알림은 그 위에 뜬다).

- [ ] **Step 4: 확인**

Run: `npx vitest run && npx tsc -b && npm run lint 2>&1 | grep -c warning`
Expected: PASS (58 파일 / 597 개), tsc 출력 없음, warning 6

`npm run dev` 로 띄워 혼자 하기에서 눈으로 본다: 왼쪽 위 `코인 0  🌅 1일차 06:0x`, 체력 막대 아래 배고픔 막대. 개발자 도구 콘솔에서

```js
(await import('/src/game/stores/progressStore.ts')).useProgressStore.setState({ survival: { stamina: 50, hunger: 0, graceLeft: null, buffs: [] } })
```

→ 주황 가장자리 + "배고파요! 뭐라도 먹어야 해요" 가 위쪽 목표 안내 **아래**에 보이고, 약 33초 뒤 화면이 어두워졌다가 침대 옆에서 깨어난다.

- [ ] **Step 5: 커밋**

```bash
git add src/game/ui/Hud.tsx src/game/ui/WeaknessOverlay.tsx src/game/ui/SleepOverlay.tsx src/game/Game.tsx
git commit -m "feat: 시계·배고픔 HUD 와 잠 화면" -m "왼쪽 위 코인 옆에 은지 시계(☀️ 3일차 14:20), 체력 아래 배고픔 막대. 체력이 낮을 때 안내는 '지쳤어요' 로 바꾸고, 배고픔 0 이면 화면 가운데에 '배고파요! 뭐라도 먹어야 해요'.
잠·죽음·방 아침에 화면이 어두워졌다 밝아지고, 같이 하기 잠 투표 중엔 '잠자는 중 (n/필요 수)' 와 일어나기 버튼."
```

---

### Task 8: 헤드리스 점검과 마무리 (사용자 확인 단계 포함)

**Files:**
- Modify: `tools/meadow-check.mjs` (점검 14~17)
- Modify: 필요하면 `docs/superpowers/specs/2026-11-18-eunji-features-design.md` (구현하며 바꾼 값)

**Interfaces:**
- Consumes: Task 1~7 전부. 점검은 개발 서버 모듈을 `__mod` 로 불러 상태를 바꾸고 읽는다: `useDayStore`·`liveClock` (`/src/game/stores/dayStore.ts`), `useProgressStore`, `useSessionStore`, `skyNow` (`/src/game/scene/skyNow.ts`), `meadowWorld`·`islandLanterns` (`/src/meadow/meadowSingleton.ts`), `playerRig`
- Produces: 없음

- [ ] **Step 1: 점검 추가** — `tools/meadow-check.mjs` 의 `check(!consoleErrors.some((e) => /shader|WebGLProgram/i.test(e)), '셰이더 컴파일 오류가 없다')` 바로 앞에 넣는다 (`session`·`mode`·`teleport`·`open`·`RUN` 은 위에 이미 있다):

```js
// --- 3-1 시간과 생존 ---
const dayStore = `(await __mod('/src/game/stores/dayStore.ts')).useDayStore.getState()`
const progress = `(await __mod('/src/game/stores/progressStore.ts')).useProgressStore`
const live = `(await __mod('/src/game/stores/dayStore.ts')).liveClock`
const BED = [197.8, -2.4]
const nearBed = (p) => Math.hypot(p[0] - BED[0], p[2] - BED[1]) < 1.5

// 14) 밤이 온다: 혼자 시계를 22:00 으로 옮기면 HUD 가 🌙, 하늘이 어둡고 광장 가로등·섬 등불이 켜진다
// 광장 분수 앞 (카메라가 분수·가로등 쪽을 본다)
await A.evaluate(teleport(150, 0))
await wait(1500)
await A.evaluate(`(async () => { ${dayStore}.setSoloClock({ t: 16 / 24, day: 1 }); return true })()`)
await wait(800)
check(await A.until(`document.body.innerText.includes('🌙 1일차 22:')`, 3000), '14) HUD 시계가 🌙 1일차 22:xx')
const night = await A.evaluate(`(async () => {
  const { skyNow } = await __mod('/src/game/scene/skyNow.ts')
  const m = await __mod('/src/meadow/meadowSingleton.ts')
  return { sky: skyNow.background.r, lamp: m.meadowWorld().lights.lamps[0].intensity, lantern: m.islandLanterns()[0].intensity }
})()`)
check(night.sky < 0.05 && night.lamp > 5 && night.lantern > 5, `14) 밤 하늘이 어둡고 가로등·섬 등불이 켜진다 (${JSON.stringify(night)})`)
await A.shot('14-night-town')
await A.evaluate(teleport(0, 18))
await wait(2000)
await A.shot('14-night-island')
await A.evaluate(`(async () => { ${dayStore}.setSoloClock({ t: 0.25, day: 1 }); return true })()`)
await wait(800)
check(await A.until(`document.body.innerText.includes('☀️ 1일차 12:')`, 3000), '14) 낮으로 돌리면 ☀️')

// 15) 혼자 잠: 침대 옆에서 E → 화면이 어두워졌다가 다음 날 06:00, 체력 100, 배고픔 −15
await A.evaluate(teleport(BED[0], BED[1]))
check(await A.until(`document.body.innerText.includes('잠자기')`, 5000), '15) 침대 옆에서 "잠자기" 안내')
await A.evaluate(`(async () => { ${progress}.setState({ survival: { stamina: 40, hunger: 50, graceLeft: null, buffs: [] } }); return true })()`)
await A.key('keydown', 'KeyE', 'e')
await A.key('keyup', 'KeyE', 'e')
await wait(500)
await A.shot('15-sleep-fade')
await wait(2500)
const slept = await A.evaluate(`(async () => { const p = ${progress}.getState(); return [p.survival.stamina, p.survival.hunger, p.clock.day, (${dayStore}).clockText] })()`)
check(slept[0] > 99 && slept[1] > 33 && slept[1] < 36 && slept[2] === 2 && slept[3].includes('2일차 06:'), `15) 다음 날 아침, 체력 100·배고픔 35 (${JSON.stringify(slept)})`)
check((await A.evaluate(mode)) === 'explore', '15) 깨면 탐험 모드')

// 16) 굶어 죽음: 배고픔 0 이면 경고, 체력이 다 떨어지면 침대 옆에서 깨어난다 (다음 날, 체력 100·배고픔 60). 그 자리를 저장한다
await A.evaluate(teleport(150, 0))
await wait(1500)
await A.evaluate(`(async () => { ${progress}.setState({ survival: { stamina: 3, hunger: 0, graceLeft: null, buffs: [] } }); return true })()`)
check(await A.until(`document.body.innerText.includes('배고파요! 뭐라도 먹어야 해요')`, 1500), '16) 배고픔 0 이면 "배고파요" 경고')
await A.shot('16-starving')
await wait(7000)
const woke = await A.evaluate(`(async () => { const p = ${progress}.getState(); const { playerRig } = await __mod('/src/game/scene/Player.tsx'); return { pos: [playerRig.position.x, playerRig.position.y, playerRig.position.z], s: p.survival, day: p.clock.day } })()`)
check(nearBed(woke.pos) && woke.s.stamina > 99 && woke.s.hunger > 58 && woke.day === 3, `16) 침대 옆에서 깨어남 (${JSON.stringify(woke)})`)
await wait(1500)
const savedBed = await A.evaluate(`JSON.parse(localStorage.getItem('fishing-island-place-v1') || 'null')?.state?.place ?? null`)
check(!!savedBed && Math.hypot(savedBed.x - BED[0], savedBed.z - BED[1]) < 2, `16) 깨어난 침대 옆을 저장한다 (${JSON.stringify(savedBed && [savedBed.x, savedBed.z])})`)
await A.shot('16-woke-bed')
// 배 타는 중 굶어 죽어도 배에서 내려 침대로
await A.evaluate(teleport(88.5, -2))
check(await A.until(`document.body.innerText.includes('배 타기 (섬으로)')`, 5000), '16) 선착장 안내')
await A.key('keydown', 'KeyE', 'e')
await A.key('keyup', 'KeyE', 'e')
await wait(1500)
await A.evaluate(`(async () => { ${progress}.setState({ survival: { stamina: 1, hunger: 0, graceLeft: null, buffs: [] } }); return true })()`)
await wait(7000)
const wokeBoat = await A.evaluate(`(async () => { const s = ${session}; const { playerRig } = await __mod('/src/game/scene/Player.tsx'); return { pos: [playerRig.position.x, playerRig.position.y, playerRig.position.z], boat: s.boat, mode: s.mode } })()`)
check(nearBed(wokeBoat.pos) && wokeBoat.boat === null && wokeBoat.mode === 'explore', `16) 배 타다 죽어도 침대 옆, 배에서 내림 (${JSON.stringify(wokeBoat)})`)

// 17) 같이 하기: 두 사람 시계가 같고, 한 사람이 자면(2명 중 1명 = 절반) 둘 다 아침. 같이 할 땐 죽어도 시간 그대로
const A3 = await open(9735, 0, `?room=night-${RUN}`)
await A3.evaluate(`__click('🔒 방 만들기')`)
await A3.evaluate(`__fill('암호', 'secret1') && __fill('닉네임', '에이')`)
await A3.evaluate(`__click('방 만들고 들어가기')`)
check(await A3.until(`document.body.innerText.includes('👥 1명')`, 20000), '17) A 방 만들기')
const B3 = await open(9736, 1, `?room=night-${RUN}`)
await B3.evaluate(`__fill('암호', 'secret1') && __fill('닉네임', '비이')`)
await B3.evaluate(`__click('들어가기')`)
check(await B3.until(`document.body.innerText.includes('👥 2명')`, 20000), '17) B 들어가기')
await wait(1500)
const clocks = [await A3.evaluate(`(async () => ({ ...${live} }))()`), await B3.evaluate(`(async () => ({ ...${live} }))()`)]
check(clocks[0].day === clocks[1].day && Math.abs(clocks[0].t - clocks[1].t) < 0.01, `17) 두 사람 시계가 같다 (${JSON.stringify(clocks)})`)
await A3.evaluate(teleport(BED[0], BED[1]))
check(await A3.until(`document.body.innerText.includes('잠자기')`, 5000), '17) A 침대 안내')
await A3.key('keydown', 'KeyE', 'e')
await A3.key('keyup', 'KeyE', 'e')
check(await B3.until(`document.body.innerText.includes('일차 아침이 됐어요')`, 5000), '17) A 가 자면 B 에게도 아침')
const mornings = [await A3.evaluate(`(async () => ({ ...${live} }))()`), await B3.evaluate(`(async () => ({ ...${live} }))()`)]
check(mornings.every((c) => c.day === clocks[0].day + 1 && c.t < 0.02), `17) 둘 다 다음 날 06:00 (${JSON.stringify(mornings)})`)
await wait(1500)
check((await A3.evaluate(mode)) === 'explore', '17) 잔 사람도 탐험으로 돌아온다')
const roomDay = mornings[0].day
const soloDay = await A3.evaluate(`(async () => ${progress}.getState().clock.day)()`)
await A3.evaluate(`(async () => { ${progress}.setState({ survival: { stamina: 1, hunger: 0, graceLeft: null, buffs: [] } }); return true })()`)
await wait(7000)
const roomDeath = await A3.evaluate(`(async () => ({ day: ${live}.day, solo: ${progress}.getState().clock.day }))()`)
check(roomDeath.day === roomDay && roomDeath.solo === soloDay, `17) 같이 할 땐 죽어도 날짜 그대로, 혼자 시계도 그대로 (${JSON.stringify(roomDeath)})`)
await A3.shot('17-room-woke')
A3.close()
B3.close()
```

- [ ] **Step 2: 헤드리스 점검 실행**

다른 터미널 둘에서 `npm run server:dev` 와 `VITE_ROOM_SERVER=ws://127.0.0.1:8787 npx vite --port 5190 --strictPort` 를 띄우고:

Run: `node tools/meadow-check.mjs http://localhost:5190 <스크래치패드>/meadow-check`
Expected: 1)~17) 과 `셰이더 컴파일 오류가 없다` 모두 `OK` (8분쯤 걸린다). 새 줄 예:
`OK   14) 밤 하늘이 어둡고 가로등·섬 등불이 켜진다 ({"sky":0.004…,"lamp":7,"lantern":7})`,
`OK   15) 다음 날 아침, 체력 100·배고픔 35 ([100,35,2,"🌅 2일차 06:0x"])`,
`OK   16) 배 타다 죽어도 침대 옆, 배에서 내림 (…"boat":null,"mode":"explore"})`,
`OK   17) 같이 할 땐 죽어도 날짜 그대로, 혼자 시계도 그대로 ({"day":2,"solo":1})`.

스크린샷을 눈으로 본다: `14-night-town.png` (어두운 하늘, 광장 가로등 불빛), `14-night-island.png` (선착장 끝·상점가 등불이 시설과 겹치지 않는지 — 겹치면 `ISLAND_LANTERNS` 만 옮기고 다시 찍는다), `15-sleep-fade.png` (검게 어두워지는 중), `16-starving.png` ("배고파요" 가 위쪽 목표 안내에 가리지 않는다), `17-room-woke.png`.

- [ ] **Step 3: 전체 점검**

```bash
npx vitest run > <스크래치패드>/vitest.txt 2>&1; grep -E "Test Files|Tests " <스크래치패드>/vitest.txt
npx tsc -b && npm run build 2>&1 | tail -5
npm run lint 2>&1 | grep -c warning
node tools/room-smoke.mjs ws://127.0.0.1:8787
node tools/multiplayer-check.mjs http://localhost:5190 <스크래치패드>/mp
node tools/hub-entry-check.mjs http://localhost:5190 <스크래치패드>/hub
```

Expected: `Test Files  58 passed (58)`, `Tests  597 passed (597)`, 빌드 성공, warning 6, 세 점검 모두 OK (옛 점검이 깨지지 않는다).

- [ ] **Step 4: 커밋**

```bash
git add tools/meadow-check.mjs
git commit -m "test: 낮과 밤·잠·죽음 헤드리스 점검" -m "14) 밤이 오면 HUD 🌙, 하늘이 어둡고 가로등·섬 등불이 켜진다. 15) 혼자 잠: 다음 날 06:00, 체력 100·배고픔 35.
16) 굶어 죽으면 침대 옆에서 깨어나고 그 자리를 저장한다. 배 타다 죽어도 배에서 내려 침대로.
17) 같이 하기: 두 사람 시계가 같고, 한 사람이 자면 둘 다 아침. 같이 할 땐 죽어도 날짜 그대로."
```

- [ ] **Step 5: 스펙과 다른 점 정리** — 구현하며 바꾼 값(섬 등불 자리, 침대 감지 상자, 로비에서 시간 멈춤 등 이 계획 "결정한 것")을 스펙 3-1 해당 줄에 반영하고 커밋:

```bash
git add docs/superpowers/specs/2026-11-18-eunji-features-design.md
git commit -m "docs: 3-1 설계를 구현에 맞춤"
```

바꾼 값이 없으면 건너뛴다.

- [ ] **Step 6: [사용자 확인] 서버 배포** — 사용자에게 "같이 하기 서버에 시계·잠 투표를 배포해도 될까요? 새 메시지는 선택 필드라 지금 배포된 게임(main)도 그대로 됩니다" 라고 묻고, 허락하면:

```bash
npm run server:deploy
```

Expected: wrangler 가 `rinfish-rooms` 배포 성공을 알린다. 배포 뒤 지금 배포된 게임(https://rinfish.vercel.app)에서 방 만들기·들어가기·채팅이 그대로 되는지 브라우저로 확인한다 (옛 클라이언트는 `time`·`sleepers`·`morning` 을 버린다).

- [ ] **Step 7: [사용자 확인] 다음 단계** — 브랜치 push(Vercel 미리보기)·main 합치기는 사용자가 정한다 (스펙: 묶음마다 Codex 리뷰, 마지막에 전체 리뷰). 폰으로 볼 것을 정리해 준다: 밤 화면(가로등·섬 등불), 프레임(빛 10개), HUD 시계·배고픔 막대가 위쪽 버튼과 겹치지 않는지, 침대 잠, 잠 투표 화면.

---

## 스펙 대응

| 스펙 (3-1) | Task |
|---|---|
| 체력 합치기: `survival.hunger`, 체력 주는 곳·차는 곳(배부름 0.8/s, 자는 동안 3/s, 벤치·음식), 배고픔 12분 | 2 (규칙), 5 (틱 연결) |
| 상태와 결과 표 (약화→진료소, 배고픔 0 경고·1.5/s, 굶어 죽음, 피해 죽음), 판정 순서 `logic/survival.ts` | 2 (`tickSurvival`, `takeDamage`), 7 (경고) |
| 음식 → 배고픔·체력 (간식·미스터찜; 은지 요리는 3-2) | 2 |
| 침대 E "잠자기", 혼자 잠 (1초, 06:00, 체력 100, 배고픔 −15) | 5 |
| 같이 잠 투표 (잠자는 중 n/필요 수 + 일어나기, 절반 올림, 맞으면 깬다는 3-3 에서 `startDeath`/`wake` 사용) | 3 (서버), 4 (상태), 5 (흐름), 7 (화면) |
| 죽음 → 침대 (1.6 + 1.4초, 침대 옆, 체력 100·배고픔 60, 혼자 다음 날·같이 그대로, 가방·코인 그대로), 배 타는 중 죽음 | 5 |
| 진료소 경로 그대로 | 2 (쓰러짐 그대로, 배고픔만 유지) |
| 시계 (480초, 혼자 저장 `{t, day}`, 같이 서버 시계, 정오 고정 풀기) | 1, 2, 4, 6 |
| 빛·하늘·바다 `uSky`·햇빛 방향, 실내 배경, 안개 끔 | 6 |
| 가로등 4 (밤에만), 섬 등불 2, 빛 10개, 폰 방 조명 | 6 |
| 밤 음악 `calm` | 6 |
| HUD "☀️ 3일차 14:20" | 7 |
| 서버: `clock {epoch, day0}`, welcome.time·time·sleepers·morning·sleep, alarm 30초·사람 있을 때만, protocolVersion 1 | 3 |
| 저장 version 3 (3-1 몫: `survival.hunger`, `clock`) | 2 |
| 확인: survival·시계(epoch)·잠 투표·프로토콜 단위 테스트, 헤드리스(밤·잠 투표 두 사람) | 1~5, 8 |
| 동물 진정 | 3-3 (이번엔 없음 — 동물이 아직 없다) |
| 배포 순서 서버 먼저 | 8 |
