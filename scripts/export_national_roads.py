#!/usr/bin/env python3
"""Read user GPKG without mutation; split intact road features into spatial shards."""
import argparse, gzip, hashlib, json, math
from pathlib import Path
from collections import defaultdict
from osgeo import gdal,ogr,osr
from export_national_map_layers import srs,sha,field_value,round_bounds,union,tile_name

gdal.UseExceptions();ogr.UseExceptions()
LAYERS={'고속국도':'expressway','일반국도':'national','지방도':'local'}
TILE=50000;MAX_BYTES=25*1024*1024

def encode(value):return json.dumps(value,ensure_ascii=False,separators=(',',':'),allow_nan=False).encode('utf8')
def geometry(feature,transform):
 source=feature.GetGeometryRef()
 if source is None or source.IsEmpty():return None,None
 geom=source.Clone();assert geom.Transform(transform)==0
 return json.loads(geom.ExportToJson(options=['COORDINATE_PRECISION=9'])),round_bounds(geom)
def main():
 p=argparse.ArgumentParser();p.add_argument('--input',type=Path,required=True);p.add_argument('--output',type=Path,default=Path('public/gis/national-roads'));a=p.parse_args()
 source=a.input.resolve();out=a.output.resolve();assert source.is_file() and source!=out and source not in out.parents
 if out.exists() and any(out.iterdir()):raise SystemExit('Output directory must be empty; do not overwrite existing files.')
 out.mkdir(parents=True,exist_ok=True);ds=ogr.Open(str(source),0);assert ds
 entries=[]
 for name,slug in LAYERS.items():
  layer=ds.GetLayerByName(name);assert layer;ref=layer.GetSpatialRef().Clone();ref.SetAxisMappingStrategy(osr.OAMS_TRADITIONAL_GIS_ORDER);transform=osr.CoordinateTransformation(ref,srs('EPSG:5186'))
  defn=layer.GetLayerDefn();schema=[{'name':defn.GetFieldDefn(i).GetName(),'type':ogr.GetFieldTypeName(defn.GetFieldDefn(i).GetType())} for i in range(defn.GetFieldCount())]
  groups=defaultdict(list);redactions=defaultdict(int);seen=set()
  for f in layer:
   fid=f.GetFID();assert fid not in seen;seen.add(fid);fields=dict(field_value(f,i,redactions) for i in range(f.GetFieldCount()));geom,box=geometry(f,transform)
   key=None if box is None else (math.floor((box[0]+box[2])/2/TILE),math.floor((box[1]+box[3])/2/TILE))
   groups[key].append({'type':'Feature','id':f'{slug}:{fid}','geometry':geom,'bbox':box,'properties':{'layer':name,'fid':fid,'fields':fields}})
  assert len(seen)==layer.GetFeatureCount();shards=[]
  for key,features in sorted(groups.items(),key=lambda item:(item[0] is None,item[0] or (0,0))):
   filename='unlocated.json.gz' if key is None else f'{tile_name(key[0])}_{tile_name(key[1])}.json.gz';relative=f'{slug}/{filename}';path=out/relative;path.parent.mkdir(parents=True,exist_ok=True)
   raw=encode({'type':'FeatureCollection','crs':{'type':'name','properties':{'name':'EPSG:5186'}},'features':features})
   with path.open('wb') as f:
    with gzip.GzipFile(filename='',mode='wb',fileobj=f,compresslevel=9,mtime=0) as z:z.write(raw)
   assert path.stat().st_size<MAX_BYTES,(relative,path.stat().st_size)
   boxes=[f['bbox'] for f in features if f['bbox'] is not None]
   shards.append({'url':f'/gis/national-roads/{relative}','bbox':union(boxes) if boxes else None,'count':len(features),'bytes':path.stat().st_size,'sha256':sha(path)})
  entries.append({'id':slug,'name':name,'sourceCount':len(seen),'unlocatedCount':len(groups.get(None,[])),'sourceCRS':ref.GetName(),'sourceWKT':ref.ExportToWkt(),'fieldSchema':schema,'redactions':dict(redactions),'shards':shards})
  print('EXPORTED',name,len(seen),'unlocated',len(groups.get(None,[])),'shards',len(shards),flush=True)
 manifest={'version':1,'crs':'EPSG:5186','tileSizeMetres':TILE,'source':{'name':'사용자 제공 대한민국전도_.gpkg','sha256':sha(source),'provenance':'원저작자·제작일·정확한 사용허가 미확인'},'scale':'소축척 개요도. 최신성·정확도 미확인, 측량·지적·안전 판단에 부적합','layers':entries}
 (out/'manifest.json').write_bytes(json.dumps(manifest,ensure_ascii=False,indent=2).encode('utf8')+b'\n')
 print('TOTAL',sum(x['sourceCount'] for x in entries),flush=True)
if __name__=='__main__':main()
