#!/usr/bin/env python3
"""Export user-supplied small-scale map layers; source is read-only."""
import argparse, gzip, hashlib, json, math, re
from pathlib import Path
from collections import defaultdict
from osgeo import gdal, ogr, osr

gdal.UseExceptions();ogr.UseExceptions()
TARGET='EPSG:5186'; TILE=100000; MAX_BYTES=20*1024*1024
LAYERS={
 '경위도':'graticule','고속철도':'express-rail','공항':'airports','광역시청':'metro-city-halls','국가경계':'national-border',
 '국립공원 경계':'national-parks','도청':'provincial-halls','등대':'lighthouses','사찰':'temples','산':'mountains',
 '스키장':'ski-resorts','시청':'municipal-halls','실폭하천':'watercourses','일반철도':'rail','전통사찰_수정필요':'traditional-temples',
 '특별광역자치시도경계':'metro-boundaries','항구':'ports','해수욕장':'beaches','해안선':'coastlines','행정경계':'administrative-boundaries'}
EXISTING={'시도_백지도':'기존 /gis/national-admin.json.gz에 전국 포함','시군구_백지도_':'기존 /gis/national-admin.json.gz에 전국 포함'}
EXCLUDED={'고속국도':'전국 도로 원본 21,973건은 대량 자동 내려받기에서 제외; 기존 서울 주변 자료 사용',
 '일반국도':'전국 도로 원본 168,014건은 대량 자동 내려받기에서 제외; 기존 서울 주변 자료 사용',
 '지방도':'전국 도로 원본 59,429건은 대량 자동 내려받기에서 제외; 기존 서울 주변 자료 사용',
 'layer_styles':'지오메트리가 아닌 QGIS 스타일 내부 테이블이며 로컬 경로를 포함할 수 있어 제외'}
PRIVATE=re.compile(r'(?i)(?:[a-z]:[\\/]|file://|/users/|/home/|\\\\[^\\]+\\)')

def sha(path):
 h=hashlib.sha256()
 with path.open('rb') as f:
  for block in iter(lambda:f.read(1024*1024),b''):h.update(block)
 return h.hexdigest()
def srs(value):
 ref=osr.SpatialReference();ref.SetFromUserInput(value);ref.SetAxisMappingStrategy(osr.OAMS_TRADITIONAL_GIS_ORDER);return ref
def round_bounds(geom):
 x1,x2,y1,y2=geom.GetEnvelope()
 return [math.floor(x1*10)/10,math.floor(y1*10)/10,math.ceil(x2*10)/10,math.ceil(y2*10)/10]
def union(boxes):
 return [min(b[0] for b in boxes),min(b[1] for b in boxes),max(b[2] for b in boxes),max(b[3] for b in boxes)]
def tile_name(value):return ('n'+str(-value)) if value<0 else ('p'+str(value))
def field_value(feature,index,counts):
 name=feature.GetFieldDefnRef(index).GetName();value=feature.GetField(index)
 if name.casefold() in {'path','filepath','file_path','source_path'}:
  counts['path_fields']+=1;return name,None
 if isinstance(value,str) and PRIVATE.search(value):counts['path_values']+=1;return name,None
 if isinstance(value,float) and not math.isfinite(value):counts['nonfinite']+=1;return name,None
 if value is None or isinstance(value,(bool,int,float,str)):return name,value
 return name,str(value)
def save(path,payload):
 content=json.dumps(payload,ensure_ascii=False,separators=(',',':'),allow_nan=False).encode('utf8')
 path.parent.mkdir(parents=True,exist_ok=True)
 with path.open('wb') as out:
  with gzip.GzipFile(filename='',mode='wb',fileobj=out,compresslevel=9,mtime=0) as gz:gz.write(content)
 assert path.stat().st_size<MAX_BYTES, f'Asset exceeds size limit: {path.name}'
 return {'bytes':path.stat().st_size,'uncompressedBytes':len(content),'sha256':sha(path)}

