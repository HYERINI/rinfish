import { FISH_SPECIES, RARITY_COLOR, RARITY_LABEL } from '../data/fish'
import { ZONES } from '../data/zones'
import { useProgressStore } from '../stores/progressStore'
import { FishImage } from './FishImage'
import { Panel } from './Panel'

export function DexPanel() {
  const dex = useProgressStore((s) => s.dex)
  const found = FISH_SPECIES.filter((s) => dex[s.id]).length

  return (
    <Panel title={`도감 ${found} / ${FISH_SPECIES.length}`}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 8 }}>
        {FISH_SPECIES.map((species) => {
          const entry = dex[species.id]
          const zoneNames = species.zones.map((z) => ZONES.find((zone) => zone.id === z)?.name).join(', ')
          return (
            <div key={species.id} style={{ background: 'rgba(255,255,255,0.06)', borderRadius: 8, padding: 10, fontSize: 13 }}>
              <FishImage speciesId={species.id} width={96} silhouette={!entry} style={{ marginBottom: 6 }} />
              {entry ? (
                <>
                  <strong>{species.name}</strong>
                  <div style={{ color: RARITY_COLOR[species.rarity] }}>{RARITY_LABEL[species.rarity]}</div>
                  <div style={{ opacity: 0.8, margin: '4px 0' }}>{species.description}</div>
                  {species.trivia && <div style={trivia}>{species.trivia}</div>}
                  <div>
                    최대 {entry.maxWeight}kg · {entry.count}마리
                  </div>
                </>
              ) : (
                <>
                  <strong>???</strong>
                  <div style={{ opacity: 0.6 }}>{zoneNames}</div>
                </>
              )}
            </div>
          )
        })}
      </div>
    </Panel>
  )
}

/** 쓸데없는 스탯 한 줄 */
const trivia = { color: '#ffe082', fontSize: 12, margin: '0 0 4px' } as const
