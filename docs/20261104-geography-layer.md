# GIS 경계·지면 시각화 레이어

`src/geographyLayer.js`는 제공 QGIS 백지도·서울 주변 행정선·하천·도로·철도와 별도로 준비된 행정동·서울 자치구 경계를 Three.js에 표시하고, 돋보기 위치에서 원본 속성을 조회한다. 독립 모듈이며 화면의 버튼·텍스트 투사·출처 표시·오류 UI는 호출자가 연결해야 한다. 도로 및 경계 도형의 출처·범위는 `20261104-overview-gis.md`, 행정동의 출처·기준일·라이선스는 `admin-dong-boundaries.md`에 있다.

## 범위와 출처

- QGIS 제공 백지도는 소축척이고 일부 행정명이 누락되어 있으며 최신 지적 경계가 아니다. 공급자의 원 출처와 이용조건은 확인되지 않았다.
- 행정동은 2026-10-01 기준 제3자 가공 SGIS 경계다. **법정동 주소 경계나 지적·필지 경계가 아니다.** 서울 자치구 25개는 서울 행정동의 합집합이며 단독 원본 시군구 경계가 아니다. 지자체 변동은 원자료 기준을 따른다.
- 행정동 표시 시 지도 인터페이스에 반드시 `onStatus`의 `attribution`과 `notice`를 표시한다. SGIS, vuski/admdongkor, CC BY 4.0 링크, 가공 사실 및 기준일을 숨기지 않는다. `GEOGRAPHY_NOTICE`, `ADMIN_ATTRIBUTION` 상수도 제공한다.

## 사용 예

```js
import { createGeographyLayer } from './geographyLayer.js';
const layer = createGeographyLayer({
  scene,
  height: 0.08, // 장면의 지면 높이에 맞게 조정
  invalidate: requestRender,
  onStatus: ({ state, notice, attribution, failed }) => {
    // notice와 attribution을 화면에 표시하고 state === 'error'면 failed와 재시도 UI 제공
  },
});
await layer.setMode('local'); // 광화문 'local', 서울 'seoul', 전국 'national'
await layer.setVisible(true); // 이때 필요한 데이터만 지연 로드
// 돋보기의 지면 교점(장면 x,z) 주변의 포함 폴리곤 및 선
const hits = await layer.query({ x: 0, z: 0, mode: 'local', radius: 150 });
for (const hit of hits) {
  const fields = hit.feature.properties.fields ?? hit.feature.properties;
  // fields 전체와 hit.source(출처·원본 CRS), hit.distance를 정보 패널에 표시
}
// 전시천리안 이름을 별도 캔버스/DOM에 투사할 때 사용
const labels = layer.getLabels({ mode: 'local' });
// 각 label의 x,z와 name을 카메라에 투영하고 화면 겹침을 처리한다.
layer.setCategories(['province', 'district', 'district-detail', 'admin', 'admin-detail', 'water', 'roads', 'rail']);
// 전국 보기에서 필요한 광역권 행정동만 추가. 서울은 회관/서울 모드에서 자동 로드.
await layer.setMode('national');
await layer.setRegions(['11', '26']); // 서울과 부산, 변경하면 다른 선택 지역의 경계는 숨김
// 실패 시 await layer.retry(); 화면 해제 시 layer.dispose();
```

`setCategories(null)`은 전체 범주를 표시한다. `query` 기본 반경은 100m이고 범주 설정이 조회에도 반영된다. 기본적으로 일치하는 결과를 전부 반환하며 호출자가 `limit`을 줄일 수 있다. `getLabels`는 기본적으로 자치구·행정동 이름과 폴리곤 내부 위치를 반환한다. `bounds:{minE,minN,maxE,maxN}` 및 `limit`으로 화면 표시량을 제한할 수 있다. 원본 행정동 도형과 속성은 경위도/EPSG:4326 그대로 결과에 포함되고, 내부 검색과 화면 좌표만 EPSG:5186으로 변환한다. QGIS 백지도 속성은 `properties.fields`에 있다.

`setRegions`는 두 자리 원본 광역 코드 배열을 받는다. 선택한 권역을 `regions/<code>.geojson.gz`로 가져오고 최대 세 요청씩 처리한다. 전국 모드의 기본값은 요청 지역 없음이며, 화면에 보이는 지역 또는 사용자가 선택한 지역을 호출자가 지정해야 한다. 전체 전국 행정동을 한 번에 요청하면 메모리와 렌더링 비용이 커질 수 있다. 광역 코드 목록은 `public/gis/admin-dong/manifest.json`을 참고한다.

다른 경계 데이터를 추가하려면 `layer.addDataset(id, collection, { category: 'admin-detail', region: '11', indexed: true })`를 사용한다. 지원 CRS는 EPSG:5186 또는 `metadata.crs`가 있는 EPSG:4326이며, GeoJSON의 LineString·MultiLineString·Polygon·MultiPolygon을 지원한다. `removeDataset(id)`로 해제한다. 추가 자료의 이용 조건은 호출자가 직접 검토·표시해야 한다.

## 구현과 검증

전국 백지도는 범주별로 합친 선 메시를 사용한다. 서울 선형 43,668건도 종류별 `LineSegments`로 묶어 수만 건을 개별 그리기 호출로 만들지 않는다. 서울과 상세 행정 경계 조회는 1km 공간 인덱스로 후보를 줄이며 큰 반경은 전체 후보를 검사한다. 서울·회관 변환은 기존 EPSG:5186 축 규약을 따른다. 경계선은 `depthTest:false`, `depthWrite:false`로 그리므로 큰 고도에서 지면과의 깊이 충돌에 영향받지 않고 건물 위에도 투사된다. 폴리곤 내부 판정은 구멍과 멀티폴리곤을 고려하며, 나머지는 가장 가까운 선분까지 거리로 조회한다.

```powershell
node --test tests/geography-layer.test.js tests/geography-real.test.js tests/admin-dong.test.mjs
# Vite 서버를 4178 포트에 띄우고 PLAYWRIGHT_PATH와 CHROME_PATH를 지정한 뒤:
node tests/geography-render.cjs
```

모의 자료로 지연 로드, 좌표 축, 분류 가시성, 실패·재시도, 늦은 응답 해제, 사용자 정의 자료 추가·제거를 검사한다. 실제 자료로 회관의 서울시·종로구·행정동·도로 포함 조회, 부산 권역 행정동 조회, 두 좌표계 전환과 선 메시 수를 검사했다. WebGL에서는 실제 압축 자료를 불러와 회관과 전국 높이의 경계선 픽셀 및 앞쪽 지면과의 깊이 처리, 원본 고지를 확인했다. 물리 모바일 기기의 성능이나 공식 경계의 현재 정확성을 보증하지 않는다.

2026-11-04 로컬 Node 시험에서 16개 광역권 전부를 선택했을 때 행정동 3,559개와 서울 자치구 25개, 총 3,584개의 이름이 생성되었다. 약 0.72초, Node 힙 약 237MB로 측정되었으므로 실제 모바일에서는 기본적으로 필요한 광역권만 불러오는 것이 적절하다.
