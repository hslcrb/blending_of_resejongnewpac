"""Independently compare the extracted GeoJSON to source DBF bytes and SHP."""
import argparse
from collections import Counter
import hashlib
import json
import math
from pathlib import Path
import struct
from osgeo import ogr, osr

ogr.UseExceptions()
parser = argparse.ArgumentParser()
parser.add_argument("--source", type=Path, required=True)
parser.add_argument("--data", type=Path, required=True)
args = parser.parse_args()
with args.data.open(encoding="utf-8-sig") as stream:
    data = json.load(stream)
features = {f["id"]: f for f in data["features"]}
assert len(features) == len(data["features"])
dataset = ogr.Open(str(args.source), 0)
layer = dataset.GetLayer(0)
src = layer.GetSpatialRef()
src.SetAxisMappingStrategy(osr.OAMS_TRADITIONAL_GIS_ORDER)
dst = osr.SpatialReference()
dst.ImportFromEPSG(4326)
dst.SetAxisMappingStrategy(osr.OAMS_TRADITIONAL_GIS_ORDER)
reverse = osr.CoordinateTransformation(dst, src)
expected_fids, distances = set(), []
actions = Counter()
with args.source.with_suffix('.dbf').open('rb') as stream:
    header = stream.read(32)
    count, start, length = struct.unpack_from('<IHH', header, 4)
    fields, offset = [], 1
    while stream.tell() < start - 1:
        part = stream.read(32)
        name = part[:11].split(b'\0', 1)[0].decode('ascii')
        width = part[16]
        fields.append((name, offset, width))
        offset += width
    assert [x[0] for x in fields] == [f'A{i}' for i in range(31)]
    stream.seek(start)
    for fid in range(count):
        row = stream.read(length)
        if row[0] == 0x2A:
            continue
        values = {}
        for name, begin, width in fields:
            raw = row[begin:begin+width].strip(b' \0')
            try:
                values[name] = raw.decode('euc-kr') if raw else None
            except UnicodeDecodeError:
                values[name] = raw.decode('cp949')
        actions[values['A29']] += 1
        eligible = (values['A29'] in {'U', 'I'} and
                    (values['A8'] in {'05000', 'Z5000'} or '문화' in (values['A9'] or '') or '집회' in (values['A9'] or '')))
        if not eligible:
            continue
        expected_fids.add(fid)
        candidate = features[fid]
        assert candidate['properties']['fields'] == values, f'FID {fid} fields differ'
        assert candidate['properties']['sourceFid'] == fid
        geom = candidate['geometry']
        if geom is None:
            continue
        point = ogr.Geometry(ogr.wkbPoint)
        point.AddPoint_2D(*geom['coordinates'])
        point.Transform(reverse)
        original = layer.GetFeature(fid)
        distance = original.GetGeometryRef().Distance(point)
        assert math.isfinite(distance) and distance <= 0.03, f'FID {fid}: point distance {distance} m'
        distances.append(distance)
assert expected_fids == set(features), 'candidate set differs'
print(json.dumps({'sourceRecords': count, 'sourceActions': actions, 'verifiedCandidates': len(features),
                  'fieldsPerCandidate': 31, 'maxPointDistanceMeters': max(distances, default=0)}, ensure_ascii=False))
