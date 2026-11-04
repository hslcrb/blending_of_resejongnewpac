"""Export every supplied building's footprint and attributes in 1 km GIS tiles."""
from osgeo import ogr, gdal
from pathlib import Path
from collections import Counter, defaultdict
import argparse, gzip, json, math, shutil

ROOT = Path(__file__).resolve().parents[2]
FIELDS = [f'A{i}' for i in range(29)]
SIZE = 1000

def polygons(geom, tile_e, tile_n):
    name = geom.GetGeometryName().upper()
    parts = [geom] if name == 'POLYGON' else [geom.GetGeometryRef(i) for i in range(geom.GetGeometryCount())] if name == 'MULTIPOLYGON' else []
    result = []
    for poly in parts:
        rings = []
        for i in range(poly.GetGeometryCount()):
            ring = poly.GetGeometryRef(i)
            if ring.GetPointCount() < 4:
                continue
            points=[]
            for j in range(ring.GetPointCount()):
                x,y,_=ring.GetPoint(j)
                points.extend((round((x-tile_e*SIZE)*10), round((y-tile_n*SIZE)*10)))
            rings.append(points)
        if rings: result.append(rings)
    return result

def run(source, output, work, limit):
    if output.exists() or work.exists(): raise RuntimeError('Refusing to overwrite output or temporary directory')
    output.mkdir(parents=True); work.mkdir(parents=True)
    gdal.SetConfigOption('SHAPE_ENCODING','CP949')
    ds=ogr.Open(str(source),0)
    if ds is None: raise RuntimeError('Cannot open source')
    layer=ds.GetLayer(0)
    if layer.GetSpatialRef().GetAuthorityCode(None) != '5186': raise RuntimeError('Expected EPSG:5186')
    counts=Counter(); pending=defaultdict(list); omitted=[]; max_span=0
    def flush():
        for (e,n), rows in pending.items():
            with (work/f'{e}_{n}.ndjson').open('a',encoding='utf8',newline='\n') as file:
                file.write('\n'.join(rows)+'\n')
        pending.clear()
    for feature in layer:
        if limit and counts['read'] >= limit: break
        counts['read'] += 1
        geom=feature.GetGeometryRef(); fid=feature.GetFID()
        if geom is None or geom.IsEmpty():
            omitted.append([fid,'empty geometry']); continue
        center=geom.Centroid()
        if not center or center.IsEmpty():
            omitted.append([fid,'empty centroid']); continue
        e,n=center.GetX(),center.GetY()
        if not (math.isfinite(e) and math.isfinite(n)):
            omitted.append([fid,'invalid coordinate']); continue
        te,tn=math.floor(e/SIZE), math.floor(n/SIZE)
        geometry=polygons(geom,te,tn)
        if not geometry:
            omitted.append([fid,'unsupported geometry']); continue
        min_e,max_e,min_n,max_n=geom.GetEnvelope()
        max_span=max(max_span,max_e-min_e,max_n-min_n)
        attributes=[feature.GetField(name) for name in FIELDS]
        row=[fid,round((e-te*SIZE)*10),round((n-tn*SIZE)*10),geometry,attributes]
        pending[(te,tn)].append(json.dumps(row,ensure_ascii=False,separators=(',',':')))
        counts[(te,tn)] += 1
        if counts['read'] % 5000 == 0: flush()
    flush()
    manifest={'version':1,'source':'AL_D010_11_20261009','crs':'EPSG:5186','tileSize':SIZE,'precision':0.1,'fields':FIELDS,'totalRead':counts['read'],'totalRecords':sum(v for k,v in counts.items() if isinstance(k,tuple)), 'omitted':omitted, 'maxSpanMeters':round(max_span,2),'tiles':[]}
    for key in sorted(k for k in counts if isinstance(k,tuple)):
        e,n=key; dest=output/f'{e}_{n}.json.gz'
        with dest.open('wb') as raw, gzip.GzipFile(fileobj=raw,mode='wb',mtime=0) as zipped:
            zipped.write(f'{{"tile":[{e},{n}],"records":['.encode())
            first=True
            with (work/f'{e}_{n}.ndjson').open('rb') as src:
                for line in src:
                    if not first: zipped.write(b',')
                    zipped.write(line.rstrip(b'\r\n'));first=False
            zipped.write(b']}')
        manifest['tiles'].append([e,n,counts[key],dest.stat().st_size])
    (output/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,separators=(',',':'))+'\n',encoding='utf8')
    resolved=work.resolve(); allowed=(ROOT/'gis-sejong'/'web').resolve()
    if allowed not in resolved.parents or resolved.name!='metadata-work': raise RuntimeError('Unexpected temporary path')
    shutil.rmtree(resolved)
    print(json.dumps({'records':manifest['totalRecords'],'read':manifest['totalRead'],'omitted':omitted,'tiles':len(manifest['tiles']),'bytes':sum(t[3] for t in manifest['tiles']),'maxSpanMeters':manifest['maxSpanMeters']}))

if __name__=='__main__':
    parser=argparse.ArgumentParser(); parser.add_argument('source',type=Path);parser.add_argument('--limit',type=int,default=0);parser.add_argument('--sample',action='store_true'); args=parser.parse_args()
    out=ROOT/'v5'/'public'/'area'/('buildings-sample' if args.sample else 'buildings')
    run(args.source,out,ROOT/'gis-sejong'/'web'/'metadata-work',args.limit)
