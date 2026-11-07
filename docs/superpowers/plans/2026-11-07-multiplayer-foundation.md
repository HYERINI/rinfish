# 같이 하는 낚시섬 1단계 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 방 이름 + 암호로 모인 사람들이 서로의 캐릭터·동작을 보고 채팅할 수 있게 한다.

**Architecture:** Cloudflare Worker + Durable Object `Room`(방마다 하나)이 웹소켓 Hibernation API 로 입장 판정·메시지 검사·중계를 한다. 클라이언트는 순수 함수(logic)로 메시지를 만들고 검사하며, 다른 사람 모습은 모듈 객체 버퍼를 `useFrame` 에서 보간해 기존 `PlayerModel` 로 그린다. 서버 주소(`VITE_ROOM_SERVER`)가 없으면 지금 그대로 혼자 하기.

**Tech Stack:** React 19, R3F 9, drei 10, zustand 5, vitest, Cloudflare Workers / Durable Objects (wrangler), Web Crypto.

**Spec:** `docs/superpowers/specs/2026-11-07-multiplayer-foundation-design.md`

## Global Constraints

- 층 규칙: scene/ui → stores → logic → data. logic 은 순수 함수, 테스트를 붙인다. 서버(`server/`)는 `src/game/logic`·`src/game/data` 만 가져다 쓴다.
- 주석·문구는 한국어, 주변 코드 말투(…한다/…다)를 따른다.
- oxlint 경고는 지금 6개. 늘리지 않는다. `npx tsc -b`, `npx vitest run`, `npm run build` 모두 통과.
- 커밋 메시지: `feat:`/`fix:`/`docs:`/`chore:` (괄호 스코프 없음), 짧은 제목 + body, Co-Authored-By·도구 표기 없음.
- main push = Vercel 자동 배포. 서버 주소 환경변수가 없으면 화면이 지금과 같아야 push 해도 안전하다.
- 숫자: 방 최대 20명, 방 이름 1~20자, 암호 4~32자, 닉네임 1~10자, 채팅 60자, 채팅 기록 30줄, 말풍선 5초, 보내기 초당 5번(안 바뀌면 2초마다), 보간 지연 250ms, 서버 속도 제한 state 10/초·chat 1초·profile 5초, 빈 방 7일 뒤 재사용, 좌표 한계 40, 나이 상한 30초, 폰에서 그릴 인원 10, 재연결 1·2·4·8·10초.
- 저장 키: `fishing-island-net-v1` (방 이름·닉네임만, 암호 저장 금지).

## Review Focus

1. 다른 사람의 한 번짜리 감정 표현(구르기)이 state 를 받을 때마다 처음부터 다시 재생되는 것 → `fromNetAct` 가 같은 동작이면 시각을 유지해야 한다 (Task 3 테스트).
2. 채팅 입력 중 WASD·E·ESC·숫자·M 이 게임으로 새는 것 → 입력 칸에서 누른 키는 무시 (Task 9 테스트).
3. 서버가 재시작되거나 잠깐 끊긴 뒤 다시 붙을 때 `create` 를 다시 보내 `room-exists` 로 튕기는 것 → 첫 welcome 뒤엔 `join` 으로 (Task 6 테스트).
4. 누군가 이상한 JSON·거대한 문자열·범위 밖 좌표를 보내 다른 사람 화면이 깨지는 것 → 파서가 null (Task 3 테스트), 서버 4KB 넘는 메시지 버림 (Task 5).
5. 다른 사람이 쓰러져 진료소로 순간이동할 때 섬을 가로질러 미끄러지는 것 → 6m 넘게 떨어진 두 샘플은 보간하지 않는다 (Task 4 테스트).

---

### Task 1: 낚시 자세를 `FishingLook` 으로 분리

다른 사람 캐릭터는 `FishingState` 전체가 없고 자세 이름과 젖힘 정도만 받는다. `PlayerModel.update` 가 그것만 받게 바꾼다.

**Files:**
- Modify: `src/game/logic/characterPose.ts`
- Modify: `src/game/logic/characterPose.test.ts`
- Modify: `src/game/scene/PlayerModel.tsx`
- Modify: `src/game/scene/Player.tsx`

**Interfaces:**
- Produces: `type FishingPose = 'aim' | 'tug' | 'dragged' | 'celebrate' | 'fallBack' | 'dejected'`, `FISHING_POSES: FishingPose[]`, `type FishingLook = { pose: FishingPose; lean: number }`, `fishingLook(f: FishingState | null): FishingLook | null`, `characterPose(fishing: FishingLook | null, speed, resting?, standingUp?, action?, now?)`, `PlayerModelHandle.update(delta, now, fishing: FishingLook | null, action, speed, rodAngle, resting, seat?)`.

- [ ] **Step 1: 테스트를 새 모양으로 바꾼다**

`characterPose.test.ts` 에서 `characterPose(<FishingState>, …)` 를 부르는 곳을 모두 `characterPose(fishingLook(<FishingState>), …)` 로 바꾸고 `fishingLook` 을 import 한다. 그리고 아래 테스트를 더한다.

```ts
describe('fishingLook', () => {
  it('낚시 상태를 자세 이름과 상체 젖힘으로 줄인다', () => {
    expect(fishingLook(null)).toBeNull()
    expect(fishingLook({ stage: 'aiming', holding: false, holdTime: 0 })).toEqual({ pose: 'aim', lean: 0 })
    expect(fishingLook(done('snapped'))).toEqual({ pose: 'fallBack', lean: 0 })
    const tug = fishingLook(fighting(50, false))!
    expect(tug.pose).toBe('tug')
    expect(tug.lean).toBeGreaterThan(0.3)
    expect(fishingLook(fighting(50, true))).toEqual({ pose: 'dragged', lean: 0 })
  })
})
```
(`fighting`·`done` 은 이 파일에 이미 있는 도우미다.)

- [ ] **Step 2: 실패 확인** — `npx vitest run src/game/logic/characterPose.test.ts` → `fishingLook is not exported` 로 실패.

- [ ] **Step 3: 구현** — `characterPose.ts`:

```ts
/** 낚시 중 자세. 다른 사람 캐릭터는 FishingState 대신 이것만 받는다 */
export type FishingPose = 'aim' | 'tug' | 'dragged' | 'celebrate' | 'fallBack' | 'dejected'
export const FISHING_POSES: FishingPose[] = ['aim', 'tug', 'dragged', 'celebrate', 'fallBack', 'dejected']
/** 캐릭터를 그리는 데 필요한 낚시 정보: 자세와 줄다리기 상체 젖힘(leanBack) */
export type FishingLook = { pose: FishingPose; lean: number }

function fishingPose(fishing: FishingState): FishingPose {
  switch (fishing.stage) {
    case 'aiming':
    case 'waiting':
      return 'aim'
    case 'fighting':
      return fishing.fight.pull.active ? 'dragged' : 'tug'
    case 'done':
      if (fishing.result === 'caught') return 'celebrate'
      if (fishing.result === 'snapped') return 'fallBack'
      return 'dejected'
  }
}

export function fishingLook(fishing: FishingState | null): FishingLook | null {
  return fishing ? { pose: fishingPose(fishing), lean: leanBack(fishing) } : null
}
```
`characterPose` 의 첫 인자 타입을 `FishingLook | null` 로 바꾸고, 끝의 `switch (fishing.stage)` 블록을 `return fishing.pose` 로 바꾼다.

`PlayerModel.tsx`: import 에서 `leanBack`·`FishingState` 를 빼고 `type FishingLook` 을 넣는다. `PlayerModelHandle.update` 와 구현의 `fishing` 타입을 `FishingLook | null` 로, `a.lean += (leanBack(fishing) - a.lean) * k` 를 `a.lean += ((fishing?.lean ?? 0) - a.lean) * k` 로. 주석의 "동작 상태(action…)와 수평 속도만 보고" 문장 뒤에 "낚시는 FishingLook(자세·젖힘)만" 을 더한다.

`Player.tsx`: `import { fishingLook } from '../logic/characterPose'` 를 넣고 `m.update(delta, now, fishing, …)` 를 `m.update(delta, now, fishingLook(fishing), …)` 로.

- [ ] **Step 4: 통과 확인** — `npx vitest run && npx tsc -b` → 모두 통과. (`CharacterCreator` 는 이미 `null` 을 넘긴다.)

- [ ] **Step 5: 커밋**
```bash
git add src/game/logic/characterPose.ts src/game/logic/characterPose.test.ts src/game/scene/PlayerModel.tsx src/game/scene/Player.tsx
git commit -m "refactor: 캐릭터 모델이 낚시 자세(FishingLook)만 받게" -m "다른 사람 캐릭터는 FishingState 전체가 없고 자세 이름과 상체 젖힘만 주고받는다"
```

---

### Task 2: 네트워크 숫자와 방 키

**Files:**
- Create: `src/game/data/net.ts`
- Create: `src/game/logic/roomKey.ts`
- Test: `src/game/logic/roomKey.test.ts`

**Interfaces:**
- Produces: `NET` (아래 값), `NET_SAVE_KEY`, `cleanText(s): string`, `textLength(s): number`, `normalizeRoomName(s)`, `normalizeNick(s)`, `type LobbyField = 'room' | 'password' | 'nick'`, `lobbyErrors({ room, password, nick }): LobbyField[]`, `sha256Hex(text): Promise<string>`, `roomIdFor(room): Promise<string>`, `passHashFor(roomId, password): Promise<string>`, `readRoomParam(search: string): string`.

- [ ] **Step 1: 숫자** — `src/game/data/net.ts`:

```ts
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
```

- [ ] **Step 2: 실패하는 테스트** — `src/game/logic/roomKey.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { cleanText, lobbyErrors, normalizeNick, normalizeRoomName, passHashFor, readRoomParam, roomIdFor, sha256Hex, textLength } from './roomKey'

describe('글자 정리', () => {
  it('줄바꿈·제어문자를 지우고 앞뒤 공백을 자른다', () => {
    expect(cleanText('  안녕\n하세요\u0007 ')).toBe('안녕하세요')
  })
  it('방 이름은 소문자로, 닉네임은 그대로', () => {
    expect(normalizeRoomName('  Study 방 ')).toBe('study 방')
    expect(normalizeNick(' 혜린A ')).toBe('혜린A')
  })
  it('글자 수는 이모지도 한 글자', () => {
    expect(textLength('🎣낚시')).toBe(3)
  })
})

describe('lobbyErrors', () => {
  it('범위를 벗어난 칸만 알려 준다', () => {
    expect(lobbyErrors({ room: '스터디', password: '1234', nick: '혜린' })).toEqual([])
    expect(lobbyErrors({ room: '  ', password: '123', nick: '열한글자닉네임입니다요' })).toEqual(['room', 'password', 'nick'])
    expect(lobbyErrors({ room: 'a'.repeat(21), password: 'p'.repeat(33), nick: 'x' })).toEqual(['room', 'password'])
  })
})

describe('방 키', () => {
  it('sha256 16진수', async () => {
    expect(await sha256Hex('abc')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad')
  })
  it('방 id 는 정리한 이름에서 만든 32자, 대소문자·공백이 달라도 같다', async () => {
    const a = await roomIdFor('Study')
    expect(a).toMatch(/^[0-9a-f]{32}$/)
    expect(await roomIdFor('  study ')).toBe(a)
    expect(await roomIdFor('other')).not.toBe(a)
  })
  it('암호 해시는 방마다 다르고 대소문자를 구분한다', async () => {
    const h = await passHashFor('r1', 'Secret')
    expect(h).toMatch(/^[0-9a-f]{64}$/)
    expect(await passHashFor('r2', 'Secret')).not.toBe(h)
    expect(await passHashFor('r1', 'secret')).not.toBe(h)
  })
})

describe('readRoomParam', () => {
  it('?room= 값을 정리해서 돌려준다', () => {
    expect(readRoomParam('?room=%EC%8A%A4%ED%84%B0%EB%94%94')).toBe('스터디')
    expect(readRoomParam('?x=1')).toBe('')
  })
})
```

- [ ] **Step 3: 실패 확인** — `npx vitest run src/game/logic/roomKey.test.ts` → 모듈 없음.

- [ ] **Step 4: 구현** — `src/game/logic/roomKey.ts`:

```ts
import { NET } from '../data/net'

/** 줄바꿈·제어문자를 지우고 앞뒤 공백을 자른다 (채팅·닉네임·방 이름 공통) */
export function cleanText(s: string): string {
  // eslint-disable-next-line no-control-regex
  return s.replace(/[\u0000-\u001f\u007f]/g, '').trim()
}

/** 글자 수 (이모지 같은 서로게이트 쌍도 한 글자) */
export const textLength = (s: string) => [...s].length

export const normalizeRoomName = (s: string) => cleanText(s).toLowerCase()
export const normalizeNick = (s: string) => cleanText(s)

const within = (s: string, [lo, hi]: [number, number]) => textLength(s) >= lo && textLength(s) <= hi

export type LobbyField = 'room' | 'password' | 'nick'

/** 로비 입력 중 범위를 벗어난 칸들. 암호는 정리하지 않고 그대로 센다 */
export function lobbyErrors(input: { room: string; password: string; nick: string }): LobbyField[] {
  const bad: LobbyField[] = []
  if (!within(normalizeRoomName(input.room), NET.roomName)) bad.push('room')
  if (!within(input.password, NET.password)) bad.push('password')
  if (!within(normalizeNick(input.nick), NET.nick)) bad.push('nick')
  return bad
}

export async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

/** 서버 주소에 쓰는 방 id. 방 이름을 그대로 드러내지 않는다 */
export async function roomIdFor(room: string): Promise<string> {
  return (await sha256Hex(`rinfish-room|${normalizeRoomName(room)}`)).slice(0, 32)
}

/** 서버에 보내는 암호 해시. 서버는 이 값을 저장·비교만 한다 */
export function passHashFor(roomId: string, password: string): Promise<string> {
  return sha256Hex(`${roomId}|${password}`)
}

/** 공유 링크의 ?room= 값 */
export function readRoomParam(search: string): string {
  return normalizeRoomName(new URLSearchParams(search).get('room') ?? '')
}
```
(oxlint 가 `no-control-regex` 를 경고하면 주석 대신 `new RegExp('[\\u0000-\\u001f\\u007f]', 'g')` 로 바꿔 경고 수를 6개로 유지한다.)

- [ ] **Step 5: 통과 확인** — `npx vitest run src/game/logic/roomKey.test.ts && npx oxlint 2>&1 | grep -c warning` → 통과, 6.

- [ ] **Step 6: 커밋**
```bash
git add src/game/data/net.ts src/game/logic/roomKey.ts src/game/logic/roomKey.test.ts
git commit -m "feat: 같이 하기 숫자와 방 키 만들기" -m "방 이름·암호·닉네임 정리와 검사, 방 id·암호 해시(SHA-256)"
```

---

### Task 3: 속도 제한기와 메시지 형식

**Files:**
- Create: `src/game/logic/rateLimit.ts`, `src/game/logic/rateLimit.test.ts`
- Create: `src/game/logic/netProtocol.ts`, `src/game/logic/netProtocol.test.ts`

