import { TANK_LEVELS, TANK_TYPES } from '../data/aquarium'
import { AQUARIUM } from '../data/balance'
import { RARITY_COLOR, findSpecies } from '../data/fish'
import { incomePerSecond, isHungry, slotCount } from '../logic/aquarium'
import { useProgressStore } from '../stores/progressStore'
import { Panel } from './Panel'
import { button, disabledButton } from './styles'

const row = { display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', borderBottom: '1px solid #333' } as const
const section = { margin: '16px 0 6px', fontSize: 15 } as const

export function AquariumPanel() {
  const s = useProgressStore()
  const { aquarium, playTime, coins, feed, inventory } = s
  const hungry = isHungry(aquarium, playTime)
  const nextLevel = TANK_LEVELS[aquarium.level + 1]
  const full = aquarium.displayed.length >= slotCount(aquarium)
  const fedAgo = Math.floor((playTime - aquarium.lastFedAt) / 60)
  const junk = inventory.find((f) => findSpecies(f.speciesId)?.rarity === 'junk')
  const income = Math.floor(aquarium.pendingIncome)

  return (
    <Panel title={`어항 Lv${aquarium.level + 1} · 코인 ${coins}`}>
      <div style={{ fontSize: 14, marginBottom: 8 }}>
        전시 {aquarium.displayed.length}/{slotCount(aquarium)} · 분당 입장료 {hungry ? 0 : Math.round(incomePerSecond(aquarium) * 60 * 10) / 10}코인
        {aquarium.displayed.length > 0 && (hungry ? <b style={{ color: '#ef5350' }}> · 배고파요!</b> : ` · ${fedAgo}분 전에 먹음`)}
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button style={income > 0 ? button : disabledButton} disabled={income === 0} onClick={() => s.claimAquariumIncome()}>
          입장료 받기 (+{income})
        </button>
        <button style={feed > 0 && aquarium.displayed.length > 0 ? button : disabledButton} disabled={feed === 0 || aquarium.displayed.length === 0} onClick={() => s.feedWithPellet()}>
          사료 주기 (남은 사료 {feed})
        </button>
        <button style={junk && aquarium.displayed.length > 0 ? button : disabledButton} disabled={!junk || aquarium.displayed.length === 0} onClick={() => junk && s.feedWithJunk(junk.id)}>
          잡어 주기
        </button>
      </div>

      <h3 style={section}>전시 중</h3>
      {aquarium.displayed.length === 0 && <p style={{ fontSize: 14 }}>아직 전시한 물고기가 없어요.</p>}
      {aquarium.displayed.map((fish) => {
        const species = findSpecies(fish.speciesId)
        return (
          <div key={fish.id} style={row}>
            <span style={{ flex: 1, color: species ? RARITY_COLOR[species.rarity] : undefined }}>{species?.name ?? '???'}</span>
            <span style={{ width: 70, textAlign: 'right' }}>{fish.weight}kg</span>
            <button style={button} onClick={() => s.undisplayFish(fish.id)}>
              빼기
            </button>
          </div>
        )
      })}

      <h3 style={section}>보관함에서 전시하기</h3>
      {inventory.length === 0 && <p style={{ fontSize: 14 }}>보관함이 비어 있어요.</p>}
      {inventory.map((fish) => {
        const species = findSpecies(fish.speciesId)
        return (
          <div key={fish.id} style={row}>
            <span style={{ flex: 1, color: species ? RARITY_COLOR[species.rarity] : undefined }}>{species?.name ?? '???'}</span>
            <span style={{ width: 70, textAlign: 'right' }}>{fish.weight}kg</span>
            <button style={full ? disabledButton : button} disabled={full} onClick={() => s.displayFish(fish.id)}>
              전시
            </button>
          </div>
        )
      })}

      <h3 style={section}>어항 종류</h3>
      {TANK_TYPES.map((type) => {
        const owned = aquarium.ownedTypes.includes(type.id)
        const active = aquarium.activeType === type.id
        return (
          <div key={type.id} style={row}>
            <span style={{ flex: 1 }}>
              {type.name} <span style={{ fontSize: 12, opacity: 0.7 }}>{type.description}</span>
            </span>
            {active ? (
              <span style={{ color: '#ffd166', fontSize: 14 }}>사용 중</span>
            ) : owned ? (
              <button style={button} onClick={() => s.selectTankType(type.id)}>
                바꾸기
              </button>
            ) : (
              <button style={coins >= type.price ? button : disabledButton} disabled={coins < type.price} onClick={() => s.buyTankType(type.id)}>
                {type.price} 코인
              </button>
            )}
          </div>
        )
      })}

      <h3 style={section}>어항 확장</h3>
      {nextLevel ? (
        <div style={row}>
          <span style={{ flex: 1 }}>
            Lv{aquarium.level + 2}: {nextLevel.slots}칸 · 입장료 ×{nextLevel.incomeMul}
          </span>
          <button style={coins >= nextLevel.price ? button : disabledButton} disabled={coins < nextLevel.price} onClick={() => s.buyAquariumExpansion()}>
            {nextLevel.price} 코인
          </button>
        </div>
      ) : (
        <p style={{ fontSize: 14, color: '#ffd166' }}>최고 단계</p>
      )}
      <p style={{ fontSize: 12, opacity: 0.6, marginTop: 12 }}>
        마지막으로 먹이를 주고 {AQUARIUM.hungerAfter / 60}분이 지나면 배고파져서 수입이 멈추고, {AQUARIUM.releaseAfter / 60}분 더 지나면 바다로 돌아가요. 사료는 장비 상점에서 팔아요.
      </p>
    </Panel>
  )
}
