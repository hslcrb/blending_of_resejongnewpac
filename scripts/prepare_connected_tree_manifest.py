"""Prepare raw tree partition manifest from original and freshly computed bounds."""
import json
from pathlib import Path
root=Path('public/model')
original=json.loads((root/'stream-shared/source-streaming-manifest.json').read_text(encoding='utf-8'))
bounds=json.loads((root/'trees-20261104/bounds.json').read_text(encoding='utf-8'))
assert len(bounds)==12
for entry in original['chunks']:
    if entry['id'] in bounds:
        name=f'20261104-{entry["id"]}.glb'
        source=root/'trees-20261104'/name
        assert source.is_file()
        entry['url']=f'/model/trees-20261104/{name}'
        entry['bytes']=source.stat().st_size
        entry['bounds']=bounds[entry['id']]
original['revision']='20261104-connected-trees'
(root/'trees-20261104/source-manifest.json').write_text(json.dumps(original,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print('Prepared tree partitions:',len(bounds))
