# 백지도와 서울 주변 지면 자료 내보내기

## 산출물과 좌표

사용자가 제공한 `CH_D010_00_20261103/디지털소축척지도_대한민국전도/대한민국전도_.gpkg`를 읽기 전용으로 사용했다. QGIS 프로젝트 `대한민국전도.qgz`가 이 GeoPackage를 참조한다. 원본은 수정하지 않는다. SHA-256은 `public/gis/manifest.json`의 `sourceSha256`에 기록한다. QGIS 3.44.15, GDAL 3.13.3으로 생성했다.

| 파일 | 내용 | 압축 크기 | 비압축 크기 |
| --- | --- | ---: | ---: |
| `public/gis/national-admin.json.gz` | 시도 30개·시군구 백지도 3,176개 폴리곤 | 약 0.98MB | 약 3.32MB |
| `public/gis/seoul-ground.json.gz` | 서울 인근 행정선·하천·국도·철도 43,668개 선 | 약 2.38MB | 약 32.37MB |
| `public/gis/manifest.json` | 원본 해시, 좌표계, 레이어 건수, 정확한 크기와 압축 해시 | 2KB 내외 | - |

두 압축 파일의 형식은 GeoJSON `FeatureCollection`이지만 좌표는 경위도가 아닌 **EPSG:5186 미터 `[동쪽, 북쪽]`**이다. 각 feature의 `id`는 `원본 레이어명:FID`, `properties`는 `layer`, `fid`, `fields`를 갖는다. 원본의 나머지 속성은 그대로 남기되 제공자 컴퓨터 경로가 들어 있는 `path` 필드는 공개하지 않는다. 좌표는 0.1m 단위로 기록한다. 전국 폴리곤은 위상 보존 방식으로 50m, 서울 선형은 5m 단순화했다. 원본 자체가 소축척이므로 정밀 위치가 필요한 지적 측량·경계 판정에는 사용할 수 없다.

서울 데이터는 EPSG:5186 범위 `[175000, 525000, 225000, 575000]`으로 자르고, 레이어별 원본 좌표계에서 변환한다. `시도_백지도`, `시군구_백지도_`, `행정경계`, `특별광역자치시도경계`, `해안선`, `실폭하천`, `고속국도`, `일반국도`, `지방도`, `고속철도`, `일반철도`를 사용했다. 지정 서울 범위에는 원본 해안선이 없어 건수가 0이다. 서울 주변 도로는 전국 지도의 도로 레이어 중 잘라낸 것으로 모든 골목길을 포함하지 않는다.

시군구 레이어는 섬 등의 개별 조각을 포함하고 이름이 반복된다. **원본에서 서울은 자치구 폴리곤이 아니라 `서울특별시` 전체로 제공된다.** 서울 인근 `행정경계` 레이어는 이름 속성 없는 선이다. 따라서 이 자료만으로 서울 25개 자치구·법정동의 이름 또는 완전한 상세 경계를 식별할 수 없다. 전국 범위에는 한반도 북부도 포함된다.

## 웹에서 사용

Vite의 `public`에서 `/gis/manifest.json`, `/gis/national-admin.json.gz`, `/gis/seoul-ground.json.gz` 경로로 제공한다. 데이터는 전역에서 한 번에 불러오기보다 관련 보기에서만 지연 로딩한다. 서울 데이터는 압축 해제 후 약 32MB이므로 파싱과 표시 비용을 고려해야 한다. 다음 예시는 서버가 gzip 파일을 원본으로 보내거나 이미 HTTP 압축 해제해 보낸 경우를 모두 처리한다.

```js
async function loadOverview(path) {
  const response = await fetch(path);
  if (!response.ok) throw new Error(`지도 자료 요청 실패: ${response.status}`);
  const bytes = new Uint8Array(await response.arrayBuffer());
  const compressed = bytes[0] === 0x1f && bytes[1] === 0x8b;
  const raw = compressed
    ? await new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer()
    : bytes;
  return JSON.parse(new TextDecoder().decode(raw));
}
const data = await loadOverview('/gis/national-admin.json.gz');
// 서울 장면: x = 동쪽 − 200000, z = 550000 − 북쪽
```

## 재생성과 검증

Windows QGIS 설치 시 저장소 루트에서 실행한다. 데이터 경로는 실제 위치에 맞게 지정한다.

```powershell
& 'C:\Program Files\QGIS 3.44.15\bin\python-qgis-ltr.bat' scripts/export_overview_gis.py --input '<자료 폴더>\CH_D010_00_20261103\디지털소축척지도_대한민국전도\대한민국전도_.gpkg'
node --test tests/gis-overview.test.mjs
```

내보내기에는 GDAL Python 바인딩과 GEOS가 필요하다. `--output`으로 출력 폴더를 바꿀 수 있다. 테스트는 파일 해시, 레이어 건수, 속성, 좌표 유한성·서울 클립 범위, 세종문화회관 좌표의 서울 폴리곤 포함 여부를 검사한다. 압축 파일 각각 20MiB를 넘으면 생성이 실패한다. 이 검사는 실제 행정경계의 최신성이나 사용 권리를 증명하지 않는다.

## 출처 및 이용 한계

제공 GeoPackage의 관련 레이어 메타데이터에서는 원저작자·원출처 URL·제작일·사용허가가 명확하게 확인되지 않았다. 파일명이나 유사 데이터만을 근거로 특정 기관의 자료 또는 공공누리 유형이라고 단정할 수 없다. 본 산출물은 **사용자 제공 QGIS 자료에서 변환한 소축척 시각화 자료**로 표기하고, 공개 재배포·사용 조건은 원본 배포처에 확인해야 한다. 영상지도나 위성영상은 이 데이터에 포함되어 있지 않다.

2026-11-04에 같은 입력으로 별도 폴더에 재생성한 세 파일은 SHA-256이 모두 일치했다. 출력 도형 전체에 대한 GDAL/GEOS 유효성 검사에서도 무효 도형은 없었다.
