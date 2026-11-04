"""Cross-check full tile IDs, attributes, footprint samples and point projection."""
from osgeo import ogr,gdal
from pathlib import Path
import argparse,gzip,json,math,struct,sys
IMPORT_ROOT=Path(__file__).resolve().parents[1]
sys.dont_write_bytecode = True
sys.path.insert(0,str(IMPORT_ROOT))
from gis_paths import REPO
parser=argparse.ArgumentParser(description=__doc__)
parser.add_argument('source',type=Path);parser.add_argument('--area',type=Path,default=REPO/'public'/'area')
args=parser.parse_args();area=args.area;tiles=area/'buildings'
manifest=json.loads((tiles/'manifest.json').read_text(encoding='utf8'))
gdal.SetConfigOption('SHAPE_ENCODING','CP949'); ds=ogr.Open(str(args.source),0); source=ds.GetLayer(0)
seen=set(); checked=0
with (area/'building-points.bin').open('rb') as points:
 assert points.read(4)==b'GSP1'
 assert struct.unpack('<I',points.read(4))[0]==manifest['totalRecords']
 for e,n,count,_ in manifest['tiles']:
  with gzip.open(tiles/f'{e}_{n}.json.gz','rt',encoding='utf8') as f: data=json.load(f)
  assert len(data['records'])==count
  for fid,x,y,polygons,attrs in data['records']:
   assert fid not in seen and len(attrs)==29 and polygons
   seen.add(fid)
   px,py,pz=struct.unpack('<fff',points.read(12))
   assert abs(px-(n*1000+y/10-552531))<0.1 and abs(pz-(e*1000+x/10-197897))<0.1
   if checked<30 and (fid%2003==0 or (e==197 and n==552 and attrs[5]=='81-3')):
    original=source.GetFeature(fid)
    assert original is not None and [original.GetField(f'A{i}') for i in range(29)]==attrs
    assert original.GetGeometryRef().GetGeometryName() in ('POLYGON','MULTIPOLYGON')
    checked+=1
 assert not points.read(1)
assert len(seen)==manifest['totalRecords']
if manifest['totalRecords']==695753: assert checked>=20
print('PASS:',len(seen),'unique records, 29 fields, aligned points; source attribute samples:',checked)