**Interfaces:**
- Consumes: `NET`, `cleanText`, `textLength` (Task 2), `FISHING_POSES`, `FishingLook` (Task 1), `normalizeLook` (`logic/characterLook`), `EMOTES` (`data/emotes`), `DISHES` (`data/dishes`), `SNACK_IDS` (`data/snacks`), `PlayerAction`·`IDLE_ACTION` (`logic/playerMotion`).
- Produces:
  - `allowEvery(last: number, now: number, every: number): boolean`
  - `type RateWindow = { start: number; count: number }`, `NEW_WINDOW`, `allowPerSecond(w, now, max): { ok: boolean; w: RateWindow }`
  - `type Vec3 = [number, number, number]`, `type NetAct`, `type NetState`, `type ClientMsg`, `type ServerMsg`, `type ErrorCode`, `type PeerInfo`, `type JoinMode`
  - `parseClientMsg(raw: string): ClientMsg | null`, `parseServerMsg(raw: string): ServerMsg | null`, `readNetState(v: unknown): NetState | null`
  - `roundState(s: NetState): NetState`, `stateKey(s: NetState): string`
  - `toNetAct(action: PlayerAction, now: number): NetAct`, `fromNetAct(act: NetAct, now: number, prev: PlayerAction): PlayerAction`

- [ ] **Step 1: 속도 제한기 테스트** — `rateLimit.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { NEW_WINDOW, allowEvery, allowPerSecond } from './rateLimit'

describe('rateLimit', () => {
  it('allowEvery: 간격이 지나야 다시 된다', () => {
    expect(allowEvery(-Infinity, 0, 1)).toBe(true)
    expect(allowEvery(10, 10.5, 1)).toBe(false)
    expect(allowEvery(10, 11, 1)).toBe(true)
  })
  it('allowPerSecond: 1초 창 안에서 max 번까지', () => {
    let w = NEW_WINDOW
    for (let i = 0; i < 3; i++) {
      const r = allowPerSecond(w, 5 + i * 0.1, 3)
      expect(r.ok).toBe(true)
      w = r.w
    }
    expect(allowPerSecond(w, 5.5, 3).ok).toBe(false)
    expect(allowPerSecond(w, 6.01, 3)).toEqual({ ok: true, w: { start: 6.01, count: 1 } })
  })
})
```

- [ ] **Step 2: 구현** — `rateLimit.ts`:

```ts
/** 마지막으로 허락한 시각(last)에서 every 초가 지났나. 시각은 초 */
export function allowEvery(last: number, now: number, every: number): boolean {
  return now - last >= every
}

/** 1초 창: 창을 연 시각과 그 안에서 허락한 횟수 */
export type RateWindow = { start: number; count: number }
export const NEW_WINDOW: RateWindow = { start: -Infinity, count: 0 }

/** 1초 창 안에서 max 번까지 허락한다. 창이 지나면 새 창을 연다 */
export function allowPerSecond(w: RateWindow, now: number, max: number): { ok: boolean; w: RateWindow } {
  if (now - w.start >= 1) return { ok: true, w: { start: now, count: 1 } }
  if (w.count >= max) return { ok: false, w }
  return { ok: true, w: { start: w.start, count: w.count + 1 } }
}
```

- [ ] **Step 3: 메시지 테스트** — `netProtocol.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { DEFAULT_LOOK } from '../data/characterParts'
import { IDLE_ACTION, type PlayerAction } from './playerMotion'
import { fromNetAct, parseClientMsg, parseServerMsg, roundState, stateKey, toNetAct, type NetState } from './netProtocol'

const state = (over: Partial<NetState> = {}): NetState => ({
  p: [1, 2, 3], f: 0.5, v: 1, rest: false, fish: null, rod: 0.5, rodOn: true, bob: null,
  act: { emote: null, emoteAge: 30, airAge: null, landedAge: 30, eat: null, eatAge: 30 },
  ...over,
})
const json = (v: unknown) => JSON.stringify(v)

describe('parseClientMsg', () => {
  it('맞는 hello·state·chat·profile 을 읽는다', () => {
    const hello = { type: 'hello', v: 1, mode: 'join', passHash: 'a'.repeat(64), nick: ' 혜린 ', look: DEFAULT_LOOK }
    expect(parseClientMsg(json(hello))).toEqual({ ...hello, nick: '혜린' })
    expect(parseClientMsg(json({ type: 'state', s: state() }))).toEqual({ type: 'state', s: state() })
    expect(parseClientMsg(json({ type: 'chat', text: ' 안녕\n ' }))).toEqual({ type: 'chat', text: '안녕' })
    expect(parseClientMsg(json({ type: 'profile', nick: '새이름', look: DEFAULT_LOOK }))).toEqual({ type: 'profile', nick: '새이름', look: DEFAULT_LOOK })
  })

  it('깨진 JSON·모르는 종류·범위 밖 값은 null', () => {
    expect(parseClientMsg('{oops')).toBeNull()
    expect(parseClientMsg(json({ type: 'nuke' }))).toBeNull()
    expect(parseClientMsg(json({ type: 'chat', text: '' }))).toBeNull()
    expect(parseClientMsg(json({ type: 'chat', text: '가'.repeat(61) }))).toBeNull()
    expect(parseClientMsg(json({ type: 'state', s: state({ p: [999, 0, 0] }) }))).toBeNull()
    expect(parseClientMsg(json({ type: 'state', s: state({ p: [Number.NaN, 0, 0] as never }) }))).toBeNull()
    expect(parseClientMsg(json({ type: 'state', s: state({ fish: { pose: 'moonwalk', lean: 0 } as never }) }))).toBeNull()
    expect(parseClientMsg(json({ type: 'state', s: { ...state(), act: { ...state().act, emote: 'hack' } } }))).toBeNull()
    expect(parseClientMsg(json({ type: 'hello', v: 1, mode: 'steal', passHash: 'x', nick: 'a', look: DEFAULT_LOOK }))).toBeNull()
    expect(parseClientMsg(json({ type: 'profile', nick: '', look: DEFAULT_LOOK }))).toBeNull()
    expect(parseClientMsg(json(null))).toBeNull()
  })
})

describe('parseServerMsg', () => {
  it('welcome 의 사람 목록에서 틀린 사람만 빼고 읽는다', () => {
    const good = { id: 'a1', nick: '혜린', look: DEFAULT_LOOK, s: null }
    const msg = parseServerMsg(json({ type: 'welcome', you: 'me', players: [good, { id: 3 }] }))
    expect(msg).toEqual({ type: 'welcome', you: 'me', players: [good] })
  })
  it('error 코드는 목록에 있는 것만', () => {
    expect(parseServerMsg(json({ type: 'error', code: 'bad-password' }))).toEqual({ type: 'error', code: 'bad-password' })
    expect(parseServerMsg(json({ type: 'error', code: 'whatever' }))).toBeNull()
  })
  it('state·chat·join·leave', () => {
    expect(parseServerMsg(json({ type: 'state', id: 'a', s: state() }))).toEqual({ type: 'state', id: 'a', s: state() })
    expect(parseServerMsg(json({ type: 'chat', id: 'a', text: 'hi' }))).toEqual({ type: 'chat', id: 'a', text: 'hi' })
    expect(parseServerMsg(json({ type: 'leave', id: 'a' }))).toEqual({ type: 'leave', id: 'a' })
    expect(parseServerMsg(json({ type: 'join', id: 'a', nick: 'n', look: DEFAULT_LOOK }))).toEqual({ type: 'join', id: 'a', nick: 'n', look: DEFAULT_LOOK })
  })
})

describe('roundState·stateKey', () => {
  it('숫자를 소수 둘째 자리로', () => {
    const r = roundState(state({ p: [1.23456, 0.001, -3.999], f: 1.005, bob: [1.111, 2.222, 3.333] }))
    expect(r.p).toEqual([1.23, 0, -4])
    expect(r.bob).toEqual([1.11, 2.22, 3.33])
  })
  it('나이(몇 초 전)만 바뀐 건 같은 상태로 본다', () => {
    const a = state()
    const b = state({ act: { ...a.act, emoteAge: 12, landedAge: 3 } })
    expect(stateKey(a)).toBe(stateKey(b))
    expect(stateKey(state({ p: [1, 2, 3.5] }))).not.toBe(stateKey(a))
  })
})

describe('toNetAct·fromNetAct', () => {
  const now = 100
  const rolling: PlayerAction = { ...IDLE_ACTION, emote: 'roll', emoteAt: 99.5 }

  it('시각을 "몇 초 전" 으로 보내고, 오래된 건 상한으로 자른다', () => {
    const act = toNetAct(rolling, now)
    expect(act.emote).toBe('roll')
    expect(act.emoteAge).toBeCloseTo(0.5)
    expect(act.landedAge).toBe(30)
    expect(act.airAge).toBeNull()
  })

  it('받은 쪽 시계로 바꾼다', () => {
    const local = fromNetAct(toNetAct(rolling, now), 500, IDLE_ACTION)
    expect(local.emote).toBe('roll')
    expect(local.emoteAt).toBeCloseTo(499.5)
  })

  it('같은 감정 표현이 계속 오면 시작 시각을 그대로 둔다 (한 번짜리 동작이 처음부터 다시 재생되지 않게)', () => {
    const first = fromNetAct({ ...toNetAct(rolling, now), emoteAge: 0.5 }, 500, IDLE_ACTION)
    // 0.2초 뒤 같은 동작이 조금 다른 나이로 도착 (네트워크 지연이 들쭉날쭉)
    const again = fromNetAct({ ...toNetAct(rolling, now), emoteAge: 0.62 }, 500.2, first)
    expect(again.emoteAt).toBe(first.emoteAt)
    expect(again).toBe(first)
  })

  it('같은 감정 표현을 새로 시작했으면 시각을 바꾼다', () => {
    const first = fromNetAct({ ...toNetAct(rolling, now), emoteAge: 0.5 }, 500, IDLE_ACTION)
    const restarted = fromNetAct({ ...toNetAct(rolling, now), emoteAge: 0.1 }, 503, first)
    expect(restarted.emoteAt).toBeCloseTo(502.9)
  })

  it('점프 중이면 airAge 가 있고 받은 쪽에서 airborne', () => {
    const jumping: PlayerAction = { ...IDLE_ACTION, airborne: true, jumpAt: 99.8 }
    const act = toNetAct(jumping, now)
    expect(act.airAge).toBeCloseTo(0.2)
    expect(fromNetAct(act, 10, IDLE_ACTION)).toMatchObject({ airborne: true })
  })
})
```

- [ ] **Step 4: 실패 확인** — `npx vitest run src/game/logic/rateLimit.test.ts src/game/logic/netProtocol.test.ts` → 모듈 없음으로 실패.

- [ ] **Step 5: 구현** — `netProtocol.ts`:

