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

## Three.js 장면과 돋보기 연결

`src/nationalMapRenderer.js`는 점을 레이어별 `THREE.Points`, 경계·철도·수계·공원 외곽을 레이어별 `THREE.LineSegments`로 그린다. 시야의 지면 모서리를 카메라에서 계산해 해당 범위의 레이어만 불러오며, `controls`를 전달하면 조작이 끝난 뒤 250ms 디바운스로 다시 조회한다. 지평선을 바라보는 광선은 카메라의 `far`까지 보수적으로 확장한다. 명시적인 EPSG:5186 범위를 `update({ bounds })`로 전달할 수도 있다. 전체 필드 확인은 `src/NationalMapInformation.jsx` 패널을 사용한다.

```jsx
import { createNationalMapRenderer } from './nationalMapRenderer.js';
import { NationalMapInformation } from './NationalMapInformation.jsx';

// host는 렌더러 캔버스를 포함하는 position:relative 요소다.
const mapLayer = createNationalMapRenderer({
  scene, camera, controls, host,
  draw: () => requestSceneDraw(),
  onStatus: status => setMapStatus(status.message),
  onInspect: hits => setMapHits(hits),
});
await mapLayer.update({
  layers: ['temples', 'mountains', 'airports', 'ports', 'national-parks', 'national-border'],
  mode: cityMode ? 'seoul' : 'local',
  sight: isAllSeeing,
});
// 3D를 그린 뒤 호출하여 레이블을 현재 카메라에 맞춘다.
mapLayer.paint();
// 기존 돋보기 onInspection(result, token)에서 이미 결정한 EPSG:5186 지점 사용:
if (result.kind === 'click') {
  await mapLayer.inspectAt({ easting: result.easting, northing: result.northing, radius: 150 });
}
// 장면 범위나 버튼의 카메라 변경 후 필요하면 await mapLayer.refresh();
// 범위 모드 변경에는 새 mode로 update(); React 해제 시 mapLayer.dispose();

<NationalMapInformation hits={mapHits} status={mapStatus} />
```

`inspectAt`은 현재 선택된 레이어만 추가로 지연 조회한다. 점과 실제 선까지의 거리, 공원 면 내부와 구멍을 판정해 후보를 반환하고 `onInspect`에 전달한다. 요청이 겹치거나 장면이 바뀌면 이전 결과는 폐기한다. 전시천리안의 이름 레이블은 겹침을 줄여 최대 25개만 표시하며, 범위 내 점과 경계는 모두 그린다. 선택한 후보의 **모든 원본 필드**는 접근 가능한 패널에서 세 건씩 넘겨볼 수 있다. 소축척 출처·시점 불확실성, 이름/주소 누락, 경위도 앵커의 한계도 패널에 표시한다. `dispose()`는 진행 중 조회, 컨트롤 이벤트, 캔버스, 생성한 Three.js geometry와 material을 정리한다.

`node --test tests/national-map-renderer.test.mjs`는 점·선·구멍·비동기 취소·카메라 범위·자원 정리를 검사한다. 로컬 Node에서 서울 50km 범위의 20개 레이어는 15개 배치, 28,938정점, 25개 요청이었다. Vite 서버(5189)와 Playwright로 `tests/national-map-renderer-browser.cjs`를 실행하면 390px에서 실제 김포공항 점, 레이블, 원본 속성과 경계를 WebGL로 확인한다. [테스트 화면](national-map-renderer-mobile-20261104.png)은 독립 하네스이며 실제 모바일 장치의 성능 보증은 아니다. 이 sparse worktree에는 `index.html`이 없어 전체 Vite 빌드는 통합 checkout에서 확인해야 한다.

### 전국 화면 요청 수 최적화

위 408개 공간 타일 외에 각 레이어를 한 파일로 묶은 20개 `overview.json.gz`를 함께 제공한다. 이 묶음은 공간 타일과 모든 FID·도형·필드가 동일하며 20개 합계 압축 1,345,855바이트, 최대 516,880바이트다. 뷰 범위가 레이어 전체를 포함하거나 사용자가 범위 없이 전체 레이어를 요청한 경우에만 해당 묶음을 사용한다. 따라서 작은 영역은 해당 타일만 읽고, 전국 전체 20개 레이어 표시는 manifest를 포함해 21개 요청으로 끝난다. 두 자료군의 내용 일치와 요청 수는 자동 검사한다.


## 사용자 선택과 오류 재시도

레이어 선택 UI는 `await source.manifest()`의 `layers`를 이름·건수·ID의 단일 기준으로 사용한다. 전시천리안의 기본 선택은 아래 20개 전부이며, 각 항목을 `aria-pressed`를 가진 버튼 또는 체크박스로 켜고 끌 수 있다. `사찰`과 `전통사찰_수정필요`는 원본이 별개이므로 자동 병합하지 않는다. 시도·시군구는 기존 전국 경계로 별도 표시하며 전국 도로는 제외 사유를 위 표대로 안내한다. 위치 없는 스키장 3건은 점으로 만들 수 없고 `(await source.query({ layers: ['ski-resorts'], includeUnlocated: true })).filter(feature => !feature.geometry)`의 위치 없는 레코드로만 목록에 표시한다.

| 레이어 ID | 이름 | 원본 수 |
| --- | --- | ---: |
| `graticule` | 경위도 | 23 |
| `express-rail` | 고속철도 | 285 |
| `airports` | 공항 | 14 |
| `metro-city-halls` | 광역시청 | 8 |
| `national-border` | 국가경계 | 2 |
| `national-parks` | 국립공원 경계 | 23 |
| `provincial-halls` | 도청 | 9 |
| `lighthouses` | 등대 | 69 |
| `temples` | 사찰 | 268 |
| `mountains` | 산 | 182 |
| `ski-resorts` | 스키장 | 23 |
| `municipal-halls` | 시청 | 77 |
| `watercourses` | 실폭하천 | 847 |
| `rail` | 일반철도 | 549 |
| `traditional-temples` | 전통사찰_수정필요 | 983 |
| `metro-boundaries` | 특별광역자치시도경계 | 81 |
| `ports` | 항구 | 129 |
| `beaches` | 해수욕장 | 71 |
| `coastlines` | 해안선 | 3,081 |
| `administrative-boundaries` | 행정경계 | 710 |

예를 들어 처음 전시천리안을 켤 때 `const selected = manifest.layers.map(layer => layer.id)`로 전부 선택하고, 변경된 `selected`를 `mapLayer.update({ layers: selected, mode, sight })`에 넘긴다. 라벨은 중첩 방지를 위해 25개까지지만 선택된 점과 선은 모두 표시한다.

`onStatus`는 `{state: 'loading' | 'ready' | 'idle' | 'error', message}`를 전달한다. `error`일 때 메시지와 **다시 불러오기** 버튼을 표시하고 `mapLayer.refresh().catch(() => {})`를 실행하면 현재 선택·모드·카메라로 다시 요청한다. `update`와 `inspectAt`은 실패 시 예외를 반환하므로 이벤트 핸들러에서 잡고, 오래된 취소 조회는 `null`을 반환한다. 실패 후 재시도와 빈 장면의 자원 정리는 자동 테스트로 검증했다.
