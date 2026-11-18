import { describe, expect, it } from 'vitest'
import type { FishingPlace } from './fishingEdge'
import { isCookingSkipKey, isSameInteractable, resolveKeyAction } from './interaction'

const place = (id: string): FishingPlace => ({ id, zone: 'beach', position: [0, 28], facing: [0, 1], surfaceY: -0.3, reach: { near: 2, far: Infinity } })

describe('isSameInteractable', () => {
  it('선착장은 가는 방향이 같아야 같은 대상', () => {
    expect(isSameInteractable({ kind: 'dock', dir: 'toIsland' }, { kind: 'dock', dir: 'toIsland' })).toBe(true)
    expect(isSameInteractable({ kind: 'dock', dir: 'toIsland' }, { kind: 'dock', dir: 'toMeadow' })).toBe(false)
  })
  it('같은 낚시 자리(같은 물)면 true, 다른 물이면 false', () => {
    const a = { kind: 'fishingSpot' as const, spot: place('shore:sea') }
    expect(isSameInteractable(a, { kind: 'fishingSpot', spot: place('shore:sea') })).toBe(true)
    expect(isSameInteractable(a, { kind: 'fishingSpot', spot: place('shore:pond') })).toBe(false)
  })

  it('종류가 다르거나 비어 있으면 false', () => {
    expect(isSameInteractable({ kind: 'sellBox' }, { kind: 'gearShop' })).toBe(false)
    expect(isSameInteractable(null, { kind: 'sellBox' })).toBe(false)
    expect(isSameInteractable({ kind: 'sellBox' }, { kind: 'sellBox' })).toBe(true)
  })
})

