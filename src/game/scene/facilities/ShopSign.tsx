import { useEffect, useMemo, useState } from 'react'
import { CanvasTexture, SRGBColorSpace, TextureLoader, type Texture } from 'three'

type Props = {
  /** public 아래 그림 경로. 불러오지 못하면 글씨 간판 */
  image: string
  text: string
  /** 글씨 간판 왼쪽 동그라미에 넣을 얼굴·로고 그림 (public 아래, 배경 투명 PNG) */
  emblem?: string
  size: [number, number]
  position: [number, number, number]
  rotationX?: number
}

/**
 * 가게 간판: 나무 틀 + 판. 그림 파일(image)이 있으면 그 그림을 붙이고, 없거나 못 불러오면 글씨를 칠한 간판을 쓴다.
 * 그림은 나중에 public/signs/ 에 넣기만 하면 바뀐다
 */
export function ShopSign({ image, text, emblem, size, position, rotationX = 0 }: Props) {
  const [w, h] = size
  const [emblemImg, setEmblemImg] = useState<HTMLImageElement | null>(null)
  useEffect(() => {
    if (!emblem) return
    let alive = true
    const img = new Image()
    img.onload = () => alive && setEmblemImg(img)
    img.src = `${import.meta.env.BASE_URL}${emblem}`
    return () => {
      alive = false
    }
  }, [emblem])
  const painted = useMemo(() => paintedSign(text, w / h, emblemImg), [text, w, h, emblemImg])
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
        {/* 그늘에서도 잘 보이게 그림 자체가 살짝 빛나게 한다 */}
        <meshStandardMaterial map={photo ?? painted} emissive="#ffffff" emissiveMap={photo ?? painted} emissiveIntensity={0.35} />
      </mesh>
    </group>
  )
}

/** 붉은 바탕에 흰 붓글씨 느낌 간판. emblem 이 있으면 왼쪽 크림색 동그라미에 넣고 글씨는 오른쪽으로 */
function paintedSign(text: string, aspect: number, emblem: HTMLImageElement | null): CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.height = 320
  canvas.width = Math.round(320 * aspect)
  const ctx = canvas.getContext('2d')
  if (ctx) {
    const g = ctx.createLinearGradient(0, 0, 0, canvas.height)
    g.addColorStop(0, '#c62828')
    g.addColorStop(1, '#8e1b1b')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.strokeStyle = '#ffd54f'
    ctx.lineWidth = 12
    ctx.strokeRect(20, 20, canvas.width - 40, canvas.height - 40)
    let textLeft = 0
    if (emblem) {
      // 얼굴 동그라미: 간판 높이를 거의 채운다
      const r = canvas.height * 0.4
      const cx = 40 + r
      const cy = canvas.height / 2
      ctx.fillStyle = '#fff8e1'
      ctx.beginPath()
      ctx.arc(cx, cy, r, 0, Math.PI * 2)
      ctx.fill()
      ctx.lineWidth = 8
      ctx.strokeStyle = '#ffd54f'
      ctx.stroke()
      const s = Math.min((r * 1.7) / emblem.height, (r * 1.7) / emblem.width)
      ctx.drawImage(emblem, cx - (emblem.width * s) / 2, cy - (emblem.height * s) / 2 + r * 0.04, emblem.width * s, emblem.height * s)
      textLeft = cx + r
    }
    ctx.fillStyle = '#fffde7'
    ctx.font = '900 184px sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.shadowColor = 'rgba(0,0,0,0.45)'
    ctx.shadowOffsetY = 8
    ctx.fillText(text, (textLeft + canvas.width) / 2, canvas.height / 2 + 12, canvas.width - textLeft - 120)
  }
  const t = new CanvasTexture(canvas)
  t.colorSpace = SRGBColorSpace
  return t
}
