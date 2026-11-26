import { Html } from '@react-three/drei'
import type { ComponentProps } from 'react'
import { useSessionStore } from '../stores/sessionStore'

type HtmlProps = ComponentProps<typeof Html>

/**
 * 섬에 있는 이름표·안내 (Html). Html 은 멀리 있어도·벽 너머여도 늘 화면 맨 위에 그려져서,
 * 초원에 있을 때 섬 쪽을 보면 섬 간판·잠긴 문 안내가 화면 한가운데 겹쳐 보인다. 초원 쪽에선 그리지 않는다
 */
export function IslandHtml(props: HtmlProps) {
  const inMeadow = useSessionStore((s) => s.inMeadow)
  return inMeadow ? null : <Html {...props} />
}

/** 초원에 있는 이름표 (상인 이름 등). 섬 쪽에선 그리지 않는다 (IslandHtml 과 같은 까닭) */
export function MeadowHtml(props: HtmlProps) {
  const inMeadow = useSessionStore((s) => s.inMeadow)
  return inMeadow ? <Html {...props} /> : null
}
