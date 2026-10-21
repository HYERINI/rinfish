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
