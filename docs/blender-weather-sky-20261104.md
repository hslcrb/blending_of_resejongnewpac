# Blender 서울 시간과 관측 하늘 - 2026-11-04

## 원본과 복사본

저장소에서 추적 중인 `.blend` 23개를 조사했다. 최신 세종 작업본·나무 작업본·이전 GIS 복사본·`public/model` 원본·역사 백업을 포함하며 총 118개 씬, 원본 402,740,479바이트다. 원본과 백업은 수정하지 않았고 경로 구조를 보존한 하늘 적용 복사본을 `blender_work/20261104-live-sky/` 아래에 저장했다. 23개 사본의 합계는 약 404MB다. 목록, 원본 SHA-256 및 각 씬은 `20261104-blender-source-inventory.json`, 사본 경로·SHA-256은 `20261104-blender-sky-copies.json`에 있다.

각 씬에 별도의 절차적 대기, 태양, 야간 보조광과 구름 노드를 설치했다. 기존 SUN 광원은 사본에서만 렌더·뷰포트를 끄고 객체와 원래 월드는 보존해 햇빛이 겹치지 않게 했다. 기존 원본의 미연결 데이터 블록도 보존한다. 118개 모든 씬에 프레임 1=서울 00:00, 73=12:00, 145=다음 날 00:00의 태양 키프레임이 들어간다. 인접 프레임은 10분 간격이며 최초 생성일은 각 씬의 `seoul_weather_sky_date` 속성에 남긴다. 원래 프레임 범위와 월드 이름은 `seoul_weather_original_frames`, `seoul_weather_original_world` 속성에 기록했다. 위치가 미확정인 사진 연구 씬과 카메라가 없는 씬도 빛을 설정했지만, 그 씬의 실제 위치나 카메라를 새로 확정하지 않았다.

## 실시간 시작과 관측의 뜻

Blender에서 원하는 **복사본**을 연 뒤 Text Editor의 `Seoul weather live.py`를 선택하고 **Run Script**를 눌러 시작한다. Blender의 자동 스크립트 실행 보안 설정은 변경하지 않았으므로 파일을 다시 열 때 직접 시작해야 한다. 선택한 씬을 서울 현재 시각에 맞추고 매분 갱신한다. 날짜·관측이 바뀌거나 다른 씬으로 전환하면 24시간 태양 키프레임도 다시 계산한다. 갱신 중 타임라인 프레임이 서울 현재 시각으로 이동한다. 키프레임만 재생하는 경우에는 사본 생성 날짜와 생성 시 관측값을 사용한다.

관측은 `https://live.renewsejongpac.rhee.life/api/weather`가 제공하는 김포공항(RKSS)의 METAR 구름 분류를 10분 간격으로 조회한다. 이는 **세종문화회관 현장 관측이 아니며**, 구름의 모양과 위치는 관측 분류량을 이용한 절차적 근사다. 강수, 바람, 정확한 구름 위치는 표현하지 않는다. 응답 실패, 위치 오류, 분류 부재 또는 2시간이 넘은 관측은 `seoul_weather_status`에 `관측 미확인 · 맑은 하늘 근사`로 표시하고 천문 태양은 계속 계산한다. 최초 적용 시 받은 관측은 `20261104-initial-rkss-observation.json`의 스냅샷이며 실시간 수신의 증거는 아니다.

네트워크 요청은 Blender API를 만지지 않는 별도 스레드에서 수행한다. 타이머를 중지하려면 Blender Python Console에서 아래 두 줄을 실행한다.

```python
import bpy
t = bpy.app.driver_namespace.pop('seoul_weather_live_timer', None); t and bpy.app.timers.is_registered(t) and bpy.app.timers.unregister(t)
```

기존 GIS 복사본의 옛 `Seoul live sky.py`는 출처 보존용으로 남겼다. 새 `Seoul weather live.py`를 시작하면 구 타이머가 동작 중일 경우 해제한다.

## 재현과 검증

`python scripts/build_all_blender_sky_copies.py`는 인벤토리의 원본 해시를 확인하고 없는 사본만 생성한다. 기존 사본은 덮지 않는다. `--repair-verified`를 명시하면 마지막 사본 목록에 기록된 해시와 일치하는 사본만 원본으로부터 재생성하며, 변경된 사본은 거부한다. Blender 5.2 경로가 다르면 `BLENDER_BIN` 환경 변수에 실행 파일 경로를 지정한다.

`python scripts/validate_all_blender_sky_copies.py`는 각 원본 해시, 사본 해시, 씬 이름·객체 수·카메라·낮밤 프레임과 날씨 대체를 검사한다. `scripts/validate_sky_geometry_preserved.py`는 각 원본과 사본의 기존 객체 이름과 메시 정점·면 인덱스 해시를 대조한다. `scripts/validate_blender_weather_sky.py -- --test-live`는 실제 관측 API, 유효하지 않은 관측 거부, 타이머 시작/중지와 가상 흐림 관측 적용을 Blender에서 검사한다.

낮과 밤 및 가상 흐림 비교는 `scripts/render_blender_weather_sky.py`로 만든 `20261104-sky-midnight.png`, `20261104-sky-noon.png`, `20261104-sky-noon-overcast.png`다. 가상 흐림 이미지는 API가 관측한 상태로 주장하지 않는다. 비교는 Blender 5.2 EEVEE에서 만든 기술 검증이며 모든 장면이나 기기의 시각 결과를 보장하지 않는다.

태양 방위·고도는 [NOAA Solar Calculation Details](https://gml.noaa.gov/grad/solcalc/solareqns.PDF)의 근사식을 사용한다. 구름 관측은 [Aviation Weather Center Data API](https://aviationweather.gov/data/api/)의 METAR를 운영 서비스가 제한적으로 중계한다. 외부 응답이 실패하거나 오래된 경우를 위와 같이 따로 표시한다.

## 한 번에 열기

Windows에서는 저장소의 `open-seoul-sky.cmd`를 실행하면 최신 수목·하늘 Blender 사본을 열고 실시간 시각·기상 스크립트를 자동 시작한다. 다른 23개 하늘 적용 사본은 `python -B scripts/open_blender_sky.py "blender_work/20261104-gis-import/seoul/seoul_buildings_overview.blend"`처럼 `blender_work/20261104-live-sky` 기준 상대 경로를 전달한다. Blender 설치 경로가 자동으로 발견되지 않으면 `BLENDER_BIN`에 실행 파일 경로를 지정한다. 이 실행기는 프로젝트의 하늘 적용 사본만 허용하며 Blender의 전역 자동 실행 설정을 변경하지 않는다. 일반적인 파일 열기를 사용하면 앞서 설명한 대로 내장 스크립트를 직접 실행해야 한다.

2026-11-04 열린 Blender MCP 세션에서 이전 서울 장면에 미저장 변경이 없음을 확인하고 같은 서울 장면의 하늘 적용 사본으로 전환했다. 실시간 타이머가 등록됐고 `RKSS 관측 (현장 관측 아님)`과 관측 시각이 실제 표시되는 것을 확인했다.
