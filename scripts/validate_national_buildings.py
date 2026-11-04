"""Independently verify every record, vertex, unique point and area against the SHP/DBF."""
from __future__ import annotations
from pathlib import Path
import argparse,gzip,json,math,sys
ROOT=Path(__file__).resolve().parents[1];sys.path.insert(0,str(ROOT/'scripts'))
from build_national_cultural import read_dbf_schema,decode_record,sha256
FIELDS=[f'A{i}' for i in range(31)];TILE_SIZE=10000

def check_geometry(geom,te,tn,row):
    from osgeo import ogr
    compact=row[3];extra=row[5] if len(row)==6 else None
    if len(row) not in (5,6) or (extra is not None and (extra.get('precision')!='source' or not isinstance(extra.get('polygons'),list))): raise ValueError('bad geometry extension')
    selected=extra['polygons'] if extra else compact
    name=geom.GetGeometryName().upper()
    parts=[geom] if name=='POLYGON' else [geom.GetGeometryRef(i) for i in range(geom.GetGeometryCount())] if name=='MULTIPOLYGON' else []
    if len(parts)!=len(selected) or len(parts)!=len(compact):raise ValueError('part count mismatch')
    shapes=[]
    for part,poly,legacy in zip(parts,selected,compact):
        if part.GetGeometryCount()!=len(poly) or len(poly)!=len(legacy):raise ValueError('ring count mismatch')
        rings=[]
        for i,(ring,old) in enumerate(zip(poly,legacy)):
            source=part.GetGeometryRef(i); count=source.GetPointCount()
            if len(ring)!=count*2 or len(old)!=count*2:raise ValueError('vertex count mismatch')
            points=[];before=set();after=set()
            for j in range(count):
                sx,sy=source.GetX(j),source.GetY(j); vx=te*TILE_SIZE+ring[2*j]/10;vy=tn*TILE_SIZE+ring[2*j+1]/10
                if not all(map(math.isfinite,(vx,vy))):raise ValueError('invalid coordinate')
                tolerance=1e-8 if extra else 0.0500001
                if abs(vx-sx)>tolerance or abs(vy-sy)>tolerance:raise ValueError('coordinate mismatch')
                if old[2*j]!=round((sx-te*TILE_SIZE)*10) or old[2*j+1]!=round((sy-tn*TILE_SIZE)*10):raise ValueError('legacy coordinate mismatch')
                before.add((sx,sy));after.add((vx,vy));points.append([vx,vy])
            if len(after)!=len(before):raise ValueError('unique vertices lost')
            rings.append(points)
        shapes.append(rings)
    decoded=ogr.CreateGeometryFromJson(json.dumps({'type':'MultiPolygon','coordinates':shapes}))
    if decoded is None or (geom.IsValid() and not decoded.IsValid()):raise ValueError('valid source became invalid')
    source_area=geom.GetArea();area=decoded.GetArea();error=abs(source_area-area)
    if extra and error>max(1e-8,abs(source_area)*1e-8):raise ValueError('precise area mismatch')
    return bool(extra),error

def validate(source,output):
    from osgeo import ogr,gdal
    ogr.UseExceptions();gdal.PushErrorHandler('CPLQuietErrorHandler')
    manifest=json.loads((output/'manifest.json').read_text(encoding='utf8'))
    for ext in ('.shp','.dbf','.shx'):
        if sha256(source.with_suffix(ext))!=manifest['inputSha256'][ext]:raise ValueError('source hash mismatch: '+ext)
    ds=ogr.Open(str(source.resolve()),0);layer=ds.GetLayer(0);seen=set();total=0;precise=0;max_area_error=0
    with source.with_suffix('.dbf').open('rb') as stream:
        count,header,length,schema=read_dbf_schema(stream)
        for e,n,expected_count,size,digest in manifest['tiles']:
            path=output/f'{e}_{n}.json.gz'
            if path.stat().st_size!=size or sha256(path)!=digest:raise ValueError('tile hash/size mismatch: '+str(path))
            with gzip.open(path,'rt',encoding='utf8') as z:tile=json.load(z)
            if tile['tile']!=[e,n] or len(tile['records'])!=expected_count:raise ValueError('tile content mismatch')
            for row in tile['records']:
                fid,x,y,_,values=row[:5]
                if fid in seen or not 0<=fid<count:raise ValueError('duplicate or invalid FID')
                seen.add(fid);stream.seek(header+fid*length);raw=stream.read(length);fields,_=decode_record(raw,schema)
                if raw[0]==0x2a or fields['A29'] not in ('I','U') or values!=[fields[k] for k in FIELDS]:raise ValueError(f'field mismatch: {fid}')
                f=layer.GetFeature(fid);geom=f.GetGeometryRef() if f else None
                if geom is None:raise ValueError(f'missing geometry: {fid}')
                try: is_precise,error=check_geometry(geom,e,n,row)
                except ValueError as exc:raise ValueError(f'FID {fid}: {exc}') from exc
                precise+=is_precise;max_area_error=max(max_area_error,error);centroid=geom.Centroid()
                if [x,y]!=[round((centroid.GetX()-e*TILE_SIZE)*10),round((centroid.GetY()-n*TILE_SIZE)*10)]:raise ValueError(f'centroid mismatch: {fid}')
                if (math.floor(centroid.GetX()/TILE_SIZE),math.floor(centroid.GetY()/TILE_SIZE))!=(e,n):raise ValueError(f'tile mismatch: {fid}')
                total+=1
        if total!=manifest['totalRecords'] or precise!=manifest['precisionExceptions']:raise ValueError('record or precision total mismatch')
        stream.seek(header);expected=set()
        for fid in range(manifest['readRecords']):
            raw=stream.read(length);fields,_=decode_record(raw,schema)
            if raw[0]!=0x2a and fields['A29'] in ('I','U'):expected.add(fid)
        missing=expected-seen;unlocated=output/'unlocated.json.gz'
        if unlocated.exists():
            with gzip.open(unlocated,'rt',encoding='utf8') as z:rows=json.load(z)
            if len(rows)!=manifest['unlocatedCount'] or set(row[0] for row in rows)!=missing:raise ValueError('unlocated mismatch')
            for fid,reason,values in rows:
                stream.seek(header+fid*length);fields,_=decode_record(stream.read(length),schema)
                if values!=[fields[k] for k in FIELDS]:raise ValueError('unlocated field mismatch')
        elif missing or manifest['unlocatedCount']:raise ValueError('missing records')
        if seen-expected:raise ValueError('unexpected records')
    print(json.dumps({'verified':total,'precise':precise,'unlocated':len(missing),'tiles':len(manifest['tiles']),'maxAreaDifferenceM2':max_area_error}))
if __name__=='__main__':
    p=argparse.ArgumentParser(description=__doc__);p.add_argument('--source',type=Path,required=True);p.add_argument('--output',type=Path,required=True);a=p.parse_args();validate(a.source,a.output)
