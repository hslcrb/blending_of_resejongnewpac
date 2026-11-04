# 연결된 나뭇잎과 수목 — 2026-11-04

## 수정과 보존

기존 `blender_work/20261103/sejong_aerial_streaming_20261103.blend`를 `blender_work/20261104/sejong_trees_connected_20261104.blend`로 복사하여 다섯 개 공유 수목 원형의 메시만 교체했다. 14개 씬, 1,652개 객체, 배치 변환과 나무 외 메시 825개의 정점 해시가 원본과 동일하다. 파빌리온·건축·정원 등 기존 상세는 그대로다. 살아 있는 Blender MCP 세션은 별도로 열려 있는 서울 개요 파일이어서 교체하거나 저장하지 않았다.

각 원형은 줄기에서 굵은 가지, 27개 분지, 378개 잔가지, 2,268개 잎으로 이어진다. 잎마다 둥근 양쪽 윤곽과 뾰족한 끝을 만들고 잎자루가 잔가지에 닿도록 했다. 사진에 따른 수종이나 식물학적 측량은 아니다. 원형들이 기존 재질과 수목 위치를 공유하므로 기존 장면과 12개 식재 구역에 반영된다.

## 웹 내보내기

기존 `20261103 - streaming web export` 씬과 원본의 공간 분할표를 이용해 변경된 12개 구역만 `public/model/trees-20261104/`에 독립형 GLB로 내보냈다. 모든 GLB가 25MiB 미만이고 기존의 노드 이름과 개수가 일치한다. 공통 압축 형상은 `public/model/trees-smooth-shared-20261104/`로 묶고 `public/model/streaming-manifest.json`을 갱신했다. 기존 원본 파일과 파빌리온·기본 GLB는 보존한다.

법선을 부드럽게 공유하고 기존 디코더를 사용한다. 전 구역 고유 모델 payload는 27,252,287바이트로 직전 27,601,974바이트보다 작다. 앞쪽 중앙 식재 구역의 고유 POSITION 정점은 486,096개에서 478,736개다. 공유 파일은 구역별 최대 네 번의 추가 요청이 필요하므로 네트워크 상황에 따라 지연될 수 있다.

## 재현과 검증

1. 복사본에서 `blender -b blender_work/20261104/sejong_trees_connected_20261104.blend --python scripts/improve_tree_geometry.py`를 실행한다. 스크립트는 지정된 작업 복사본 외에는 저장을 거부한다.
2. `scripts/export_connected_trees.py`, `scripts/tree_export_bounds.py`로 12개 구역을 생성한다. `python scripts/prepare_connected_tree_manifest.py`로 파일 크기와 경계를 반영한 후 `node scripts/deduplicate-stream-geometry.mjs --manifest public/model/trees-20261104/source-manifest.json --output public/model/trees-smooth-shared-20261104`을 실행하고 생성 manifest를 `public/model/streaming-manifest.json`으로 반영한다.
3. `blender -b blender_work/20261104/sejong_trees_connected_20261104.blend --python-exit-code 1 --python scripts/validate_connected_trees.py`는 각 잎자루·잔가지가 부모 가지에 접하는지 원형 5개 전체를 검사한다. `scripts/audit_tree_scene.py`를 원본과 복사본에서 각각 실행하면 동일한 비수목 장면 SHA-256을 얻는다.
4. `node --test tests/*.test.js scripts/*.test.mjs`의 52개 테스트와 `npm run build`가 통과했다. 브라우저 GLTFLoader가 실제 공유 버퍼를 내려받고 앞쪽 중앙 66개 메시를 디코딩했다. 수목 근접 렌더는 [connected tree](sitevisit-review/20261104-connected-tree.png)다. 물리 모바일 기기의 성능은 측정하지 않았다.
