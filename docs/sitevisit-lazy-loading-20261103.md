# 2026-11-03 웹 모델 공간 로딩

사용자 요구: “glb로 내보내서 웹 잘 연결, 또한 웹 접속할때 레이지 모델 로딩 방식해서 멀리있는데도 너무 느려지지 않게 지능적으로 잘 할것.”

## 파일 계약

`/model/streaming-manifest.json`은 `version: 1`이며 필수 건물/지면을 담은 `core`와 선택 상세인 `chunks`를 구분한다. 모든 GLB는 동일한 원점을 유지한다. bounds는 Three.js의 Y-up 월드 좌표, 즉 Blender `(x,y,z)` → `(x,z,-y)`다.

선택 `focusBounds`는 초기 카메라/조명 계산을 회관 영역에 고정한다. 먼 주변 건물까지 담은 `core.bounds` 자체는 바꾸지 않는다. `campus-layout.json`의 `westGarden.beds[].points`는 같은 Three.js XZ 좌표의 실제 곡선 식재 경계이며, manifest와 병렬로 받아 보행 충돌에 쓴다.

```json
{
  "version": 1,
  "core": { "url": "/model/sejong_core.glb", "bounds": { "min": [-80,0,-120], "max": [80,45,80] } },
  "chunks": [{
    "id": "example-detail",
    "url": "/model/example-detail.glb",
    "bounds": { "min": [0,0,-120], "max": [30,8,-100] },
    "loadDistance": 50,
    "unloadDistance": 90,
    "maxViewDistance": 140,
    "shadowDistance": 45
  }]
}
```

위 값과 파일명은 인터페이스 설명용이다. 실제 내보내기 위치·크기·파일명은 배포 manifest를 따른다.

## 로딩과 렌더링

- viewer가 화면 근처(320px 여유)에 왔을 때 manifest와 core를 요청한다. core가 준비되면 조작을 활성화하며 주변 파일 완료를 기다리지 않는다.
- GLTFLoader와 MeshoptDecoder도 실제 모델 요청 시 동적 import한다. 디코더 코드 초기화와 모델 바이트 다운로드를 병렬화하고, 페이지 첫 JavaScript 묶음에서 분리한다.
- 모형 보기에서는 사용자가 선택/이동한 회전 중심을 요청 우선순위로 쓰고, 접근 반경은 회전 중심과 실제 카메라 XZ 위치 중 가까운 쪽을 쓴다. 걷기에서는 카메라 위치가 두 기준에 모두 쓰인다. 파일 bounds의 XZ 사각형 가장자리까지 거리를 계산하므로 큰 정원의 중심점을 지나야 나타나는 문제를 피한다.
- 실제 카메라와 3D bounds 간 거리도 확인한다. 확대하지 않은 개요 시점에서 너무 작은 세부 파일을 요청하지 않는다. `maxViewDistance` 기본값은 `loadDistance × 3`이다.
- 선택 파일은 가까운 구역부터 한 번에 하나만 요청한다. 카메라 이동이 파일 선택보다 빨라지면 진행 중 fetch를 AbortSignal로 취소한다. 이미 디코딩 중인 요청이 늦게 끝나도 장면에 붙이지 않고 해제한다.
- 멀어질 때는 더 큰 `unloadDistance` 및 `maxViewDistance × 1.25`를 적용한다. 잠깐 경계를 왕복해도 파일을 다시 받지 않는다. 충분히 먼 상태가 20초 유지되면 장면과 GPU 자원을 해제한다.
- 실패한 선택 파일은 UI 전체를 오류로 만들지 않으며 최소 30초 뒤 접근 조건이 맞으면 재시도한다. manifest가 없거나 유효하지 않을 때는 기존 단일 GLB 경로로 돌아간다.
- 평가 주기는 250ms다. 원거리 선택 파일과 원거리 core 메시의 그림자는 끈다. 태양 그림자 범위도 이동 중심 주변 150m로 한정한다. viewport 밖이나 숨겨진 탭에서는 GPU 렌더링을 멈춘다.
- 큰 campus 식생군의 실제 반경 예산은 load 50m / unload 90m / view 125m다. public 식생은 45m / 90m / 160m다. 선큰 내부 view는 200m로 제한한다. 개요에서 보이는 작은 주변 입면과 조형물은 해당 manifest 예산을 따른다.
- 나무의 공유 geometry/material 인스턴싱과 기본 frustum culling을 유지한다. 새 청크가 왔다고 초기 카메라를 다시 맞추지 않는다.

## 자원과 기존 조작 보존

`src/modelResources.js`는 중복 geometry/material/texture를 한 번씩 해제한다. diffuse map 외 normal/roughness 등 모든 텍스처 슬롯과 InstancedMesh 버퍼도 처리한다. 화면이 내려간 뒤 core 디코딩이 끝나는 경우도 자원을 해제한다.

`focusOrbitAt`는 메모리에 남아 있지만 숨겨진 먼 청크를 선택하지 않는다. 기존 키보드/터치 조작·정면/뒷면 프리셋·보행 충돌/지면 높이 로직은 계속 사용한다. 세부를 확인할 수 있도록 모형 보기의 최소 확대 거리는 2.5m로 설정했다.

항공사진에 맞춰 늘어난 별관 뒤 절반은 surroundings 모드에서 연속 충돌 영역으로 반영했다. 기존 경계 Z=-25m에서 빈 틈이 생기지 않으며, legacy 모드의 기존 별관 치수는 보존한다.

