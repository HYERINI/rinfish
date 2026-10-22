import { useEffect, useMemo, useState } from 'react'
import { CanvasTexture, SRGBColorSpace, TextureLoader, type Texture } from 'three'

type Props = {
  /** public 아래 그림 경로. 불러오지 못하면 글씨 간판 */
  image: string
  text: string
  size: [number, number]
  position: [number, number, number]
  rotationX?: number
}

/**
 * 가게 간판: 나무 틀 + 판. 그림 파일(image)이 있으면 그 그림을 붙이고, 없거나 못 불러오면 글씨를 칠한 간판을 쓴다.
 * 그림은 나중에 public/signs/ 에 넣기만 하면 바뀐다
 */
export function ShopSign({ image, text, size, position, rotationX = 0 }: Props) {
  const [w, h] = size
  const painted = useMemo(() => paintedSign(text, w / h), [text, w, h])
  const [photo, setPhoto] = useState<Texture | null>(null)
  useEffect(() => {
    let alive = true
    let loaded: Texture | null = null
    new TextureLoader().load(
      `${import.meta.env.BASE_URL}${image}`,
      (t) => {
        t.colorSpace = SRGBColorSpace
        loaded = t
        if (alive) setPhoto(t)
        else t.dispose()
      },
      undefined,
      () => {}, // 파일이 없으면 글씨 간판 그대로
    )
    return () => {
      alive = false
      loaded?.dispose()
    }
  }, [image])
  useEffect(() => () => painted.dispose(), [painted])

  return (
    <group position={position} rotation-x={rotationX}>
      <mesh castShadow>
        <boxGeometry args={[w + 0.16, h + 0.16, 0.08]} />
        <meshStandardMaterial color="#5d4037" />
      </mesh>
      <mesh position={[0, 0, 0.045]}>
        <planeGeometry args={[w, h]} />
        <meshStandardMaterial map={photo ?? painted} />
      </mesh>
    </group>
  )
}

/** 붉은 바탕에 흰 붓글씨 느낌 간판 */
function paintedSign(text: string, aspect: number): CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.height = 160
  canvas.width = Math.round(160 * aspect)
  const ctx = canvas.getContext('2d')
  if (ctx) {
    const g = ctx.createLinearGradient(0, 0, 0, canvas.height)
    g.addColorStop(0, '#c62828')
    g.addColorStop(1, '#8e1b1b')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.strokeStyle = '#ffd54f'
    ctx.lineWidth = 6
    ctx.strokeRect(10, 10, canvas.width - 20, canvas.height - 20)
    ctx.fillStyle = '#fffde7'
    ctx.font = '900 92px sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.shadowColor = 'rgba(0,0,0,0.45)'
    ctx.shadowOffsetY = 4
    ctx.fillText(text, canvas.width / 2, canvas.height / 2 + 6, canvas.width - 60)
  }
  const t = new CanvasTexture(canvas)
  t.colorSpace = SRGBColorSpace
  return t
}
