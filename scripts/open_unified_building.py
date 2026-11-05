"""Open the fixed project-owned unified building with Seoul sky and material lighting."""
from pathlib import Path
from open_blender_sky import find_blender,launch
ROOT=Path(__file__).resolve().parents[1]
def main():
 copy=ROOT/'blender_work/20261105-unified/sejong_unified_20261105.blend'
 if not copy.is_file():raise FileNotFoundError('통합 회관 작업 사본을 찾지 못했습니다.')
 launch(find_blender(),copy);print('기존 외관과 대극장 내부가 함께 있는 통합 모형을 엽니다.')
if __name__=='__main__':main()