## 검증 기록

- 구현 전 새 테스트가 실패하는 것을 확인했다. 구현 후 `node --test tests/modelStreaming.test.js tests/orbitFocus.test.js`는 10/10 통과했다.
- 실제 로컬 HTTP 서버를 사용하는 테스트에서 먼 카페 파일은 요청되지 않고, target을 옮겨도 카메라가 너무 멀면 요청되지 않으며, 카메라까지 접근하면 실제 fetch가 한 번 발생함을 확인했다.
- 다운로드 동시성/순서, 경계 왕복, 20초 퇴거, 이동 중 취소·unmount 후 늦은 응답, 30초 재시도 지연, 잘못된 bounds/중복 id, 공유 자원 해제, 숨겨진 파일의 더블클릭 선택 방지를 확인했다.
- 초기 프런트 통합 빌드는 통과했다. 기존 500kB 초과 번들 안내가 남아 있다.
- 새 manifest 생성 전 로컬 실제 IAB에서 기존 GLB fallback이 준비 상태에 도달하고 뒷면 버튼이 동작하며 콘솔 오류가 없음을 확인했다. 실제 분할 파일의 요청 검증은 내보내기 후 수행한다.
- 독립 코드 검토에서 숨긴 시간이 FPS 샘플에 섞이는 문제를 발견했다. 일시정지 시 측정을 초기화하는 검출기로 수정했고 실제 20fps/10초 숨김 후 60fps를 구분하는 2개 테스트가 통과했다.

## 최종 분할·공유 버퍼 실제 브라우저 검증

로컬 IAB에서 `20261103-aerial-shared` manifest를 사용해 실제 다운로드와 렌더를 확인했다. core는 8,668,108바이트, 초기 개요의 GLB 파일 합계는 8,996,484바이트였다. 이는 파일 크기 합계이며 HTTP 압축 후 전송량이나 로딩 시간 측정값은 아니다.

- 초기 개요: core와 소형 입면/조형물만 요청, campus/public 식생 파일 0개, 공유 식생 버퍼 0개.
- 뒷면 프리셋: west-garden과 rear-garden 상세, 가까운 center-rear/south-rear 식생을 요청했다. 개요에서 앞쪽 7MB 식생군까지 모두 받던 조건을 줄였다.
- 후면을 선택·확대: 실제 계단·하부 설비·석재 포장, 연결동 마감, 정원 수목을 확인했다.
- 카페를 선택·확대: cafe-interior와 cafe-tile-detail 요청, 입체 반원형 타일과 실내/입구 표현을 확인했다.
- 걷기 전환 및 W 키 1.2초 이동, 모형 보기 복귀 시점 복원, 정면/뒷면/처음 프리셋을 확인했다.
- 최종 탐색에서 공유 buffer URI는 3개만 관측되었고 기존 raw campus GLB 경로 요청은 0개였다. 자산 inventory는 같은 URI의 반복 네트워크 요청 횟수를 구별하지 않으므로 ‘각 버퍼가 한 번만 요청되었다’고 단정하지 않는다.
- 최종 console warning/error 관측값은 0개다. 취소·늦은 응답·자원 해제·20초 퇴거는 별도 의미 있는 단위 테스트로 확인했다.
- 검증을 마친 임시 IAB 탭을 닫고 검증용 5174 dev server를 중지했다. 기존 사용자 탭이나 다른 서버는 조작하지 않았다.

실제 관측 URL과 단계별 목록: [네트워크 검증 JSON](sitevisit-review/20261103-web-streaming-network.json).

| 화면 | 검증 내용 |
| --- | --- |
| [초기](sitevisit-review/20261103-web-streaming-initial.jpg) | 멀리 있는 주변 상세를 받기 전 회관 중심 개요 |
| [후면](sitevisit-review/20261103-web-streaming-rear.jpg) | 깊이를 보정한 별관과 새 서측 정원 |
| [계단/정원 근접](sitevisit-review/20261103-web-streaming-stair.jpg) | 근거리 모델 요청 후 계단과 실제 식생 표시 |
| [카페 근접](sitevisit-review/20261103-web-streaming-cafe.jpg) | 타일·실내 GLB 및 지면 아티팩트 제거 |
| [걷기](sitevisit-review/20261103-web-streaming-walk.jpg) | 눈높이 시점과 키 이동 |

## 깊이·그림자 회귀 수정

카페 낮은 시점에서 넓은 지면에 동심원 간섭이 나타나 검증했다. orbit near plane을 거리에 비례해 0.1–6m로 조절하고 걷기는 0.1m를 유지해 밀리미터 마감 간격의 깊이 정밀도를 높였다. 80m에서 1mm 간격이 24-bit depth의 여러 단계로 구분됨과 가장 가까운 2.5m 모형 시점의 초점 물체가 잘리지 않음을 테스트했다.

넓은 바닥의 동심원 자체는 이 변경만으로 없어지지 않았다. 다음 검증에서 넓고 낮은 지면이 스스로 그림자를 투사하던 shadow acne임을 확인했다. 넓은 지면은 receive만 유지하고 cast를 제외해 실제 브라우저에서 제거했다. 작은 화단 턱과 건축물의 그림자는 유지한다. [수정 전 증거](sitevisit-review/20261103-web-streaming-cafe-before-depth.jpg)와 위 카페 근접 결과를 보존했다. 새 텍스처에는 GPU 지원 범위 내 anisotropy 최대 4를 준비 시 한 번 적용했다.
