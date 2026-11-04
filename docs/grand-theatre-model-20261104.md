# 대극장 내부 모델 · 2026-11-04

사용자가 제공한 대극장 평면도와 객석·무대·오르간·백스테이지 사진을 참고해 독립 실내 장면을 제작했다. 사진에 보이는 세 층의 붉은 좌석, 곡선형 발코니, 목재 음향 벽, 무대, 오르간, 붉은 막, 밝은 목재 반사판, 검은 기술 무대와 트러스를 표현한다. 크기·좌석 수·출입구와 사진에 가려진 백스테이지 구조는 시각적 추정이며 실제 도면이나 시설 운영 정보가 아니다.

기존 `blender_work/20261104-live-sky/blender_work/20261104/sejong_trees_connected_20261104.blend`를 읽고 원래 씬을 그대로 보존한 별도 사본 `blender_work/20261104-live-sky/grand-theatre/sejong_grand_theatre_20261104.blend`을 만들었다. 새 씬은 `대극장 내부 · Grand Theatre`이며 기존 서울 하늘의 월드·날씨 속성과 조명을 공유한다. Blender 실시간 하늘은 저장소에서 `python -B scripts/open_blender_sky.py "grand-theatre/sejong_grand_theatre_20261104.blend"`로 열어 타이머를 시작한다. 일반적으로 파일을 직접 열면 내장 스크립트를 직접 실행해야 한다. GLB에는 대극장 씬의 신규 메시만 내보냈다. 목재·좌석 등 간단한 절차 생성 질감을 GLB와 Blender 파일에 포함했다.

## 웹 좌표와 노드 계약

`public/model/grand-theatre/grand-theatre.glb`는 미터 단위 Three.js Y-up이며 Blender의 X/Y/Z는 Three의 X/-Z/Y에 해당한다. `layout.json`은 출입구·무대·백스테이지·스크린 위치와 좌석 1,368개의 ID·층·열·바닥 위치·눈높이·시선을 담는다. 이는 예약 좌석표가 아니다. 중심 출입구는 `[0, 1.96, 29]`, 무대 뒤쪽은 `[0, 0, -14]`다. 1층 통로는 x=0, ±8.4m이고, 앞쪽 무대에서 뒤쪽 입구로 갈수록 올라가는 단차를 가진다.

별도 GLB 노드 `GrandCurtain`, `GrandAcousticShell`, `GrandProjectionScreen`의 visibility를 조절해 막·음향 반사판·영사막 상태를 전환한다. 화면 중심은 `[0, 6.75, -1.12]`, 크기는 16×9m다. 실제 움직이는 영상 텍스처·오디오·공연 효과는 웹 애플리케이션에서 연결한다. 막과 스크린, 반사판은 같은 장면에 있으므로 상태에 맞게 숨기고 표시해야 한다.

곡선 객석의 1층 바닥은 대략 `row = clamp(floor((z - 3.2 - 0.010*x*x + 0.49)/0.98), 0, 23)`, 높이 `row*0.085`m다. 마지막 줄 뒤 출입구 착지면 높이는 1.96m다. 좌석별 시점은 `layout.json`의 y와 `eyeHeight`를 더하고 무대를 바라보면 된다. 이동 제한·경사로·앉기 동작은 이 수치를 사용하는 웹 쪽 책임이다.

## 재생성 및 검증

```powershell
& 'C:\Program Files\Blender Foundation\Blender 5.2\blender.exe' -b --threads 2 --python scripts/build_grand_theatre.py -- --source '<로컬 경로>'
python -B -m unittest tests/grand_theatre_contract_test.py
```

렌더를 생략하려면 `--source` 경로 뒤에 `--no-render`를 추가한다. 기본 미리보기는 800×450, 8 samples, 2 threads다. [객석에서 무대로](grand-theatre-preview-20261104.png), [무대에서 객석으로](grand-theatre-auditorium-20261104.png)를 검토했다. 테스트는 좌석 ID와 층, 출입구·상태 노드, GLB의 유효한 헤더·내장 텍스처·실내만 포함한 노드 구성을 확인한다.

영사막 전면 UV는 0..1 범위로 전체 영상을 한 번 표시한다. glTF 좌표에 맞춰 Three.js VideoTexture는 flipY=false로 사용한다. 2·3층은 각각 6.4m·11.0m에서 시작해 줄마다 0.12m씩 높아지고, 마지막 줄 뒤에는 각 높이 7.12m·11.72m의 통로가 있다.
