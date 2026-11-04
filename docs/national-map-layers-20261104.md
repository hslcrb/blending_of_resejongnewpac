# 백지도 부가 레이어 — 2026-11-04

사용자가 제공한 소축척 대한민국 전도 GeoPackage의 26개 레이어를 조사했다. 기존 `public/gis/national-admin.json.gz`의 시도·시군구와 `seoul-ground.json.gz`의 서울 인근 지면 자료에 더해, 아래 20개 레이어를 `public/gis/extra/`로 내보냈다. 원본은 읽기 전용이며 SHA-256은 manifest에 기록했다. 정확한 원저작자·제작 시점·축척 수치·사용허가는 원본에서 확인되지 않아 사용자 제공 자료로만 표기하며, 공개 배포 권리 확인이 필요하다. 지적 측량이나 현재의 법정 경계 판정에 사용하면 안 된다.

| 원본 레이어 | 전수 | 원본 레이어 | 전수 |
| --- | ---: | --- | ---: |
| 경위도 | 23 | 고속철도 | 285 |
| 공항 | 14 | 광역시청 | 8 |
| 국가경계 | 2 | 국립공원 경계 | 23 |
| 도청 | 9 | 등대 | 69 |
| 사찰 | 268 | 산 | 182 |
| 스키장 | 23 | 시청 | 77 |
| 실폭하천 | 847 | 일반철도 | 549 |
| 전통사찰_수정필요 | 983 | 특별광역자치시도경계 | 81 |
| 항구 | 129 | 해수욕장 | 71 |
| 해안선 | 3,081 | 행정경계 | 710 |

총 **7,434건**이다. 스키장 3건은 원본에 위치가 없어 별도 `unlocated` 파일에 속성과 원본 FID만 남겼다. `전통사찰_수정필요`는 원본 이름 자체가 수정을 요구하며 `사찰`과 중복될 수 있다. 일부 원본 필드명에 이미 깨진 문자가 있어 임의로 복원하지 않았다. 표기와 주소·전화·시설 상태는 원본의 과거 기록일 수 있다.

| 나머지 레이어 | 처리와 이유 |
| --- | --- |
| 시도_백지도 (30), 시군구_백지도_ (3,176) | 기존 `national-admin.json.gz`에 전국 전수 제공 |
| 고속국도 (21,973), 일반국도 (168,014), 지방도 (59,429) | 전국 249,416건 무조건 다운로드는 제외. 기존 `seoul-ground.json.gz`에 서울 인근 잘라낸 도로 제공 |
| layer_styles (25) | QGIS 내부 스타일 테이블로 공간 도형이 아니며 로컬 경로가 들어갈 수 있어 제외 |

## 형식과 선택 로딩

각 파일은 gzip GeoJSON FeatureCollection이며 기하 좌표는 **EPSG:5186 미터 `[동쪽, 북쪽]`**이다. 점은 변환 후 0.1m로 기록하고 선·다각형은 50m 위상 보존 단순화한 소축척 표시용이다. 각 feature의 `id`는 레이어 식별자와 원본 FID, `properties.fields`는 원본 속성이다. 개인 컴퓨터 경로를 공개하지 않도록 `path` 계열 및 파일 경로 문자열은 `null` 처리한다(이번 포함 레이어의 실제 비식별화 건수 0). `properties.anchorWgs84`는 원본 도형 경계 상자 중심을 변환한 **[경도, 위도]**이며, 점은 그 점의 위치이고 선·면은 실제 도형 위에 있지 않을 수 있다. 필드명·좌표계·건수·원본 속성형과 압축 해시는 `manifest.json`에서 확인한다.

100km 격자에 도형의 경계 상자 중심으로 한 번만 배정해 중복을 막는다. 각 파일에는 수록 도형의 **전체 원본 범위 합집합**을 기록하므로 한 타일을 길게 가로지르는 선도 화면 범위 질의에서 누락되지 않는다. 이 범위는 보수적인 후보 필터여서 실제 도형과 화면의 정밀 교차는 렌더러에서 별도 판정해야 한다. 408개 파일의 합계는 압축 1,479,149바이트, 비압축 5,482,714바이트이며 최대 파일은 86,578바이트다. 위치 없는 자료는 명시적으로 요청할 때만 반환한다.

```js
import { createNationalMapSource, toSeoulWorld, toSejongWorld } from './nationalMapLayers.js';
const source = createNationalMapSource();
const layers = await source.manifest(); // layers.layers에서 id·이름·건수 확인
const features = await source.query({
  layers: ['temples', 'mountains', 'national-parks', 'national-border'],
  bounds: [195000, 550000, 200000, 555000], // 선택 사항, EPSG:5186 미터
  signal: abortController.signal,
  includeUnlocated: false,
});
// EPSG:5186 점을 서울 장면에 넣을 때: toSeoulWorld(feature.geometry.coordinates)
```

명시된 레이어에 대해서만 조회하고 최대 네 요청을 동시에 실행한다. 결과 캐시는 기본 24개 파일이며 실패·취소된 요청은 캐시에 보관하지 않는다. 레이어 전체가 필요한 경우 `bounds`를 생략할 수 있다. 점·선·면 스타일과 Three.js 자원은 호출자가 관리한다.

## 재생성과 검사

QGIS의 GDAL Python에서 다음과 같이 실행한다. 입력 파일 경로는 사용자가 제공한 원본을 가리키며 공개 manifest에는 저장하지 않는다.

```sh
python scripts/export_national_map_layers.py --input <input.gpkg>
python scripts/validate_national_map_layers.py --input <input.gpkg>
node --test tests/gis-overview.test.mjs tests/national-map-layers.test.mjs
```

7,434건 모두 원본 FID, 모든 속성, 좌표 변환 전후 범위 및 경위도 앵커를 대조했다. 위치 없는 3건도 원본과 일치했고 출력 도형의 GDAL 유효성 검사 결과 무효 0건이었다. 결과는 `20261104-national-map-validation.json`에 있다. 이 검사는 자료의 현재성이나 권리를 증명하지 않는다.
