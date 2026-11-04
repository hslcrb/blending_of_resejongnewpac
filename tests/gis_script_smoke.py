"""Run a read-only-source GIS regeneration smoke test inside .gis-runs.

Use QGIS Python and pass --source PATH to the user's ESRI Shapefile. Outputs are
intentionally retained in a uniquely named ignored run folder for inspection.
"""
import argparse
import gzip
import hashlib
import json
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
import zipfile

root = Path(__file__).resolve().parents[1]
import_root = root / 'blender_work' / '20261104-gis-import'
sys.path.insert(0, str(import_root))
sys.dont_write_bytecode = True
from gis_paths import RUN_ROOT, is_scratch

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--source', type=Path, required=True)
args = parser.parse_args()
source = args.source.resolve(strict=True)
source_dbf = source.with_suffix('.dbf')
assert source_dbf.is_file()
before = {p: (p.stat().st_size, p.stat().st_mtime_ns) for p in (source, source_dbf)}
source_hash = hashlib.sha256(source.read_bytes()).hexdigest()
RUN_ROOT.mkdir(parents=True, exist_ok=True)
run = Path(tempfile.mkdtemp(prefix='automated-smoke-', dir=RUN_ROOT)).resolve()
assert is_scratch(run) and run.parent == RUN_ROOT.resolve()
area = run / 'area'

def invoke(script, *arguments):
    subprocess.run([sys.executable, '-B', str(import_root / script), *map(str, arguments)], cwd=root, check=True)

invoke('web/export_buildings.py', source, '--output', area / 'buildings', '--limit', '100')
invoke('web/export_building_points.py', '--buildings', area / 'buildings', '--output', area / 'building-points.bin')
invoke('web/export_building_search.py', '--buildings', area / 'buildings', '--output', area / 'building-search')
invoke('web/validate_buildings.py', source, '--area', area)
invoke('web/validate_search.py', '--area', area)
aggregate = run / 'seoul-grid-sample.json.gz'
invoke('seoul/aggregate_seoul.py', source, '--output', aggregate, '--limit', '100')
with gzip.open(aggregate, 'rt', encoding='utf-8') as f:
    sample = json.load(f)
assert sample['counts']['source'] == 100
count = len(sample['cells'])
assert count > 0
invoke('web/export_city.py', '--output', run / 'seoul-grid.json')
assert json.loads((run / 'seoul-grid.json').read_text(encoding='utf-8')) == json.loads((root / 'public/area/seoul-grid.json').read_text(encoding='utf-8'))
qgis_dir = run / 'qgis'
invoke('seoul/export_qgis.py', '--source', aggregate, '--output-dir', qgis_dir)
moved = run / 'qgis-copy'
assert is_scratch(qgis_dir) and is_scratch(moved) and not moved.exists()
shutil.copytree(qgis_dir, moved)
with zipfile.ZipFile(moved / 'seoul_overview.qgz') as archive:
    xml = archive.read(next(n for n in archive.namelist() if n.endswith('.qgs'))).decode('utf-8')
    assert './seoul-grid-50m.gpkg' in xml
    assert str(qgis_dir).replace('\\', '/') not in xml
invoke('seoul/validate_project.py', '--project', moved / 'seoul_overview.qgz', '--expected-cells', count)
assert hashlib.sha256(source.read_bytes()).hexdigest() == source_hash
assert all((p.stat().st_size, p.stat().st_mtime_ns) == stats for p, stats in before.items())
print(f'PASS: read-only source, 100 records, {count} QGIS cells, relative project; scratch: {run}')
