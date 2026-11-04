"""Cross-check full tile IDs, attributes, footprint samples and point projection."""
from osgeo import ogr,gdal
from pathlib import Path
import gzip,json,math,struct,sys
root=Path(__file__).resolve().parents[2]
area=root/'v5'/'public'/'area';tiles=area/'buildings'
manifest=json.loads((tiles/'manifest.json').read_text(encoding='utf8'))
gdal.SetConfigOption('SHAPE_ENCODING','CP949'); ds=ogr.Open(sys.argv[1],0); source=ds.GetLayer(0)
seen=set(); checked=0
with (area/'building-points.bin').open('rb') as points:
 assert points.read(4)==b'GSP1'
 assert struct.unpack('<I',points.read(4))[0]==manifest['totalRecords']==695753
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
assert len(seen)==manifest['totalRecords'] and checked>=20
print('PASS:',len(seen),'unique records, 29 fields, aligned points; source attribute samples:',checked)