```ts
import { DISHES } from '../data/dishes'
import { EMOTES, type EmoteId } from '../data/emotes'
import { NET } from '../data/net'
import { SNACK_IDS } from '../data/snacks'
import type { CharacterLook, FoodId } from '../data/types'
import { FISHING_POSES, type FishingLook, type FishingPose } from './characterPose'
import { normalizeLook } from './characterLook'
import type { PlayerAction } from './playerMotion'
import { cleanText, textLength } from './roomKey'

/**
 * 같이 하기 메시지 (JSON 텍스트). 서버와 클라이언트가 같은 함수로 만들고 검사한다.
 * 받은 값은 믿지 않는다: 모양·범위·이름 목록을 확인하고 틀리면 null (그 메시지만 버린다)
 */

export type Vec3 = [number, number, number]
/** 동작 상태. 기기마다 시계가 달라 시각 대신 "몇 초 전" 으로 보낸다 */
export type NetAct = { emote: EmoteId | null; emoteAge: number; airAge: number | null; landedAge: number; eat: FoodId | null; eatAge: number }
/** 내 모습 한 장면. p: 몸 가운데(캡슐 가운데) 위치, f: 바라보는 각도, v: 수평 속도 */
export type NetState = { p: Vec3; f: number; v: number; rest: boolean; fish: FishingLook | null; rod: number; rodOn: boolean; bob: Vec3 | null; act: NetAct }
export type JoinMode = 'create' | 'join'
export type ErrorCode = 'bad-hello' | 'room-exists' | 'no-room' | 'bad-password' | 'full' | 'version'
export const ERROR_CODES: ErrorCode[] = ['bad-hello', 'room-exists', 'no-room', 'bad-password', 'full', 'version']
export type PeerInfo = { id: string; nick: string; look: CharacterLook; s: NetState | null }

export type ClientMsg =
  | { type: 'hello'; v: number; mode: JoinMode; passHash: string; nick: string; look: CharacterLook }
  | { type: 'state'; s: NetState }
  | { type: 'chat'; text: string }
  | { type: 'profile'; nick: string; look: CharacterLook }

export type ServerMsg =
  | { type: 'welcome'; you: string; players: PeerInfo[] }
  | { type: 'error'; code: ErrorCode }
  | { type: 'join'; id: string; nick: string; look: CharacterLook }
  | { type: 'leave'; id: string }
  | { type: 'profile'; id: string; nick: string; look: CharacterLook }
  | { type: 'state'; id: string; s: NetState }
  | { type: 'chat'; id: string; text: string }

const EMOTE_IDS = EMOTES.map((e) => e.id)
const FOOD_IDS: FoodId[] = [...DISHES.map((d) => d.id), ...SNACK_IDS]

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)
const num = (v: unknown, lo: number, hi: number): number | null => (typeof v === 'number' && Number.isFinite(v) && v >= lo && v <= hi ? v : null)
const oneOf = <T extends string>(v: unknown, list: readonly T[]): T | null => (typeof v === 'string' && (list as readonly string[]).includes(v) ? (v as T) : null)
const id = (v: unknown): string | null => (typeof v === 'string' && v.length >= 1 && v.length <= 40 ? v : null)

function vec3(v: unknown): Vec3 | null {
  if (!Array.isArray(v) || v.length !== 3) return null
  const L = NET.coordLimit
  const [x, y, z] = [num(v[0], -L, L), num(v[1], -L, L), num(v[2], -L, L)]
  return x === null || y === null || z === null ? null : [x, y, z]
}

/** 정리한 글자가 [lo, hi] 글자 안이면 그 글자, 아니면 null */
function text(v: unknown, lo: number, hi: number): string | null {
  if (typeof v !== 'string') return null
  const t = cleanText(v)
  const n = textLength(t)
  return n >= lo && n <= hi ? t : null
}
const nick = (v: unknown) => text(v, NET.nick[0], NET.nick[1])
const look = (v: unknown): CharacterLook | null => normalizeLook(v)

function readAct(v: unknown): NetAct | null {
  if (!isRecord(v)) return null
  const cap = NET.actAgeCap
  const emote = v.emote === null ? null : oneOf(v.emote, EMOTE_IDS)
  const eat = v.eat === null ? null : oneOf(v.eat, FOOD_IDS)
  const emoteAge = num(v.emoteAge, 0, cap)
  const airAge = v.airAge === null ? null : num(v.airAge, 0, cap)
  const landedAge = num(v.landedAge, 0, cap)
  const eatAge = num(v.eatAge, 0, cap)
  if ((v.emote !== null && emote === null) || (v.eat !== null && eat === null)) return null
  if (emoteAge === null || landedAge === null || eatAge === null || (v.airAge !== null && airAge === null)) return null
  return { emote, emoteAge, airAge, landedAge, eat, eatAge }
}

function readFish(v: unknown): FishingLook | null | undefined {
  if (v === null) return null
  if (!isRecord(v)) return undefined
  const pose = oneOf<FishingPose>(v.pose, FISHING_POSES)
  const lean = num(v.lean, 0, 1)
  return pose === null || lean === null ? undefined : { pose, lean }
}

export function readNetState(v: unknown): NetState | null {
  if (!isRecord(v)) return null
  const p = vec3(v.p)
  const f = num(v.f, -1e4, 1e4)
  const speed = num(v.v, 0, 50)
  const rod = num(v.rod, -4, 4)
  const fish = readFish(v.fish)
  const bob = v.bob === null ? null : vec3(v.bob)
  const act = readAct(v.act)
  if (!p || f === null || speed === null || rod === null || fish === undefined || (v.bob !== null && bob === null) || !act) return null
  if (typeof v.rest !== 'boolean' || typeof v.rodOn !== 'boolean') return null
  return { p, f, v: speed, rest: v.rest, fish, rod, rodOn: v.rodOn, bob, act }
}

function parse(raw: string): Record<string, unknown> | null {
  try {
    const v: unknown = JSON.parse(raw)
    return isRecord(v) ? v : null
  } catch {
    return null
  }
}

export function parseClientMsg(raw: string): ClientMsg | null {
  const m = parse(raw)
  if (!m) return null
  switch (m.type) {
    case 'hello': {
      const mode = oneOf<JoinMode>(m.mode, ['create', 'join'])
      const v = num(m.v, 0, 1e6)
      const passHash = typeof m.passHash === 'string' && /^[0-9a-f]{64}$/.test(m.passHash) ? m.passHash : null
      const n = nick(m.nick)
      const l = look(m.look)
      return mode && v !== null && passHash && n && l ? { type: 'hello', v, mode, passHash, nick: n, look: l } : null
    }
    case 'state': {
      const s = readNetState(m.s)
      return s ? { type: 'state', s } : null
    }
    case 'chat': {
      const t = text(m.text, 1, NET.chatLength)
      return t ? { type: 'chat', text: t } : null
    }
    case 'profile': {
      const n = nick(m.nick)
      const l = look(m.look)
      return n && l ? { type: 'profile', nick: n, look: l } : null
    }
    default:
      return null
  }
}

function readPeer(v: unknown): PeerInfo | null {
  if (!isRecord(v)) return null
  const i = id(v.id)
  const n = nick(v.nick)
  const l = look(v.look)
  const s = v.s === null ? null : readNetState(v.s)
  if (!i || !n || !l || (v.s !== null && s === null)) return null
  return { id: i, nick: n, look: l, s }
}

export function parseServerMsg(raw: string): ServerMsg | null {
  const m = parse(raw)
  if (!m) return null
  switch (m.type) {
    case 'welcome': {
      const you = id(m.you)
      if (!you || !Array.isArray(m.players)) return null
      return { type: 'welcome', you, players: m.players.map(readPeer).filter((p): p is PeerInfo => p !== null) }
    }
    case 'error': {
      const code = oneOf(m.code, ERROR_CODES)
      return code ? { type: 'error', code } : null
    }
    case 'join':
    case 'profile': {
      const i = id(m.id)
      const n = nick(m.nick)
      const l = look(m.look)
      return i && n && l ? { type: m.type, id: i, nick: n, look: l } : null
    }
    case 'leave': {
      const i = id(m.id)
      return i ? { type: 'leave', id: i } : null
    }
    case 'state': {
      const i = id(m.id)
      const s = readNetState(m.s)
      return i && s ? { type: 'state', id: i, s } : null
    }
    case 'chat': {
      const i = id(m.id)
      const t = text(m.text, 1, NET.chatLength)
      return i && t ? { type: 'chat', id: i, text: t } : null
    }
    default:
      return null
  }
}

const r2 = (n: number) => Math.round(n * 100) / 100 + 0 // + 0: -0 을 0 으로
const r3 = (v: Vec3): Vec3 => [r2(v[0]), r2(v[1]), r2(v[2])]

/** 보내기 전 숫자를 소수 둘째 자리로 (메시지 크기를 줄인다) */
export function roundState(s: NetState): NetState {
  const a = s.act
  return {
    p: r3(s.p),
    f: r2(s.f),
    v: r2(s.v),
    rest: s.rest,
    fish: s.fish && { pose: s.fish.pose, lean: r2(s.fish.lean) },
    rod: r2(s.rod),
    rodOn: s.rodOn,
    bob: s.bob && r3(s.bob),
    act: { emote: a.emote, emoteAge: r2(a.emoteAge), airAge: a.airAge === null ? null : r2(a.airAge), landedAge: r2(a.landedAge), eat: a.eat, eatAge: r2(a.eatAge) },
  }
}

/** "바뀐 게 있나" 비교용 열쇠. 저절로 늘어나는 나이(몇 초 전)는 빼고 무엇을 하는지만 넣는다 */
export function stateKey(s: NetState): string {
  return JSON.stringify([s.p, s.f, s.v, s.rest, s.fish, s.rod, s.rodOn, s.bob, s.act.emote, s.act.eat, s.act.airAge !== null])
}

const age = (now: number, at: number) => Math.min(NET.actAgeCap, Math.max(0, now - at))

/** 내 동작 상태 → 보낼 값 (now: 동작 시각과 같은 시계) */
export function toNetAct(action: PlayerAction, now: number): NetAct {
  return {
    emote: action.emote,
    emoteAge: age(now, action.emoteAt),
    airAge: action.airborne ? age(now, action.jumpAt) : null,
    landedAge: age(now, action.landedAt),
    eat: action.eat,
    eatAge: age(now, action.eatAt),
  }
}

/** 같은 동작인데 시작 시각이 이보다(초) 적게 다르면 네트워크 지연 차이로 보고 그대로 둔다 */
const SAME_START = 0.3
const keep = (prevAt: number, at: number) => (Math.abs(prevAt - at) < SAME_START ? prevAt : at)

/**
 * 받은 값 → 내 시계(now) 의 동작 상태. 같은 동작이 이어서 오면 이전 시각을 그대로 써서
 * 한 번짜리 동작이 받을 때마다 처음부터 다시 재생되지 않게 한다. 바뀐 게 없으면 prev 를 그대로 돌려준다
 */
export function fromNetAct(act: NetAct, now: number, prev: PlayerAction): PlayerAction {
  const emoteAt = act.emote && act.emote === prev.emote ? keep(prev.emoteAt, now - act.emoteAge) : now - act.emoteAge
  const airborne = act.airAge !== null
  const jumpAt = airborne ? (prev.airborne ? keep(prev.jumpAt, now - act.airAge!) : now - act.airAge!) : prev.jumpAt
  const landedAt = keep(prev.landedAt, now - act.landedAge)
  const eatAt = act.eat && act.eat === prev.eat ? keep(prev.eatAt, now - act.eatAge) : now - act.eatAge
  const next: PlayerAction = { emote: act.emote, emoteAt, airborne, jumpAt, landedAt, eat: act.eat, eatAt }
  const same = next.emote === prev.emote && next.emoteAt === prev.emoteAt && next.airborne === prev.airborne && next.jumpAt === prev.jumpAt && next.landedAt === prev.landedAt && next.eat === prev.eat && next.eatAt === prev.eatAt
  return same ? prev : next
}
```

- [ ] **Step 6: 통과 확인** — `npx vitest run src/game/logic/rateLimit.test.ts src/game/logic/netProtocol.test.ts && npx tsc -b` → 통과. (`landedAge` 30 이 자꾸 "다른 시각"이 되어 `again !== first` 로 실패하면: 상한으로 잘린 나이는 `keep` 의 차이가 0.3 을 넘을 수 있다. 그때는 `act.landedAge >= NET.actAgeCap ? prev.landedAt : keep(...)` 처럼 상한 값이면 prev 를 그대로 쓰게 같은 규칙을 emote·eat 에도 적용한다.)

- [ ] **Step 7: 커밋**
```bash
git add src/game/logic/rateLimit.ts src/game/logic/rateLimit.test.ts src/game/logic/netProtocol.ts src/game/logic/netProtocol.test.ts
git commit -m "feat: 같이 하기 메시지 형식과 검사" -m "서버·클라이언트가 같이 쓰는 메시지 타입, 받은 값 검사, 숫자 반올림, 동작 시각을 몇 초 전으로 주고받기, 속도 제한기"
```

---

### Task 4: 받은 state 보간

**Files:**
- Create: `src/game/logic/interpolate.ts`, `src/game/logic/interpolate.test.ts`

**Interfaces:**
- Consumes: `NetState` (Task 3), `shortestAngleDelta` (`logic/cameraYaw`), `NET.snapDistance`.
- Produces: `type Sample = { at: number; s: NetState }`, `pushSample(buf: Sample[], sample: Sample, max: number): Sample[]`, `type Sampled = { x: number; y: number; z: number; f: number; v: number; s: NetState }`, `sampleAt(buf: Sample[], t: number): Sampled | null`.

- [ ] **Step 1: 테스트**

```ts
import { describe, expect, it } from 'vitest'
import type { NetState } from './netProtocol'
import { pushSample, sampleAt, type Sample } from './interpolate'

const st = (x: number, f = 0, rest = false): NetState => ({
  p: [x, 1, 0], f, v: 2, rest, fish: null, rod: 0.5, rodOn: true, bob: null,
  act: { emote: null, emoteAge: 30, airAge: null, landedAge: 30, eat: null, eatAge: 30 },
})

describe('pushSample', () => {
  it('뒤에 붙이고 max 개만 남긴다. 늦게 도착한 옛 값은 버린다', () => {
    let buf: Sample[] = []
    for (let i = 0; i < 5; i++) buf = pushSample(buf, { at: i, s: st(i) }, 3)
    expect(buf.map((b) => b.at)).toEqual([2, 3, 4])
    expect(pushSample(buf, { at: 3.5, s: st(9) }, 3)).toBe(buf)
  })
})

describe('sampleAt', () => {
  const buf: Sample[] = [{ at: 0, s: st(0, 0) }, { at: 1, s: st(2, 3) }, { at: 2, s: st(4, -3, true) }]

  it('비어 있으면 null, 범위 밖은 끝 값', () => {
    expect(sampleAt([], 1)).toBeNull()
    expect(sampleAt(buf, -5)!.x).toBe(0)
    expect(sampleAt(buf, 99)!.x).toBe(4)
  })

  it('두 값 사이를 선형으로 잇고, 켜고 끄는 값은 앞 값을 쓴다', () => {
    const a = sampleAt(buf, 1.5)!
    expect(a.x).toBeCloseTo(3)
    expect(a.s.rest).toBe(false)
  })

  it('각도는 짧은 쪽으로 돈다 (3 → -3 은 거의 반 바퀴 반대로 돌지 않는다)', () => {
    const a = sampleAt(buf, 1.5)!
    expect(Math.abs(a.f)).toBeGreaterThan(3)
  })

  it('6m 넘게 떨어진 두 값은 잇지 않는다 (순간이동)', () => {
    const jump: Sample[] = [{ at: 0, s: st(0) }, { at: 1, s: st(20) }]
    expect(sampleAt(jump, 0.5)!.x).toBe(0)
    expect(sampleAt(jump, 1)!.x).toBe(20)
  })
})
```

- [ ] **Step 2: 실패 확인** — `npx vitest run src/game/logic/interpolate.test.ts` → 모듈 없음.

- [ ] **Step 3: 구현**

```ts
import { NET } from '../data/net'
import { shortestAngleDelta } from './cameraYaw'
import type { NetState } from './netProtocol'

/** 받은 state 와 받은 시각(초, 받은 쪽 시계) */
export type Sample = { at: number; s: NetState }
/** 그릴 자리: 위치·각도·속도는 이어 그린 값, 나머지(켜고 끄는 값)는 앞 state 그대로 */
export type Sampled = { x: number; y: number; z: number; f: number; v: number; s: NetState }

/** 버퍼 뒤에 붙인다. 이미 있는 것보다 옛것이면 그대로 두고, max 개만 남긴다 */
export function pushSample(buf: Sample[], sample: Sample, max: number): Sample[] {
  const last = buf[buf.length - 1]
  if (last && sample.at <= last.at) return buf
  const next = [...buf, sample]
  return next.length > max ? next.slice(next.length - max) : next
}

const at = (s: Sample): Sampled => ({ x: s.s.p[0], y: s.s.p[1], z: s.s.p[2], f: s.s.f, v: s.s.v, s: s.s })

/** 시각 t 의 모습. 버퍼 앞보다 이르면 첫 값, 뒤보다 늦으면 마지막 값(앞질러 짐작하지 않는다) */
export function sampleAt(buf: Sample[], t: number): Sampled | null {
  if (buf.length === 0) return null
  if (t <= buf[0].at) return at(buf[0])
  const last = buf[buf.length - 1]
  if (t >= last.at) return at(last)
  let i = 0
  while (buf[i + 1].at <= t) i++
  const a = buf[i]
  const b = buf[i + 1]
  const [ax, ay, az] = a.s.p
  const [bx, by, bz] = b.s.p
  if (Math.hypot(bx - ax, by - ay, bz - az) > NET.snapDistance) return at(a)
  const k = (t - a.at) / (b.at - a.at)
  return {
    x: ax + (bx - ax) * k,
    y: ay + (by - ay) * k,
    z: az + (bz - az) * k,
    f: a.s.f + shortestAngleDelta(a.s.f, b.s.f) * k,
    v: a.s.v + (b.s.v - a.s.v) * k,
    s: a.s,
  }
}
```

- [ ] **Step 4: 통과 확인** — `npx vitest run src/game/logic/interpolate.test.ts` → 통과.

- [ ] **Step 5: 커밋**
```bash
git add src/game/logic/interpolate.ts src/game/logic/interpolate.test.ts
git commit -m "feat: 다른 사람 모습 보간" -m "받은 state 버퍼에서 조금 늦은 시점을 두 값 사이로 이어 그린다. 6m 넘게 떨어지면 순간이동으로 보고 잇지 않는다"
```

---

### Task 5: 방 서버 (Cloudflare Worker + Durable Object)

**Files:**
- Create: `server/wrangler.toml`, `server/tsconfig.json`, `server/src/index.ts`, `server/src/room.ts`, `server/src/roomRules.ts`, `server/src/roomRules.test.ts`
- Create: `tools/room-smoke.mjs`
- Modify: `package.json` (devDependencies `wrangler`, `@cloudflare/workers-types`; scripts `server:dev`, `server:deploy`), `tsconfig.json` (references 에 `./server`), `.gitignore` (`.wrangler/`)

