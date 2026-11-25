"""Split attributed 2026-10-01 administrative-dong data; dissolve Seoul districts.

Run with QGIS Python and GEOS. The input is an immutable licensed upstream
GeoJSON. No coordinates are simplified. Output is gzip-compressed WGS84 GeoJSON.
"""
import argparse
from collections import defaultdict
import gzip
import hashlib
import json
from pathlib import Path
from osgeo import ogr

ogr.UseExceptions()
SOURCE_COMMIT = 'd5d5a821c8de6cc337d47eeca604d7af76271c9b'
SOURCE_HASH = '843ece3a0b3429742cd4a1b699cc13987a88b5e5401f382e7fdaaa194ea5e605'
SOURCE_URL = f'https://raw.githubusercontent.com/vuski/admdongkor/{SOURCE_COMMIT}/ver20261001/HangJeongDong_ver20261001.geojson'
ATTRIBUTION = ('출처: 국가데이터처 통계지리정보서비스(SGIS, https://sgis.kostat.go.kr); '
               '가공: vuski/admdongkor(https://github.com/vuski/admdongkor), CC BY 4.0; '
               '추가 가공: 광역별 분할 및 서울 자치구 경계 병합.')


def sha(data):
    return hashlib.sha256(data).hexdigest()


def collection(features):
    return {'type': 'FeatureCollection', 'metadata': {'referenceDate': '2026-10-01', 'crs': 'EPSG:4326', 'attribution': ATTRIBUTION, 'license': 'CC BY 4.0', 'licenseUrl': 'https://creativecommons.org/licenses/by/4.0/'}, 'features': features}


def write_gzip(path, obj):
    payload = json.dumps(obj, ensure_ascii=False, separators=(',', ':')).encode('utf-8')
    compressed = gzip.compress(payload, compresslevel=9, mtime=0)
    if len(compressed) >= 25 * 1024 * 1024:
        raise ValueError(f'Cloudflare file exceeds 25 MiB: {path}')
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(compressed)
    return {'features': len(obj['features']), 'bytes': len(compressed), 'sha256': sha(compressed)}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source', type=Path, required=True)
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    source_bytes = args.source.read_bytes()
    if sha(source_bytes) != SOURCE_HASH:
        raise ValueError('Input differs from the pinned upstream version')
    raw = json.loads(source_bytes)
    if raw.get('type') != 'FeatureCollection' or len(raw['features']) != 3559:
        raise ValueError('Unexpected source feature count')
    if raw.get('crs', {}).get('properties', {}).get('name') != 'urn:ogc:def:crs:OGC:1.3:CRS84':
        raise ValueError('Expected WGS84 longitude/latitude source')
    groups, districts, all_codes = defaultdict(list), defaultdict(list), set()
    for feature in raw['features']:
        p = feature['properties']
        if not all(p.get(k) for k in ('sido', 'sidonm', 'sgg', 'sggnm', 'adm_cd2', 'adm_nm')):
            raise ValueError('Feature is missing an administrative identifier')
        if p['adm_cd2'] in all_codes:
            raise ValueError('Duplicate administrative code')
        all_codes.add(p['adm_cd2'])
        if feature.get('geometry', {}).get('type') not in ('Polygon', 'MultiPolygon'):
            raise ValueError('Unsupported or empty geometry')
        groups[p['sido']].append(feature)
        if p['sido'] == '11': districts[(p['sgg'], p['sggnm'])].append(feature)
    if len(groups) != 16 or len(districts) != 25 or len(groups['11']) != 427:
        raise ValueError('Unexpected regional or Seoul counts')

    args.output.mkdir(parents=True, exist_ok=True)
    assets, regions = {}, []
    for code, features in sorted(groups.items()):
        filename = f'regions/{code}.geojson.gz'
        assets[filename] = write_gzip(args.output / filename, collection(features))
        names = {f['properties']['sidonm'] for f in features}
        if len(names) != 1: raise ValueError(f'Conflicting names for region {code}')
        regions.append({'code': code, 'name': names.pop(), 'count': len(features), 'file': filename})

    # 서울 25개 자치구는 행정동 폴리곤의 합집합입니다.
    # Seoul districts are the geometric union of their source dong polygons.
    dissolved = []
    for (code, name), features in sorted(districts.items()):
        multipolygon = ogr.Geometry(ogr.wkbMultiPolygon)
        for feature in features:
            geometry = ogr.CreateGeometryFromJson(json.dumps(feature['geometry']))
            if not geometry.IsValid():
                raise ValueError(f'Invalid source geometry {feature["properties"]["adm_cd2"]}')
            if geometry.GetGeometryName() == 'POLYGON': multipolygon.AddGeometry(geometry)
            else:
                for polygon in geometry: multipolygon.AddGeometry(polygon)
        district = multipolygon.UnionCascaded()
        if district is None or district.IsEmpty() or not district.IsValid():
            raise ValueError(f'Invalid dissolved district {code} {name}')
        dissolved.append({'type': 'Feature', 'id': code,
                          'properties': {'code': code, 'name': name, 'sourceDongCount': len(features), 'sourceRegion': '11'},
                          'geometry': json.loads(district.ExportToJson())})
    district_file = 'seoul-districts.geojson.gz'
    assets[district_file] = write_gzip(args.output / district_file, collection(dissolved))
    manifest = {'version': 1, 'referenceDate': '2026-10-01', 'crs': 'EPSG:4326', 'coordinateOrder': '[longitude, latitude]',
                'boundaryType': 'administrative-dong, not legal-dong or cadastral', 'attribution': ATTRIBUTION,
                'license': {'derived': 'CC BY 4.0', 'url': 'https://creativecommons.org/licenses/by/4.0/',
                            'dataLicense': f'https://github.com/vuski/admdongkor/blob/{SOURCE_COMMIT}/LICENSE-DATA'},
                'source': {'provider': 'vuski/admdongkor; upstream Statistics Korea SGIS', 'url': SOURCE_URL,
                           'commit': SOURCE_COMMIT, 'sha256': SOURCE_HASH, 'featureCount': len(raw['features'])},
                'transformation': 'Split original feature collection by sido; Seoul districts dissolved from constituent administrative-dong polygons without simplification.',
                'regions': regions, 'assets': assets}
    (args.output / 'manifest.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(json.dumps({'source': len(raw['features']), 'regions': len(regions), 'seoulDong': len(groups['11']),
                      'seoulDistricts': len(dissolved), 'largestBytes': max(a['bytes'] for a in assets.values())}, ensure_ascii=False))


if __name__ == '__main__': main()
