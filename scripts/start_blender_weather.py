"""Run the trusted embedded sky script after opening a project-owned copy."""
import bpy
from pathlib import Path
import runpy

text = bpy.data.texts.get('Seoul weather live.py')
if not text:
    raise RuntimeError('이 Blender 사본에 서울 날씨 스크립트가 없습니다.')
exec(compile(text.as_string(), 'Seoul weather live.py', 'exec'), {'__name__': '__main__'})
timer = bpy.app.driver_namespace.get('seoul_weather_live_timer')
if not timer or not bpy.app.timers.is_registered(timer):
    raise RuntimeError('서울 날씨 타이머를 시작하지 못했습니다.')
preview = runpy.run_path(str(Path(__file__).with_name('blender_viewport_lighting.py')))
print('장면 조명 뷰포트:', preview['use_scene_preview'](bpy.data.screens))
print('서울 시간과 김포공항 관측 하늘이 실행 중입니다.')
