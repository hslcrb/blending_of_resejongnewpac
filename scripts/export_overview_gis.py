#!/usr/bin/env python3
"""Export the supplied QGIS overview map as compact, projected web data.

This script only reads the source GeoPackage. Run with QGIS's Python/GDAL.
"""
from __future__ import annotations
import argparse
import gzip
import hashlib
import json
import math
from pathlib import Path
from osgeo import gdal, ogr, osr

gdal.UseExceptions()
ogr.UseExceptions()
CRS = 'EPSG:5186'
BOUNDS = [175000, 525000, 225000, 575000]  # easting/northing metres, Seoul vicinity
NATIONAL = {'시도_백지도': 50, '시군구_백지도_': 50}
SEOUL = {'행정경계': 5, '특별광역자치시도경계': 5, '해안선': 5, '실폭하천': 5, '고속국도': 5, '일반국도': 5, '지방도': 5, '고속철도': 5, '일반철도': 5}
MAX_BYTES = 20 * 1024 * 1024


def digest(path):
    h = hashlib.sha256()
    with path.open('rb') as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b''):
            h.update(block)
    return h.hexdigest()


def ref(authority):
    s = osr.SpatialReference()
    s.SetFromUserInput(authority)
    s.SetAxisMappingStrategy(osr.OAMS_TRADITIONAL_GIS_ORDER)
    return s


def clean(value):
    if isinstance(value, float) and not math.isfinite(value):
        return None
    return value


def geometry_bounds(b):
    return ogr.CreateGeometryFromWkt(f'POLYGON (({b[0]} {b[1]}, {b[2]} {b[1]}, {b[2]} {b[3]}, {b[0]} {b[3]}, {b[0]} {b[1]}))')


def export_layers(ds, layers, bounds=None):
    out, counts = [], {}
    target = ref(CRS)
    clip = geometry_bounds(bounds) if bounds else None
    for name, tolerance in layers.items():
        layer = ds.GetLayerByName(name)
        if layer is None:
            raise ValueError(f'Missing source layer: {name}')
        source = layer.GetSpatialRef()
        if not source:
            raise ValueError(f'Missing source CRS: {name}')
        source = source.Clone()
        source.SetAxisMappingStrategy(osr.OAMS_TRADITIONAL_GIS_ORDER)
        transform = osr.CoordinateTransformation(source, target)
        if bounds:
            inverse = osr.CoordinateTransformation(target, source)
            x1, y1, x2, y2 = inverse.TransformBounds(*bounds, 21)
            layer.SetSpatialFilterRect(x1, y1, x2, y2)
        total = 0
        for feature in layer:
            geom = feature.GetGeometryRef()
            if geom is None or geom.IsEmpty():
                continue
            geom = geom.Clone()
            if geom.Transform(transform) != 0:
                raise ValueError(f'Coordinate transformation failed: {name} {feature.GetFID()}')
            if clip:
                if not geom.Intersects(clip):
                    continue
                geom = geom.Intersection(clip)
                if not geom or geom.IsEmpty():
                    continue
            simplified = geom.SimplifyPreserveTopology(tolerance)
            if not simplified or simplified.IsEmpty():
                simplified = geom
            geo = json.loads(simplified.ExportToJson(options=['COORDINATE_PRECISION=1']))
            fields = {feature.GetFieldDefnRef(i).GetName(): clean(feature.GetField(i)) for i in range(feature.GetFieldCount()) if feature.GetFieldDefnRef(i).GetName().lower() != 'path'}
            out.append({'type': 'Feature', 'id': f'{name}:{feature.GetFID()}', 'geometry': geo, 'properties': {'layer': name, 'fid': feature.GetFID(), 'fields': fields}})
            total += 1
        layer.SetSpatialFilter(None)
        counts[name] = total
        print(f'{name}: {total} features', flush=True)
    return {'type': 'FeatureCollection', 'crs': {'type': 'name', 'properties': {'name': CRS}}, 'features': out}, counts


def save_gzip(path, data):
    payload = json.dumps(data, ensure_ascii=False, separators=(',', ':'), allow_nan=False).encode('utf-8')
    with path.open('wb') as raw:
        with gzip.GzipFile(filename='', mode='wb', fileobj=raw, compresslevel=9, mtime=0) as compressed:
            compressed.write(payload)
    if path.stat().st_size > MAX_BYTES:
        raise ValueError(f'{path} exceeds {MAX_BYTES} bytes')
    return {'compressedBytes': path.stat().st_size, 'uncompressedBytes': len(payload), 'sha256': digest(path)}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--input', type=Path, required=True, help='Read-only GeoPackage from supplied QGIS project')
    parser.add_argument('--output', type=Path, default=Path('public/gis'))
    args = parser.parse_args()
    if not args.input.is_file():
        parser.error('Input GeoPackage does not exist')
    args.output.mkdir(parents=True, exist_ok=True)
    ds = ogr.Open(str(args.input), 0)
    if ds is None:
        raise ValueError('Could not open input GeoPackage')
    assets = {}
    for filename, layers, bounds in [('national-admin.json.gz', NATIONAL, None), ('seoul-ground.json.gz', SEOUL, BOUNDS)]:
        data, counts = export_layers(ds, layers, bounds)
        assets[filename] = {**save_gzip(args.output / filename, data), 'layers': counts, 'simplificationMetres': layers, 'clipBounds5186': bounds}
    manifest = {'version': 1, 'format': 'gzip-compressed GeoJSON with projected metre coordinates', 'crs': CRS, 'coordinates': '[easting, northing]', 'dataKind': 'small-scale overview, not cadastral or authoritative current boundary', 'source': 'User-supplied 대한민국전도_.gpkg / 대한민국전도.qgz', 'sourceSha256': digest(args.input), 'provenance': 'Exact original producer, date and licence not identified in supplied layer metadata.', 'assets': assets}
    (args.output / 'manifest.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print('Export complete:', json.dumps(assets, ensure_ascii=False), flush=True)


if __name__ == '__main__':
    main()
