# 전국 소축척 도로 자료와 뷰포트 조회

사용자 제공 `대한민국전도_.gpkg`의 `고속국도`, `일반국도`, `지방도`를 읽기 전용으로 사용했다. 파일의 정확한 생산자·제작일·사용허가는 제공된 메타데이터에서 확인되지 않았다. 공개 배포 권리는 별도로 확인해야 한다. 소축척 개요도이며 최신성·위치 정확도를 보장할 수 없고 측량·지적·안전 판단에 부적합하다. 모든 실제 도로를 포함한다는 뜻이 아니다.

## 자료 계약

`public/gis/national-roads/manifest.json`은 입력의 SHA-256과 각 레이어 원 좌표계 WKT, 속성 스키마, FID 수, null geometry 수, 경로 삭제 수, gzip 파일의 실제 객체 범위·수·해시를 기록한다. 각 파일은 EPSG:5186의 `[easting, northing]` 미터 좌표를 가진 GeoJSON FeatureCollection이고 기존 `nationalMapLayers.js` 결과와 같은 `id`, `bbox`, `properties.layer`, `properties.fid`, `properties.fields` 형태다. 고속국도와 다른 도로 레이어의 원 좌표계가 다르므로 각 레이어의 원본 좌표계에서 개별 변환한다. 변환 좌표는 소수점 9자리까지 기록하며 형상을 단순화하거나 자르지 않는다.

FID는 원본 레이어마다 고유하며 `expressway:`, `national:`, `local:` 접두사를 붙인다. 원본 속성 필드의 null은 null로 유지한다. 개인정보에 해당할 수 있는 로컬 파일 경로 형식의 문자열과 경로 필드는 null로 바꾸고 삭제 수를 manifest에 기록한다. 경로 삭제 외에는 원본 필드 값과 명칭을 보존한다. 형상 null인 객체는 별도 unlocated 파일에 보존되며 지도 범위 조회에는 포함되지 않는다.

객체는 EPSG:5186 외곽 상자 중심점 기준 50km 격자로 한 번만 배정된다. 실제 도로는 격자를 가로지를 수 있으므로 manifest는 격자의 경계가 아닌 전체 원본 객체들의 외곽 상자 합집합을 기록한다. 조회 시 이 실제 범위가 겹치는 파일을 선택하므로 격자 경계의 긴 도로가 누락되지 않는다. 반환된 객체 bbox는 범위의 보수적 근사라서 정확한 교차 판정은 소비자가 수행할 수 있다. 각 gzip은 25MiB 미만이다.

## 브라우저 연결

```js
import { createNationalRoadSource } from './nationalRoadTiles.js';
const roads = createNationalRoadSource();
const controller = new AbortController();
const features = await roads.query({
  layers: ['expressway', 'national', 'local'],
  bounds: [west, south, east, north], // EPSG:5186 metres
  signal: controller.signal,
});
// 화면 이동 / 레이어 해제: controller.abort()
// 각 feature의 geometry 좌표를 기존 nationalMapRenderer 좌표 변환으로 전달
```

`bounds`는 필수이고 가로·세로 각각 50km 이하여야 한다. 64개를 초과하는 파일이 필요한 경우도 범위를 좁혀야 한다. 화면이 멀리 축소되면 호출하지 않고 안내를 표시하는 것이 좋다. 한 조회는 최대 4개 파일을 동시에 불러오며 중단 시 미완료 요청을 취소한다. 각 호출은 독립적이어서 다른 조회를 취소하지 않는다. `clearCache()`로 최대 24개 압축 해제 타일의 메모리 캐시를 비울 수 있다. HTTP 실패와 잘못된 데이터는 오류로 전달하므로 소비자는 오류와 재시도를 표시해야 한다. gzip 해제는 브라우저의 `DecompressionStream`을 사용한다. `manifest(signal)`로 스키마·출처를 읽을 수 있다. 기존 3D 장면의 도로와 동시에 표시하면 서울 구간이 중복될 수 있으므로 통합 시 기존 도로를 숨겨야 한다.

## 재생성과 전수 검증

QGIS 배포판 Python/GDAL에서 다음을 저장소 루트에서 실행한다. 출력 디렉터리는 비어 있어야 하며 원본 경로는 인자로만 전달하고 결과에 기록하지 않는다. 기존 추적 데이터 덮어쓰기를 방지하려면 새로운 빈 디렉터리를 `--output`에 지정한다.

```powershell
& '<QGIS>/bin/python-qgis-ltr.bat' scripts/export_national_roads.py --input '<사용자 원본.gpkg>' --output '<새 빈 디렉터리>'
& '<QGIS>/bin/python-qgis-ltr.bat' scripts/validate_national_roads.py --input '<사용자 원본.gpkg>' --data '<동일 디렉터리>'
node --test tests/national-road-tiles.test.js
```

검증 스크립트는 원본 해시, 모든 원본 FID 중복·누락, 모든 속성·null과 경로 삭제, 변환된 각 geometry 및 bbox, 타일별 실제 bbox·객체 수·파일 해시·25MiB 미만을 전수 대조한다. 최종 수치는 실행 로그 및 manifest를 참조한다.

생성 결과: 고속국도 21,973건 / 43개 파일, 일반국도 168,014건 / 62개 파일, 지방도 59,429건 / 63개 파일이다. 각 레이어는 32개 속성 필드를 가지며 위치 없는 객체와 경로 삭제는 모두 0건이었다. 세 레이어의 압축 파일 최대 크기는 2,993,699바이트다. 총 168개 gzip과 manifest는 약 39.7MB다.

`createNationalMapRenderer({scene, camera, source: roads, ...})`에 이 소스를 주면 기존 렌더러의 `update({layers, bounds, mode})`와 `inspectAt(...)` 계약을 사용할 수 있다. 별도 렌더러 인스턴스로 사용하고 축소 범위에서 호출을 생략하는 제어는 통합 화면이 담당한다.

2026-11-04 실제 전수 대조 결과: 입력 SHA-256 `cd5c34ced00cff5af0446261a8fa48db95b876dc2b86b7965b2278327cbb53df`, 249,416/249,416건 일치. 고속국도 21,973건, 일반국도 168,014건, 지방도 59,429건 모두 FID 중복·누락 없이 각 속성·변환 geometry·범위가 일치했고 세 레이어 모두 위치 없는 객체와 로컬 경로 삭제가 0건이다. 각 gzip 크기·해시와 실제 bbox도 일치했다. 실제 gzip을 기존 렌더러에 연결해 선 표시와 좌표별 속성 조회를 자동 테스트했다.

전국 168개 타일의 실제 bbox 교차 이벤트를 모두 계산한 결과 세 도로 등급 동시 조회 시 정사각형 5km 또는 10km 범위에서 최대 12개 타일, 압축 9,261,477바이트, 해제 65,258,003바이트가 겹친다. 정사각형 50km에서는 최대 26개 타일, 최대 압축 총량 12,356,024바이트, 최대 해제 총량 83,492,790바이트다. 개수와 용량의 최대 위치는 서로 다를 수 있다. 서울 회관 중심 10km 조회의 Node 로컬 실측은 결과 6,454건, gzip 9,261,477바이트·해제 65,258,003바이트, 파싱 후 힙 증가 약 110MB였다. 이는 메모리 상한이 아니며 브라우저·렌더러의 geometry와 캐시는 추가로 필요하다. 도로 레이어를 사용자가 켰을 때만 불러오고 범위 이동을 디바운스하며 껐을 때 `clearCache()`를 호출하는 것을 권한다.
