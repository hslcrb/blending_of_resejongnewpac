#!/usr/bin/env python3
"""Independently compare every exported road FID, field and transformed geometry to the GPKG."""
import argparse,gzip,json
from pathlib import Path
from collections import defaultdict
from osgeo import ogr,osr
from export_national_map_layers import srs,sha,field_value,union
from export_national_roads import geometry,LAYERS,MAX_BYTES
ogr.UseExceptions()
p=argparse.ArgumentParser();p.add_argument('--input',type=Path,required=True);p.add_argument('--data',type=Path,default=Path('public/gis/national-roads'));a=p.parse_args()
source=a.input.resolve();base=a.data.resolve();manifest=json.loads((base/'manifest.json').read_text(encoding='utf8'));assert sha(source)==manifest['source']['sha256'];ds=ogr.Open(str(source),0);results=[]
for entry in manifest['layers']:
 assert LAYERS[entry['name']]==entry['id'];layer=ds.GetLayerByName(entry['name']);ref=layer.GetSpatialRef().Clone();ref.SetAxisMappingStrategy(osr.OAMS_TRADITIONAL_GIS_ORDER);transform=osr.CoordinateTransformation(ref,srs('EPSG:5186'));seen=set();unlocated=0;redactions=defaultdict(int)
 for shard in entry['shards']:
  rel=shard['url'].removeprefix('/gis/national-roads/');path=(base/rel).resolve();assert base in path.parents and path.stat().st_size==shard['bytes'] and path.stat().st_size<MAX_BYTES and sha(path)==shard['sha256']
  with gzip.open(path,'rt',encoding='utf8') as z:data=json.load(z)
  assert data['type']=='FeatureCollection' and len(data['features'])==shard['count'];boxes=[]
  for feature in data['features']:
   fid=feature['properties']['fid'];assert fid not in seen;seen.add(fid);original=layer.GetFeature(fid);assert original is not None
   assert feature['id']==f"{entry['id']}:{fid}" and feature['properties']['layer']==entry['name']
   assert feature['properties']['fields']==dict(field_value(original,i,redactions) for i in range(original.GetFieldCount()))
   expected,box=geometry(original,transform);assert feature['geometry']==expected and feature['bbox']==box,(entry['name'],fid)
   if box is None:unlocated+=1
   else:boxes.append(box)
  assert shard['bbox']==(union(boxes) if boxes else None)
 assert len(seen)==entry['sourceCount']==layer.GetFeatureCount() and unlocated==entry['unlocatedCount'] and dict(redactions)==entry['redactions']
 results.append({'layer':entry['name'],'features':len(seen),'unlocated':unlocated,'redactions':dict(redactions),'shards':len(entry['shards'])})
 print('VALIDATED',entry['name'],len(seen),'unlocated',unlocated,flush=True)
assert len(results)==len(LAYERS);print(json.dumps({'sourceSha256':sha(source),'total':sum(r['features'] for r in results),'results':results},ensure_ascii=False))
