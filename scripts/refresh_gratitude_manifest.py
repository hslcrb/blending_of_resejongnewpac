"""Check the standalone Blender garden export and switch only its stream chunk."""
import hashlib
import json
from pathlib import Path

root = Path(__file__).resolve().parents[1]
asset = root/'public/model/public-axis-20261125'
e = json.loads((asset/'gratitude-plaza-evidence.json').read_text())
model = asset/'gratitude-plaza.glb'
assert e['url'] == '/model/public-axis-20261125/gratitude-plaza.glb'
assert model.stat().st_size == e['bytes'] and hashlib.sha256(model.read_bytes()).hexdigest() == e['sha256']
assert hashlib.sha256((root/'src/gratitudeGardenLayout.json').read_bytes()).hexdigest() == e['layoutSha256']
manifest = root/'public/model/streaming-manifest.json'
data = json.loads(manifest.read_text())
data['revision'] = '20261125-public-axis-v4-gratitude'
garden = next(c for c in data['chunks'] if c['id'] == 'gratitude-garden')
garden.update({k: e[k] for k in ('url','bytes','objects','bounds','sha256')})
manifest.write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n')
