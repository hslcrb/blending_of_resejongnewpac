"""Cross-check split features, district unions and Seoul city dong names."""
import argparse
from collections import Counter
import gzip
import hashlib
from html.parser import HTMLParser
import json
from pathlib import Path
import re
from osgeo import ogr

ogr.UseExceptions()
parser = argparse.ArgumentParser()
parser.add_argument('--source', type=Path, required=True)
parser.add_argument('--output', type=Path, required=True)
parser.add_argument('--seoul-reference', type=Path, required=True)
args = parser.parse_args()
source = json.loads(args.source.read_text(encoding='utf-8'))
manifest = json.loads((args.output / 'manifest.json').read_text(encoding='utf-8'))
assert hashlib.sha256(args.source.read_bytes()).hexdigest() == manifest['source']['sha256']
original = {feature['properties']['adm_cd2']: feature for feature in source['features']}
assert len(original) == len(source['features'])
reassembled = {}
for region in manifest['regions']:
    payload = gzip.decompress((args.output / region['file']).read_bytes())
    for feature in json.loads(payload)['features']:
        code = feature['properties']['adm_cd2']
        assert code not in reassembled
        assert feature == original[code], f'Original feature changed: {code}'
        reassembled[code] = feature
assert original.keys() == reassembled.keys()
for feature in source['features']:
    polygon = ogr.CreateGeometryFromJson(json.dumps(feature['geometry']))
    assert polygon.IsValid(), feature['properties']['adm_nm']
    west, east, south, north = polygon.GetEnvelope()
    assert 124 <= west <= east <= 132 and 32 <= south <= north <= 44, feature['properties']['adm_nm']
seoul = [feature for feature in source['features'] if feature['properties']['sido'] == '11']
districts = json.loads(gzip.decompress((args.output / 'seoul-districts.geojson.gz').read_bytes()))['features']
district_map = {item['properties']['code']: ogr.CreateGeometryFromJson(json.dumps(item['geometry'])) for item in districts}
assert len(district_map) == 25
for feature in seoul:
    polygon = ogr.CreateGeometryFromJson(json.dumps(feature['geometry']))
    district = district_map[feature['properties']['sgg']]
    assert district.IsValid()
    leftover = polygon.Difference(district)
    assert leftover is not None and leftover.GetArea() < 1e-12, feature['properties']['adm_nm']

class OfficialNames(HTMLParser):
    def __init__(self):
        super().__init__()
        self.district = self.heading = self.cell = self.row = False
        self.cellnum = 0
        self.head = self.text = ''
        self.name = None
        self.items = []
    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag == 'div' and {'district', 'tabcont'} <= set(attrs.get('class', '').split()): self.district = True
        if not self.district: return
        if tag == 'h5': self.heading = True; self.head = ''
        if tag == 'tr': self.row = True; self.cellnum = 0
        if tag == 'td' and self.row: self.cellnum += 1; self.cell = self.cellnum == 1; self.text = ''
    def handle_endtag(self, tag):
        if not self.district: return
        if tag == 'h5':
            self.heading = False
            match = re.search(r'\d+\)\s*([가-힣\s]+구)', self.head)
            self.name = re.sub(r'\s+', '', match.group(1)) if match else None
        if tag == 'td' and self.cell:
            self.items.append((self.name, self.text.split('(')[0])); self.cell = False
        if tag == 'tr': self.row = False
        if tag == 'div': self.district = False
    def handle_data(self, text):
        if self.heading: self.head += text
        if self.cell: self.text += text

def normal(name):
    name = name.replace('洞', '동')
    name = re.sub(r'제(?=\d)', '', name)
    return re.sub(r'[\s,.·ㆍ]', '', name)

official = OfficialNames()
html = args.seoul_reference.read_bytes()
official.feed(html.decode('utf-8'))
expected = {(borough, normal(name)) for borough, name in official.items}
actual = {(f['properties']['sggnm'], normal(f['properties']['adm_nm'].split()[-1])) for f in seoul}
assert len(official.items) == len(expected) == len(actual) == 427
assert expected == actual, {'onlyOfficial': sorted(expected - actual), 'onlySource': sorted(actual - expected)}
report = {'sourceFeaturesCompared': len(reassembled), 'sourceFieldsAndGeometriesPreserved': True,
          'sourceGeometriesValid': len(original), 'sourceCoordinateBoundsChecked': True, 'seoulDistricts': len(districts), 'seoulDong': len(seoul), 'districtUnionsCoverAllDong': True,
          'nameComparison': {'officialUrl': 'https://www.seoul.go.kr/seoul/autonomy_sub.do',
                             'officialHtmlSha256': hashlib.sha256(html).hexdigest(),
                             'comparedNames': len(expected), 'mismatchesAfterNormalization': 0,
                             'normalization': 'spaces, punctuation, 제 before number and 洞/동'},
          'seoulDistrictCounts': dict(sorted(Counter(f['properties']['sggnm'] for f in seoul).items()))}
(args.output / 'seoul-validation.json').write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
print(json.dumps(report, ensure_ascii=False))
