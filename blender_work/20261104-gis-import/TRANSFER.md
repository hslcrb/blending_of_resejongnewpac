# 2026-11-04 세종·서울 GIS 자료 이관

`renewsejongpac/gis-sejong`의 Blender 작업본 3개, QGIS 프로젝트와 상대경로 GeoPackage, 스크립트 및 증거 파일을 이 폴더에 보존했다. 원본 사용자 자료는 변경하지 않았다. `public/area`에는 기존 웹이 쓰는 서울 격자·광화문 GLB·건물 위치·속성 타일·검색 색인을 같은 구조로 복사했다. 737개 파일을 SHA-256으로 원본과 비교했다. Python 캐시는 복사하지 않았다.

생성·검증 스크립트의 새 저장소 경로와 안전한 실행 방법은 [REPRODUCTION.md](REPRODUCTION.md)를 따른다. 입력은 읽기 전용으로 열고 생성 결과는 추적되지 않는 `.gis-runs`의 새 경로에만 쓴다. QGIS 프로젝트는 같은 폴더의 `seoul-grid-50m.gpkg`가 필요하다. 이미지와 링크는 Blender 파일 안에 패킹돼 있다.

원본 GIS 출처·정확도 및 데이터 필드는 `web/BUILDING-DATA.md`, `web/README.md`, `seoul/README.md`와 상위 통합 계획을 참고한다. 이전 `renewsejongpac` 파일은 새 서비스와 연결이 검증될 때까지 보존한다.