**Interfaces:**
- Consumes: `parseClientMsg`, `ClientMsg`, `ServerMsg`, `ErrorCode`, `PeerInfo`, `NetState` (Task 3), `allowEvery`, `allowPerSecond`, `NEW_WINDOW`, `RateWindow` (Task 3), `NET` (Task 2).
- Produces: 웹소켓 주소 `ws(s)://<host>/rooms/<32자 16진수>`, 서버→클라이언트 메시지 (spec 대로).
  - `type RoomMeta = { passHash: string; createdAt: number; lastActive: number }`
  - `judgeHello(hello: Extract<ClientMsg, { type: 'hello' }>, meta: RoomMeta | null, players: number, nowMs: number): { ok: true; meta: RoomMeta } | { ok: false; code: ErrorCode }`
  - `type Member = { id: string; nick: string; look: CharacterLook; joinedAt: number; s: NetState | null; stateWin: RateWindow; lastChat: number; lastProfile: number }`
  - `handleMemberMsg(member: Member, msg: ClientMsg, nowSec: number): { member: Member; out: ServerMsg | null }`

- [ ] **Step 1: 의존성·설정**

```bash
npm i -D wrangler @cloudflare/workers-types
```

`server/wrangler.toml`:
```toml
name = "rinfish-rooms"
main = "src/index.ts"
compatibility_date = "2025-09-01"

[[durable_objects.bindings]]
name = "ROOM"
class_name = "Room"

[[migrations]]
tag = "v1"
new_sqlite_classes = ["Room"]
```

`server/tsconfig.json`:
```json
{
  "compilerOptions": {
    "tsBuildInfoFile": "../node_modules/.tmp/tsconfig.server.tsbuildinfo",
    "target": "es2023",
    "lib": ["ES2023"],
    "module": "esnext",
    "moduleResolution": "bundler",
    "types": ["@cloudflare/workers-types"],
    "allowImportingTsExtensions": true,
    "verbatimModuleSyntax": true,
    "skipLibCheck": true,
    "noEmit": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true
  },
  "include": ["src"]
}
```
루트 `tsconfig.json` references 에 `{ "path": "./server" }` 추가. `package.json` scripts 에 `"server:dev": "wrangler dev --config server/wrangler.toml --port 8787"`, `"server:deploy": "wrangler deploy --config server/wrangler.toml"`. `.gitignore` 에 `.wrangler/`.

- [ ] **Step 2: 판정 테스트** — `server/src/roomRules.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { DEFAULT_LOOK } from '../../src/game/data/characterParts'
import type { ClientMsg, NetState } from '../../src/game/logic/netProtocol'
import { NEW_WINDOW } from '../../src/game/logic/rateLimit'
import { handleMemberMsg, judgeHello, type Member, type RoomMeta } from './roomRules'

const hello = (mode: 'create' | 'join', passHash = 'a'.repeat(64)): Extract<ClientMsg, { type: 'hello' }> => ({ type: 'hello', v: 1, mode, passHash, nick: '혜린', look: DEFAULT_LOOK })
const DAY = 86_400_000
const meta: RoomMeta = { passHash: 'a'.repeat(64), createdAt: 0, lastActive: 10 * DAY }

describe('judgeHello', () => {
  it('없는 방은 만들 수 있고 들어갈 수 없다', () => {
    expect(judgeHello(hello('create'), null, 0, 5)).toEqual({ ok: true, meta: { passHash: 'a'.repeat(64), createdAt: 5, lastActive: 5 } })
    expect(judgeHello(hello('join'), null, 0, 5)).toEqual({ ok: false, code: 'no-room' })
  })
  it('있는 방: 만들기는 room-exists, 암호가 다르면 bad-password, 맞으면 들어간다', () => {
    const now = 10 * DAY + 1
    expect(judgeHello(hello('create'), meta, 1, now)).toEqual({ ok: false, code: 'room-exists' })
    expect(judgeHello(hello('join', 'b'.repeat(64)), meta, 1, now)).toEqual({ ok: false, code: 'bad-password' })
    expect(judgeHello(hello('join'), meta, 1, now)).toEqual({ ok: true, meta: { ...meta, lastActive: now } })
  })
  it('20명이면 full', () => {
    expect(judgeHello(hello('join'), meta, 20, 10 * DAY)).toEqual({ ok: false, code: 'full' })
  })
  it('7일 넘게 빈 방은 없는 방처럼 (새로 만들 수 있다). 누가 있으면 오래돼도 그대로', () => {
    const later = meta.lastActive + 8 * DAY
    expect(judgeHello(hello('create', 'c'.repeat(64)), meta, 0, later)).toEqual({ ok: true, meta: { passHash: 'c'.repeat(64), createdAt: later, lastActive: later } })
    expect(judgeHello(hello('join'), meta, 0, later)).toEqual({ ok: false, code: 'no-room' })
    expect(judgeHello(hello('create'), meta, 1, later)).toEqual({ ok: false, code: 'room-exists' })
  })
  it('버전이 다르면 version', () => {
    expect(judgeHello({ ...hello('join'), v: 99 }, meta, 0, 0)).toEqual({ ok: false, code: 'version' })
  })
})

describe('handleMemberMsg', () => {
  const s: NetState = { p: [0, 1, 0], f: 0, v: 0, rest: false, fish: null, rod: 0.5, rodOn: true, bob: null, act: { emote: null, emoteAge: 30, airAge: null, landedAge: 30, eat: null, eatAge: 30 } }
  const me: Member = { id: 'm1', nick: '혜린', look: DEFAULT_LOOK, joinedAt: 0, s: null, stateWin: NEW_WINDOW, lastChat: -Infinity, lastProfile: -Infinity }

  it('state 는 저장하고 내 id 를 붙여 나눠 준다. 초당 10번 넘으면 버린다', () => {
    let m = me
    for (let i = 0; i < 10; i++) {
      const r = handleMemberMsg(m, { type: 'state', s }, 1 + i * 0.05)
      expect(r.out).toEqual({ type: 'state', id: 'm1', s })
      m = r.member
    }
    expect(m.s).toEqual(s)
    expect(handleMemberMsg(m, { type: 'state', s }, 1.6).out).toBeNull()
  })
  it('chat 은 1초에 한 번', () => {
    const r = handleMemberMsg(me, { type: 'chat', text: '안녕' }, 3)
    expect(r.out).toEqual({ type: 'chat', id: 'm1', text: '안녕' })
    expect(handleMemberMsg(r.member, { type: 'chat', text: '또' }, 3.5).out).toBeNull()
    expect(handleMemberMsg(r.member, { type: 'chat', text: '또' }, 4).out).not.toBeNull()
  })
  it('profile 은 5초에 한 번, 바꾼 이름·옷을 저장한다', () => {
    const r = handleMemberMsg(me, { type: 'profile', nick: '새이름', look: DEFAULT_LOOK }, 10)
    expect(r.member.nick).toBe('새이름')
    expect(r.out).toEqual({ type: 'profile', id: 'm1', nick: '새이름', look: DEFAULT_LOOK })
    expect(handleMemberMsg(r.member, { type: 'profile', nick: '또', look: DEFAULT_LOOK }, 12).out).toBeNull()
  })
  it('들어온 뒤 hello 는 무시', () => {
    expect(handleMemberMsg(me, hello('join'), 1)).toEqual({ member: me, out: null })
  })
})
```

- [ ] **Step 3: 실패 확인** — `npx vitest run server` → 모듈 없음.

- [ ] **Step 4: 판정 구현** — `server/src/roomRules.ts`:

```ts
import { NET } from '../../src/game/data/net'
import type { CharacterLook } from '../../src/game/data/types'
import type { ClientMsg, ErrorCode, NetState, ServerMsg } from '../../src/game/logic/netProtocol'
import { allowEvery, allowPerSecond, type RateWindow } from '../../src/game/logic/rateLimit'

/** 방 저장소에 두는 것: 암호 해시와 만든·마지막으로 쓴 시각(ms) */
export type RoomMeta = { passHash: string; createdAt: number; lastActive: number }

/** 방에 들어온 사람 (웹소켓 붙임 정보). 시각은 초 */
export type Member = { id: string; nick: string; look: CharacterLook; joinedAt: number; s: NetState | null; stateWin: RateWindow; lastChat: number; lastProfile: number }

const DAY_MS = 86_400_000

/** 입장 판정. players: 지금 방에 들어와 있는 사람 수 */
export function judgeHello(hello: Extract<ClientMsg, { type: 'hello' }>, meta: RoomMeta | null, players: number, nowMs: number): { ok: true; meta: RoomMeta } | { ok: false; code: ErrorCode } {
  if (hello.v !== NET.protocolVersion) return { ok: false, code: 'version' }
  // 아무도 없는 채 오래된 방은 없는 방으로 본다 (이름을 다시 쓸 수 있게)
  const live = meta && (players > 0 || nowMs - meta.lastActive <= NET.roomExpireDays * DAY_MS) ? meta : null
  if (hello.mode === 'create') {
    if (live) return { ok: false, code: 'room-exists' }
    return { ok: true, meta: { passHash: hello.passHash, createdAt: nowMs, lastActive: nowMs } }
  }
  if (!live) return { ok: false, code: 'no-room' }
  if (live.passHash !== hello.passHash) return { ok: false, code: 'bad-password' }
  if (players >= NET.maxPlayers) return { ok: false, code: 'full' }
  return { ok: true, meta: { ...live, lastActive: nowMs } }
}

/** 들어온 사람의 메시지 하나 처리: 바뀐 사람 정보와 다른 사람들에게 보낼 메시지(없으면 null) */
export function handleMemberMsg(member: Member, msg: ClientMsg, nowSec: number): { member: Member; out: ServerMsg | null } {
  switch (msg.type) {
    case 'state': {
      const r = allowPerSecond(member.stateWin, nowSec, NET.serverStatePerSecond)
      if (!r.ok) return { member, out: null }
      return { member: { ...member, s: msg.s, stateWin: r.w }, out: { type: 'state', id: member.id, s: msg.s } }
    }
    case 'chat':
      if (!allowEvery(member.lastChat, nowSec, NET.serverChatEvery)) return { member, out: null }
      return { member: { ...member, lastChat: nowSec }, out: { type: 'chat', id: member.id, text: msg.text } }
    case 'profile':
      if (!allowEvery(member.lastProfile, nowSec, NET.serverProfileEvery)) return { member, out: null }
      return { member: { ...member, nick: msg.nick, look: msg.look, lastProfile: nowSec }, out: { type: 'profile', id: member.id, nick: msg.nick, look: msg.look } }
    case 'hello':
      return { member, out: null }
  }
}
```

- [ ] **Step 5: 통과 확인** — `npx vitest run server` → 통과.

- [ ] **Step 6: Durable Object** — `server/src/room.ts`:

```ts
import { DurableObject } from 'cloudflare:workers'
import { NET } from '../../src/game/data/net'
import { parseClientMsg, type ErrorCode, type PeerInfo, type ServerMsg } from '../../src/game/logic/netProtocol'
import { NEW_WINDOW } from '../../src/game/logic/rateLimit'
import { handleMemberMsg, judgeHello, type Member, type RoomMeta } from './roomRules'

/** 웹소켓 붙임 정보: 아직 hello 전이거나, 들어온 사람 */
type Attachment = { phase: 'hello' } | ({ phase: 'in' } & Member)

export type Env = { ROOM: DurableObjectNamespace<Room> }

/**
 * 방 하나. 웹소켓 Hibernation API 를 써서 조용할 땐 잠들어 요금이 들지 않는다.
 * 사람 정보는 웹소켓마다 붙임 정보(attachment)에, 방 암호 해시는 저장소(meta)에 둔다
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
      const me: Member = { id: crypto.randomUUID().slice(0, 8), nick: msg.nick, look: msg.look, joinedAt: Date.now() / 1000, s: null, stateWin: NEW_WINDOW, lastChat: -Infinity, lastProfile: -Infinity }
      ws.serializeAttachment({ phase: 'in', ...me } satisfies Attachment)
      const players: PeerInfo[] = this.members(ws).map(({ m }) => ({ id: m.id, nick: m.nick, look: m.look, s: m.s }))
      send(ws, { type: 'welcome', you: me.id, players })
      this.broadcast({ type: 'join', id: me.id, nick: me.nick, look: me.look }, ws)
      return
    }
    const { phase: _phase, ...member } = att
    const r = handleMemberMsg(member, msg, Date.now() / 1000)
    if (r.member !== member) ws.serializeAttachment({ phase: 'in', ...r.member } satisfies Attachment)
    if (r.out) this.broadcast(r.out, ws)
  }

  async webSocketClose(ws: WebSocket): Promise<void> {
    await this.leave(ws)
  }

  async webSocketError(ws: WebSocket): Promise<void> {
    await this.leave(ws)
  }

  /** 들어와 있는 다른 사람들 (except 는 뺀다) */
  private members(except?: WebSocket): { ws: WebSocket; m: Member }[] {
    const out: { ws: WebSocket; m: Member }[] = []
    for (const w of this.ctx.getWebSockets()) {
      if (w === except) continue
      const a = w.deserializeAttachment() as Attachment | null
      if (a?.phase === 'in') out.push({ ws: w, m: a })
    }
    return out
  }

  private broadcast(msg: ServerMsg, except: WebSocket) {
    for (const { ws } of this.members(except)) send(ws, msg)
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

`server/src/index.ts`:
```ts
import type { Env } from './room'

export { Room } from './room'

/** /rooms/<방 id 32자> 만 받아 그 방(Durable Object)으로 넘긴다 */
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const match = new URL(request.url).pathname.match(/^\/rooms\/([0-9a-f]{32})$/)
    if (!match) return new Response('not found', { status: 404 })
    return env.ROOM.get(env.ROOM.idFromName(match[1])).fetch(request)
  },
} satisfies ExportedHandler<Env>
```

- [ ] **Step 7: 타입 확인** — `npx tsc -b` → 통과. (`_phase` 미사용 경고가 나면 `const member: Member = { id: att.id, nick: att.nick, look: att.look, joinedAt: att.joinedAt, s: att.s, stateWin: att.stateWin, lastChat: att.lastChat, lastProfile: att.lastProfile }` 로 바꾼다. 참고: `-Infinity` 는 JSON 직렬화 붙임 정보에서 `null` 이 된다 → `serializeAttachment` 는 structured clone 이라 `-Infinity` 를 그대로 보존한다. 의심되면 Step 8 스모크에서 chat 두 번이 1초 간격으로 통과하는지로 확인한다.)

- [ ] **Step 8: 로컬 스모크** — `tools/room-smoke.mjs` (Node 22+ 전역 WebSocket):

```js
// 로컬 방 서버(npm run server:dev) 확인: 만들기·틀린 암호·들어가기·state·chat·나가기
import { createHash } from 'node:crypto'

const base = process.argv[2] ?? 'ws://127.0.0.1:8787'
const sha = (s) => createHash('sha256').update(s).digest('hex')
const roomId = sha(`rinfish-room|smoke-${Date.now()}`).slice(0, 32)
const look = { gender: 'male', skinColor: '#e0b089', hair: 'short', hairColor: '#3e2723', beard: false, top: 'peasant', bottom: 'peasant', shoes: 'peasant', hood: false }
const state = { p: [1, 1, 1], f: 0, v: 0, rest: false, fish: null, rod: 0.5, rodOn: true, bob: null, act: { emote: null, emoteAge: 30, airAge: null, landedAge: 30, eat: null, eatAge: 30 } }

