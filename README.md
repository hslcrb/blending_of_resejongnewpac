# 세종문화회관 건축 둘러보기

제공된 사진과 대극장 종단면 도면을 바탕으로 Blender에서 제작한 세종문화회관 외관 모델과 React 3D 뷰어입니다. 종단면의 전면·후면 기준선 간 거리 112.5m와 객석·무대 지붕 높이를 매스 배치에 참고했습니다. 정면 전체 폭과 도면에 나타나지 않은 세부는 사진의 비례에 따른 추정이며, 부조와 가려진 부분은 해석을 포함합니다. 정밀 실측 모델은 아닙니다.

도면의 지면 기준으로 객석 지붕 +35.060m, 무대 파라펫 +45.045m를 매스에 참고했습니다. 녹청 지붕의 마루 높이 +37.2m와 길이, 정면 전체 폭은 사진과 배치도에 근거한 추정입니다. 변환된 DWG의 일부 객체 이름에 경고가 있어 수치는 원본 도면과 교차 확인이 필요합니다. 112.5m는 기준선 사이의 길이이며 전체 외피 길이와 같다고 단정하지 않습니다.

## 실행

```sh
npm ci
npm run dev
```

`npm run build`는 Cloudflare Pages에 배포할 `dist` 디렉터리를 만듭니다. `main` 브랜치의 변경은 GitHub에 연결된 Cloudflare Pages에서 빌드합니다.

현재 Blender 작업본은 `blender_work/20261103/sejong_aerial_streaming_20261103.blend`입니다. 이전 작업본과 `public/model/`의 원본들은 보존했습니다. 웹은 `public/model/streaming-manifest.json`의 기본 외형을 먼저 불러오고, 거리와 화면 크기에 맞춰 정원·실내·주변 상세 GLB를 추가로 받습니다. 반복되는 수목 형상은 공유 버퍼 3개로 재사용합니다. `?environment=legacy`는 이전 단일 모델을 유지합니다.

항공사진을 참고해 별관 지붕의 앞뒤 길이를 본관의 약 50%로 늘리고 뒤 정원에 굽은 화단·벽돌 보행 공간과 수목을 보강했습니다. 이 비례와 위치는 사진에 따른 근사이며 실측값이 아닙니다. `scripts/build_sejong.py`는 이전 모델을 재생성하므로 현재 MCP 수정본을 덮어쓰는 용도로 사용하지 마세요. 부조·화면·현수막과 새 포장·석재 무늬는 직접 제작했으며 사진에서 잘라 쓰지 않았습니다.

사진 원본과 요청 기록은 [제작 브리프](docs/brief.md)와 [요청 원문](docs/references/user-requests-verbatim.md)에, 답사 149장 검토와 수작업 상세는 [11월 3일 기록](docs/sitevisit-mcp-20261103.md)에 정리했습니다. [항공 비례와 웹 연결](docs/sitevisit-aerial-web-20261103.md), [GLB 검증](docs/sitevisit-review/20261103-glb-verification.md), [웹 공간 로딩](docs/sitevisit-lazy-loading-20261103.md)에 이번 변경의 구현·검증 범위를 기록했습니다. 걷기 모드의 로비와 가려진 실내는 사진으로 완전히 검증된 복원이 아니라 해석을 포함합니다.

## 서울 시각과 기상 관측

웹 하늘은 서울 시각·날짜를 이용한 [NOAA 태양 위치 근사식](https://gml.noaa.gov/grad/solcalc/solareqns.PDF)으로 1분마다 바뀐다. 구름 밀도는 [NOAA 항공기상 API](https://aviationweather.gov/data/api/)의 김포공항(RKSS) 최신 관측 범주를 이용하며, 공항과 광화문의 위치가 다르므로 현장 기상과 일치한다고 주장하지 않는다. 관측 시각을 화면에 표시하고, 2시간보다 오래된 관측이나 요청 실패는 알 수 없는 상태로 처리해 임의 구름 사용을 밝힌다.

NOAA API는 브라우저 CORS를 지원하지 않아 Cloudflare Pages Function `/api/weather`가 단일 공항 관측을 가져온다. 10분 캐시로 요청을 줄이고 오래된 응답은 제공하지 않는다. Vite 개발 서버에는 Pages Function이 없으므로 로컬 화면은 기상 실패 대체 상태가 정상이다. 실제 운영 경로와 날씨 출처 응답은 배포 후 별도 확인한다. 과거 프로젝트의 Blender 파일은 `blender_work/20261104-gis-import/sky/README.md`에 기록된 24시간 키프레임과 수동 실행 스크립트를 보존한다.
