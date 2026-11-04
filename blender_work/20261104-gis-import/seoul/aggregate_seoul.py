"""Aggregate supplied Seoul building footprints into a 50 m overview grid with GDAL."""
from collections import defaultdict, Counter
from pathlib import Path
from osgeo import ogr
import argparse, gzip, json, math, sys

IMPORT_ROOT = Path(__file__).resolve().parents[1]
sys.dont_write_bytecode = True
sys.path.insert(0, str(IMPORT_ROOT))
from gis_paths import new_file
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('source', type=Path)
parser.add_argument('--output', type=Path, required=True)
parser.add_argument('--limit', type=int, default=0)
args = parser.parse_args()
if args.limit < 0: parser.error('--limit must be non-negative')
source = args.source
out = new_file(args.output)
size = 50
# Broad sanity envelope, not an administrative boundary.
bounds = (175000, 530000, 225000, 575000)
ds = ogr.Open(str(source), 0)
if ds is None: raise RuntimeError('Cannot open source')
layer = ds.GetLayer(0)
assert layer.GetSpatialRef().GetAuthorityCode(None) == '5186', 'Expected EPSG:5186'
cells = defaultdict(lambda: [0, 0., 0, 0, 0, Counter()])
district_counts = Counter()
counts = Counter()
for feature in layer:
    if args.limit and counts['source'] >= args.limit: break
    counts['source'] += 1
    code = str(feature.GetField('A23') or '')
    if not code.startswith('11'):
        counts['non_seoul_code'] += 1
        continue
    geom = feature.GetGeometryRef()
    if not geom or geom.IsEmpty():
        counts['empty'] += 1
        continue
    point = geom.Centroid()
    if not point or point.IsEmpty():
        counts['empty_centroid'] += 1
        continue
    e, n = point.GetX(), point.GetY()
    if not (math.isfinite(e) and math.isfinite(n) and bounds[0] <= e <= bounds[2] and bounds[1] <= n <= bounds[3]):
        counts['outside_envelope'] += 1
        continue
    h = feature.GetField('A16') or 0
    floors = feature.GetField('A26') or 0
    if isinstance(h, (int,float)) and math.isfinite(h) and 0 < h <= 500:
        height, kind = h, 2
    elif isinstance(floors, (int,float)) and 0 < floors <= 100:
        height, kind = floors * 3.2, 1
    else:
        height, kind = 3.2, 0
    key = (math.floor(e / size), math.floor(n / size))
    v = cells[key]
    v[0] += 1; v[1] += height; v[2 + kind] += 1
    v[5][code] += 1
    district_counts[code] += 1
    counts['included'] += 1
    counts[['placeholder','floors_estimate','height_attribute'][kind]] += 1
payload = {'version':1,'crs':'EPSG:5186','cell_size_m':size,'envelope':bounds,
           'height':'mean: A16 when plausible, else A26*3.2, else 3.2m display placeholder',
           'counts':dict(counts),'district_counts':dict(sorted(district_counts.items())),
           'cells':[[min(v[5], key=lambda code: (-v[5][code],code)),e,n,v[0],round(v[1]/v[0],2),v[2],v[3],v[4]] for (e,n),v in sorted(cells.items())],
           'mixed_district_cells':[[e,n,sorted(v[5].items())] for (e,n),v in sorted(cells.items()) if len(v[5]) > 1]}
with out.open('xb') as f:
    with gzip.GzipFile(fileobj=f, mode='wb', mtime=0) as z:
        z.write(json.dumps(payload,ensure_ascii=False,separators=(',',':')).encode('utf-8'))
print(json.dumps({'counts':dict(counts),'cells':len(cells),'districts':len(district_counts),'mixed_district_cells':len(payload['mixed_district_cells']),'bytes':out.stat().st_size}))
