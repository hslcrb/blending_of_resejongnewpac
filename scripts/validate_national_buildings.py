"""Verify packaged building change records against the original DBF and SHP."""
from __future__ import annotations
from pathlib import Path
import argparse, gzip, json, math, sys
ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'scripts'))
from build_national_cultural import read_dbf_schema, decode_record, sha256
from build_national_buildings import FIELDS, TILE_SIZE, include_change, polygon_data

def validate(source, output):
    from osgeo import ogr
    ogr.UseExceptions()
    manifest = json.loads((output / 'manifest.json').read_text(encoding='utf-8'))
    dataset = ogr.Open(str(source.resolve()), 0)
    if dataset is None: raise ValueError('source could not be opened')
    layer = dataset.GetLayer(0)
    seen=set(); total=0
    with source.with_suffix('.dbf').open('rb') as stream:
        count, header, length, schema = read_dbf_schema(stream)
        for e,n,expected_count,size,digest in manifest['tiles']:
            path=output / f'{e}_{n}.json.gz'
            if path.stat().st_size != size or sha256(path) != digest: raise ValueError(f'tile hash/size mismatch: {path}')
            with gzip.open(path,'rt',encoding='utf-8') as zipped: tile=json.load(zipped)
            if tile['tile'] != [e,n] or len(tile['records']) != expected_count: raise ValueError(f'tile content mismatch: {path}')
            for fid,x,y,polygons,values in tile['records']:
                if fid in seen or not 0 <= fid < count: raise ValueError(f'duplicate or invalid FID: {fid}')
                seen.add(fid); stream.seek(header + fid*length); raw=stream.read(length); fields,_=decode_record(raw,schema)
                if raw[0] == 0x2a or not include_change(fields) or values != [fields[k] for k in FIELDS]: raise ValueError(f'field mismatch: {fid}')
                feature=layer.GetFeature(fid); geom=feature.GetGeometryRef() if feature else None
                if geom is None or polygons != polygon_data(geom,e,n): raise ValueError(f'geometry mismatch: {fid}')
                centroid=geom.Centroid()
                if [x,y] != [round((centroid.GetX()-e*TILE_SIZE)*10),round((centroid.GetY()-n*TILE_SIZE)*10)]: raise ValueError(f'centroid mismatch: {fid}')
                total+=1
        if total != manifest['totalRecords']: raise ValueError('record total mismatch')
        stream.seek(header)
        expected=set()
        for fid in range(manifest['readRecords']):
            raw=stream.read(length); fields,_=decode_record(raw,schema)
            if raw[0] != 0x2a and include_change(fields): expected.add(fid)
        missing=expected-seen
        unlocated=output/'unlocated.json.gz'
        if unlocated.exists():
            with gzip.open(unlocated,'rt',encoding='utf-8') as zipped: rows=json.load(zipped)
            if len(rows)!=manifest['unlocatedCount'] or set(row[0] for row in rows)!=missing: raise ValueError('unlocated mismatch')
            for fid,reason,values in rows:
                stream.seek(header+fid*length); fields,_=decode_record(stream.read(length),schema)
                if values != [fields[k] for k in FIELDS]: raise ValueError(f'unlocated field mismatch: {fid}')
        elif missing or manifest['unlocatedCount']: raise ValueError('missing records')
        if seen-expected: raise ValueError('unexpected records')
    print(json.dumps({'verified':total,'unlocated':len(missing),'tiles':len(manifest['tiles'])}))

if __name__=='__main__':
    p=argparse.ArgumentParser(description=__doc__);p.add_argument('--source',type=Path,required=True);p.add_argument('--output',type=Path,required=True);args=p.parse_args();validate(args.source,args.output)
