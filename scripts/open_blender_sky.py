#!/usr/bin/env python3
"""Open a project-owned sky copy with its live Seoul clock enabled."""
from pathlib import Path
import argparse
import os
import shutil
import subprocess

ROOT = Path(__file__).resolve().parents[1]
COPY_ROOT = ROOT / 'blender_work' / '20261104-live-sky'
DEFAULT = COPY_ROOT / 'blender_work' / '20261104' / 'sejong_trees_connected_20261104.blend'
START = ROOT / 'scripts' / 'start_blender_weather.py'

def resolve_copy(value):
    path = Path(value).expanduser() if value else DEFAULT
    if not path.is_absolute():
        path = COPY_ROOT / path
    path = path.resolve()
    if not path.is_relative_to(COPY_ROOT.resolve()) or path.suffix.lower() != '.blend' or not path.is_file():
        raise ValueError('서울 하늘이 적용된 프로젝트 사본의 .blend 파일을 선택하세요.')
    return path

def find_blender():
    configured = os.environ.get('BLENDER_BIN')
    if configured:
        path = Path(configured).expanduser()
        if path.is_file(): return path
        raise FileNotFoundError('BLENDER_BIN의 Blender 실행 파일을 찾지 못했습니다.')
    available = shutil.which('blender') or shutil.which('blender.exe')
    if available: return Path(available)
    if os.name == 'nt':
        choices = sorted(Path(os.environ.get('ProgramFiles', r'C:\Program Files')).glob('Blender Foundation/Blender */blender.exe'), reverse=True)
        if choices: return choices[0]
    raise FileNotFoundError('Blender 실행 파일을 찾지 못했습니다. BLENDER_BIN을 설정해 주세요.')

def launch(blender, copy):
    return subprocess.Popen([str(blender), str(copy), '--python', str(START)], shell=False)

def main():
    parser = argparse.ArgumentParser(description='서울 시각과 관측 하늘을 자동 시작하며 Blender 사본을 엽니다.')
    parser.add_argument('copy', nargs='?', help='20261104-live-sky 폴더의 상대 경로 또는 절대 경로')
    args = parser.parse_args()
    try:
        path = resolve_copy(args.copy)
        launch(find_blender(), path)
        print(f'서울 하늘 Blender 열기: {path}')
    except (ValueError, FileNotFoundError, OSError) as error:
        parser.exit(1, f'{error}\n')

if __name__ == '__main__': main()
