import { useEffect, useState, type CSSProperties } from 'react'
import { fishThumbnail } from '../scene/fishing/fishThumbnail'

type Props = {
  speciesId: string
  width: number
  /** 아직 못 잡은 물고기는 검은 실루엣으로 보여 준다 */
  silhouette?: boolean
  style?: CSSProperties
}

/** 3D 모델로 그린 물고기 사진 */
export function FishImage({ speciesId, width, silhouette = false, style }: Props) {
  const [image, setImage] = useState<{ speciesId: string; src: string } | null>(null)
  useEffect(() => {
    let alive = true
    fishThumbnail(speciesId)
      .then((src) => alive && setImage({ speciesId, src }))
      .catch(() => {}) // 모델을 못 불러오면 빈 자리로 둔다
    return () => {
      alive = false
    }
  }, [speciesId])

  const height = Math.round((width * 9) / 16)
  // 다른 물고기의 사진이 잠깐 남아 보이지 않게, 지금 물고기의 사진일 때만 그린다
  if (image?.speciesId !== speciesId) return <div style={{ width, height, ...style }} />
  return (
    <img
      src={image.src}
      width={width}
      height={height}
      alt=""
      style={{ display: 'block', filter: silhouette ? 'brightness(0)' : undefined, opacity: silhouette ? 0.35 : 1, ...style }}
    />
  )
}
