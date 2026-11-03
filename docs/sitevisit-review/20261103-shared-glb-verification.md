# 2026-11-03 공유 geometry GLB 검증

결과: **별도 prototype 검증 통과**. 원본 `stream/` GLB와 production `streaming-manifest.json`은 이 작업에서 수정하지 않았다. 배포 경로 승격은 별도 결정이다.

- 원본 27개 GLB 합계: **55,284,184바이트**.
- 최적화 manifest가 참조하는 GLB와 공유 BIN의 고유 합계: **27,601,974바이트**.
- 절감: **27,682,210바이트**. 형상과 텍스처 해상도를 낮추지 않았다.
- 공유 BIN은 3개이며 파일명은 실제 바이트의 SHA-256이다. 같은 GLB 집합에서 쓰이는 압축 view만 함께 묶었다.
- core를 포함한 15개 GLB는 URL과 바이트를 그대로 유지한다. 식생 관련 12개 GLB만 `stream-shared/`에 별도로 썼다.
- core 추가 요청 0개, campus 청크마다 최대 3개, west/public planting마다 1개. 전체를 방문해도 고유 geometry 리소스 URL은 기존 27개 + 공유 BIN 3개다.

## 바이너리 보존 검사

[원본 stream 검증](20261103-glb-verification.md)과 [최적화 비교 JSON](20261103-shared-glb-verification.json)은 별개의 검사다.

- 원본/최적화의 **2,254개 meshopt view**의 압축 바이트를 대조했다.
- 두 버전 모두 실제 Three.js MeshoptDecoder로 해제하고 **93,751,760바이트**가 정확히 같은지 확인했다.
- node matrix, mesh primitive, accessor, scene, material, texture, image, sampler 선언은 동일하다. 따라서 정점·색·법선·인덱스와 배치는 원본과 같다.
- 압축되지 않은 이미지/일반 view 18개도 바이트가 동일하다.
- 기존 virtual fallback buffer 인덱스는 유지했다. 외부화한 meshopt extension의 `buffer`와 `byteOffset`만 새 BIN을 가리키며, 남겨 둔 내장 view의 위치는 압축된 내장 BIN에 맞춰 갱신했다.
- 공유 BIN별로 각 소비 GLB가 요구하는 view 집합이 정확히 같은지 확인했다. 불필요하게 받는 geometry는 **0바이트**, 4바이트 정렬 패딩만 전체 76바이트다.

## 실제 로더 HTTP 검사

설치된 Three.js `GLTFLoader.loadAsync`와 실제 MeshoptDecoder를 로컬 HTTP 서버에 연결했다. [HTTP 검사 기록](20261103-shared-loader-http.json)에 요청 URL과 응답 바이트를 보존했다.

원본과 최적화 `campus-planting-center-front` 모두 mesh 66개, 배치된 정점 806,496개를 정상 생성했다. 최적화 파일의 외부 BIN 3개도 모두 HTTP 200으로 불러왔다. 기존 뷰어 로더가 별도 모델 포맷 처리 없이 외부 buffer URI를 해석할 수 있음을 확인했다.

이 로컬 Node 검사는 브라우저 FPS나 인터넷 지연을 보증하지 않는다. 첫 식생 청크의 완전한 cold load에서는 작은 GLB를 받은 다음 BIN을 요청하는 한 단계가 추가된다. 이후 청크는 같은 hash URL의 HTTP cache를 재사용할 수 있다. core 경로는 그대로이므로 최초 핵심 모델에 외부 BIN 요청이 추가되지 않는다. 실제 브라우저와 배포 캐시 확인은 승격 전후 별도로 수행해야 한다.

## 생성과 테스트

```powershell
node --test scripts/deduplicate-stream-geometry.test.mjs
node scripts/deduplicate-stream-geometry.mjs
```

테스트 4개는 원본 보존, fallback·내장 데이터 보존, core 제외, source 디렉터리 덮어쓰기 거절, 전체 외부화 시 양수 buffer 길이를 확인한다. 기능이 없는 상태와 경계 오류가 실제 실패하는 것을 확인한 뒤 모두 통과했다.

원본 production manifest가 나중에 최적화 경로로 승격된 뒤 재생성할 때는 보존한 원본 경로 snapshot을 지정한다.

```powershell
node scripts/deduplicate-stream-geometry.mjs --manifest public/model/stream-shared/source-streaming-manifest.json
```

원본 snapshot, prototype manifest, bucket 크기와 소비처 목록은 `public/model/stream-shared/`에 함께 보존했다. 콘텐츠 hash BIN만 장기 immutable cache를 적용할 수 있다. revision 이름만 있는 GLB와 manifest는 갱신 정책을 별도로 유지해야 한다.
