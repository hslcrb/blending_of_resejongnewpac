# GIS·QGIS·Blender 재생성: 새 저장소 경로와 안전 규칙

기존 `renewsejongpac/gis-sejong`에서 옮긴 스크립트를 `blender_work/20261104-gis-import`와 새 서비스의 `public/area`를 기준으로 실행한다. 아래 실행은 원본 사용자의 SHP와 DBF, 기존 Blender 파일, `public/area`의 배포 자산을 **읽기 전용**으로 다룬다. 생성 결과는 저장소의 `.gis-runs/` 아래에만 쓸 수 있다. 이 폴더는 Git에서 무시한다. 출력 파일이나 폴더가 이미 있으면 실행을 거부한다. QGIS의 스타일·인증 캐시도 새 `.gis-runs/qgis-profile-*`에 격리하며 실패로 남은 결과는 새 경로를 선택해 다시 실행한다. 직접 배포 자산을 덮어쓰거나 검증된 Blender 파일을 자동으로 바꾸지 않는다.

다음 PowerShell 예시에서 `$source`는 사용자가 제공한 실제 `AL_D010_11_20261009.shp` 경로로 바꾼다. SHP, SHX, DBF, PRJ를 원래 위치에 함께 둔다. `--limit 100`은 작은 표본 검사이며 전국·서울 전체 건수를 의미하지 않는다. 전체 생성은 `--limit`을 생략하고 새 빈 실행 경로를 지정한다. 경로는 저장소 루트 기준이다.

```powershell
$source = 'C:\path\to\AL_D010_11_20261009.shp'
$base = 'blender_work/20261104-gis-import'
$run = '.gis-runs/example-20261104'
$qgis = 'C:\Program Files\QGIS 3.44.15\bin\python-qgis-ltr.bat'
$blender = 'C:\Program Files\Blender Foundation\Blender 5.2\blender.exe'
$env:PYTHONUTF8 = '1'
$env:QT_QPA_PLATFORM = 'offscreen'

# 29개 원본 필드의 표본 타일 → 투사 점 → 검색 색인.
& $qgis -B "$base/web/export_buildings.py" $source --output "$run/area/buildings" --limit 100
python -B "$base/web/export_building_points.py" --buildings "$run/area/buildings" --output "$run/area/building-points.bin"
python -B "$base/web/export_building_search.py" --buildings "$run/area/buildings" --output "$run/area/building-search"
& $qgis -B "$base/web/validate_buildings.py" $source --area "$run/area"
python -B "$base/web/validate_search.py" --area "$run/area"

# 서울 격자 집계·웹 자료. 웹 자료는 이관된 전체 집계에서 생성한다.
& $qgis -B "$base/seoul/aggregate_seoul.py" $source --output "$run/seoul-grid-sample.json.gz" --limit 100
python -B "$base/web/export_city.py" --output "$run/seoul-grid.json"

# 기존 QGIS 프로젝트 읽기 전용 확인. 새 프로젝트를 만들면 출력 폴더가 새로워야 한다.
& $qgis -B "$base/seoul/validate_project.py"
& $qgis -B "$base/seoul/export_qgis.py" --source "$run/seoul-grid-sample.json.gz" --output-dir "$run/qgis"
# 표본의 격자 수에 맞춰 --expected-cells를 바꾼다.
& $qgis -B "$base/seoul/validate_project.py" --project "$run/qgis/seoul_overview.qgz" --expected-cells 48

# 기존 회관 파일에서 GLB를 새 경로에 내보내기.
& $blender -b --python-exit-code 1 --python "$base/web/export_sejong.py" -- --source "$base/web/sejong_web_source.blend" --output "$run/sejong.glb"

# 서울 개요와 서울시간 하늘은 각각 별도의 새 Blender 파일로 저장한다.
& $blender -b --python-exit-code 1 --python "$base/seoul/build_seoul_overview.py" -- --source "$run/seoul-grid-sample.json.gz" --output "$run/seoul-sample.blend"
& $blender -b --python-exit-code 1 --python "$base/sky/install_sky.py" -- --source "$run/seoul-sample.blend" --output "$run/seoul-sky.blend"
& $blender -b --python-exit-code 1 --python "$base/sky/validate_sky.py" -- "$run/seoul-sky.blend"
```

`build_west_context.py`, `build_south_context.py`, `build_east_reference.py`도 `blender -b --python-exit-code 1 --python <스크립트> -- --source <입력.blend> --output .gis-runs/<새파일.blend>` 형식이다. 단계마다 별도 입력·출력 파일을 지정한다. 각 컬렉션이 이미 있는 장면에 다시 적용하면 중복을 거부한다. 동·서·남 데이터는 스크립트 옆의 이관된 GeoJSON을 읽는다. 스크립트는 백그라운드 Blender에서만 실행되며 사용자가 열어 둔 GUI 장면을 변경하지 않는다.

`export_qgis.py`는 GPKG와 QGZ를 같은 새 폴더에 만들고 QGIS의 상대경로 저장을 명시한다. 폴더를 다른 위치로 복사할 때 두 파일을 함께 옮긴다. `validate_project.py --project <경로> --expected-cells <수>`는 이동 후 유효성·레이어 수·EPSG:5186을 검사한다. 기본 입력은 이관된 프로젝트이며 123,626 셀이다.

## 실행 확인 (2026-11-04)

- 실제 SHP 처음 100건으로 12개 건물 타일·100개 투사 점·4개 검색 구역을 만들고 원본 29개 속성 표본, 좌표와 전체 검색 색인 대조에 통과했다. 전체 695,753건 재생성은 이번 실행 범위가 아니다.
- 이관된 전체 50m 집계를 새 `seoul-grid.json`으로 내보내 기존 `public/area/seoul-grid.json`과 JSON 내용을 비교해 일치했다. 100건 표본으로 48개 셀을 집계하고 QGIS 프로젝트를 생성해 다른 폴더에 복사한 뒤 상대경로와 48개 셀을 확인했다. 기존 프로젝트의 123,626개 셀도 확인했다.
- 별도 빈 Blender 장면 사본에 서쪽 28개 매스·남쪽 4개 매스·동쪽 4개 참조를 차례로 생성했다. 48셀 서울 샘플과 하늘 사본을 생성해 자정·정오 조명 및 145프레임을 검증했다. 이관 회관 Blender에서 GLB 1,235개 메시를 새 파일로 내보냈고 입력 Blender SHA-256이 전후 동일했다.
- `& $qgis -B tests/gis_script_smoke.py --source $source`는 같은 표본 흐름을 격리된 새 폴더에서 반복하고 원본 SHP 해시·SHP/DBF 크기와 수정 시각을 전후 대조한다.
- `python -B -m unittest tests/gis_script_paths_test.py`는 추적 자산과 저장소 밖 출력, 이미 존재하는 파일을 거절하는지 확인한다. 기존 Blender 3개와 외부 사용자 SHP는 수정하지 않았다. 상기 테스트는 좌표의 실측 정확도나 최신 기상 반영을 증명하지 않는다.
