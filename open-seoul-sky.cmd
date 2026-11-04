@echo off
python -B "%~dp0scripts\open_blender_sky.py" %*
if errorlevel 1 pause
