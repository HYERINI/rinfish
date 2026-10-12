import { Game } from './game/Game'

// 개발용 하니스: 나중에 팀 "로비" 앱이 이 자리를 대신해 <Game />을 마운트한다.
export default function App() {
  return (
    <Game
      onExit={() => console.log('[dev] onExit 호출됨')}
      onFinish={(result) => console.log('[dev] onFinish 호출됨', result)}
    />
  )
}
