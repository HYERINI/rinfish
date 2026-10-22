# 3D 모델 출처

## 물고기 (fish/*.glb)

- 제작: Quaternius (Animated Cute Fish Pack 등)
- 라이선스: CC0 1.0 (퍼블릭 도메인, 표기 의무 없음)
- 배포처: https://poly.pizza/m/<ID> (각 모델 페이지에서 "Licence: CC0 1.0" 확인, 2026-10-22). 파일은 그 페이지의 glb 그대로
- 머리가 +z (고등어 mackerel.glb 만 -x 라서 코드에서 돌린다. 오징어 squid.glb 는 위로 서 있어서 어종 생김새에서 돌린다). 애니메이션 클립 이름은 아래 표

| 파일 | Poly Pizza ID | 원래 이름 | 애니메이션 |
| --- | --- | --- | --- |
| fish/puffer.glb | UKHtgpxTOk | Pufferfish | Fish_Armature (Swimming_Fast 등 6개) |
| fish/tuna.glb | 1tycAcvSVW | Tuna | Fish_Armature |
| fish/blue-tang.glb | TQaMo8GTJl | Blue Tang | Fish_Armature |
| fish/cardinal.glb | YyZyVhg2Jq | Cardinal Fish | Fish_Armature |
| fish/tang.glb | D36zsP5ESu | Tang | Fish_Armature |
| fish/tetra.glb | l6AhogdZHe | Tetra | Fish_Armature |
| fish/armored-catfish.glb | mtd9QK5yCe | Armored Catfish | Fish_Armature |
| fish/trout.glb | XWl86YFtpF | Fish | Armature\|Swim |
| fish/koi.glb | qyGtRmhgzl | Koi | Fish_Armature |
| fish/red-snapper.glb | BRKfDKwPTv | Red Snapper | Fish_Armature |
| fish/blobfish.glb | 7Jh8vsARfN | Blobfish | Fish_Armature |
| fish/goblin-shark.glb | JQrBevTzgD | Goblin Shark | Fish_Armature |
| fish/goldfish.glb | qS6CgsWFAh | Goldfish | Fish_Armature |
| fish/mackerel.glb | uassUTYYae | Fish Mackerel | 없음 (정적) |
| fish/yellow-tang.glb | CrDlkPLon0 | Yellow Tang | Fish_Armature |
| fish/flatfish.glb | X5EjEA6fMF | Flatfish | Fish_Armature |
| fish/blue-goldfish.glb | imxZBHZ1yS | Blue Goldfish | Fish_Armature |
| fish/flowerhorn.glb | ExfO0SGWmf | Flower Horn | Fish_Armature |
| fish/lionfish.glb | czsz9Baw86 | Lionfish | Fish_Armature |
| fish/anglerfish.glb | MRjSlwCjHM | Anglerfish | Fish_Armature |
| fish/manta.glb | yzD8b7ZHZm | Manta ray | Armature\|Swim |
| fish/betta.glb | Vg8IlYjdZi | Betta | Fish_Armature |
| fish/squid.glb | gReSPnGdkr | Squid (음식 재료 모델, "Licence: CC0 1.0" 확인 2026-10-22) | 없음 (정적). 서 있는 모델이라 fishLooks 의 rotate 로 눕힌다 |

- 예전에 쓰던 clownfish(769fHo3eEB)·shark(sZR8AMLMz5)·swordfish(7hMOlBjln0)·dolphin(3LzFgI3GLO)은 더 안 써서 지웠다

## 플레이어 캐릭터 (fisherman.glb)

- 꾸미기용 캐릭터(`characters/`)로 대체되어 지웠다

## Kenney (CC0 1.0)

- 출처: https://kenney.nl — Food Kit, Furniture Kit, Nature Kit, Mini Characters, Holiday Kit, City Kit (Commercial), Fantasy Town Kit, Survival Kit, Mini Market, Pirate Kit
- 라이선스: Creative Commons Zero (CC0). 출처 표기 의무는 없지만 기록해 둔다 (각 팩 zip 의 License.txt 에서 "Creative Commons Zero, CC0" 확인, 2026-10-22)
- 위치: `public/models/kenney/<팩>/`. glb 는 같은 폴더의 `Textures/colormap.png` 를 상대 경로로 읽는다

| 폴더 | 팩 | 쓰는 파일 | 어디에 |
| --- | --- | --- | --- |
| holiday/ | Holiday Kit | bench.glb | 해변 벤치 |
| city-commercial/ | City Kit (Commercial) | detail-parasol-a.glb | 벤치 옆 파라솔 탁자 |
| fantasy-town/ | Fantasy Town Kit | stall-green.glb | 장비 상점 노점 |
| survival/ | Survival Kit | barrel, box-large, box-open, bucket, signpost-single, fish, fish-large (.glb) | 장비 상점·판매함 소품 |
| mini-market/ | Mini Market | freezer.glb | 판매함 아이스박스 |
| pirate/ | Pirate Kit | crate.glb | 판매함 생선 상자 |
| nature/ | Nature Kit | tree_palm·palmBend·palmShort·oak·default·fat·pineRoundA, flower_redA·yellowA·purpleA·yellowB, mushroom_red·tanGroup, plant_bush·bushLarge·bushDetailed (.glb, 텍스처 없음) | 섬 바닥 꾸미기 (나무·꽃·버섯·덤불). 색은 decorAssets.ts 에서 섬 풀빛에 맞춰 바꾼다 |

## 꾸미기용 캐릭터 (characters/male.glb, female.glb)

- 제작: Quaternius, 라이선스 CC0 1.0 (각 팩 zip 안 License 파일)
- Universal Base Characters, Modular Character Outfits - Fantasy, Universal Animation Library 의 무료(Standard) 판을 합쳤다
- 다시 만들기: `tools/build-characters/README.md`
