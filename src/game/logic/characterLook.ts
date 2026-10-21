import { BODY_PARTS, BODY_RANGES, DEFAULT_LOOK, DYE_COLORS, HAIR_COLORS, HAIRS, HEIGHT_RANGE, OUTFIT_SLOTS, OUTFITS, SKIN_COLORS } from '../data/characterParts'
import type { BodyPart, CharacterLook, Gender, HairId, OutfitId, OutfitSlot } from '../data/types'
import { lerp, type Rng } from './rng'

const COLOR = /^#[0-9a-f]{6}$/i
const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)
const clamp = (v: number, [min, max]: [number, number]) => Math.min(max, Math.max(min, v))

function readColor(v: unknown, fallback: string): string {
  return typeof v === 'string' && COLOR.test(v) ? v.toLowerCase() : fallback
}

/** 부위별 염색 색. 색이 아니면 null(원래 색) */
function readDye(v: unknown): Record<OutfitSlot, string | null> {
  const saved = isRecord(v) ? v : {}
  const dye = {} as Record<OutfitSlot, string | null>
  for (const slot of OUTFIT_SLOTS) {
    const c = saved[slot]
    dye[slot] = typeof c === 'string' && COLOR.test(c) ? c.toLowerCase() : null
  }
  return dye
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
    dye: readDye(v.dye),
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
  // 반쯤은 원래 옷 색 그대로 두고, 나머지는 견본 색으로 물들인다
  const dye = {} as Record<OutfitSlot, string | null>
  for (const slot of OUTFIT_SLOTS) dye[slot] = rng() < 0.5 ? null : pick(DYE_COLORS, rng())
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
    dye,
    height: centered(rng, HEIGHT_RANGE),
    body,
  }
}
