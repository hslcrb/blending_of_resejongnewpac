"""Generate one compact point per source building for citywide projection."""
import gzip,json,struct
from pathlib import Path
root=Path(__file__).resolve().parents[2]
source=root/'v5'/'public'/'area'/'buildings'
output=root/'v5'/'public'/'area'/'building-points.bin'
manifest=json.loads((source/'manifest.json').read_text(encoding='utf8'))
count=0
with output.open('wb') as out:
 out.write(b'GSP1');out.write(struct.pack('<I',manifest['totalRecords']))
 for e,n,_,_ in manifest['tiles']:
  with gzip.open(source/f'{e}_{n}.json.gz','rt',encoding='utf8') as file: tile=json.load(file)
  for fid,x,y,polygons,attrs in tile['records']:
   east=e*1000+x/10; north=n*1000+y/10
   raw=attrs[16];height=raw if isinstance(raw,(int,float)) and 0<raw<500 else 3
   out.write(struct.pack('<fff',north-552531,height+2,east-197897));count+=1
if count!=manifest['totalRecords']: raise RuntimeError(f'count mismatch: {count}')
print('point records',count,'bytes',output.stat().st_size)
