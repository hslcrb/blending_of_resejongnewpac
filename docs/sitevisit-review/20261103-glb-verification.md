# 2026-11-03 GLB 분할 내보내기 검증

검증 시각: 2026-11-03T07:40:25.840Z
결과: **통과**. 상세 수치와 파일별 SHA-256은 [검증 JSON](20261103-glb-verification.json)에 기록했다.

- 파일 27개: core 1개 + 거리별 chunk 26개. 총 55,284,184바이트.
- 초기 core 8,668,108바이트, 나머지 chunk 합계 46,616,076바이트.
- 모든 개별 파일은 25MiB 미만이며 최대 파일은 8,668,108바이트다.
- 원본 partition 목록의 1330개 source는 중복 배정 없이 각각 한 번씩 포함된다. [web mesh] 프록시 이름을 반영해 실제 GLB 노드와 대조했다.
- active scene뿐 아니라 GLB 안의 모든 scene/node를 검사했다. 전체 geometry node 1330개, 누락/추가/중복 노드 0건. 각 파일은 scene 1개다.
- EXT_meshopt_compression이 모든 파일에 사용되고 required로 선언되어 있다. Draco 압축은 없다.
- 설치된 Three.js MeshoptDecoder로 압축 bufferView 2,254개를 실제 해제했다. 해제된 바이트 93,751,760개.
- POSITION accessor 826개의 정점 3,467,820개를 실제 읽고 glTF node world matrix로 변환했다. 비유한 좌표가 없고 manifest bounds 안에 5mm 허용오차로 포함된다.

## 베이크 텍스처 보존

| 이미지 | 실제 포함 파일 | 크기 | 검증 |
| --- | --- | --- | --- |
| 20261103_stair_granite | core, rear-stair-detail | 512 × 512 PNG | GLB 내장 bufferView·PNG 시그니처·실제 baseColor 재질 참조 확인 |
| 20261103_cafe_frame | core | 512 × 512 PNG | GLB 내장 bufferView·PNG 시그니처·실제 baseColor 재질 참조 확인 |
| 20261103_garden_paving | west-garden | 512 × 512 PNG | GLB 내장 bufferView·PNG 시그니처·실제 baseColor 재질 참조 확인 |

## 범위와 한계

이 검사는 바이너리 디코딩·메시 배정·좌표 범위·이미지 내장을 확인한다. 실사 재현도나 런타임 FPS를 보증하는 검사는 아니다. 의도적으로 제외한 archive/parent/LC-alpha 오브젝트는 export-partitions의 1,330개 원본 객체 계약 밖에 있다.

초기 검사에서 별도 베이크 scene의 calibration plane이 파일마다 추가된 것을 발견했다. root가 use_active_scene 옵션으로 다시 내보낸 최종 27개 파일을 새로 읽고 전체 scene/node 검사를 통과했으며, 해당 보정 plane은 최종 GLB에 없다.

## 전체 전송량이 커진 이유

원본을 수정하지 않고 이미지 bufferView와 압축 geometry bufferView를 바이트 해시로 비교했다. 큰 식생 청크 6개에는 내장 이미지가 0개다. 이미지 다운샘플링으로 이 청크 용량을 줄일 수 없다.

| 청크 | 전체 바이트 | 압축 geometry 바이트 | 내장 이미지 바이트 |
| --- | ---: | ---: | ---: |
| core | 8,668,108 | 6,075,234 | 2,458,724 |
| campus-planting-center-front | 7,529,688 | 7,476,203 | 0 |
| campus-planting-center-rear | 7,416,620 | 7,346,167 | 0 |
| campus-planting-north-front | 5,215,724 | 5,167,670 | 0 |
| campus-planting-north-rear | 4,265,152 | 4,209,342 | 0 |
| campus-planting-south-rear | 4,255,156 | 4,209,342 | 0 |
| campus-planting-south-front | 4,246,972 | 4,209,342 | 0 |
| west-garden | 2,850,424 | 2,600,199 | 190,186 |

전체 이미지 합은 3,771,222바이트이며, 동일 이미지의 추가 복사분은 483,326바이트다. 반면 압축 geometry 50,340,014바이트 중 GLB 사이에 반복된 동일 bufferView는 27,870,003바이트다. 파일 내부 반복분은 136,669바이트로 별도 구분했다. 같은 식생 형상이 campus 6개와 public planting 5개, 최대 11개 청크에 각각 내장되어 있다.

이는 전 청크를 모두 방문했을 때의 누적 전송량 분석이다. 레이지 로딩은 처음부터 모든 파일을 다운로드하는 비용을 피하며, 별도 공유 식생 형상과 구역별 transform 데이터로 분리하면 이후 전체 전송량도 줄일 수 있다. 이 검증 작업에서는 GLB·manifest·앱을 변경하지 않았다.
