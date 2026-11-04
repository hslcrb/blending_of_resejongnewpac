"""Verify search index points to the same source IDs and addresses as tiles."""
from pathlib import Path
import gzip,json
root=Path(__file__).resolve().parents[2]/'v5'/'public'/'area'
manifest=json.loads((root/'buildings'/'manifest.json').read_text(encoding='utf8'))
index=json.loads((root/'building-search'/'manifest.json').read_text(encoding='utf8'))
expected={}
for e,n,_,_ in manifest['tiles']:
 with gzip.open(root/'buildings'/f'{e}_{n}.json.gz','rt',encoding='utf8') as f: tile=json.load(f)
 for fid,x,y,polygons,a in tile['records']:
  address=' '.join(str(v) for v in (a[4],a[5]) if v is not None and v!='')
  expected[fid]=(e,n,address,str(a[24] or ''))
count=0
for code,length,size in index['shards']:
 with gzip.open(root/'building-search'/f'{code}.json.gz','rt',encoding='utf8') as f: rows=json.load(f)
 assert len(rows)==length
 for fid,e,n,address,name in rows:
  assert expected.pop(fid)==(e,n,address,name)
  count+=1
assert not expected and count==index['totalRecords']==manifest['totalRecords']==695753
print('PASS:',count,'search records match source IDs, locations, addresses and names')