function open(mode, pass) {
  return new Promise((resolve) => {
    const ws = new WebSocket(`${base}/rooms/${roomId}`)
    const inbox = []
    ws.onopen = () => ws.send(JSON.stringify({ type: 'hello', v: 1, mode, passHash: sha(`${roomId}|${pass}`), nick: mode, look }))
    ws.onmessage = (e) => {
      const m = JSON.parse(e.data)
      inbox.push(m)
      if (m.type === 'welcome' || m.type === 'error') resolve({ ws, first: m, inbox })
    }
  })
}
const wait = (ms) => new Promise((r) => setTimeout(r, ms))
const assert = (ok, label) => {
  console.log(ok ? 'OK  ' : 'FAIL', label)
  if (!ok) process.exitCode = 1
}

const a = await open('create', 'secret1')
assert(a.first.type === 'welcome' && a.first.players.length === 0, '방 만들기')
const again = await open('create', 'secret1')
assert(again.first.code === 'room-exists', '같은 이름 다시 만들기 → room-exists')
const wrong = await open('join', 'nope1234')
assert(wrong.first.code === 'bad-password', '틀린 암호 → bad-password')
const b = await open('join', 'secret1')
assert(b.first.type === 'welcome' && b.first.players.length === 1, '들어가기 → 먼저 온 사람이 보인다')
await wait(200)
assert(a.inbox.some((m) => m.type === 'join'), '먼저 온 사람에게 join')
a.ws.send(JSON.stringify({ type: 'state', s: state }))
a.ws.send(JSON.stringify({ type: 'chat', text: '안녕' }))
await wait(300)
assert(b.inbox.some((m) => m.type === 'state' && m.id === a.first.you), 'state 중계')
assert(b.inbox.some((m) => m.type === 'chat' && m.text === '안녕'), 'chat 중계')
a.ws.send(JSON.stringify({ type: 'chat', text: '도배' }))
await wait(300)
assert(b.inbox.filter((m) => m.type === 'chat').length === 1, '1초 안에 또 보낸 chat 은 버림')
await wait(800)
a.ws.send(JSON.stringify({ type: 'chat', text: '1초 뒤' }))
await wait(300)
assert(b.inbox.some((m) => m.type === 'chat' && m.text === '1초 뒤'), '1초 지나면 다시 chat')
a.ws.close()
await wait(300)
assert(b.inbox.some((m) => m.type === 'leave' && m.id === a.first.you), '나가면 leave')
b.ws.close()
await wait(100)
process.exit()
```

실행: 한 터미널 `npm run server:dev` (백그라운드), 다른 데서 `node tools/room-smoke.mjs` → 전부 `OK`.

- [ ] **Step 9: 커밋**
```bash
git add server tools/room-smoke.mjs package.json package-lock.json tsconfig.json .gitignore
git commit -m "feat: 같이 하기 방 서버 (Cloudflare Durable Object)" -m "방마다 Durable Object 하나가 웹소켓 Hibernation 으로 입장 판정(만들기·들어가기·암호·인원)과 메시지 검사·속도 제한·중계를 한다. 로컬 확인용 스모크 스크립트 포함"
```

---

### Task 6: 클라이언트 연결과 netStore

**Files:**
- Create: `src/game/net/serverUrl.ts`, `src/game/net/connection.ts`, `src/game/net/remoteRig.ts`, `src/game/stores/netStore.ts`, `src/game/stores/netStore.test.ts`
- Modify: `src/vite-env.d.ts` 가 있으면 `VITE_ROOM_SERVER` 타입, 없으면 `src/game/net/serverUrl.ts` 안에서 `import.meta.env.VITE_ROOM_SERVER as string | undefined`.

**Interfaces:**
- Consumes: Task 2·3·4 의 함수들, `useSessionStore.notify`.
- Produces:
  - `ROOM_SERVER: string | null`, `roomUrl(roomId: string): string`
  - `type ConnStatus = 'connecting' | 'open' | 'closed'`, `type Connection = { send(m: ClientMsg): void; close(): void }`, `type Connector = (url: string, hello: () => ClientMsg, onMessage: (m: ServerMsg) => void, onStatus: (s: ConnStatus) => void) => Connection`, `connectSocket: Connector`
  - `remoteRig: Map<string, RemoteEntry>`, `type RemoteEntry = { buf: Sample[]; action: PlayerAction; bubble: { text: string; at: number } | null }`, `receiveState(id, s, now)`, `showBubble(id, text, now)`, `forgetRemote(id?)`, `selfBubble: { text: string; at: number }`, `netNow(): number` (= `performance.now() / 1000`)
  - `useNetStore` 상태: `phase: 'off' | 'connecting' | 'online' | 'reconnecting'`, `room: string | null`, `you: string | null`, `peers: Record<string, { nick: string; look: CharacterLook }>`, `chat: ChatLine[]`, `error: ErrorCode | null`, `lastRoom: string`, `nick: string`
  - 액션: `join(input: { mode: JoinMode; room: string; password: string; nick: string; look: CharacterLook }): Promise<void>`, `leave(): void`, `sendChat(text: string): boolean`, `sendState(s: NetState): void`, `sendProfile(nick: string, look: CharacterLook): void`, `_setConnector(c: Connector): void` (테스트용)
  - `type ChatLine = { key: number; from: string; text: string; at: number; mine: boolean }`

- [ ] **Step 1: 테스트 (가짜 연결)** — `netStore.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { DEFAULT_LOOK } from '../data/characterParts'
import type { ClientMsg, NetState, ServerMsg } from '../logic/netProtocol'
import { remoteRig } from '../net/remoteRig'
import type { ConnStatus, Connector } from '../net/connection'
import { useNetStore } from './netStore'
import { useSessionStore } from './sessionStore'

const st: NetState = { p: [1, 1, 1], f: 0, v: 0, rest: false, fish: null, rod: 0.5, rodOn: true, bob: null, act: { emote: null, emoteAge: 30, airAge: null, landedAge: 30, eat: null, eatAge: 30 } }

let sent: ClientMsg[] = []
let helloFn: () => ClientMsg
let push: (m: ServerMsg) => void
let status: (s: ConnStatus) => void
let closed = 0
const fake: Connector = (_url, hello, onMessage, onStatus) => {
  helloFn = hello
  push = onMessage
  status = onStatus
  return { send: (m) => sent.push(m), close: () => closed++ }
}

const join = (mode: 'create' | 'join' = 'create') => useNetStore.getState().join({ mode, room: 'Study', password: 'secret1', nick: '혜린', look: DEFAULT_LOOK })

beforeEach(() => {
  sent = []
  closed = 0
  remoteRig.clear()
  useNetStore.getState().leave()
  useNetStore.setState({ chat: [], error: null })
  useNetStore.getState()._setConnector(fake)
})

describe('netStore', () => {
  it('들어가면 hello 를 만들고, welcome 에 online 이 된다', async () => {
    await join()
    expect(useNetStore.getState().phase).toBe('connecting')
    const hello = helloFn()
    expect(hello).toMatchObject({ type: 'hello', mode: 'create', nick: '혜린', v: 1 })
    push({ type: 'welcome', you: 'me', players: [{ id: 'p1', nick: '정빈', look: DEFAULT_LOOK, s: st }] })
    const s = useNetStore.getState()
    expect(s.phase).toBe('online')
    expect(s.room).toBe('study')
    expect(s.peers.p1.nick).toBe('정빈')
    expect(remoteRig.get('p1')?.buf.length).toBe(1)
    expect(useNetStore.getState().lastRoom).toBe('study')
  })

  it('한 번 들어간 뒤 다시 연결할 땐 create 가 아니라 join 으로', async () => {
    await join('create')
    push({ type: 'welcome', you: 'me', players: [] })
    status('connecting')
    expect(useNetStore.getState().phase).toBe('reconnecting')
    expect(helloFn()).toMatchObject({ mode: 'join' })
  })

  it('끊기면 다른 사람을 숨기고, 다시 welcome 이 오면 채운다', async () => {
    await join()
    push({ type: 'welcome', you: 'me', players: [{ id: 'p1', nick: '정빈', look: DEFAULT_LOOK, s: st }] })
    status('connecting')
    expect(useNetStore.getState().peers).toEqual({})
    expect(remoteRig.size).toBe(0)
  })

  it('join·leave·state·chat·profile', async () => {
    const notify = vi.spyOn(useSessionStore.getState(), 'notify')
    await join()
    push({ type: 'welcome', you: 'me', players: [] })
    push({ type: 'join', id: 'p2', nick: '민수', look: DEFAULT_LOOK })
    expect(notify).toHaveBeenCalledWith('민수님이 들어왔어요')
    push({ type: 'state', id: 'p2', s: st })
    expect(remoteRig.get('p2')?.buf.length).toBe(1)
    push({ type: 'state', id: 'ghost', s: st })
    expect(remoteRig.has('ghost')).toBe(false)
    push({ type: 'chat', id: 'p2', text: '안녕' })
    expect(useNetStore.getState().chat.at(-1)).toMatchObject({ from: '민수', text: '안녕', mine: false })
    expect(remoteRig.get('p2')?.bubble?.text).toBe('안녕')
    push({ type: 'profile', id: 'p2', nick: '민수2', look: DEFAULT_LOOK })
    expect(useNetStore.getState().peers.p2.nick).toBe('민수2')
    push({ type: 'leave', id: 'p2' })
    expect(useNetStore.getState().peers.p2).toBeUndefined()
    expect(remoteRig.has('p2')).toBe(false)
    expect(notify).toHaveBeenCalledWith('민수2님이 나갔어요')
  })

  it('error 를 받으면 off 로 돌아가고 코드를 남긴다', async () => {
    await join('join')
    push({ type: 'error', code: 'bad-password' })
    expect(useNetStore.getState()).toMatchObject({ phase: 'off', error: 'bad-password' })
  })

  it('채팅: 정리해서 보내고 내 줄을 남긴다. 1초 안에 또 보내면 거절, 빈 글자도 거절', async () => {
    await join()
    push({ type: 'welcome', you: 'me', players: [] })
    expect(useNetStore.getState().sendChat('  안녕\n ')).toBe(true)
    expect(sent.at(-1)).toEqual({ type: 'chat', text: '안녕' })
    expect(useNetStore.getState().chat.at(-1)).toMatchObject({ text: '안녕', mine: true, from: '혜린' })
    expect(useNetStore.getState().sendChat('또')).toBe(false)
    expect(useNetStore.getState().sendChat('   ')).toBe(false)
  })

  it('채팅 기록은 30줄까지', async () => {
    await join()
    push({ type: 'welcome', you: 'me', players: [{ id: 'p1', nick: 'a', look: DEFAULT_LOOK, s: null }] })
    for (let i = 0; i < 35; i++) push({ type: 'chat', id: 'p1', text: `${i}` })
    expect(useNetStore.getState().chat).toHaveLength(30)
    expect(useNetStore.getState().chat[0].text).toBe('5')
  })

  it('나가면 연결을 닫고 off', async () => {
    await join()
    useNetStore.getState().leave()
    expect(closed).toBe(1)
    expect(useNetStore.getState().phase).toBe('off')
  })
})
```

- [ ] **Step 2: 실패 확인** — `npx vitest run src/game/stores/netStore.test.ts` → 모듈 없음.

- [ ] **Step 3: 구현**

`src/game/net/serverUrl.ts`:
```ts
/** 방 서버 주소 (예: wss://rinfish-rooms.xxx.workers.dev). 없으면 같이 하기를 숨기고 혼자 하기만 */
const raw = import.meta.env.VITE_ROOM_SERVER as string | undefined
export const ROOM_SERVER: string | null = raw ? raw.replace(/\/+$/, '') : null

export const roomUrl = (roomId: string) => `${ROOM_SERVER}/rooms/${roomId}`
```

`src/game/net/connection.ts`:
```ts
import { NET } from '../data/net'
import { parseServerMsg, type ClientMsg, type ServerMsg } from '../logic/netProtocol'

export type ConnStatus = 'connecting' | 'open' | 'closed'
export type Connection = { send(m: ClientMsg): void; close(): void }
/** 연결 만들기. hello 는 (다시) 연결될 때마다 불러서 보낸다. 테스트에선 가짜로 바꾼다 */
export type Connector = (url: string, hello: () => ClientMsg, onMessage: (m: ServerMsg) => void, onStatus: (s: ConnStatus) => void) => Connection

/**
 * 진짜 웹소켓. 끊기면 1·2·4·8·10초 간격으로 다시 붙는다.
 * 서버가 error 를 보내고 닫은 연결과 우리가 닫은 연결은 다시 붙지 않는다
 */
export const connectSocket: Connector = (url, hello, onMessage, onStatus) => {
  let ws: WebSocket | null = null
  let attempt = 0
  let stopped = false
  let timer: ReturnType<typeof setTimeout> | undefined

  const open = () => {
    onStatus('connecting')
    const socket = new WebSocket(url)
    ws = socket
    socket.onopen = () => {
      attempt = 0
      socket.send(JSON.stringify(hello()))
      onStatus('open')
    }
    socket.onmessage = (e) => {
      const m = typeof e.data === 'string' ? parseServerMsg(e.data) : null
      if (!m) return
      if (m.type === 'error') stopped = true
      onMessage(m)
    }
    socket.onclose = () => {
      if (ws !== socket) return
      if (stopped) {
        onStatus('closed')
        return
      }
      const delays = NET.reconnectDelays
      const wait = delays[Math.min(attempt, delays.length - 1)]
      attempt++
      onStatus('connecting')
      timer = setTimeout(open, wait * 1000)
    }
  }
  open()

  return {
    send(m) {
      if (ws?.readyState === WebSocket.OPEN) ws.send(JSON.stringify(m))
    },
    close() {
      stopped = true
      clearTimeout(timer)
      const socket = ws
      ws = null
      socket?.close()
      onStatus('closed')
    },
  }
}
```

`src/game/net/remoteRig.ts`:
```ts
import { NET } from '../data/net'
import { pushSample, type Sample } from '../logic/interpolate'
import { fromNetAct, type NetState } from '../logic/netProtocol'
import { IDLE_ACTION, type PlayerAction } from '../logic/playerMotion'

/** 다른 사람마다 받은 state 버퍼·동작 상태·말풍선. 매 프레임 읽는 값이라 React 상태가 아닌 모듈 객체에 둔다 */
export type RemoteEntry = { buf: Sample[]; action: PlayerAction; bubble: { text: string; at: number } | null }
export const remoteRig = new Map<string, RemoteEntry>()

/** 다른 사람 모습·동작 시각에 쓰는 시계(초). 받은 시각과 그리는 시각이 같은 시계여야 한다 */
export const netNow = () => performance.now() / 1000

const entry = (id: string): RemoteEntry => {
  let e = remoteRig.get(id)
  if (!e) {
    e = { buf: [], action: IDLE_ACTION, bubble: null }
    remoteRig.set(id, e)
  }
  return e
}

export function receiveState(id: string, s: NetState, now: number) {
  const e = entry(id)
  e.buf = pushSample(e.buf, { at: now, s }, NET.bufferSize)
  e.action = fromNetAct(s.act, now, e.action)
}

export function showBubble(id: string, text: string, now: number) {
  entry(id).bubble = { text, at: now }
}

