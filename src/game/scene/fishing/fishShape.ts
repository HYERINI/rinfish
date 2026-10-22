/** 몸의 한 단면(z 위치)에서 위·아래 끝과 옆으로 반폭 */
export type Section = { top: number; bottom: number; half: number }

/**
 * 몸길이 1.2 로 맞춘 물고기의 머리 모양. 소품을 모델마다 머리에 맞게 놓고 크기를 맞추는 데 쓴다.
 * eye: 두 눈을 합친 영역 (x 는 바깥 면, 반지름 r), sections: z 위치별 단면 (앞이 +z, 지느러미는 뺀다)
 */
export type FishShape = {
  eye: { x: number; y: number; z: number; r: number }
  sections: { z: number; s: Section }[]
}

/** z 위치에서 가장 가까운 단면 */
export function sectionAt(shape: FishShape, z: number): Section {
  let best = shape.sections[0]
  for (const c of shape.sections) if (Math.abs(c.z - z) < Math.abs(best.z - z)) best = c
  return best.s
}

/** 몸 앞 끝(주둥이)과 뒤 끝의 z (지느러미를 뺀 몸 기준) */
export const frontZ = (shape: FishShape) => shape.sections[shape.sections.length - 1].z
export const backZ = (shape: FishShape) => shape.sections[0].z
/** 단면의 위아래 가운데 높이 */
export const midY = (s: Section) => (s.top + s.bottom) / 2

/** 소품을 붙이는 자리: 눈 높이(eye), 머리 꼭대기(top), 몸통 가운데(body), 입(mouth), 목(neck: 눈 뒤 아가미께) */
export type Anchor = 'eye' | 'top' | 'body' | 'mouth' | 'neck'

/** 몸통 소품(구명튜브·셀카봉 등)을 두는 z 위치 */
export const BODY_Z = 0.05

/** 붙이는 자리의 좌표 (몸길이 1.2 물고기, 가운데가 원점, 머리 +z) */
export function anchorPoint(anchor: Anchor, shape: FishShape): [number, number, number] {
  const { eye } = shape
  switch (anchor) {
    case 'eye':
      return [0, eye.y, eye.z]
    case 'top': {
      // 눈보다 조금 뒤, 머리 꼭대기
      const z = eye.z - eye.r
      return [0, sectionAt(shape, z).top - 0.02, z]
    }
    case 'body':
      return [0, midY(sectionAt(shape, BODY_Z)), BODY_Z]
    case 'mouth': {
      const z = frontZ(shape) - 0.05
      return [0, midY(sectionAt(shape, z)), z]
    }
    case 'neck': {
      const z = neckZ(shape)
      return [0, midY(sectionAt(shape, z)), z]
    }
  }
}

/** 목(눈 뒤, 아가미께)의 z */
export const neckZ = (shape: FishShape) => shape.eye.z - shape.eye.r * 1.6 - 0.05
