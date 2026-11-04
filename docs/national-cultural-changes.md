# 전국 문화·집회 용도 건물 변경분: 데이터 계약과 검증

## 범위와 한계

사용자가 제공한 `CH_D010_00_20261103` SHP/DBF는 2026-11-03 이름의 **건축물 변경분**이다. 총 97,984행 중 수정 U 97,827, 신규 I 64, 삭제 D 93이다. 이는 전국의 현재 전체 건축물 목록이 아니다. A29가 I/U이고 용도 코드 A8이 `05000`·`Z5000`이거나 용도명 A9에 `문화`·`집회`가 들어간 347개 후보(수정 345, 신규 2)를 추출했다. 삭제와 알 수 없는 변경 유형은 표시하지 않는다. 이용 시점에 이미 변경되었을 수 있고, 실제 운영 중인 문화시설이나 이용 가능한 공연장으로 확인된 목록도 아니다. A8/A9 분류는 다른 유형의 건물을 포함하거나 누락할 수 있다.

347개 중 이름 A24가 있는 행은 180개다. 행정 코드 A30의 첫 두 자리 기준으로 13종만 포함돼 모든 시도를 포괄하지 않는다. 이름이 없으면 `건물명 미기재`, 미포함 지역은 `이 자료에 후보 없음`으로 표시한다. A4 법정동명과 A5 지번은 지번 주소로, 도로명 주소가 아니다. 데이터의 정확한 배포 출처·이용 조건은 확인되지 않았다. 실운영 여부는 별도 공식 시설 정보나 현장 확인을 거쳐야 한다.

## 브라우저 데이터 형식

`public/data/national-cultural-changes.geojson`은 269,556바이트 GeoJSON FeatureCollection이다. 각 `Feature.id`와 `properties.sourceFid`는 원본 SHP 행 번호이며 `properties.fields`에 `A0`부터 `A30`까지 원본 31개 필드를 **문자열 또는 null**로 둔다. 문자열 `"0"`은 결측이 아니다. 값 안에 `*`가 포함된 숫자 필드는 DBF의 범위 초과 표기이므로 값을 계산에 사용하지 않고 `원본 범위 초과`와 함께 원문을 보여준다. 실제 후보 중 A27 132개, A15 111개, A17 111개, A18 112개, A16 27개, A26 2개에 별표가 있다. 어떤 필드도 부동소수점으로 변환하지 않았다.

주요 필드: A4 법정동명, A5 지번, A8 용도 코드, A9 용도명, A16 높이, A24 건물명, A26·A27 지상·지하층 수, A28 데이터 생성·변경일, A29 변경 유형, A30 시군구 코드. A0~A28 명칭은 유사한 [국가교통DB 보고서의 GIS 건물 필드 표](https://www.ktdb.go.kr/DATA/pblcte/20250805093928585.pdf)를 참조했으나 원본의 명세 버전과 일치하는지는 미확인이다. A29·A30은 제공된 변경 자료의 내용에서 파악한 이름이다. 텍스트 렌더링은 HTML 문자열 연결 대신 안전한 텍스트 노드를 사용한다.

GeoJSON의 좌표는 `[경도, 위도]` EPSG:4326이며 원본 EPSG:5186 폴리곤 내부 대표점을 변환한 것이다. 경계·실제 출입구·건물 형태를 나타내지는 않는다. 좌표를 7자리 소수로 반올림했다. 변환할 수 없는 도형이 있으면 `geometry: null`로 보존하며 지도에 표시하지 않고 목록에는 남긴다. 별도 `national-cultural-manifest.json`은 대상·필드 스키마·검증 수치·파일 SHA-256과 결측/오류 FID를 제공한다. 이 자료에는 위치 결측, 무효 도형, 넓은 국내 범위 밖 대표점이 각각 0건이었다. 넓은 범위 검사는 실제 행정구역 소속의 증거가 아니다.

```js
const response = await fetch('/data/national-cultural-changes.geojson');
if (!response.ok) throw new Error('전국 변경 자료를 불러오지 못했습니다');
const collection = await response.json();
for (const feature of collection.features) {
  const f = feature.properties.fields;
  const name = f.A24 || '건물명 미기재';
  const address = [f.A4, f.A5].filter(Boolean).join(' ') || '지번 주소 미기재';
  // geometry가 null이면 목록에서만 표시. I/U도 검증된 영업 상태가 아님.
}
```

## 생성과 재검증

원본을 수정하지 않고 QGIS에 포함된 GDAL Python을 사용한다. 다른 OS의 QGIS Python에서도 같은 스크립트를 실행할 수 있다.

```powershell
$env:PYTHONUTF8='1'
& 'C:\Program Files\QGIS 3.44.15\bin\python-qgis-ltr.bat' scripts/build_national_cultural.py --source '<로컬 경로>' --output public/data
& 'C:\Program Files\QGIS 3.44.15\bin\python-qgis-ltr.bat' scripts/validate_national_cultural.py --source '<로컬 경로>' --data public/data/national-cultural-changes.geojson
python -m unittest tests/national_cultural_test.py
node --test tests/national-cultural-data.test.mjs
```

SHP·SHX·DBF·PRJ·CST 파일은 원래 순서와 동일한 이름으로 함께 있어야 한다. DBF 원문은 EUC-KR로 엄격하게 읽고 필요하면 CP949를 엄격 적용하며, 둘 다 불가능하면 실패한다. 좌우 패딩 공백·끝의 NUL을 제거하고 내부 NUL은 보존한다. 소스 파일 해시, 파일별 크기와 검출된 확장 문자·오버플로는 manifest에 기록한다. 2026-11-04 실행에서 후보 전체 347건의 31필드가 원본 DBF와 일치하고 대표점이 원본 도형 내부에 있음을 별도 스크립트로 검증했다. 원본 SHP와 DBF는 대용량이므로 저장소에 복사하지 않았다.
