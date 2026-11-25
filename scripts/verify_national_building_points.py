"""Independently compare every NBP1 point to its source spatial tile."""
import argparse,gzip,json,struct
from pathlib import Path

def verify(directory,index):
 manifest=json.loads((directory/'manifest.json').read_text(encoding='utf-8'));raw=gzip.decompress(index.read_bytes())
 if raw[:4]!=b'NBP1' or len(raw)<8:raise ValueError('Invalid header')
 count=struct.unpack_from('<I',raw,4)[0]
 if len(raw)!=8+count*12 or count!=manifest['totalRecords']:raise ValueError('Invalid count or length')
 points={}
 for fid,e,n in struct.iter_unpack('<Iii',raw[8:]):
  if fid in points:raise ValueError(f'Duplicate index fid {fid}')
  points[fid]=(e,n)
 seen=0
 for te,tn,expected,*_ in manifest['tiles']:
  tile=json.loads(gzip.decompress((directory/f'{te}_{tn}.json.gz').read_bytes()))
  if tile['tile']!=[te,tn] or len(tile['records'])!=expected:raise ValueError(f'Invalid tile {te}_{tn}')
  for row in tile['records']:
   fid,x,y=row[:3]
   if points.pop(fid,None)!=(te*100000+x,tn*100000+y):raise ValueError(f'Mismatched fid/coordinate {fid}')
   seen+=1
 if points or seen!=count:raise ValueError('Missing or extra points')
 print(f'PASS: {seen} points exactly match all {len(manifest["tiles"])} source tiles')
if __name__=='__main__':
 p=argparse.ArgumentParser(description=__doc__);p.add_argument('--input',type=Path,required=True);p.add_argument('--index',type=Path,required=True);a=p.parse_args();verify(a.input,a.index)
