"""Package CH_D010 building change footprints and original fields into spatial tiles."""
from __future__ import annotations
from collections import Counter, defaultdict
from pathlib import Path
import argparse, gzip, hashlib, json, math, sys

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'scripts'))
from build_national_cultural import read_dbf_schema, decode_record, sha256
TILE_SIZE = 10000
FIELDS = [f'A{i}' for i in range(31)]

def include_change(fields):
    return fields.get('A29') in {'I', 'U'}

def tile_index(easting, northing):
    return math.floor(easting / TILE_SIZE), math.floor(northing / TILE_SIZE)

def polygon_data(geometry, tile_e, tile_n):
    name = geometry.GetGeometryName().upper()
    parts = [geometry] if name == 'POLYGON' else [geometry.GetGeometryRef(i) for i in range(geometry.GetGeometryCount())] if name == 'MULTIPOLYGON' else []
    polygons = []
    for polygon in parts:
        rings = []
        for index in range(polygon.GetGeometryCount()):
            ring = polygon.GetGeometryRef(index)
            if ring is None or ring.GetPointCount() < 4: continue
            points = []
            for j in range(ring.GetPointCount()):
                x, y, _ = ring.GetPoint(j)
                if not math.isfinite(x) or not math.isfinite(y): raise ValueError('non-finite coordinate')
                points.extend((round((x-tile_e*TILE_SIZE)*10), round((y-tile_n*TILE_SIZE)*10)))
            rings.append(points)
        if rings: polygons.append(rings)
    return polygons

def precise_polygon_data(geometry, tile_e, tile_n):
    """Original doubles expressed in the same tile-relative decimetre units."""
    name = geometry.GetGeometryName().upper()
    parts = [geometry] if name == 'POLYGON' else [geometry.GetGeometryRef(i) for i in range(geometry.GetGeometryCount())] if name == 'MULTIPOLYGON' else []
    return [[[v for j in range(p.GetGeometryRef(i).GetPointCount()) for v in ((p.GetGeometryRef(i).GetX(j)-tile_e*TILE_SIZE)*10, (p.GetGeometryRef(i).GetY(j)-tile_n*TILE_SIZE)*10)] for i in range(p.GetGeometryCount())] for p in parts]

def needs_precision(geometry, compact):
    """Preserve topology and distinct vertices if 0.1 m quantization damages them."""
    from osgeo import ogr
    parts = [geometry] if geometry.GetGeometryName().upper() == 'POLYGON' else [geometry.GetGeometryRef(i) for i in range(geometry.GetGeometryCount())]
    if len(parts) != len(compact): return True
    for original, polygon in zip(parts, compact):
        if original.GetGeometryCount() != len(polygon): return True
        for index, ring in enumerate(polygon):
            source = original.GetGeometryRef(index)
            before = {(source.GetX(j), source.GetY(j)) for j in range(source.GetPointCount())}
            after = set(zip(ring[::2], ring[1::2]))
            if len(after) < len(before): return True
    coordinates = [[[[ring[i], ring[i+1]] for i in range(0,len(ring),2)] for ring in polygon] for polygon in compact]
    result = ogr.CreateGeometryFromJson(json.dumps({'type':'MultiPolygon','coordinates':coordinates}))
    return result is None or not result.IsValid()

def write_gzip(path, value):
    raw = json.dumps(value, ensure_ascii=False, separators=(',', ':')).encode('utf-8')
    with path.open('xb') as stream:
        with gzip.GzipFile(fileobj=stream, mode='wb', filename='', mtime=0) as zipped: zipped.write(raw)
    return path.stat().st_size

