import { CanvasTexture, SRGBColorSpace } from 'three'

/** 이모지별 텍스처. 같은 이모지는 한 번만 그린다 (먹는 요리가 바뀌어도 다시 만들지 않는다) */
const cache = new Map<string, CanvasTexture>()

/** 이모지 한 글자를 그린 투명 텍스처 (은지 요리를 손에 들 때 판(스프라이트)에 붙인다) */
export function emojiTexture(icon: string): CanvasTexture {
  let texture = cache.get(icon)
  if (!texture) {
    const canvas = document.createElement('canvas')
    canvas.width = canvas.height = 128
    const g = canvas.getContext('2d')
    if (g) {
      g.font = '100px "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif'
      g.textAlign = 'center'
      g.textBaseline = 'middle'
      g.fillText(icon, 64, 72)
    }
    texture = new CanvasTexture(canvas)
    texture.colorSpace = SRGBColorSpace
    cache.set(icon, texture)
  }
  return texture
}
