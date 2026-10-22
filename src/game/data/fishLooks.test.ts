import { describe, expect, it } from 'vitest'
import { FISH_SPECIES } from './fish'
import { DEFAULT_FISH_LOOK, FISH_LOOKS, FISH_MODEL_FILES, fishLookFor } from './fishLooks'

describe('fishLooks', () => {
  it('모든 어종에 생김새가 있고, 모델은 실제 파일 목록에 있다', () => {
    for (const s of FISH_SPECIES) {
      const look = FISH_LOOKS[s.id]
      expect(look, s.id).toBeDefined()
      expect(FISH_MODEL_FILES[look.model], s.id).toBeDefined()
      expect(look.size).toBeGreaterThan(0)
    }
  })

  it('같은 모델을 쓰는 어종은 색·크기·소품 중 하나 이상이 다르다', () => {
    const seen = new Map<string, string>()
    for (const [id, look] of Object.entries(FISH_LOOKS)) {
      const key = `${look.model}|${look.tint ?? ''}|${look.glow ?? ''}|${look.size}|${look.accessory ?? ''}`
      expect(seen.has(key), `${id} 와 ${seen.get(key)} 가 똑같이 생겼다`).toBe(false)
      seen.set(key, id)
    }
  })

  it('표에 없는 어종은 기본 생김새', () => {
    expect(fishLookFor('no-such-fish')).toEqual(DEFAULT_FISH_LOOK)
    expect(fishLookFor(null)).toEqual(DEFAULT_FISH_LOOK)
  })
})
