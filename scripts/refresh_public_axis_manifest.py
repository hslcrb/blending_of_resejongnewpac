"""Read the Blender export evidence, verify it, and sync existing site manifests."""
import hashlib,json
from pathlib import Path
root=Path(__file__).resolve().parents[1]
asset=root/'public/model/public-axis-20261125'
data=json.loads((asset/'field-evidence.json').read_text())
def write(value,path):
    path.write_text(json.dumps(value,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
for k in ('theatre','garden','north'):
    entry=data[k]
    b=(root/'public'/entry['url'].lstrip('/')).read_bytes()
    if len(b)!=entry['bytes'] or hashlib.sha256(b).hexdigest()!=entry['sha256']:
        raise ValueError(f'Mismatched Blender export: {k}')
path=root/'public/model/streaming-manifest.json'
m=json.loads(path.read_text())
m['revision']='20261125-public-axis-v3-field'
m['sTheatrePatch']={**data['theatre'],'hideFromCore':data['hideFromCore']}
next(x for x in m['chunks'] if x['id']=='gratitude-garden').update(data['garden'])
n=next((x for x in m['chunks'] if x['id']=='gwanghwamun-north-axis'),None)
if n is None:
    n={'id':'gwanghwamun-north-axis','loadDistance':135,'unloadDistance':225,'shadowDistance':85,'maxViewDistance':420}
    m['chunks'].append(n)
n.update(data['north'])
write(m,path)
anchor=data['northAnchor']
write({'theatre':data['theatreLayout'],'north':{'x':anchor['x'],'z':anchor['z'],'walkLimitX':403.95}},root/'src/publicAxisLayout.json')
