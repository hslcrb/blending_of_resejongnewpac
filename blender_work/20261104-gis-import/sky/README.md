# 서울 시간 하늘 / Seoul solar sky

`sejong_surroundings_gis_work.blend`, `web/sejong_web_source.blend`, `seoul/seoul_buildings_overview.blend`의 `Scene`에 별도의 하늘과 태양을 추가했다. 기존 사진 연구·`Site visit - NIGHT` 장면은 보존한다. 서울 좌표와 회관 좌표의 북쪽 축이 달라 태양 방위를 각각 변환한다. 위도 37.572°, 경도 126.9763°에서 [NOAA 태양 위치 근사식](https://gml.noaa.gov/grad/solcalc/solareqns.PDF)을 사용한다. 실제 구름, 미세먼지, 관측 날씨나 달 위치는 포함하지 않으며, 밤의 파란 보조광은 가시성을 위한 표현이다.

프레임 1은 00:00, 프레임 145는 다음 00:00이며 1프레임은 10분이다. 키프레임은 생성 당시 서울 날짜 기준이다. 원래 프레임 범위는 Scene의 `seoul_sky_original_frames` 속성에 보존했다. 프레임 1·73을 각각 자정·정오로 확인했다.

## 실시간 사용

각 파일의 텍스트 블록 `Seoul live sky.py`를 Blender 텍스트 편집기에서 **Run Script**로 실행하면 60초마다 서울의 현재 날짜와 시각으로 갱신된다. 자동 스크립트 실행 보안 설정은 바꾸지 않았다. Blender를 종료하고 평소 방식으로 다시 열면 타이머는 자동으로 복구되지 않으므로 다시 실행해야 한다. 실행 중지에는 Python 콘솔에서 `bpy.app.timers.unregister(bpy.app.driver_namespace['seoul_live_sky_timer'])`를 사용할 수 있다. 이번 작업에서는 열려 있는 서울 개요 파일에 MCP로 타이머 시작을 확인했다.

`install_sky.py`는 백그라운드에서 입력 파일을 읽고 `.gis-runs`의 새 Blender 파일에만 하늘과 키프레임을 만든다. 원본 파일은 덮어쓰지 않는다. 실행 인자는 [재생성 절차](../REPRODUCTION.md)를 따른다. `validate_sky.py`는 파일별 축·낮밤 태양·기존 야간 장면을 검사한다. `sky-preview-1.png`, `sky-preview-73.png`는 서울 개요 장면의 자정과 정오 렌더 확인이다.
