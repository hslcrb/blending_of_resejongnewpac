"""Reproducible compact index of CH_D010 I/U centroids, verified against all tiles."""
import argparse, gzip, hashlib, json, os, struct
from pathlib import Path

def build(directory, output):
 manifest=json.loads((directory/'manifest.json').read_text(encoding='utf-8'))
 if (manifest.get('version'),manifest.get('sourceCrs'),manifest.get('tileSize'),manifest.get('precision')) != (1,'EPSG:5186',10000,0.1): raise ValueError('Unexpected manifest format')
 data=bytearray(b'NBP1'+struct.pack('<I',manifest['totalRecords'])); ids=set(); count=0
 for te,tn,expected,size,digest in manifest['tiles']:
  path=directory/f'{te}_{tn}.json.gz'; compressed=path.read_bytes()
  if len(compressed)!=size or hashlib.sha256(compressed).hexdigest()!=digest: raise ValueError(f'Tile checksum/size mismatch: {path.name}')
  tile=json.loads(gzip.decompress(compressed))
  if tile['tile']!=[te,tn] or len(tile['records'])!=expected: raise ValueError(f'Tile record mismatch: {path.name}')
  for row in tile['records']:
   fid,x,y=row[:3]
   if fid in ids: raise ValueError(f'Duplicate FID: {fid}')
   ids.add(fid);data.extend(struct.pack('<Iii',fid,te*100000+x,tn*100000+y));count+=1
 if count!=manifest['totalRecords']: raise ValueError('Total record mismatch')
 output.parent.mkdir(parents=True,exist_ok=True);temporary=output.with_name(output.name+'.tmp')
 try:
  with temporary.open('wb') as f:
   with gzip.GzipFile(fileobj=f,mode='wb',filename='',mtime=0,compresslevel=9) as gz: gz.write(data)
  os.replace(temporary,output)
 finally:
  if temporary.exists(): temporary.unlink()
 print(f'{count} points; {len(data)} raw bytes; {output.stat().st_size} gzip bytes; sha256 {hashlib.sha256(output.read_bytes()).hexdigest()}')
if __name__=='__main__':
 parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('--input',type=Path,required=True);parser.add_argument('--output',type=Path,required=True);args=parser.parse_args();build(args.input,args.output)
