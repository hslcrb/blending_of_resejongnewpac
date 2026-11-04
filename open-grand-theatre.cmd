@echo off
python -B "%~dp0scripts\open_blender_sky.py" "grand-theatre\sejong_grand_theatre_20261104.blend"
if errorlevel 1 pause