/** 한 사람(또는 모두)을 지운다 */
export function forgetRemote(id?: string) {
  if (id === undefined) remoteRig.clear()
  else remoteRig.delete(id)
}

/** 내 말풍선 (내 머리 위) */
export const selfBubble = { text: '', at: -Infinity }
```

`src/game/stores/netStore.ts`:
```ts
import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import { NET, NET_SAVE_KEY } from '../data/net'
import type { CharacterLook } from '../data/types'
import type { ClientMsg, ErrorCode, JoinMode, NetState, ServerMsg } from '../logic/netProtocol'
import { allowEvery } from '../logic/rateLimit'
import { cleanText, normalizeNick, normalizeRoomName, passHashFor, roomIdFor, textLength } from '../logic/roomKey'
import { connectSocket, type Connection, type Connector } from '../net/connection'
import { forgetRemote, netNow, receiveState, selfBubble, showBubble } from '../net/remoteRig'
import { roomUrl } from '../net/serverUrl'
import { useSessionStore } from './sessionStore'

export type NetPhase = 'off' | 'connecting' | 'online' | 'reconnecting'
export type Peer = { nick: string; look: CharacterLook }
export type ChatLine = { key: number; from: string; text: string; at: number; mine: boolean }

type NetStore = {
  phase: NetPhase
  /** 들어간 방 이름 (정리한 값) */
  room: string | null
  you: string | null
  peers: Record<string, Peer>
  chat: ChatLine[]
  /** 마지막으로 서버가 거절한 이유 (로비에 띄운다) */
  error: ErrorCode | null
  /** 저장: 마지막 방 이름·닉네임 */
  lastRoom: string
  nick: string
  join: (input: { mode: JoinMode; room: string; password: string; nick: string; look: CharacterLook }) => Promise<void>
  leave: () => void
  sendChat: (text: string) => boolean
  sendState: (s: NetState) => void
  sendProfile: (nick: string, look: CharacterLook) => void
  _setConnector: (c: Connector) => void
}

// 연결은 화면에 그리는 값이 아니라 스토어 밖에 둔다
let connector: Connector = connectSocket
let conn: Connection | null = null
let chatKey = 0
let lastChatAt = -Infinity

export const useNetStore = create<NetStore>()(
  persist(
    (set, get) => {
      const addChat = (line: Omit<ChatLine, 'key'>) => set((s) => ({ chat: [...s.chat, { ...line, key: ++chatKey }].slice(-NET.chatLog) }))
      const notify = (text: string) => useSessionStore.getState().notify(text)

      const onMessage = (m: ServerMsg) => {
        const now = netNow()
        switch (m.type) {
          case 'welcome': {
            forgetRemote()
            const peers: Record<string, Peer> = {}
            for (const p of m.players) {
              peers[p.id] = { nick: p.nick, look: p.look }
              if (p.s) receiveState(p.id, p.s, now)
            }
            set({ phase: 'online', you: m.you, peers, error: null })
            hello.mode = 'join'
            return
          }
          case 'error':
            conn = null
            forgetRemote()
            set({ phase: 'off', room: null, you: null, peers: {}, error: m.code })
            return
          case 'join':
            set((s) => ({ peers: { ...s.peers, [m.id]: { nick: m.nick, look: m.look } } }))
            notify(`${m.nick}님이 들어왔어요`)
            return
          case 'leave': {
            const peer = get().peers[m.id]
            forgetRemote(m.id)
            set((s) => {
              const { [m.id]: _gone, ...rest } = s.peers
              return { peers: rest }
            })
            if (peer) notify(`${peer.nick}님이 나갔어요`)
            return
          }
          case 'profile':
            if (get().peers[m.id]) set((s) => ({ peers: { ...s.peers, [m.id]: { nick: m.nick, look: m.look } } }))
            return
          case 'state':
            if (get().peers[m.id]) receiveState(m.id, m.s, now)
            return
          case 'chat': {
            const peer = get().peers[m.id]
            if (!peer) return
            addChat({ from: peer.nick, text: m.text, at: now, mine: false })
            showBubble(m.id, m.text, now)
            return
          }
        }
      }

      /** 다시 연결할 때 보낼 hello (첫 welcome 뒤엔 join 으로 바꾼다) */
      const hello: { mode: JoinMode; passHash: string; nick: string; look: CharacterLook } = { mode: 'join', passHash: '', nick: '', look: null as never }

      return {
        phase: 'off',
        room: null,
        you: null,
        peers: {},
        chat: [],
        error: null,
        lastRoom: '',
        nick: '',

        async join({ mode, room, password, nick, look }) {
          get().leave()
          const name = normalizeRoomName(room)
          const roomId = await roomIdFor(name)
          Object.assign(hello, { mode, passHash: await passHashFor(roomId, password), nick: normalizeNick(nick), look })
          set({ phase: 'connecting', room: name, error: null, lastRoom: name, nick: hello.nick, chat: [] })
          conn = connector(
            roomUrl(roomId),
            (): ClientMsg => ({ type: 'hello', v: NET.protocolVersion, ...hello }),
            onMessage,
            (status) => {
              if (status === 'connecting' && get().phase === 'online') {
                forgetRemote()
                set({ phase: 'reconnecting', peers: {} })
              }
            },
          )
        },

        leave() {
          const c = conn
          conn = null
          c?.close()
          forgetRemote()
          set({ phase: 'off', room: null, you: null, peers: {} })
        },

        sendChat(raw) {
          const text = cleanText(raw)
          const now = netNow()
          if (!conn || get().phase !== 'online' || textLength(text) < 1 || textLength(text) > NET.chatLength) return false
          if (!allowEvery(lastChatAt, now, NET.chatEvery)) return false
          lastChatAt = now
          conn.send({ type: 'chat', text })
          addChat({ from: get().nick, text, at: now, mine: true })
          selfBubble.text = text
          selfBubble.at = now
          return true
        },

        sendState(s) {
          if (get().phase === 'online') conn?.send({ type: 'state', s })
        },

        sendProfile(nick, look) {
          hello.nick = normalizeNick(nick)
          hello.look = look
          set({ nick: hello.nick })
          if (get().phase === 'online') conn?.send({ type: 'profile', nick: hello.nick, look })
        },

        _setConnector(c) {
          connector = c
          lastChatAt = -Infinity
        },
      }
    },
    {
      name: NET_SAVE_KEY,
      version: 1,
      storage: createJSONStorage(() => localStorage),
      // 암호는 어디에도 두지 않는다. 방 이름·닉네임만
      partialize: (s) => ({ lastRoom: s.lastRoom, nick: s.nick }),
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as { lastRoom?: unknown; nick?: unknown }
        return { ...current, lastRoom: typeof p.lastRoom === 'string' ? p.lastRoom : '', nick: typeof p.nick === 'string' ? p.nick : '' }
      },
    },
  ),
)
```
(`_gone` 미사용 경고가 lint 에 잡히면 `const rest = { ...s.peers }; delete rest[m.id]` 로 바꾼다.)

- [ ] **Step 4: 통과 확인** — `npx vitest run src/game/stores/netStore.test.ts && npx tsc -b && npx oxlint 2>&1 | grep -c warning` → 통과, 6.

- [ ] **Step 5: 커밋**
```bash
git add src/game/net src/game/stores/netStore.ts src/game/stores/netStore.test.ts
git commit -m "feat: 방 서버 연결과 같이 하기 상태" -m "웹소켓 연결·다시 붙기, 사람 목록·채팅 기록(netStore), 다른 사람 state 버퍼(remoteRig). 다시 붙을 땐 join 으로, 암호는 저장하지 않는다"
```

---

### Task 7: 내 모습 보내기 (NetBridge)

**Files:**
- Modify: `src/game/scene/Player.tsx` (`playerRig` 에 값 더하기, `FOOT_Y` export)
- Modify: `src/game/scene/fishing/fishingFx.ts`, `src/game/scene/fishing/FishingVisuals.tsx` (찌 mesh 내놓기)
- Create: `src/game/net/NetBridge.tsx`
- Modify: `src/game/scene/World.tsx` (`<NetBridge />` 넣기)

**Interfaces:**
- Consumes: `useNetStore.sendState/sendProfile`, `roundState`, `stateKey`, `toNetAct` (Task 3), `fishingLook` (Task 1).
- Produces: `playerRig.facing: number`, `playerRig.speed: number`, `playerRig.resting: boolean`, `playerRig.rodAngle: number`, `playerRig.rodShown: boolean`; `export const FOOT_Y` (Player.tsx); `fishingFx.bobber: Object3D | null`.

- [ ] **Step 1: Player 가 값 내놓기** — `playerRig` 정의를:

```ts
/** 다른 컴포넌트(낚싯줄·같이 하기 등)가 읽는 플레이어 정보. Player가 매 프레임 갱신한다 */
export const playerRig = {
  position: new Vector3(0, 1, 15),
  rodTip: new Vector3(0, 2, 15),
  /** 바라보는 각도, 수평 속도, 벤치에 앉아 있나, 낚싯대 각도·보이나 (같이 하기로 보낸다) */
  facing: 0,
  speed: 0,
  resting: false,
  rodAngle: 0.5,
  rodShown: true,
}
```
`const FOOT_Y = …` 를 `export const FOOT_Y = …` 로. `useFrame` 안 `if (visual.current) visual.current.rotation.y = facing.current` 바로 아래에 `playerRig.facing = facing.current`, `playerRig.speed = speed`, `playerRig.resting = mode === 'rest'`. 낚싯대 블록 안 `rod.current.visible = rodVisible(…)` 다음 줄에 `playerRig.rodAngle = rod.current.rotation.x` 와 `playerRig.rodShown = rod.current.visible`.

- [ ] **Step 2: 찌 내놓기** — `fishingFx.ts` 에:
```ts
  /** 찌 mesh (FishingVisuals 가 넣는다). 같이 하기가 보일 때 위치를 읽어 보낸다 */
  bobber: null as Object3D | null,
