import { RARITY_COLOR, findSpecies } from '../data/fish'
import { sellPrice } from '../logic/economy'
import { useProgressStore } from '../stores/progressStore'
import { Panel } from './Panel'
import { button } from './styles'

export function SellPanel() {
  const inventory = useProgressStore((s) => s.inventory)
  const sellFish = useProgressStore((s) => s.sellFish)

  const rows = inventory.flatMap((fish) => {
    const species = findSpecies(fish.speciesId)
    return species ? [{ fish, species, price: sellPrice(species, fish.weight) }] : []
  })
  const total = rows.reduce((sum, r) => sum + r.price, 0)

  return (
    <Panel title="물고기 팔기">
      {rows.length === 0 ? (
        <p>팔 물고기가 없어요. 낚시하러 가 볼까요?</p>
      ) : (
        <>
          <button style={{ ...button, width: '100%', marginBottom: 12 }} onClick={() => sellFish(rows.map((r) => r.fish.id))}>
            모두 팔기 (+{total} 코인)
          </button>
          {rows.map(({ fish, species, price }) => (
            <div key={fish.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', borderBottom: '1px solid #333' }}>
              <span style={{ color: RARITY_COLOR[species.rarity], flex: 1 }}>{species.name}</span>
              <span style={{ width: 70, textAlign: 'right' }}>{fish.weight}kg</span>
              <span style={{ width: 70, textAlign: 'right' }}>{price} 코인</span>
              <button style={button} onClick={() => sellFish([fish.id])}>
                팔기
              </button>
            </div>
          ))}
        </>
      )}
    </Panel>
  )
}
