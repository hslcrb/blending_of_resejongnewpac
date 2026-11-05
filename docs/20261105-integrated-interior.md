# 기존 대극장을 외피 안에 배치 — 2026-11-05

이번 작업은 이미 만든 `grand-theatre`의 1,368개 좌석과 발코니, 무대막, 오르간, 음향반사판, 스크린, 무대 뒤 철골을 재사용한다. 새 독립 scene을 만들어 이동하는 방식이 아니라, `append_campus_interior(scene, theatre_blend)`로 현재 외피 scene의 `CampusGrandTheatreInterior_20261105` collection에 기존 메시를 복사하여 물리적으로 배치한다. 원본 내부 메시 데이터와 기존 `grand-theatre.glb`는 보존한다. 외피의 기존 고체 벽과 출입구 절개는 통합 담당자가 처리한다.

## 좌표 계약

Three의 기존 대극장/로비 좌표를 다음처럼 건물 좌표에 넣는다.

```text
campus = [33.1, 1.07, -71.9] + 1.25 * local
```

로비 문 중앙 local `[0,0,60]`은 외부 `[33.1,1.07,3.1]`에 놓이고, 무대 local `[0,0,0]`은 `[33.1,1.07,-71.9]`에 놓인다. 로비는 local z=30~60이며 중앙 경사로가 객석 뒤 출입구의 높이 1.96m에 이어진다. 기존 좌석 ID와 layout 좌표는 그대로 유지한다.

기존 뒷무대는 local z=-10.24 이후에 외피의 낮은 부분을 뚫고 나가는 영역이 있었다. 해당 공간은 실제 높은 rear mass에 맞춰 x 범위를 기존 [-15.2,15.2]에서 [-7.2,15]로 선형 압축하고, 높이는 15.5m 이내로 제한한다. z=-9~-10.24에서 부드럽게 전환하며 물체 두께를 유지한다. 바뀌는 원본 종류는 `Grand_black`, `Grand_floor`, `Grand_steel`, `Grand_gold`뿐이다. 객석·오르간·천장·막·반사판·스크린은 위치 데이터를 그대로 보존한다.

웹에서는 파생 자산 `public/model/grand-theatre/grand-theatre-campus.glb`를 동일 transform으로 사용하고 기존 `createLobby()`를 같은 group에 넣는다. Blender 사본에는 웹 로비와 같은 바닥·경사로·기둥·붉은 계단·금속 난간·유리·상부 복도·천장 조명까지 실제 지오메트리로 추가한다. 웹 GLB에는 로비를 중복 포함하지 않는다. core 외피 GLB를 export할 때 이 내부 collection을 제외해야 한다.

## 실행과 검증

`append_campus_interior.py`는 파일을 열거나 저장하지 않는다. 통합 담당자가 보존용 외피 사본을 연 상태에서 함수를 호출하고 최종 사본을 저장한다. 같은 이름의 내부 collection이 이미 있으면 중복 추가를 거부한다. `export_local_theatre(collection, output)`은 현재 scene의 내부 복사 메시 16개만 local 좌표로 export하고 선택과 변환을 복원한다.

```powershell
python -B -m unittest tests/integrated_interior_test.py tests/campus_theatre_asset_test.py
& 'C:\Program Files\Blender Foundation\Blender 5.2\blender.exe' --background --threads 4 --python scripts/verify_campus_interior_blender.py -- '절대경로\sejong_grand_theatre_20261104.blend'
```

검증 결과: Python 6개 통과. 실제 Blender에서 같은 외피 scene에 내부 16개 메시·로비 9개 메시·12개 조명을 추가했고, 원본 내부 메시 전체의 좌표/면 SHA-256 불변과 중앙 로비 문 통과를 확인했다. 후면 468개 정점의 가용 외피 bounds를 확인했다. 파생 GLB는 8,445,872바이트이며 기존 16개 노드 이름과 좌석·막·반사판·스크린·오르간·천장의 모든 위치 데이터를 기존 GLB와 대조했다. 실제 외부 벽의 절개와 통합 보행·착석·영사는 상위 통합 검사로 별도 확인해야 한다.
