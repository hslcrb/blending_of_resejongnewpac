"""Bake flags and original labels offline; no Seoul photographs are included.

python scripts/build_gratitude_atlas.py path/to/flag-icons/flags/4x3
Requires Pillow, Inkscape and Noto Sans CJK installed (used to rasterize text).
National flag artwork: lipis/flag-icons v7.5.0 under MIT; see assets notice.
"""
import argparse
from io import BytesIO
import json
from pathlib import Path
import subprocess
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
LAYOUT = json.loads((ROOT / 'src/gratitudeGardenLayout.json').read_text())
FONT = '/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc'

def text(draw, x, y, label, size, max_width, color):
    while True:
        ft = ImageFont.truetype(FONT, size, index=1)
        if ft.getlength(label) <= max_width or size <= 10:
            break
        size -= 1
    draw.text((x, y), label, font=ft, fill=color, anchor='mm')

def main():
    p = argparse.ArgumentParser()
    p.add_argument('flags', type=Path)
    a = p.parse_args()
    im = Image.new('RGB', (1024, 768), '#baa16c')
    d = ImageDraw.Draw(im)
    for i,(code,ko,en) in enumerate(LAYOUT['countries']):
        x, y = (i%5)*192, (i//5)*120
        svg = a.flags / f'{code}.svg'
        png = subprocess.check_output(['inkscape', str(svg), '--export-type=png', '--export-filename=-', '--export-width=96'])
        flag = Image.open(BytesIO(png)).convert('RGB')
        im.paste(flag,(x+(192-flag.width)//2,y+7))
        text(d,x+96,y+91,ko,16,164,'#17130d')
        text(d,x+96,y+109,en.upper(),12,178,'#17130d')
    d.rectangle((0,604,749,675),fill='#434b50')
    text(d,374,638,'감사의 정원   GARDEN OF GRATITUDE',35,712,'#f2efeb')
    d.rectangle((0,680,749,755),fill='#b0aca4')
    text(d,174,706,'감사의 정원',28,300,'#8a571a')
    text(d,174,737,'GARDEN OF GRATITUDE',19,300,'#302a22')
    text(d,553,706,'프리덤 홀',28,290,'#8a571a')
    text(d,553,737,'FREEDOM HALL',19,300,'#302a22')
    im.save(ROOT/'scripts/assets/gratitude-plaque-atlas.jpg',quality=92,subsampling=0,optimize=True)

if __name__=='__main__':
    main()
