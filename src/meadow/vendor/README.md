# 은지 게임(Room Sim) 코드 복사본

- 출처: https://github.com/Eunji1217/3js 커밋 `f3c3808` 의 `src/` (모델은 `public/models/{kenney,nature,town,food,pets}` → `public/meadow/models/`, 모두 CC0. 동물(pets, Kenney Cube Pets)은 3-3 에서 TS 로 옮긴 `logic/animalSim`·`scene/animals` 가 쓴다)
- 고친 곳은 `// rinfish:` 로 찾는다: 모델 경로(paths.js), 사격장 설비·동물·거울(world.js), 상인 NPC(town.js), 들판·마을 ready 를 allSettled 로(outdoor.js·town.js), 효과음을 낚시섬 음량으로(audio.js)
- 3-4: `weapons.js` 는 그대로 복사했다 (무기 모델 `buildWeaponModel`·`WEAPONS` 만 쓴다. 쏘기·조준은 TS 로 옮긴 `logic/gun`·`scene/guns`)
- 남의 코드라 oxlint 검사에서 뺀다. 타입은 우리가 쓰는 부분만 `.d.ts` 에 선언한다
- 은지 원본이 바뀌면 같은 파일을 다시 복사하고 `// rinfish:` 자리만 다시 고친다
