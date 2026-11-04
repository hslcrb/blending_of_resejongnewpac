"""Export the QGIS-derived 50 m Seoul overview for the web viewer.

Rows are [easting grid index, northing grid index, mean height metres, class].
Classes 0/1/2 represent mostly height-attribute / mixed / all-placeholder cells.
Coordinates use EPSG:5186; the published geometry is aggregated, not footprints.
"""
from __future__ import annotations

import gzip
import json
import math
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SOURCE = ROOT / 'gis-sejong' / 'seoul' / 'seoul-grid-50m.json.gz'
OUTPUT = ROOT / 'v5' / 'public' / 'area' / 'seoul-grid.json'


def export() -> dict:
    with gzip.open(SOURCE, 'rt', encoding='utf-8') as file:
        source = json.load(file)
    if source.get('crs') != 'EPSG:5186' or source.get('cell_size_m') != 50:
        raise ValueError('Unexpected source coordinate system or grid size')
    seen = set()
    result = []
    for row in source['cells']:
        district, easting, northing, count, height, unknown, estimated, reported = row
        if not isinstance(easting, int) or not isinstance(northing, int):
            raise ValueError('Grid coordinates must be integers')
        if (easting, northing) in seen:
            raise ValueError(f'Duplicate grid coordinate: {easting}, {northing}')
        seen.add((easting, northing))
        if not isinstance(height, (int, float)) or not math.isfinite(height) or height <= 0:
            raise ValueError('Cell height must be finite and positive')
        if count <= 0 or count != unknown + estimated + reported:
            raise ValueError('Invalid source record counts')
        quality = 2 if unknown == count else 0 if reported * 2 >= count else 1
        result.append([easting, northing, height, quality])
    if len(result) != 123626:
        raise ValueError(f'Unexpected number of cells: {len(result)}')
    return {
        'version': 1,
        'crs': 'EPSG:5186',
        'cellSizeMeters': 50,
        'visibleWidthMeters': 47,
        'originEastingNorthing': [200000, 550000],
        'buildingRecords': source['counts']['included'],
        'excludedRecords': source['counts']['outside_envelope'],
        'cells': result,
    }


def main() -> None:
    data = export()
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_text(json.dumps(data, ensure_ascii=False, separators=(',', ':')) + '\n', encoding='utf-8')
    print(f"Exported {len(data['cells'])} cells to {OUTPUT} ({OUTPUT.stat().st_size} bytes)")


if __name__ == '__main__':
    main()
