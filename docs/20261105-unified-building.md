# 기존 외관 안의 실제 대극장 — 2026-11-05

최신 main을 fetch/pull한 뒤 기존 수목·하늘 외관 사본을 새 작업본으로 보존하고 Blender MCP로 개조했다. 기존 대극장 1,368석·곡선 발코니·오르간·무대막·스크린·반사판·백스테이지와 로비 구조를 재사용했다. 별도 내부 장면을 새로 만든 것이 아니라 같은 외관 씬 안에 실제 내부를 배치했다.

## 바뀐 구조

- 본관 속을 막던 8개의 고체 부품을 제거하고 실제 측벽·바닥·천장·처마·무대 상부벽·후면 서비스 외벽으로 대체했다. 원래 지붕, 6개 주열, 격자, 계단과 별관의 주요 비례는 보존했다. 입구에서 로비 안쪽까지 눈높이 실제 geometry ray 두 개가 통과하며, 무대 상부 외벽의 아래 띠도 실제로 닫혀 있다.
- 기존 유리의 alpha1 OPAQUE를 alpha0.22 BLEND로 변경했다. 영상/보행 중 렌더 부하를 줄이기 위해 별도 transmission pass는 사용하지 않는다. 중앙 유리문은 열린 문짝·프레임·손잡이와 실제 통과 틈이 있다.
- 기존 실내를 scale1.25, Three translation[33.1,1.07,-71.9]에 배치했다. 기존 로비 입구 z60은 외부 [33.1,1.07,3.1]에 놓인다. 무대 뒤의 일부 사본만 실제 후면 외피 크기에 맞게 좁히고 높이를 낮췄다. 객석·막·스크린·오르간 원본은 보존했다.
- 오래된 간이 로비 장식은 통합 Blender 씬에서 제외하여 기존 대극장 로비와 겹치지 않게 했다. 전체 내부25mesh와 조명12개가 실제 같은 씬에 있다.
- 앞쪽 수목3청크는 기존 잎·가지 형상을 보존하면서 가시거리를 늘려 원경에서도 나타난다. 첨부 사진의 분홍/노란 표시는 주석으로 보아 재질이나 건축 구조로 옮기지 않았다.

## 웹과 기존 주소

`/explore/`의 직접 걷기는 외부·로비·객석을 같은 WebGL scene과 camera에서 처리한다. 기존 `?theatre=1`과 내장 모드 주소는 그대로 유효하며 같은 모형의 보행으로 시작한다. `/map/` 정보 지도와 기존 영상·HRTF 음향·무대효과·착석을 유지한다. 로딩이 끝나기 전에는 내부로 진입하지 않으며 오류는 다시 불러오기로 복구한다. 느린 프레임에서도 이동 시간을 보존하고 0.25m 충돌 단위로 나누며 숨김/포커스 이탈에서는 입력을 비운다.

## 파일과 재현

작업본: `blender_work/20261105-unified/sejong_unified_20261105.blend`. 실행: `open-unified-building.cmd`. 이 실행기는 프로젝트의 고정된 사본을 열고 기존 서울 기상·시간 타이머와 장면 조명 미리보기를 시작한다.

외피 core는 `/model/stream/20261105-unified-core.glb`, 내부 사본은 `/model/grand-theatre/grand-theatre-campus.glb`이며 각각 25MiB 미만이다. 같은 scene에 부착되는 공간별 자산이며 별도의 내부 renderer가 아니다. 기존 원본들은 보존했다.

재현 순서는 `scripts/rebuild_unified_building.py`에 있다. Blender background에서 `--python scripts/rebuild_unified_building.py -- <저장소>/blender_work/20261105-unified/<아직 없는 이름>.blend`로 실행한다. 원본 열기→새 사본 저장→외피 개조→기존 내부 append→같은 외관 씬에 배치→실제 geometry 검증→core export→저장 순서다. `scripts/refine_unified_shell.py`, `append_campus_interior.py`, `export_unified_core.py`, `validate_unified_building.py`를 사용한다. manifest의 core 메타데이터도 export 반환값으로 갱신한다.

## 검증과 한계

`docs/20261105-shell-edits.json`과 `docs/20261105-unified-geometry-validation.json`에 실제 제거·추가 구조와 눈높이 통과 결과를 기록했다. 독립 감사에서 원래 공통 외관 mesh1,303개 중 의도한4개만 geometry가 달라졌고 지붕·주열·원래 식재 형상은 유지됨을 확인했다. Node 전체146개·Python31개 검사가 통과했다. Blender camera에서도 같은 외피 안의 로비와 객석을 확인했다.

초기 브라우저 검사는 모델 준비 조건 및 소프트웨어 GPU의 큰 프레임 간격 때문에 시간초과했다. 같은 scroll-helper 실패를 두 번 반복한 후 중단하고 실제 DOM/키입력/camera를 관측해 원인을 분리했다. 최종 브라우저 검사에서 WebGL canvas1개, 실제 W/S 키로 입장·퇴장·재입장, 기존 좌석 착석, 같은 카메라 영상40초 탐색·무대효과와390px 화면이 통과했다. 원래 terrace 청크에 섞인 오래된 간이 로비6개 노드는 사본에서 제외하여 새 배치와 겹치지 않도록 했다. 실측 도면으로 확인되지 않은 내부/외관 부분은 사진과 기존 설계에 근거한 재구성이다.

기존 terrace GLB에서 간이 로비의 중복6개만 제외한 사본은 scripts/prepare_unified_assets.py로 재생성한다. 원본은 보존하며 root scene 참조만 제거해 외부 terrace geometry는 그대로 유지한다.
