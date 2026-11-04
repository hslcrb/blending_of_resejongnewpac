#!/usr/bin/env python3
"""Compare every exported record to the supplied read-only source GeoPackage."""
import argparse, gzip, json, math
from pathlib import Path
from osgeo import gdal,ogr,osr
from export_national_map_layers import srs,sha,field_value,round_bounds
from collections import defaultdict

gdal.UseExceptions();ogr.UseExceptions();gdal.PushErrorHandler('CPLQuietErrorHandler')
p=argparse.ArgumentParser();p.add_argument('--input',type=Path,required=True);args=p.parse_args()
source=args.input.resolve();base=Path('public/gis/extra');manifest=json.loads((base/'manifest.json').read_text(encoding='utf8'));assert sha(source)==manifest['source']['sha256']
ds=ogr.Open(str(source),0);target=srs('EPSG:5186');to_wgs=osr.CoordinateTransformation(target,srs('EPSG:4326'));results=[]
for entry in manifest['layers']:
 layer=ds.GetLayerByName(entry['name']);ref=layer.GetSpatialRef().Clone();ref.SetAxisMappingStrategy(osr.OAMS_TRADITIONAL_GIS_ORDER);transform=osr.CoordinateTransformation(ref,target)
 seen=set();nulls=0;invalid=0
 for shard in entry['shards']:
  with gzip.open(Path('public')/shard['url'].lstrip('/'),'rt',encoding='utf8') as f:data=json.load(f)
  for feature in data['features']:
   fid=feature['properties']['fid'];assert fid not in seen;seen.add(fid);original=layer.GetFeature(fid);assert original is not None,(entry['name'],fid)
   counts=defaultdict(int);fields=dict(field_value(original,i,counts) for i in range(original.GetFieldCount()))
   assert fields==feature['properties']['fields'],(entry['name'],fid,'attributes')
   geom=original.GetGeometryRef()
   if geom is None or geom.IsEmpty():assert feature['geometry'] is None;nulls+=1;continue
   geom=geom.Clone();assert geom.Transform(transform)==0;box=round_bounds(geom);assert box==feature['bbox'],(entry['name'],fid,'bbox')
   center=((box[0]+box[2])/2,(box[1]+box[3])/2);w=to_wgs.TransformPoint(*center);assert feature['properties']['anchorWgs84']==[round(w[0],6),round(w[1],6)]
   out=ogr.CreateGeometryFromJson(json.dumps(feature['geometry']));assert out is not None
   if not out.IsValid():invalid+=1
 assert len(seen)==entry['sourceCount'] and nulls==entry['unlocatedCount']
 results.append({'layer':entry['name'],'records':len(seen),'unlocated':nulls,'invalidOutputGeometries':invalid})
 print('VALIDATED',entry['name'],len(seen),'invalid',invalid,flush=True)
report={'sourceSha256':sha(source),'records':sum(x['records'] for x in results),'results':results}
Path('docs/20261104-national-map-validation.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf8')
print('VALIDATION_TOTAL',report['records'],'invalid',sum(x['invalidOutputGeometries'] for x in results))
