"""Build district-sharded address/name search index from metadata tiles."""
from pathlib import Path
from collections import defaultdict
import argparse,json,gzip,re,sys
IMPORT_ROOT=Path(__file__).resolve().parents[1]
sys.dont_write_bytecode = True
sys.path.insert(0,str(IMPORT_ROOT))
from gis_paths import REPO,new_directory
parser=argparse.ArgumentParser(description=__doc__)
parser.add_argument('--buildings',type=Path,default=REPO/'public'/'area'/'buildings')
parser.add_argument('--output',type=Path,required=True)
args=parser.parse_args();source=args.buildings;output=new_directory(args.output)
output.mkdir(exist_ok=False);manifest=json.loads((source/'manifest.json').read_text(encoding='utf8')); districts=defaultdict(list)
for e,n,count,size in manifest['tiles']:
 with gzip.open(source/f'{e}_{n}.json.gz','rt',encoding='utf8') as f: tile=json.load(f)
 for fid,x,y,polygons,attrs in tile['records']:
  code=str(attrs[23] or 'unknown')
  if not re.fullmatch(r'(?:[0-9]+|unknown)',code): raise ValueError('Invalid district code')
  address=' '.join(str(x) for x in (attrs[4],attrs[5]) if x is not None and x!='');name=str(attrs[24] or '')
  districts[code].append([fid,e,n,address,name])
index={'version':1,'totalRecords':sum(map(len,districts.values())),'shards':[]}
for code,rows in sorted(districts.items()):
 dest=output/f'{code}.json.gz';data=json.dumps(rows,ensure_ascii=False,separators=(',',':')).encode('utf8')
 with dest.open('wb') as raw, gzip.GzipFile(fileobj=raw,mode='wb',mtime=0) as z:z.write(data)
 index['shards'].append([code,len(rows),dest.stat().st_size])
(output/'manifest.json').write_text(json.dumps(index,ensure_ascii=False,separators=(',',':'))+'\n',encoding='utf8')
assert index['totalRecords']==manifest['totalRecords']
print('districts',len(districts),'records',index['totalRecords'],'bytes',sum(row[2] for row in index['shards']))