def convert(source, output, limit=0):
    from osgeo import gdal, ogr
    ogr.UseExceptions(); gdal.SetConfigOption('SHAPE_ENCODING','CP949')
    source = source.resolve(); output = output.resolve()
    if source.suffix.lower() != '.shp' or not source.is_file(): raise ValueError('기존 원본 SHP가 필요합니다.')
    if not output.is_relative_to(ROOT.resolve()) or output.exists(): raise ValueError('저장소 안의 아직 없는 출력 폴더가 필요합니다.')
    dataset = ogr.Open(str(source), 0)
    if not dataset: raise ValueError('원본 SHP를 열 수 없습니다.')
    layer = dataset.GetLayer(0)
    if layer.GetSpatialRef().GetAuthorityCode(None) != '5186': raise ValueError('EPSG:5186 원본이 필요합니다.')
    tiles = defaultdict(list); actions=Counter(); omitted=[]; anomalies=[]; max_span=0
    with source.with_suffix('.dbf').open('rb') as stream:
        count,header_length,record_length,schema = read_dbf_schema(stream); stream.seek(header_length)
        for fid in range(min(count, limit) if limit else count):
            raw = stream.read(record_length)
            if len(raw)!=record_length: raise ValueError(f'잘린 DBF 행: {fid}')
            fields,_ = decode_record(raw,schema)
            if raw[0] == 0x2a: actions['DBF-deleted'] += 1; continue
            actions[fields['A29'] or '(blank)'] += 1
            if not include_change(fields): continue
            feature=layer.GetFeature(fid); geom=feature.GetGeometryRef() if feature else None
            if geom is None or geom.IsEmpty(): omitted.append([fid,'empty geometry',[fields[k] for k in FIELDS]]); continue
            centroid=geom.Centroid()
            if centroid is None or centroid.IsEmpty(): omitted.append([fid,'empty centroid',[fields[k] for k in FIELDS]]); continue
            e,n=centroid.GetX(),centroid.GetY()
            if not math.isfinite(e) or not math.isfinite(n): omitted.append([fid,'invalid centroid',[fields[k] for k in FIELDS]]); continue
            te,tn=tile_index(e,n); polygons=polygon_data(geom,te,tn)
            if not polygons: omitted.append([fid,'unsupported geometry',[fields[k] for k in FIELDS]]); continue
            min_e,max_e,min_n,max_n=geom.GetEnvelope(); span=max(max_e-min_e,max_n-min_n);max_span=max(max_span,span)
            if span > TILE_SIZE: anomalies.append([fid,round(span,1)])
            record=[fid,round((e-te*TILE_SIZE)*10),round((n-tn*TILE_SIZE)*10),polygons,[fields[k] for k in FIELDS]]
            if needs_precision(geom,polygons): record.append({'precision':'source','polygons':precise_polygon_data(geom,te,tn)})
            tiles[(te,tn)].append(record)
    output.mkdir(parents=True,exist_ok=False)
    entries=[]
    for (te,tn),records in sorted(tiles.items()):
        path=output/f'{te}_{tn}.json.gz'; size=write_gzip(path,{'tile':[te,tn],'records':records})
        if size > 20*1024*1024: raise ValueError(f'배포 파일 용량 초과: {path.name}')
        entries.append([te,tn,len(records),size,sha256(path)])
    if omitted: write_gzip(output/'unlocated.json.gz',omitted)
    manifest={'version':1,'source':'CH_D010_00_20261103','sourceCrs':'EPSG:5186','tileSize':TILE_SIZE,'precision':0.1,'fields':FIELDS,'sourceRecords':count,'readRecords':min(count,limit) if limit else count,'actions':dict(actions),'totalRecords':sum(t[2] for t in entries),'unlocatedCount':len(omitted),'precisionExceptions':sum(len(record)>5 for records in tiles.values() for record in records),'maxSpanMeters':round(max_span,1),'oversizeFids':anomalies,'tiles':entries,'inputSha256':{ext:sha256(source.with_suffix(ext)) for ext in ('.shp','.dbf','.shx')},'note':'I/U changes only, not a complete or current nationwide building inventory; D records are excluded.'}
    (output/'manifest.json').write_bytes((json.dumps(manifest,ensure_ascii=False,indent=2)+'\n').encode('utf-8'))
    print(json.dumps({'tiles':len(entries),'records':manifest['totalRecords'],'unlocated':len(omitted),'actions':dict(actions),'maxSpanMeters':manifest['maxSpanMeters'],'oversize':len(anomalies),'bytes':sum(t[3] for t in entries)},ensure_ascii=False))

def main():
    parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('--source',type=Path,required=True);parser.add_argument('--output',type=Path,required=True);parser.add_argument('--limit',type=int,default=0);args=parser.parse_args()
    if args.limit < 0: parser.error('--limit must be non-negative')
    convert(args.source,args.output,args.limit)
if __name__=='__main__': main()
