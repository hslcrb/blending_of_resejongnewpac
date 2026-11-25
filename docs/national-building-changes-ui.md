# 전국 건물 변경 자료 조회

`CH_D010_00_20261103`의 2026-11-03 신규(I)·수정(U) 건물 변경분입니다. 현재 전국의 전체 건물 목록이 아니며 삭제(D)는 제외합니다. 원본의 법정동·지번, 건물명, 변경 유형과 A0–A30의 모든 원본 값을 표시합니다. 원본 숫자 범위 초과 표기(`*********`)를 그대로 보존합니다. 주소는 도로명 주소가 아닙니다. 출처의 권리·재배포 조건은 별도 확인이 필요합니다.

돋보기로 지점을 고르거나 전국 문화시설 후보를 선택하면 주변 25·75·150m의 실제 폴리곤 내부 또는 경계까지의 거리로 변경 건물을 찾습니다. 전시천리안에서는 현재 중심 주변을 조회하고 전국 분포는 10km 격자 중심별 건수를 나타냅니다. 격자점은 개별 건물 위치가 아닙니다. 전시천리안의 분홍색 점은 개별 변경 건물의 중심점이며, 광화문에서는 해당 범위만, 서울·전국 모드에서는 전국 점을 표시합니다. 확대하면 현재 선택 지점 주변에서 타일로 읽은 이름과 지번을 다른 레이블과 겹치지 않는 한 최대 25개까지 표시합니다. 줌을 올려도 겹치는 레이블은 생략하므로 돋보기로 지점을 선택해 원본 31개 필드를 확인하세요. 폴리곤은 목록의 거리 판단에만 쓰며 입면·층수 등 3D 건물을 생성하지 않습니다.

`/gis/national-building-changes/manifest.json`과 `/gis/national-building-changes/<e>_<n>.json.gz`를 요청합니다. manifest에 있는 최장 도형 폭에 반경과 반올림 여유 0.2m를 더해 후보 타일을 선택합니다. 이로써 타일 경계 건물도 찾습니다. gzip과 서버가 이미 압축을 해제한 응답을 모두 처리합니다. 캐시되지 않은 후보는 최대 36타일·8MiB까지만 자동 요청하며 동시 요청은 4개입니다. 초과 시 오류를 표시하고 반경을 줄이도록 안내합니다. 선택이 바뀌면 이전 요청을 중단하며 목록과 오류를 지웁니다. 실패하면 다시 불러올 수 있습니다. 전국 분포는 manifest만 사용합니다.

검증: `node --test tests/national-building-store.test.js`, Vite 실행 후 `node tests/national-building-ui-browser.cjs`. 원본 전체 변환·정합성은 데이터 생성 브랜치의 문서를 참조합니다. 브라우저에서 데이터가 보이려면 해당 데이터 디렉터리를 함께 배포해야 합니다.


## 전시천리안 점 인덱스

`points.bin.gz`는 97,891개 I/U 변경 건물의 FID와 EPSG:5186 중심점을 0.1m 정밀도로 저장합니다. 2026-11-04 생성본은 gzip 756,950바이트이며 상세 원본 필드는 들어있지 않습니다. NBP1 형식은 4바이트 서명, little-endian uint32 개수, 이어서 `[uint32 FID, int32 동쪽 좌표 0.1m, int32 북쪽 좌표 0.1m]` 순서입니다. 서울 및 광화문 축에 맞게 브라우저에서 변환하며 로딩과 GPU 자료는 전시천리안을 켰을 때에만 사용하고 종료 시 정리합니다. 광역 줌에서는 점만 그리고 상세 레이블은 고도와 충돌에 따라 생략합니다. 실패 시 전시천리안을 끄고 다시 켜 재시도할 수 있습니다.

```powershell
python scripts/build_national_building_points.py --input public/gis/national-building-changes --output public/gis/national-building-changes/points.bin.gz
python scripts/verify_national_building_points.py --input public/gis/national-building-changes --index public/gis/national-building-changes/points.bin.gz
python tests/national_building_points_test.py
node --test tests/national-building-points.test.js
```

생성기는 타일의 SHA-256·압축 크기·레코드 수·FID 유일성을 검사하고 고정 gzip 시간으로 재현 가능한 결과를 만듭니다. 별도 검증기는 모든 타일의 모든 FID와 좌표를 인덱스에 일대일로 대조합니다. 타일이 갱신되면 인덱스를 다시 생성·검증해 함께 배포해야 합니다.