```
(`import type { Object3D } from 'three'`). `FishingVisuals.tsx` 에 `useEffect(() => { fishingFx.bobber = bobber.current; return () => { fishingFx.bobber = null } }, [])` (`useEffect` import).

- [ ] **Step 3: NetBridge** — `src/game/net/NetBridge.tsx`:

```tsx
import { useEffect, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { NET } from '../data/net'
import { fishingLook } from '../logic/characterPose'
import { roundState, stateKey, toNetAct, type NetState } from '../logic/netProtocol'
import { playerRig } from '../scene/Player'
import { fishingFx } from '../scene/fishing/fishingFx'
import { useFishingStore } from '../stores/fishingStore'
import { useNetStore } from '../stores/netStore'
import { useProgressStore } from '../stores/progressStore'
import { useSessionStore } from '../stores/sessionStore'

/**
 * 캔버스 안에서 내 모습을 방에 보낸다: 바뀐 게 있으면 초당 최대 NET.sendHz 번, 없으면 NET.idleSendEvery 초마다.
 * 옷을 바꾸면 profile 도 보낸다. 같이 하는 중이 아니면 아무것도 하지 않는다
 */
export function NetBridge() {
  const last = useRef({ at: -Infinity, key: '' })

  useEffect(
    () =>
      useProgressStore.subscribe((s, prev) => {
        const net = useNetStore.getState()
        if (s.look && s.look !== prev.look && net.phase === 'online') net.sendProfile(net.nick, s.look)
      }),
    [],
  )

  useFrame(({ clock }) => {
    if (useNetStore.getState().phase !== 'online') return
    const now = clock.elapsedTime
    const bob = fishingFx.bobber
    const s: NetState = roundState({
      p: [playerRig.position.x, playerRig.position.y, playerRig.position.z],
      f: playerRig.facing,
      v: playerRig.speed,
      rest: playerRig.resting,
      fish: fishingLook(useFishingStore.getState().state),
      rod: playerRig.rodAngle,
      rodOn: playerRig.rodShown,
      bob: bob?.visible ? [bob.position.x, bob.position.y, bob.position.z] : null,
      act: toNetAct(useSessionStore.getState().playerAction, now),
    })
    const key = stateKey(s)
    const since = now - last.current.at
    const changed = key !== last.current.key
    if ((changed && since >= 1 / NET.sendHz) || since >= NET.idleSendEvery) {
      last.current = { at: now, key }
      useNetStore.getState().sendState(s)
    }
  })
  return null
}
```
(각도 `f` 가 한없이 커지지 않게: `playerRig.facing` 이 ±1e4 를 넘으면 서버 검사에서 버려진다. Player 의 facing 은 `atan2` 로 다시 정해지거나 `shortestAngleDelta` 로 조금씩만 바뀌므로 범위 안이다.)

`World.tsx` 에서 `<Player />` 옆에 `<NetBridge />` (`import { NetBridge } from '../net/NetBridge'`).

- [ ] **Step 4: 확인** — `npx tsc -b && npx vitest run && npx oxlint 2>&1 | grep -c warning` → 통과, 6. 혼자 하기에선 아무 일도 안 하므로 화면 변화 없음.

- [ ] **Step 5: 커밋**
```bash
git add src/game/scene/Player.tsx src/game/scene/fishing/fishingFx.ts src/game/scene/fishing/FishingVisuals.tsx src/game/net/NetBridge.tsx src/game/scene/World.tsx
git commit -m "feat: 같이 하는 중 내 모습을 방에 보내기" -m "위치·방향·속도·앉기·낚시 자세·낚싯대·찌·동작을 바뀌면 초당 5번, 그대로면 2초마다 보낸다. 옷을 바꾸면 profile 도"
```

---

### Task 8: 다른 사람 그리기

**Files:**
- Create: `src/game/scene/RemotePlayer.tsx`, `src/game/scene/RemotePlayers.tsx`
- Modify: `src/game/scene/World.tsx` (`<RemotePlayers />`)

**Interfaces:**
- Consumes: `remoteRig`, `netNow`, `selfBubble` (Task 6), `sampleAt` (Task 4), `useNetStore.peers`, `PlayerModel`, `FOOT_Y`·`playerRig` (Task 7), `BENCH_SEAT_SHAPE`, `saggingLinePoint`, `CHARACTER_BASE_HEIGHT`, `useQualityLevel`.
- Produces: 화면에 다른 사람 캐릭터·이름표·말풍선·낚싯대·찌·줄, 내 말풍선.

- [ ] **Step 1: RemotePlayer** — `src/game/scene/RemotePlayer.tsx`:

```tsx
import { useMemo, useRef, useState } from 'react'
import { Html } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { BufferGeometry, Line, LineBasicMaterial, Vector3, type Group, type Mesh, type Object3D } from 'three'
import { CHARACTER_BASE_HEIGHT } from '../data/characters'
import { NET } from '../data/net'
import type { CharacterLook } from '../data/types'
import { saggingLinePoint } from '../logic/castArc'
import { sampleAt } from '../logic/interpolate'
import { netNow, remoteRig } from '../net/remoteRig'
import { BENCH_SEAT_SHAPE } from './facilities/benchShape'
import { FOOT_Y } from './Player'
import { PlayerModel, type PlayerModelHandle } from './PlayerModel'

const LINE_POINTS = 16
const grip = new Vector3()
const tip = new Vector3()
const point = new Vector3()

/** 이름표·말풍선 글씨 */
const tag = { background: 'rgba(0,0,0,0.55)', color: '#fff', padding: '2px 8px', borderRadius: 10, fontSize: 13, whiteSpace: 'nowrap' as const, pointerEvents: 'none' as const }
const bubbleStyle = { ...tag, background: '#fff', color: '#222', fontSize: 14, marginBottom: 4, maxWidth: 220, whiteSpace: 'normal' as const, textAlign: 'center' as const }

/**
 * 다른 사람 한 명. 받은 state 를 조금 늦은 시점(NET.interpDelay)에서 이어 그리고, 내 캐릭터와 같은 PlayerModel 로 자세를 잡는다.
 * shown(): 폰에서 가까운 몇 명만 그릴 때 이 사람을 그릴지
 */
export function RemotePlayer({ id, nick, look, shown }: { id: string; nick: string; look: CharacterLook; shown: () => boolean }) {
  const root = useRef<Group>(null)
  const visual = useRef<Group>(null)
  const model = useRef<PlayerModelHandle>(null)
  const rod = useRef<Group>(null)
  const rodTip = useRef<Object3D>(null)
  const bobber = useRef<Mesh>(null)
  const [bubble, setBubble] = useState('')
  const line = useMemo(() => {
    const l = new Line(new BufferGeometry().setFromPoints(Array.from({ length: LINE_POINTS }, () => new Vector3())), new LineBasicMaterial({ color: 'white' }))
    l.frustumCulled = false
    return l
  }, [])

  useFrame((_, delta) => {
    const e = remoteRig.get(id)
    const now = netNow()
    const cur = e && shown() ? sampleAt(e.buf, now - NET.interpDelay) : null
    if (!root.current || !visual.current) return
    root.current.visible = cur !== null
    line.visible = false
    if (bobber.current) bobber.current.visible = false
    if (!cur || !e) return
    const s = cur.s
    root.current.position.set(cur.x, cur.y, cur.z)
    visual.current.rotation.y = cur.f
    // 말풍선: 바뀌었을 때만 React 상태를 바꾼다
    const text = e.bubble && now - e.bubble.at < NET.bubbleSeconds ? e.bubble.text : ''
    if (text !== bubble) setBubble(text)

    const m = model.current
    if (!m || !rod.current) return
    m.update(delta, now, s.fish, e.action, cur.v, s.rod, s.rest, BENCH_SEAT_SHAPE)
    rod.current.visible = s.rodOn
    rod.current.rotation.x = s.rod
    visual.current.updateWorldMatrix(true, false)
    m.gripPosition(grip)
    rod.current.position.copy(visual.current.worldToLocal(grip))
    if (s.bob && bobber.current && rodTip.current) {
      bobber.current.position.set(s.bob[0], s.bob[1], s.bob[2])
      bobber.current.visible = true
      rodTip.current.getWorldPosition(tip)
      const positions = line.geometry.attributes.position
      for (let i = 0; i < LINE_POINTS; i++) {
        saggingLinePoint(tip, bobber.current.position, i / (LINE_POINTS - 1), 0.2, point)
        positions.setXYZ(i, point.x, point.y, point.z)
      }
      positions.needsUpdate = true
      line.visible = true
    }
  })

  const headY = FOOT_Y + CHARACTER_BASE_HEIGHT * look.height + 0.35
  return (
    <>
      <group ref={root} visible={false}>
        <group ref={visual}>
          <group position={[0, FOOT_Y, 0]}>
            <PlayerModel ref={model} look={look} />
          </group>
          <group ref={rod}>
            <mesh position={[0, 0.85, 0]} castShadow>
              <cylinderGeometry args={[0.015, 0.035, 2.3]} />
              <meshStandardMaterial color="#6d4c41" />
            </mesh>
            <object3D ref={rodTip} position={[0, 2, 0]} />
          </group>
        </group>
        <Html center position={[0, headY, 0]} zIndexRange={[50, 0]}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            {bubble && <div style={bubbleStyle}>{bubble}</div>}
            <div style={tag}>{nick}</div>
          </div>
        </Html>
      </group>
      <mesh ref={bobber} visible={false}>
        <sphereGeometry args={[0.15, 12, 12]} />
        <meshStandardMaterial color="#e63946" />
      </mesh>
      <primitive object={line} />
    </>
  )
}
```
(`CHARACTER_BASE_HEIGHT` 는 `data/characters` 에 있다 — Player.tsx 가 이미 거기서 가져온다. `look.height` 는 `CharacterLook` 에 있는 키 배율이다.)

- [ ] **Step 2: RemotePlayers** — `src/game/scene/RemotePlayers.tsx`:

```tsx
import { useRef, useState } from 'react'
import { Html } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import type { Group } from 'three'
import { NET } from '../data/net'
import { useQualityLevel } from '../input/touchDevice'
import { netNow, remoteRig, selfBubble } from '../net/remoteRig'
import { useNetStore } from '../stores/netStore'
import { playerRig } from './Player'
import { RemotePlayer } from './RemotePlayer'

/** 그릴 사람을 다시 고르는 간격(초) */
const PICK_EVERY = 1

/** 방에 있는 다른 사람들과 내 말풍선. 폰(quality low)에선 가까운 NET.lowQualityMaxRemote 명만 그린다 */
export function RemotePlayers() {
  const peers = useNetStore((s) => s.peers)
  const low = useQualityLevel() === 'low'
  const picked = useRef({ at: -Infinity, ids: new Set<string>() })

  useFrame(() => {
    const now = netNow()
    if (now - picked.current.at < PICK_EVERY) return
    picked.current.at = now
    const dist = (id: string) => {
      const last = remoteRig.get(id)?.buf.at(-1)?.s.p
      return last ? Math.hypot(last[0] - playerRig.position.x, last[2] - playerRig.position.z) : Infinity
    }
    const ids = Object.keys(useNetStore.getState().peers).sort((a, b) => dist(a) - dist(b))
    picked.current.ids = new Set(low ? ids.slice(0, NET.lowQualityMaxRemote) : ids)
  })

  return (
    <>
      {Object.entries(peers).map(([id, p]) => (
        <RemotePlayer key={`${id}:${p.look.gender}`} id={id} nick={p.nick} look={p.look} shown={() => picked.current.ids.has(id)} />
      ))}
      <SelfBubble />
    </>
  )
}

/** 내가 한 말 말풍선 (내 머리 위) */
function SelfBubble() {
  const group = useRef<Group>(null)
  const [text, setText] = useState('')
  useFrame(() => {
    const t = netNow() - selfBubble.at < NET.bubbleSeconds ? selfBubble.text : ''
    if (t !== text) setText(t)
    group.current?.position.set(playerRig.position.x, playerRig.position.y + 1.4, playerRig.position.z)
  })
  return (
    <group ref={group}>
      {text && (
        <Html center zIndexRange={[50, 0]}>
          <div style={{ background: '#fff', color: '#222', padding: '2px 8px', borderRadius: 10, fontSize: 14, maxWidth: 220, textAlign: 'center', pointerEvents: 'none' }}>{text}</div>
        </Html>
      )}
    </group>
  )
}
```
`useQualityLevel` 가 돌려주는 값 이름이 `'low'` 가 아니면 `data/quality.ts` 의 `QualityLevel` 에서 가장 낮은 단계 이름으로 바꾼다. `picked` 가 처음 1초 동안 비어 있어 아무도 안 보이는 걸 막으려고 `at: -Infinity` 로 시작한다(첫 프레임에 바로 고른다).

`World.tsx` 에 `<RemotePlayers />` (`import { RemotePlayers } from './RemotePlayers'`).

- [ ] **Step 3: 확인** — `npx tsc -b && npx vitest run && npx oxlint 2>&1 | grep -c warning` → 통과, 6. 실제 모습은 Task 10 에서 브라우저 두 개로 확인.

- [ ] **Step 4: 커밋**
```bash
git add src/game/scene/RemotePlayer.tsx src/game/scene/RemotePlayers.tsx src/game/scene/World.tsx
git commit -m "feat: 같은 방 사람들 그리기" -m "받은 모습을 250ms 늦게 이어 그리고 내 캐릭터와 같은 모델로 자세·낚싯대·찌·줄을 그린다. 머리 위 이름표·말풍선, 폰에선 가까운 10명만"
```

---

### Task 9: 로비·방 배지·채팅 화면

**Files:**
- Create: `src/game/input/typing.ts`, `src/game/input/typing.test.ts`
- Modify: `src/game/input/keys.ts`, `src/game/input/useInteractionKeys.ts`, `src/game/input/usePlayerActionKeys.ts`, `src/game/audio/backgroundMusic.ts`
- Modify: `src/game/logic/interaction.ts` (`Mode` 에 `'lobby'`, `resolveKeyAction`), `src/game/logic/interaction.test.ts`
- Create: `src/game/ui/Lobby.tsx`, `src/game/ui/RoomBadge.tsx`, `src/game/ui/ChatBox.tsx`
- Modify: `src/game/ui/Panels.tsx`, `src/game/ui/CharacterCreator.tsx`, `src/game/Game.tsx`

**Interfaces:**
- Consumes: `useNetStore` (Task 6), `ROOM_SERVER`, `lobbyErrors`, `readRoomParam`, `normalizeRoomName` (Task 2).
- Produces: `isTypingTarget(target: EventTarget | null): boolean`, mode `'lobby'`.

- [ ] **Step 1: 입력 칸 판정 테스트** — `typing.test.ts` (jsdom 환경; 다른 테스트가 jsdom 을 어떻게 켜는지 보고 같은 방식으로. 예: 파일 맨 위 `// @vitest-environment jsdom`):

```ts
// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { isTypingTarget } from './typing'

describe('isTypingTarget', () => {
  it('입력 칸·여러 줄·편집 가능 요소에서 누른 키', () => {
    expect(isTypingTarget(document.createElement('input'))).toBe(true)
    expect(isTypingTarget(document.createElement('textarea'))).toBe(true)
    const div = document.createElement('div')
    div.contentEditable = 'true'
    expect(isTypingTarget(div)).toBe(true)
  })
  it('버튼·창·null 은 아니다', () => {
    expect(isTypingTarget(document.createElement('button'))).toBe(false)
    expect(isTypingTarget(window)).toBe(false)
    expect(isTypingTarget(null)).toBe(false)
  })
})
```
`interaction.test.ts` 에:
```ts
it('로비에선 ESC·E 모두 아무 일도 하지 않는다 (혼자 하기/같이 하기를 골라야 닫힌다)', () => {
  expect(resolveKeyAction('Escape', 'lobby', null)).toEqual({ type: 'none' })
  expect(resolveKeyAction('KeyE', 'lobby', null)).toEqual({ type: 'none' })
})
```

- [ ] **Step 2: 구현 — 입력 칸 판정**

`src/game/input/typing.ts`:
```ts
/** 글자를 치는 칸(입력창·여러 줄 입력·선택 상자·편집 가능한 요소)에서 누른 키인가. 이 키는 게임 조작으로 쓰지 않는다 */
export function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  return target.isContentEditable || target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement
}
```
(jsdom 은 `isContentEditable` 을 구현하지 않을 수 있다. 테스트가 그 줄에서 실패하면 `target.isContentEditable || target.getAttribute('contenteditable') === 'true'` 로.)
`usePlayerActionKeys.ts` 의 같은 이름 함수를 지우고 이걸 import.
`keys.ts`: `const down = (e: KeyboardEvent) => { if (isTypingTarget(e.target)) return; pressed.add(e.code) }`, 그리고 `window.addEventListener('focusin', onFocusIn)` — `const onFocusIn = (e: FocusEvent) => { if (isTypingTarget(e.target)) pressed.clear() }` (입력 칸으로 들어가는 순간 누르고 있던 이동 키를 뗀다). 정리 함수에서 제거.
`useInteractionKeys.ts`: `onKeyDown` 맨 앞에 `if (isTypingTarget(e.target)) return`.
`backgroundMusic.ts`: `!(e.target instanceof HTMLInputElement)` 를 `!isTypingTarget(e.target)` 로.

- [ ] **Step 3: 로비 모드** — `interaction.ts`: `Mode` 에 `| 'lobby'`, `resolveKeyAction` 첫 줄을 `if (mode === 'cutscene' || mode === 'lobby') return { type: 'none' }`. `npx tsc -b` 로 `Mode` 를 빠짐없이 다루는 곳에서 오류가 나면 `'menu'` 와 같게 다룬다.

- [ ] **Step 4: 테스트 통과** — `npx vitest run src/game/input src/game/logic/interaction.test.ts` → 통과.

- [ ] **Step 5: Lobby** — `src/game/ui/Lobby.tsx`:

```tsx
import { useEffect, useState } from 'react'
import { DEFAULT_LOOK } from '../data/characterParts'
import { NET } from '../data/net'
import type { ErrorCode, JoinMode } from '../logic/netProtocol'
import { lobbyErrors, readRoomParam, type LobbyField } from '../logic/roomKey'
import { useNetStore } from '../stores/netStore'
import { useProgressStore } from '../stores/progressStore'
import { useSessionStore } from '../stores/sessionStore'
import { Panel } from './Panel'
import { button } from './styles'

const ERROR_TEXT: Record<ErrorCode, string> = {
  'room-exists': '이미 있는 방 이름이에요',
  'no-room': '그런 방이 없어요',
  'bad-password': '암호가 틀렸어요',
  full: `방이 꽉 찼어요 (${NET.maxPlayers}명)`,
  version: '게임을 새로고침해 주세요 (버전이 달라요)',
  'bad-hello': '연결에 문제가 있어요. 다시 해 주세요',
}
const FIELD_TEXT: Record<LobbyField, string> = {
  room: `방 이름은 ${NET.roomName[0]}~${NET.roomName[1]}자`,
  password: `암호는 ${NET.password[0]}~${NET.password[1]}자`,
  nick: `닉네임은 ${NET.nick[0]}~${NET.nick[1]}자`,
}

/** 시작 창: 혼자 하기 / 같이 하기(방 만들기·들어가기). 공유 링크(?room=)로 오면 들어가기 탭에 방 이름이 채워져 있다 */
export function Lobby() {
  const net = useNetStore()
  const linkRoom = readRoomParam(window.location.search)
  const [tab, setTab] = useState<JoinMode>(linkRoom ? 'join' : 'create')
  const [room, setRoom] = useState(linkRoom || net.lastRoom)
  const [password, setPassword] = useState('')
  const [nick, setNick] = useState(net.nick)
  const [bad, setBad] = useState<LobbyField[]>([])
  const setMode = useSessionStore((s) => s.setMode)

  // 들어가지면 로비를 닫는다
  useEffect(() => {
    if (net.phase === 'online') setMode('explore')
  }, [net.phase, setMode])

  const submit = () => {
    const errors = lobbyErrors({ room, password, nick })
    setBad(errors)
    if (errors.length > 0) return
    void net.join({ mode: tab, room, password, nick, look: useProgressStore.getState().look ?? DEFAULT_LOOK })
  }
  const busy = net.phase === 'connecting'
  const input = { width: '100%', padding: '10px 12px', fontSize: 16, borderRadius: 8, border: '1px solid #ccc', boxSizing: 'border-box' as const }

  return (
    <Panel title="🎣 낚시섬">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, minWidth: 'min(320px, 80vw)' }}>
        <button style={{ ...button, fontSize: 18 }} onClick={() => setMode('explore')}>혼자 하기</button>
        <div style={{ borderTop: '1px solid #ddd', paddingTop: 12 }}>
          <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
            {(['create', 'join'] as const).map((t) => (
              <button key={t} style={{ ...button, flex: 1, opacity: tab === t ? 1 : 0.5 }} onClick={() => setTab(t)}>
                {t === 'create' ? '🔒 방 만들기' : '🚪 들어가기'}
              </button>
            ))}
          </div>
          <form style={{ display: 'flex', flexDirection: 'column', gap: 8 }} onSubmit={(e) => { e.preventDefault(); submit() }}>
            <input style={input} placeholder="방 이름" value={room} maxLength={40} onChange={(e) => setRoom(e.target.value)} />
            <input style={input} placeholder="암호" type="password" value={password} maxLength={64} onChange={(e) => setPassword(e.target.value)} />
            <input style={input} placeholder="닉네임" value={nick} maxLength={20} onChange={(e) => setNick(e.target.value)} />
            {bad.map((f) => <p key={f} style={{ margin: 0, color: '#c62828', fontSize: 14 }}>{FIELD_TEXT[f]}</p>)}
            {net.error && <p style={{ margin: 0, color: '#c62828', fontSize: 14 }}>{ERROR_TEXT[net.error]}</p>}
            <button type="submit" style={{ ...button, fontSize: 18 }} disabled={busy}>
              {busy ? '연결 중…' : tab === 'create' ? '방 만들고 들어가기' : '들어가기'}
            </button>
          </form>
          <p style={{ margin: '8px 0 0', fontSize: 13, opacity: 0.7 }}>암호를 아는 사람끼리만 같은 섬에서 만나요. 암호는 저장되지 않아요.</p>
        </div>
      </div>
    </Panel>
  )
}
```
(`Panel` 의 props 이름(`title` 등)은 `ui/Panel.tsx` 를 열어 맞춘다. 닫기 버튼을 그리는 Panel 이면 닫기 동작이 '혼자 하기' 와 같게 `setMode('explore')`.)

`Panels.tsx`: `case 'lobby': return <Lobby />`.

- [ ] **Step 6: 방 배지** — `src/game/ui/RoomBadge.tsx`:

```tsx
import { useState } from 'react'
import { DEFAULT_LOOK } from '../data/characterParts'
import { lobbyErrors } from '../logic/roomKey'
import { useNetStore } from '../stores/netStore'
import { useProgressStore } from '../stores/progressStore'
import { useSessionStore } from '../stores/sessionStore'
import { button, safeRight, safeTop } from './styles'

/** 화면 오른쪽 위: 🔒 방 이름 · 👥 인원, 링크 복사·닉네임 바꾸기·나가기. 같이 하는 중에만 */
export function RoomBadge() {
  const { phase, room, peers, nick } = useNetStore()
  const mode = useSessionStore((s) => s.mode)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(nick)
  if (phase === 'off' || !room || mode === 'cutscene' || mode === 'lobby') return null
  const count = Object.keys(peers).length + 1
  const copy = () => {
    const url = `${window.location.origin}${window.location.pathname}?room=${encodeURIComponent(room)}`
    void navigator.clipboard?.writeText(url).then(() => useSessionStore.getState().notify('링크를 복사했어요. 암호는 따로 알려 주세요'))
  }
  const saveNick = () => {
    if (lobbyErrors({ room, password: 'xxxx', nick: draft }).includes('nick')) return
    useNetStore.getState().sendProfile(draft, useProgressStore.getState().look ?? DEFAULT_LOOK)
    setEditing(false)
  }
  const small = { ...button, padding: '4px 10px', fontSize: 13 }
  return (
    <div style={{ position: 'absolute', top: safeTop(64), right: safeRight(16), background: 'rgba(0,0,0,0.6)', color: '#fff', borderRadius: 10, padding: '6px 10px', fontSize: 14, display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end', maxWidth: '70vw' }}>
      <span>🔒 {room} · 👥 {count}명{phase === 'reconnecting' ? ' · 다시 연결 중…' : phase === 'connecting' ? ' · 연결 중…' : ''}</span>
      <button style={small} onClick={copy}>링크 복사</button>
      {editing ? (
        <form style={{ display: 'flex', gap: 4 }} onSubmit={(e) => { e.preventDefault(); saveNick() }}>
          <input value={draft} maxLength={20} autoFocus onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => { if (e.key === 'Escape') { e.stopPropagation(); setEditing(false) } }} style={{ width: 90, fontSize: 14 }} />
          <button type="submit" style={small}>저장</button>
        </form>
      ) : (
        <button style={small} onClick={() => { setDraft(nick); setEditing(true) }}>✏️ {nick}</button>
      )}
      <button style={small} onClick={() => useNetStore.getState().leave()}>나가기</button>
    </div>
  )
}
```

- [ ] **Step 7: 채팅** — `src/game/ui/ChatBox.tsx`:

```tsx
import { useEffect, useRef, useState } from 'react'
import { NET } from '../data/net'
import { useTouchUi } from '../input/touchDevice'
import { isTypingTarget } from '../input/typing'
import { netNow } from '../net/remoteRig'
import { useNetStore } from '../stores/netStore'
import { useSessionStore } from '../stores/sessionStore'
import { button, safeBottom, safeLeft } from './styles'

/** 채팅을 열 수 있는 모드 (패널이 열려 있을 땐 그 패널 입력과 겹치지 않게 막는다) */
const CHAT_MODES = new Set(['explore', 'fishing', 'rest'])

/** 왼쪽 아래 채팅: 최근 30줄(10초 지나면 흐려짐), Enter 로 열고 보내기, Esc 로 닫기. 폰은 💬 버튼 */
export function ChatBox() {
  const phase = useNetStore((s) => s.phase)
  const chat = useNetStore((s) => s.chat)
  const mode = useSessionStore((s) => s.mode)
  const touchUi = useTouchUi()
  const [open, setOpen] = useState(false)
  const [text, setText] = useState('')
  const input = useRef<HTMLInputElement>(null)
  const [, tick] = useState(0)

  // 흐려지게 하려고 1초마다 다시 그린다
  useEffect(() => {
    const t = setInterval(() => tick((n) => n + 1), 1000)
    return () => clearInterval(t)
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code !== 'Enter' || open || isTypingTarget(e.target)) return
      if (useNetStore.getState().phase !== 'online' || !CHAT_MODES.has(useSessionStore.getState().mode)) return
      e.preventDefault()
      setOpen(true)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  useEffect(() => {
    if (open) input.current?.focus()
  }, [open])

  if (phase === 'off' || mode === 'lobby' || mode === 'cutscene') return null
  const now = netNow()
  const send = () => {
    if (text.trim()) useNetStore.getState().sendChat(text)
    setText('')
    setOpen(false)
  }

  return (
    <div style={{ position: 'absolute', left: safeLeft(16), bottom: safeBottom(touchUi ? 200 : 60), width: 'min(340px, 64vw)', pointerEvents: 'none', display: 'flex', flexDirection: 'column', gap: 4 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2, maxHeight: '30vh', overflow: 'hidden', justifyContent: 'flex-end' }}>
        {chat.map((line) => {
          const age = now - line.at
          const opacity = open ? 1 : Math.max(0, 1 - Math.max(0, age - NET.chatFadeSeconds) / 3)
          if (opacity <= 0) return null
          return (
            <div key={line.key} style={{ background: 'rgba(0,0,0,0.5)', color: '#fff', borderRadius: 6, padding: '2px 8px', fontSize: 14, opacity, wordBreak: 'break-all' }}>
              <b style={{ color: line.mine ? '#ffd166' : '#8ecae6' }}>{line.from}</b> {line.text}
            </div>
          )
        })}
      </div>
      {open ? (
        <form style={{ display: 'flex', gap: 4, pointerEvents: 'auto' }} onSubmit={(e) => { e.preventDefault(); send() }}>
          <input
            ref={input}
            value={text}
            maxLength={NET.chatLength}
            placeholder="말하기 (Enter 보내기 · Esc 닫기)"
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                e.preventDefault()
                e.stopPropagation()
                setOpen(false)
              }
            }}
            onBlur={() => !text && setOpen(false)}
            style={{ flex: 1, fontSize: 16, padding: '6px 8px', borderRadius: 6, border: 'none' }}
          />
          <button type="submit" style={button}>보내기</button>
        </form>
      ) : (
        touchUi && phase === 'online' && CHAT_MODES.has(mode) && (
          <button style={{ ...button, pointerEvents: 'auto', alignSelf: 'flex-start' }} onClick={() => setOpen(true)}>💬</button>
        )
      )}
    </div>
  )
}
```
주의: 채팅 입력의 Esc 는 `stopPropagation` 해도 window 의 `useInteractionKeys` 리스너보다 먼저 React 핸들러가 불리는지는 이벤트 위임 순서에 달렸다. `useInteractionKeys` 는 Step 2 에서 입력 칸에서 누른 키를 무시하므로 어느 순서든 메뉴가 열리지 않는다.

- [ ] **Step 8: 화면에 붙이기**

`Game.tsx`: `import { ROOM_SERVER } from './net/serverUrl'`, `import { ChatBox } from './ui/ChatBox'`, `import { RoomBadge } from './ui/RoomBadge'`. 시작 effect 의 else 블록을:
```ts
    else {
      const place = normalizePlace(usePlaceStore.getState().place, useProgressStore.getState().unlockedZones)
      useSessionStore.setState({ zoom: place.zoom })
      // 방 서버가 있으면 혼자 할지 같이 할지부터 고른다. 아니면 벤치에 앉아 있던 채로 이어서
      if (ROOM_SERVER) useSessionStore.getState().setMode('lobby')
      else if (place.resting) useSessionStore.getState().setMode('rest')
    }
```
그리고 effect 정리 함수로 `return () => useNetStore.getState().leave()` (게임을 나가면 연결을 닫는다). JSX 의 `<Hud />` 다음에 `<RoomBadge />`, `<FishingOverlay />` 다음에 `<ChatBox />`.

`CharacterCreator.tsx`: `const close = () => useSessionStore.getState().setMode('explore')` 를
```ts
  // 처음 만든 뒤 방 서버가 있으면 혼자/같이 고르는 창으로
  const close = () => useSessionStore.getState().setMode(firstTime && ROOM_SERVER ? 'lobby' : 'explore')
```
(`import { ROOM_SERVER } from '../net/serverUrl'`).

- [ ] **Step 9: 확인** — `npx tsc -b && npx vitest run && npx oxlint 2>&1 | grep -c warning && npm run build` → 통과, 6, 빌드 성공. 서버 주소 없이 `npm run dev` 로 띄워 로비가 안 뜨고 지금과 같은지 헤드리스 스크린샷 한 장.

- [ ] **Step 10: 커밋**
```bash
git add src/game/input src/game/logic/interaction.ts src/game/logic/interaction.test.ts src/game/ui/Lobby.tsx src/game/ui/RoomBadge.tsx src/game/ui/ChatBox.tsx src/game/ui/Panels.tsx src/game/ui/CharacterCreator.tsx src/game/Game.tsx src/game/audio/backgroundMusic.ts
git commit -m "feat: 같이 하기 로비·방 배지·채팅" -m "시작할 때 혼자 하기/방 만들기/들어가기를 고르고, 위에 방 이름·인원·링크 복사·닉네임·나가기, 왼쪽 아래 채팅. 입력 칸에서 누른 키는 게임 조작으로 쓰지 않는다. 방 서버 주소가 없으면 지금과 같다"
```

---

### Task 10: 브라우저 두 개로 끝까지 확인하고 마무리

**Files:**
- Create: `tools/multiplayer-check.mjs` (헤드리스 확인 스크립트, 커밋)
- Modify: `README.md` (같이 하기 서버 띄우기·배포 방법), `.env.example` (`VITE_ROOM_SERVER=ws://127.0.0.1:8787`)

- [ ] **Step 1: 로컬로 띄우기** — 백그라운드로 `npm run server:dev` (포트 8787), `VITE_ROOM_SERVER=ws://127.0.0.1:8787 npm run build && npx vite preview --port 5190`.

- [ ] **Step 2: 확인 스크립트** — CDP 로 Chrome(swiftshader) 두 개를 고유 포트(9711, 9712)로 띄우고, 각자 localStorage 에 캐릭터(`fishing-island-save-v1` 의 look)를 넣은 뒤 `http://127.0.0.1:5190/?room=check` 를 연다. A: '방 만들기' 탭에서 방 이름 `check`, 암호 `secret1`, 닉 `A` 로 들어간다. B: 먼저 틀린 암호 `nope1234` 로 들어가기 → "암호가 틀렸어요" 문구 확인 → `secret1` 로 들어간다. 이후:
  - A 화면 HUD 에 `👥 2명`, B 도 `👥 2명`.
  - A 에서 W 키를 1초 누르고 1초 뒤 B 화면 스크린샷: A 캐릭터·이름표 `A` 가 보인다.
  - A 에서 Enter → `안녕` 입력 → Enter. B 화면에 채팅 줄 `A 안녕` 과 말풍선.
  - A 채팅 입력 중 W 를 눌러도 A 가 움직이지 않는다(위치 값 비교).
  - B 탭을 닫으면 A 에 "B님이 나갔어요".
  스크린샷을 `scratchpad` 에 저장하고 직접 열어 확인한다.

- [ ] **Step 3: 고친 게 있으면 해당 Task 의 테스트를 먼저 더하고 고친다.**

- [ ] **Step 4: 문서** — README 에:
```md
## 같이 하기 (방 서버)

- 로컬: `npm run server:dev` 로 방 서버(ws://127.0.0.1:8787)를 띄우고 `.env.local` 에 `VITE_ROOM_SERVER=ws://127.0.0.1:8787` 을 넣은 뒤 `npm run dev`.
- 배포: `npx wrangler login` (한 번) → `npm run server:deploy` → 나온 주소(https://rinfish-rooms.<계정>.workers.dev)를 `wss://` 로 바꿔 Vercel 환경변수 `VITE_ROOM_SERVER` 에 넣고 다시 배포.
- `VITE_ROOM_SERVER` 가 없으면 혼자 하기만 보인다.
```

- [ ] **Step 5: 전체 확인과 커밋** — `npx tsc -b && npx vitest run && npx oxlint 2>&1 | grep -c warning && npm run build`.
```bash
git add tools/multiplayer-check.mjs README.md .env.example
git commit -m "docs: 같이 하기 서버 띄우기·배포 방법" -m "로컬 방 서버로 브라우저 두 개를 띄워 서로 보이기·채팅·틀린 암호를 확인하는 스크립트 포함"
```

- [ ] **Step 6: push** — 서버 주소가 Vercel 에 아직 없으므로 배포 화면은 지금과 같다. `git push origin main`.

- [ ] **Step 7: 사용자에게 넘길 것** — Cloudflare 가입, `! npx wrangler login`. 로그인되면 `npm run server:deploy` → 주소를 받아 사용자에게 Vercel 환경변수 `VITE_ROOM_SERVER` 설정을 부탁 → 재배포 뒤 실제 주소로 두 기기 확인.
