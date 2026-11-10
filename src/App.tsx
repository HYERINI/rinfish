import { Game } from './game/Game'
import { readHubEntry } from './game/logic/hubParams'

/** 이번 탭 저장소. 막혀 있으면(사생활 보호 등) 없이 간다 */
function tabStorage(): Storage | null {
  try {
    return window.sessionStorage
  } catch {
    return null
  }
}

// 팀 허브 로비는 이 페이지로 이동시키며 hub_return·hub_name·hub_room 을 붙인다 (game-entry-contract v3)
const hub = readHubEntry(window.location.search, tabStorage())

export default function App() {
  return (
    <Game
      hub={{ name: hub.name, room: hub.room }}
      // 복귀 주소는 고치지 않고 그대로 이동한다. 허브 없이 열면 돌아가기 버튼이 없다
      onExit={hub.back ? () => window.location.assign(hub.back!) : undefined}
      onFinish={(result) => console.log('[dev] onFinish 호출됨', result)}
    />
  )
}