def main():
 p=argparse.ArgumentParser();p.add_argument('--input',type=Path,required=True);p.add_argument('--output',type=Path,default=Path('public/gis/extra'));args=p.parse_args()
 source=args.input.resolve();output=args.output.resolve();assert source.is_file()
 # Never write into or on top of the input GeoPackage.
 assert source!=output and source not in output.parents
 ds=ogr.Open(str(source),0);assert ds is not None
 all_names={ds.GetLayerByIndex(i).GetName() for i in range(ds.GetLayerCount())}
 assert all_names==set(LAYERS)|set(EXISTING)|set(EXCLUDED),(all_names-set(LAYERS)-set(EXISTING)-set(EXCLUDED))
 target=srs(TARGET);wgs=srs('EPSG:4326');to_wgs=osr.CoordinateTransformation(target,wgs);entries=[]
 for name,slug in LAYERS.items():
  layer=ds.GetLayerByName(name);original=layer.GetSpatialRef();assert original is not None,name
  original=original.Clone();original.SetAxisMappingStrategy(osr.OAMS_TRADITIONAL_GIS_ORDER);transform=osr.CoordinateTransformation(original,target)
  defn=layer.GetLayerDefn();schema=[{'name':defn.GetFieldDefn(i).GetName(),'type':ogr.GetFieldTypeName(defn.GetFieldDefn(i).GetType())} for i in range(defn.GetFieldCount())]
  groups=defaultdict(list);redactions=defaultdict(int);located=0;unlocated=0;seen=set();total=layer.GetFeatureCount()
  geom_type=ogr.GeometryTypeToName(defn.GetGeomType());tolerance=0 if 'Point' in geom_type and 'Multi Point' not in geom_type else 50
  for feature in layer:
   fid=feature.GetFID();assert fid not in seen,(name,fid);seen.add(fid)
   fields=dict(field_value(feature,i,redactions) for i in range(feature.GetFieldCount()))
   source_geom=feature.GetGeometryRef();geometry=None;bbox=None;anchor=None
   if source_geom is not None and not source_geom.IsEmpty():
    g=source_geom.Clone();assert g.Transform(transform)==0,(name,fid)
    bbox=round_bounds(g);center=((bbox[0]+bbox[2])/2,(bbox[1]+bbox[3])/2)
    w=to_wgs.TransformPoint(*center);anchor=[round(w[0],6),round(w[1],6)]
    if tolerance:
     simple=g.SimplifyPreserveTopology(tolerance)
     if simple and not simple.IsEmpty():g=simple
    geometry=json.loads(g.ExportToJson(options=['COORDINATE_PRECISION=1']))
    key=(math.floor(center[0]/TILE),math.floor(center[1]/TILE));located+=1
   else:key=None;unlocated+=1
   groups[key].append({'type':'Feature','id':f'{slug}:{fid}','geometry':geometry,'bbox':bbox,'properties':{'layer':name,'fid':fid,'fields':fields,'anchorWgs84':anchor}})
  assert len(seen)==total,(name,len(seen),total)
  shards=[]
  for key,features in sorted(groups.items(),key=lambda x:(x[0] is None,x[0] or (0,0))):
   filename='unlocated.json.gz' if key is None else f'{tile_name(key[0])}_{tile_name(key[1])}.json.gz'
   relative=f'{slug}/{filename}';boxes=[f['bbox'] for f in features if f['bbox']]
   value=save(output/relative,{'type':'FeatureCollection','crs':{'type':'name','properties':{'name':TARGET}},'features':features})
   shards.append({'url':f'/gis/extra/{relative}','tile':list(key) if key else None,'bbox':union(boxes) if boxes else None,'count':len(features),**value})
  entries.append({'id':slug,'name':name,'sourceCount':total,'locatedCount':located,'unlocatedCount':unlocated,'geometryType':geom_type,
   'sourceCRS':original.GetName(),'sourceEPSG':original.GetAuthorityCode(None),'toleranceMetres':tolerance,'fieldSchema':schema,'redactions':dict(redactions),'shards':shards})
  print('EXPORTED',name,total,'unlocated',unlocated,'shards',len(shards),flush=True)
 manifest={'version':1,'crs':TARGET,'wgs84':'EPSG:4326','coordinates':'[동쪽, 북쪽] 미터; anchorWgs84=[경도, 위도]','tileSizeMetres':TILE,
  'scale':'사용자 제공 소축척 개요도; 원본 정확 축척·촬영일 미확인, 지적·법정 경계 판정 불가',
  'source':{'name':'사용자 제공 대한민국전도_.gpkg','sha256':sha(source),'provenance':'원저작자·제작일·정확한 사용허가가 확인되지 않아 배포 권리 확인 필요'},
  'layers':entries,'existing':[{'name':n,'count':ds.GetLayerByName(n).GetFeatureCount(),'reason':why} for n,why in EXISTING.items()],
  'excluded':[{'name':n,'count':ds.GetLayerByName(n).GetFeatureCount(),'reason':why} for n,why in EXCLUDED.items()]}
 (output/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n',encoding='utf8')
 print('SUMMARY',len(entries),sum(e['sourceCount'] for e in entries),'shards',sum(len(e['shards']) for e in entries),flush=True)
if __name__=='__main__':main()
