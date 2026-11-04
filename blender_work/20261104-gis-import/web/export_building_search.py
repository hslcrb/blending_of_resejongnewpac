"""Build district-sharded address/name search index from metadata tiles."""
from pathlib import Path
from collections import defaultdict
import json,gzip
root=Path(__file__).resolve().parents[2];area=root/'v5'/'public'/'area';source=area/'buildings';output=area/'building-search'
if output.exists(): raise RuntimeError('Refusing to overwrite search index')
output.mkdir();manifest=json.loads((source/'manifest.json').read_text(encoding='utf8')); districts=defaultdict(list)
for e,n,count,size in manifest['tiles']:
 with gzip.open(source/f'{e}_{n}.json.gz','rt',encoding='utf8') as f: tile=json.load(f)
 for fid,x,y,polygons,attrs in tile['records']:
  code=str(attrs[23] or 'unknown');address=' '.join(str(x) for x in (attrs[4],attrs[5]) if x is not None and x!='');name=str(attrs[24] or '')
  districts[code].append([fid,e,n,address,name])
index={'version':1,'totalRecords':sum(map(len,districts.values())),'shards':[]}
for code,rows in sorted(districts.items()):
 dest=output/f'{code}.json.gz';data=json.dumps(rows,ensure_ascii=False,separators=(',',':')).encode('utf8')
 with dest.open('wb') as raw, gzip.GzipFile(fileobj=raw,mode='wb',mtime=0) as z:z.write(data)
 index['shards'].append([code,len(rows),dest.stat().st_size])
(output/'manifest.json').write_text(json.dumps(index,ensure_ascii=False,separators=(',',':'))+'\n',encoding='utf8')
assert index['totalRecords']==manifest['totalRecords']
print('districts',len(districts),'records',index['totalRecords'],'bytes',sum(row[2] for row in index['shards']))
