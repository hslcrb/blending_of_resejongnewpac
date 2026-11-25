"""Generate one compact point per source building for citywide projection."""
import argparse,gzip,json,struct,sys
from pathlib import Path
IMPORT_ROOT=Path(__file__).resolve().parents[1]
sys.dont_write_bytecode = True
sys.path.insert(0,str(IMPORT_ROOT))
from gis_paths import REPO,new_file
parser=argparse.ArgumentParser(description=__doc__)
parser.add_argument('--buildings',type=Path,default=REPO/'public'/'area'/'buildings')
parser.add_argument('--output',type=Path,required=True)
args=parser.parse_args();source=args.buildings;output=new_file(args.output)
manifest=json.loads((source/'manifest.json').read_text(encoding='utf8'))
count=0
with output.open('xb') as out:
 out.write(b'GSP1');out.write(struct.pack('<I',manifest['totalRecords']))
 for e,n,_,_ in manifest['tiles']:
  with gzip.open(source/f'{e}_{n}.json.gz','rt',encoding='utf8') as file: tile=json.load(file)
  for fid,x,y,polygons,attrs in tile['records']:
   east=e*1000+x/10; north=n*1000+y/10
   raw=attrs[16];height=raw if isinstance(raw,(int,float)) and 0<raw<500 else 3
   out.write(struct.pack('<fff',north-552531,height+2,east-197897));count+=1
if count!=manifest['totalRecords']: raise RuntimeError(f'count mismatch: {count}')
print('point records',count,'bytes',output.stat().st_size)
