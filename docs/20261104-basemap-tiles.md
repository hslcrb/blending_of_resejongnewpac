# 실제 지도 및 위성영상 3D 지면 타일

`src/basemapLayer.js`는 원본 QGIS 백지도와 별개인 실시간 지도 타일 표시 모듈이다. `src/mapProjection.js`가 EPSG:5186과 위경도·웹 메르카토르 XYZ를 변환하고, 회관/서울 장면 축에 맞춘다. 장면 통합과 사용자가 선택하는 버튼·오류 메시지는 호출자가 구성한다.

## 제공처와 표기

- `ground`: [OpenStreetMap 표준 지도](https://www.openstreetmap.org/copyright), 최대 줌 18. `© OpenStreetMap contributors`를 표시한다. [OSM 타일 이용 정책](https://operations.osmfoundation.org/policies/tiles/)에 따라 실제 보이는 영역만 요청하며, 대량 선행 다운로드나 오프라인 패키지를 제공하지 않는다. 브라우저 기본 HTTP 캐시를 사용하고 `no-cache` 요청을 보내지 않는다. 배포 서버의 Referrer-Policy는 교차 출처에서 최소 origin Referer를 허용해야 한다.
- `satellite`: [EOxCloudless](https://cloudless.eox.at/)의 Sentinel-2 cloudless **2016년 저해상도 합성 영상**, 최대 줌 14. 최신 항공사진이나 현재 실시간 영상이 아니다. EOX는 원본 해상도를 약 10m 수준으로 설명하며, 도시의 개별 시설·나무를 판독하기에 부적합하다. 필수 문구 `EOxCloudless https://cloudless.eox.at by EOX IT Services GmbH (Contains modified Copernicus Sentinel data 2016)`와 CC BY 4.0·촬영 연도를 지도에 표시한다. EOX [이용 안내](https://cloudless.eox.at/documentation/faq)와 [2016 데이터 설명](https://eox.at/2017/03/sentinel-2-cloudless-original-tiles-available/)을 참고한다. 스크린샷·영상 내보내기에도 출처를 포함해야 한다.

두 무료 타일 서비스는 SLA가 없으며 이용 제한·연결 오류가 있을 수 있다. 실패 시 바닥을 유지하고 사용자에게 오류와 `retry()`를 제공한다. 다른 공급자로 대체할 때 `providers` 옵션에 `{url(z,x,y), maxZoom, attribution}`을 넣되 해당 제공자의 이용 허가와 표기를 별도로 확인한다. 타일은 CORS 지원이 필요하며 브라우저 `fetch`와 `createImageBitmap`을 사용한다. 인증키는 코드에 추가하지 않는다.

## 통합 예

출처 요소는 반드시 지도가 보이는 동안 읽을 수 있는 크기로 지도 안에 표시한다. CSS로 숨기거나 화면 밖에 두지 않는다.

```js
import { createBasemapLayer } from './basemapLayer.js';
const credit = document.createElement('div');
credit.className = 'map-attribution';
mapContainer.appendChild(credit);
const map = createBasemapLayer({
  scene, attributionElement: credit,
  height: 0.03, // 바닥 면 및 다른 기하와 깊이 충돌을 피하도록 조정
  invalidate: requestRender,
  onStatus: ({ loaded, total, failed }) => {
    // failed > 0이면 사용자에게 재시도 UI를 표시한다.
  },
});
map.setProvider('ground');  // 'satellite' 또는 null(끔)
function refreshMap() {
  map.update(camera, { width: renderer.domElement.clientWidth,
                       height: renderer.domElement.clientHeight,
                       mode: 'local' }); // 'seoul'로 전환 가능
}
controls.addEventListener('change', refreshMap);
refreshMap();
// 실제 서울 시각에 따른 어두워짐을 따로 계산한 경우 지도에도 적용 가능.
map.setBrightness(0.7); // 0–1, 기본 1
// 보기 해제 시: controls.removeEventListener('change', refreshMap); map.dispose();
```

카메라 절두체와 지정 높이의 평면을 교차해 보이는 지면 다각형을 계산한다. 다각형과 겹치는 타일만 요청하며 한 화면 최대 24개, 동시 요청 최대 4개다. 자세한 시점에서 타일 수가 많으면 줌을 낮춘다. 시점 변경 시 화면 밖 요청을 중단하고 타일의 GPU 자원과 이미지 비트맵을 해제한다. 반복된 동일 화면 갱신은 추가 요청이나 불필요한 렌더 루프를 만들지 않는다. `mode` 전환은 기존 타일을 지운 뒤 새 축으로 다시 배치한다.

회관 장면은 `x = 북쪽 − 552531, z = 동쪽 − 197897`, 서울 개요는 `x = 동쪽 − 200000, z = 550000 − 북쪽`이다. 타일 네 꼭짓점은 Web Mercator에서 경위도로 바꾼 뒤 GRS80/EPSG:5186으로 투영한다. 지도 요청은 한반도 전체와 주변 여백인 경도 120–135도, 위도 29–44도로 제한한다. 화면의 일부가 이 범위를 벗어나도 겹치는 부분만 표시한다. 아주 넓은 시점에서는 저배율 타일의 경계와 내부를 격자로 나누어 투영하므로 전국 화면의 곡률 오차를 줄인다. 이 표시는 정밀 측량 대체물이 아니다. 화면 밖, 하늘만 보이는 카메라에서는 요청하지 않는다.

## 검증

```powershell
node --test tests/basemap-projection.test.js tests/basemap-layer.test.js
# Vite 서버를 포트 4177에 띄운 뒤 Playwright와 Chrome 경로를 지정:
$env:PLAYWRIGHT_PATH='<로컬 경로>'
$env:CHROME_PATH='C:\Program Files\Google\Chrome\Application\chrome.exe'
node tests/basemap-render.cjs
```

QGIS/GDAL의 회관·부산·제주·광주·독도·북부 등 전국 기준점에서 순변환 최대 오차 약 0.002m, 두 장면 축 왕복, 화면 밖 요청 취소, 재시도, 실패·지연 응답 폐기, 출처 표기, 중복 렌더 방지를 검사했다. 별도 WebGL 검사는 모의 색상 타일의 상하좌우 방향을 광화문·서울 축 모두에서 실제 픽셀로 검증하고, 저배율 전국 시점의 영상 표시도 확인한다. 한반도 범위 밖에서는 요청하지 않고 기존 타일을 해제한다. 2026-11-04 브라우저에서 각 제공처의 서울 타일 1개를 CORS 요청하여 HTTP 200과 256×256 이미지 디코딩을 확인했다. 공급처 가용성이나 실제 모바일 성능을 보증하지 않는다.
