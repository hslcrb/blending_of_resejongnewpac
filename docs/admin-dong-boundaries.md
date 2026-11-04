# 행정동·서울 자치구 경계 (2026-10-01)

## 범위와 출처

`public/gis/admin-dong/`은 [vuski/admdongkor의 2026-10-01 행정동 경계](https://github.com/vuski/admdongkor/tree/d5d5a821c8de6cc337d47eeca604d7af76271c9b/ver20261001)를 분할한 자료다. 배포자는 SGIS 센서스용 행정동 경계를 바탕으로 경계·변경 이력을 보정한 자료라고 밝힌다. 따라서 행정기관의 원본 파일 자체가 아닌 **제3자 가공자료**다. 좌표는 WGS84 EPSG:4326 `[경도, 위도]`이며 2026-10-01 기준이고 이후 변경이나 실제 경계와 차이가 있을 수 있다.

[SGIS 공식 자료 목록](https://sgis.mods.go.kr/view/pss/openDataIntrcn)은 시도·시군구·읍면동 센서스용 경계를 제공한다고 안내하며, [공식 안내](https://sgis.mods.go.kr/view/pss/dataProvdIntrcn)는 법정동 경계가 아닌 행정동 경계임을 명시한다. **행정동은 법정동 주소 경계나 지적·필지 경계가 아니다.** 건물의 A4 법정동 주소 및 A30 변경 시점 코드와 일치한다고 가정하거나 법적 위치 판단에 쓰면 안 된다.

### 라이선스와 표시

가공자료의 [LICENSE-DATA](https://github.com/vuski/admdongkor/blob/d5d5a821c8de6cc337d47eeca604d7af76271c9b/LICENSE-DATA)는 CC BY 4.0으로 배포하며 SGIS 출처와 저장소 표시를 요구한다. 원저작자는 SGIS 원자료의 공공누리 제1유형 출처 표시 의무를 명시한다. [SGIS 저작권 정책](https://sgis.mods.go.kr/jsp/member/copyright.jsp)은 개별 자료에 해당 표시가 붙었는지 확인하도록 안내하며, 이 작업에서는 SGIS 개별 원본의 라이선스 배지를 직접 확인하지 못했다. 제품에서 이 자료를 표시할 때 다음 출처와 [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) 링크, 가공 사실을 함께 표시한다.

> 출처: 국가데이터처 통계지리정보서비스(SGIS, https://sgis.kostat.go.kr); 가공: vuski/admdongkor(https://github.com/vuski/admdongkor), CC BY 4.0; 추가 가공: 광역별 분할 및 서울 자치구 경계 병합.

출처·라이선스·기준일은 각 압축 GeoJSON의 `metadata`와 별도 `manifest.json`에도 들어 있다.

## 파일과 인터페이스

- `manifest.json`: 16개 광역 단위 목록, 파일명·개수, 압축 파일 SHA-256, 출처·기준일·좌표계. 원본의 3,559개 행정동을 광역 코드 `sido`별로 빠짐없이 나눴다. 2026-07 전남·광주 통합을 반영한 원본 코드 `12`가 있으므로 별도 자료의 2026년 이전 광역코드와 단순 문자열 결합하지 않는다. [행정안전부 통합 안내](https://mois.go.kr/video/bbs/type019/commonSelectBoardArticle.do?bbsId=BBSMSTR_000000000255&nttId=126940).
- `regions/<sido>.geojson.gz`: 행정동 원본 GeoJSON. 폴리곤·멀티폴리곤과 일곱 원본 속성 `adm_nm`, `adm_cd`, `adm_cd2`, `sgg`, `sggnm`, `sido`, `sidonm`을 변경하지 않았다. 이름 `adm_nm`은 전체 경로를 포함한다. 서울은 `regions/11.geojson.gz` 427건이다.
- `seoul-districts.geojson.gz`: 서울 25개 자치구를 원본 행정동 도형들의 합집합으로 생성한 자료. 속성 `code`, `name`, `sourceDongCount`, `sourceRegion`은 새로 생성했으며 원본 단독 시군구 도형이 아니다.
- `seoul-validation.json`: 원본 도형·속성 보존, 서울 자치구 합집합과 이름 대조 결과. 가장 큰 gzip은 1,706,749바이트로 Cloudflare Pages의 파일당 25 MiB 미만이다.

브라우저에서 먼저 `manifest.json`을 읽어 필요한 지역만 가져온다. 웹서버가 gzip 파일을 그대로 전달하거나 전송 중 자동 해제할 수 있으므로 실제 바이트를 검사한다. 경계 표시 UI에는 위 출처 문구와 기준일을 함께 보여야 한다.

```js
async function readBoundary(url, signal) {
  const response = await fetch(url, { signal });
  if (!response.ok) throw new Error('경계 자료를 불러오지 못했습니다');
  const bytes = new Uint8Array(await response.arrayBuffer());
  const stream = new Blob([bytes]).stream();
  const decoded = bytes[0] === 0x1f && bytes[1] === 0x8b
    ? stream.pipeThrough(new DecompressionStream('gzip')) : stream;
  return new Response(decoded).json();
}
// const seoul = await readBoundary('/gis/admin-dong/regions/11.geojson.gz');
// const districts = await readBoundary('/gis/admin-dong/seoul-districts.geojson.gz');
```

3D 장면의 EPSG:5186 미터 좌표와 혼용할 수 없으므로 투영 변환이 필요하다. 이 파일 추가만으로 지도나 돋보기에 경계가 나타나는 것은 아니다. 렌더러는 행정동 이름·25개 자치구 경계, 해당 시점·출처·법정동과의 차이를 실제 화면에 연결하고 요청 실패·좁은 화면을 확인해야 한다.

## 재생성 및 검증

QGIS Python과 GEOS가 필요하다. 원본은 고정 커밋의 파일 SHA-256을 검증하고 불일치 시 중단한다. 소스 34.7 MB는 작업 시에만 받으며 저장소에는 분할 결과만 포함한다.

```powershell
New-Item -ItemType Directory -Force -Path data-source | Out-Null
curl.exe -fL -o data-source/HangJeongDong_ver20261001.geojson 'https://raw.githubusercontent.com/vuski/admdongkor/d5d5a821c8de6cc337d47eeca604d7af76271c9b/ver20261001/HangJeongDong_ver20261001.geojson'
curl.exe -fL -o data-source/seoul-autonomy.html 'https://www.seoul.go.kr/seoul/autonomy_sub.do'
$env:PYTHONUTF8='1'
& 'C:\Program Files\QGIS 3.44.15\bin\python-qgis-ltr.bat' scripts/build_admin_dong.py --source data-source/HangJeongDong_ver20261001.geojson --output public/gis/admin-dong
& 'C:\Program Files\QGIS 3.44.15\bin\python-qgis-ltr.bat' scripts/validate_admin_dong.py --source data-source/HangJeongDong_ver20261001.geojson --output public/gis/admin-dong --seoul-reference data-source/seoul-autonomy.html
node --test tests/admin-dong.test.mjs
```

2026-11-04 검증에서 원본 3,559건의 속성과 좌표가 분할 결과와 전부 같았으며 GEOS 도형 유효성 및 넓은 국내 좌표 범위를 통과했다. 서울 동 427건이 각 자치구 합집합에 포함됐다. [서울시 공식 자치구별 동 현황](https://www.seoul.go.kr/seoul/autonomy_sub.do) 427개 이름과 대조 시 띄어쓰기, `제`, 구분점·쉼표, `洞`/`동` 표기만 정규화하면 일치했다. 이는 이름과 도형 보존 검사이지 지적 정확도나 현장 측량 검증이 아니다. 대조한 공식 HTML의 SHA-256은 `seoul-validation.json`에 기록했다. 공식 웹 페이지의 구성이나 기준이 바뀌면 재검증이 실패할 수 있으며 그 경우 변경 이력을 직접 확인해야 한다.