describe('resolveKeyAction', () => {
  it('침대에서 E 로 잠자기', () => {
    expect(resolveKeyAction('KeyE', 'explore', { kind: 'bed' })).toEqual({ type: 'sleep' })
  })
  it('누워 있는 동안(sleep) E·ESC 는 일어나기, 그 밖의 키는 무시 (메뉴를 열지 않는다)', () => {
    expect(resolveKeyAction('KeyE', 'sleep', { kind: 'bed' })).toEqual({ type: 'wake' })
    expect(resolveKeyAction('Escape', 'sleep', null)).toEqual({ type: 'wake' })
    for (const code of ['Digit1', 'Space', 'KeyM']) expect(resolveKeyAction(code, 'sleep', { kind: 'bed' })).toEqual({ type: 'none' })
  })
  it('선착장에서 E 로 배를 탄다', () => {
    expect(resolveKeyAction('KeyE', 'explore', { kind: 'dock', dir: 'toIsland' })).toEqual({ type: 'boardBoat', dir: 'toIsland' })
  })
  it('배 타는 중엔 어떤 키도 모드를 바꾸지 않는다', () => {
    for (const code of ['Escape', 'KeyE', 'Digit1', 'Space']) {
      expect(resolveKeyAction(code, 'boat', { kind: 'dock', dir: 'toMeadow' })).toEqual({ type: 'none' })
    }
  })
  it('큰 지도를 보는 중엔 ESC 로 닫기만 하고(메뉴 안 열림) E·숫자·Space 는 무시한다', () => {
    expect(resolveKeyAction('Escape', 'map', null)).toEqual({ type: 'closePanel' })
    for (const code of ['KeyE', 'Digit1', 'Space', 'KeyW']) {
      expect(resolveKeyAction(code, 'map', { kind: 'dock', dir: 'toMeadow' })).toEqual({ type: 'none' })
    }
  })
  it('로비에선 ESC·E 모두 아무 일도 하지 않는다 (혼자 하기/같이 하기를 골라야 닫힌다)', () => {
    expect(resolveKeyAction('Escape', 'lobby', null)).toEqual({ type: 'none' })
    expect(resolveKeyAction('KeyE', 'lobby', { kind: 'sellBox' })).toEqual({ type: 'none' })
  })

  const spot = { kind: 'fishingSpot' as const, spot: place('shore:sea') }

  it('탐험 중 낚시 포인트에서 E를 누르면 낚시를 시작한다', () => {
    expect(resolveKeyAction('KeyE', 'explore', spot)).toEqual({ type: 'startFishing', spot: spot.spot })
  })

  it('판매함·상점에서 E를 누르면 해당 패널을 연다', () => {
    expect(resolveKeyAction('KeyE', 'explore', { kind: 'sellBox' })).toEqual({ type: 'openMode', mode: 'sell' })
    expect(resolveKeyAction('KeyE', 'explore', { kind: 'gearShop' })).toEqual({ type: 'openMode', mode: 'shop' })
  })

  it('주변에 아무것도 없거나 이미 다른 일을 하는 중이면 E는 무시한다', () => {
    expect(resolveKeyAction('KeyE', 'explore', null)).toEqual({ type: 'none' })
    expect(resolveKeyAction('KeyE', 'fishing', spot)).toEqual({ type: 'none' })
    expect(resolveKeyAction('KeyE', 'shop', { kind: 'gearShop' })).toEqual({ type: 'none' })
  })

  it('ESC: 탐험 중이면 메뉴, 낚시 중이면 낚시 중단, 패널이면 닫기', () => {
    expect(resolveKeyAction('Escape', 'explore', null)).toEqual({ type: 'openMode', mode: 'menu' })
    expect(resolveKeyAction('Escape', 'fishing', spot)).toEqual({ type: 'stopFishing' })
    expect(resolveKeyAction('Escape', 'menu', null)).toEqual({ type: 'closePanel' })
  })

  it('낚시 중 1~3은 미끼, 0은 미끼 없이. 패널에선 숫자 키를 받지 않는다', () => {
    expect(resolveKeyAction('Digit1', 'fishing', spot)).toEqual({ type: 'selectBait', bait: 'worm' })
    expect(resolveKeyAction('Digit3', 'fishing', spot)).toEqual({ type: 'selectBait', bait: 'lure' })
    expect(resolveKeyAction('Digit0', 'fishing', spot)).toEqual({ type: 'selectBait', bait: null })
    expect(resolveKeyAction('Digit5', 'fishing', spot)).toEqual({ type: 'none' })
    expect(resolveKeyAction('Digit2', 'shop', null)).toEqual({ type: 'none' })
  })

  it('잠긴 구역 문 앞에서 E 는 여는 창, 연출 중엔 E·ESC·숫자 키 모두 무시', () => {
    const gate = { kind: 'zoneGate' as const, zoneId: 'pond' as const }
    expect(resolveKeyAction('KeyE', 'explore', gate)).toEqual({ type: 'openMode', mode: 'unlock' })
    expect(resolveKeyAction('Escape', 'unlock', gate)).toEqual({ type: 'closePanel' })
    for (const code of ['KeyE', 'Escape', 'Digit1']) expect(resolveKeyAction(code, 'cutscene', gate)).toEqual({ type: 'none' })
    expect(isSameInteractable(gate, { kind: 'zoneGate', zoneId: 'reef' })).toBe(false)
    expect(isSameInteractable(gate, { kind: 'zoneGate', zoneId: 'pond' })).toBe(true)
  })

  it('요리 연출은 E·Space·Enter·ESC 로 건너뛴다', () => {
    for (const code of ['KeyE', 'Space', 'Enter', 'Escape']) expect(isCookingSkipKey(code)).toBe(true)
    expect(isCookingSkipKey('KeyW')).toBe(false)
  })

  it('다른 키는 무시한다', () => {
    expect(resolveKeyAction('KeyW', 'explore', spot)).toEqual({ type: 'none' })
  })

  it('미스터찜(market)·어항은 패널을 열고, 벤치는 앉는다', () => {
    expect(resolveKeyAction('KeyE', 'explore', { kind: 'market' })).toEqual({ type: 'openMode', mode: 'market' })
    expect(resolveKeyAction('KeyE', 'explore', { kind: 'aquarium' })).toEqual({ type: 'openMode', mode: 'aquarium' })
    expect(resolveKeyAction('KeyE', 'explore', { kind: 'bench' })).toEqual({ type: 'openMode', mode: 'rest' })
  })

  it('앉아 있을 때 E나 ESC를 누르면 일어난다', () => {
    expect(resolveKeyAction('KeyE', 'rest', { kind: 'bench' })).toEqual({ type: 'closePanel' })
    expect(resolveKeyAction('Escape', 'rest', { kind: 'bench' })).toEqual({ type: 'closePanel' })
  })

  it('패널이 열려 있을 때 E는 아무 일도 하지 않는다', () => {
    expect(resolveKeyAction('KeyE', 'market', { kind: 'market' })).toEqual({ type: 'none' })
  })

  it('옷장에서 E를 누르면 꾸미기 화면을 연다', () => {
    expect(resolveKeyAction('KeyE', 'explore', { kind: 'wardrobe' })).toEqual({ type: 'openMode', mode: 'wardrobe' })
  })

  it('처음 캐릭터를 만드는 중(잠금)엔 ESC로 닫히지 않는다', () => {
    expect(resolveKeyAction('Escape', 'wardrobe', null, true)).toEqual({ type: 'none' })
    expect(resolveKeyAction('Escape', 'wardrobe', null, false)).toEqual({ type: 'closePanel' })
  })

  it('어항 크게 보기에서 ESC를 누르면 어항 패널로 돌아간다', () => {
    expect(resolveKeyAction('Escape', 'aquariumView', null)).toEqual({ type: 'openMode', mode: 'aquarium' })
  })

  it('Tab: 탐험·배·메뉴·지도에서 큰 지도를 열고 닫는다. 낚시·패널·바퀴에선 무시', () => {
    for (const mode of ['explore', 'boat', 'menu', 'map'] as const) expect(resolveKeyAction('Tab', mode, null)).toEqual({ type: 'toggleMap' })
    for (const mode of ['fishing', 'shop', 'sleep', 'emote', 'lobby', 'cutscene'] as const) expect(resolveKeyAction('Tab', mode, null)).toEqual({ type: 'none' })
  })
  it('감정 표현 바퀴(emote) 중엔 E·숫자는 무시하고 ESC 는 닫기', () => {
    expect(resolveKeyAction('KeyE', 'emote', { kind: 'sellBox' })).toEqual({ type: 'none' })
    expect(resolveKeyAction('Digit1', 'emote', null)).toEqual({ type: 'none' })
    expect(resolveKeyAction('Escape', 'emote', null)).toEqual({ type: 'closePanel' })
  })

  it('탐험 중 숫자 키는 도구 칸 (1 낚싯대 · 2 주먹 · 3 칼 · 4~7 총), 빈 칸은 무시. X 는 넣기', () => {
    expect(resolveKeyAction('Digit1', 'explore', null)).toEqual({ type: 'equip', tool: 'rod' })
    expect(resolveKeyAction('Digit2', 'explore', null)).toEqual({ type: 'equip', tool: 'fists' })
    expect(resolveKeyAction('Digit3', 'explore', null)).toEqual({ type: 'equip', tool: 'knife' })
    expect(resolveKeyAction('Digit4', 'explore', null)).toEqual({ type: 'equip', tool: 'pistol' })
    expect(resolveKeyAction('Digit7', 'explore', null)).toEqual({ type: 'equip', tool: 'sniper' })
    expect(resolveKeyAction('Digit8', 'explore', null)).toEqual({ type: 'none' })
    expect(resolveKeyAction('Digit0', 'explore', null)).toEqual({ type: 'none' })
    expect(resolveKeyAction('KeyX', 'explore', null)).toEqual({ type: 'equip', tool: null })
    expect(resolveKeyAction('KeyR', 'explore', null)).toEqual({ type: 'reload' })
    expect(resolveKeyAction('KeyR', 'fishing', null)).toEqual({ type: 'none' })
    expect(resolveKeyAction('KeyR', 'bag', null)).toEqual({ type: 'none' })
    expect(resolveKeyAction('KeyV', 'explore', null)).toEqual({ type: 'toggleView' })
    expect(resolveKeyAction('KeyV', 'fishing', null)).toEqual({ type: 'none' })
    expect(resolveKeyAction('KeyG', 'explore', null)).toEqual({ type: 'rangeGame' })
    expect(resolveKeyAction('KeyG', 'rack', null)).toEqual({ type: 'none' })
    expect(resolveKeyAction('KeyE', 'explore', { kind: 'rack' })).toEqual({ type: 'openMode', mode: 'rack' })
    expect(resolveKeyAction('Escape', 'rack', null)).toEqual({ type: 'closePanel' })
    // 낚시 중 숫자는 그대로 미끼, 패널에선 무시
    expect(resolveKeyAction('Digit2', 'fishing', null)).toEqual({ type: 'selectBait', bait: 'shrimp' })
    expect(resolveKeyAction('KeyX', 'fishing', null)).toEqual({ type: 'none' })
    expect(resolveKeyAction('Digit1', 'market', null)).toEqual({ type: 'none' })
  })

  it('탐험 중 F 는 먹기, I 는 가방 (가방에서 I·ESC 는 닫기). 낚시·패널 중엔 무시', () => {
    expect(resolveKeyAction('KeyF', 'explore', null)).toEqual({ type: 'eatBest' })
    expect(resolveKeyAction('KeyI', 'explore', null)).toEqual({ type: 'openMode', mode: 'bag' })
    expect(resolveKeyAction('KeyI', 'bag', null)).toEqual({ type: 'closePanel' })
    expect(resolveKeyAction('Escape', 'bag', null)).toEqual({ type: 'closePanel' })
    for (const mode of ['fishing', 'market', 'map', 'emote', 'sleep'] as const) {
      expect(resolveKeyAction('KeyF', mode, null).type).not.toBe('eatBest')
      expect(resolveKeyAction('KeyI', mode, null).type).not.toBe('openMode')
    }
  })

  it('초원: 버섯 E 는 따기, 가스레인지 E 는 가방(요리법). 같은 버섯인지는 번호로', () => {
    const shroom = { kind: 'pickup' as const, index: 4, item: 'mushroom' as const }
    expect(resolveKeyAction('KeyE', 'explore', shroom)).toEqual({ type: 'harvest', index: 4 })
    expect(resolveKeyAction('KeyE', 'explore', { kind: 'stove' })).toEqual({ type: 'openMode', mode: 'bag' })
    expect(isSameInteractable(shroom, { kind: 'pickup', index: 4, item: 'mushroom' })).toBe(true)
    expect(isSameInteractable(shroom, { kind: 'pickup', index: 5, item: 'mushroom' })).toBe(false)
  })

  it('문 앞에서 E 는 여닫기. 다른 문이면 다른 대상', () => {
    expect(resolveKeyAction('KeyE', 'explore', { kind: 'door', index: 2 })).toEqual({ type: 'toggleDoor', index: 2 })
    expect(isSameInteractable({ kind: 'door', index: 2 }, { kind: 'door', index: 3 })).toBe(false)
  })

  it('상인 앞에서 E 는 사고팔기 창. 다른 상인이면 다른 대상', () => {
    expect(resolveKeyAction('KeyE', 'explore', { kind: 'vendor', id: 'grocer' })).toEqual({ type: 'openVendor', id: 'grocer' })
    expect(isSameInteractable({ kind: 'vendor', id: 'grocer' }, { kind: 'vendor', id: 'butcher' })).toBe(false)
    expect(resolveKeyAction('Escape', 'vendor', null)).toEqual({ type: 'closePanel' })
  })
})

describe('전리품 줍기 (3-3)', () => {
  it('탐험 중 전리품 앞에서 E → 줍기, 같은 번호면 같은 대상', () => {
    const beef = { kind: 'loot', key: 5, item: 'beef' } as const
    expect(resolveKeyAction('KeyE', 'explore', beef)).toEqual({ type: 'pickLoot', key: 5 })
    expect(resolveKeyAction('KeyE', 'bag', beef)).toEqual({ type: 'none' })
    expect(isSameInteractable(beef, { ...beef })).toBe(true)
    expect(isSameInteractable(beef, { ...beef, key: 6 })).toBe(false)
  })
})
