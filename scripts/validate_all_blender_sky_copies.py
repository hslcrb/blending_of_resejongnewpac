"""Validate all copied scenes and compare original scene inventory without saving."""
from pathlib import Path
import os, shutil
import concurrent.futures,subprocess,json,hashlib
root=Path.cwd();original=json.loads((root/'docs/20261104-blender-source-inventory.json').read_text(encoding='utf8'))['files'];copies=json.loads((root/'docs/20261104-blender-sky-copies.json').read_text(encoding='utf8'))['copies'];copy_by_source={c['source']:c for c in copies}
exe=os.environ.get('BLENDER_BIN') or shutil.which('blender') or r'C:\Program Files\Blender Foundation\Blender 5.2\blender.exe'
def verify(entry):
 copy=copy_by_source[entry['path']];path=root/copy['target'];source=root/entry['path']
 assert hashlib.sha256(source.read_bytes()).hexdigest()==entry['sha256'],entry['path']
 assert hashlib.sha256(path.read_bytes()).hexdigest()==copy['sha256'],copy['target']
 out=subprocess.check_output([exe,'-b',str(path),'--python-exit-code','1','--python','scripts/validate_blender_weather_sky.py','--python','scripts/audit_blender_scenes.py'],text=True,encoding='utf8',errors='replace',stderr=subprocess.STDOUT)
 tag=next(x[len('SKY_INVENTORY '):] for x in out.splitlines() if x.startswith('SKY_INVENTORY '));found=json.loads(tag)
 before={s['name']:s for s in entry['scenes']};after={s['name']:s for s in found['scenes']};assert before.keys()==after.keys(),entry['path']
 for name,old in before.items():
  new=after[name];assert new['objects']==old['objects']+2,(entry['path'],name,old['objects'],new['objects'])
  assert new['renderable']==old['renderable'] and new['camera']==old['camera'],(entry['path'],name)
  assert new['frames']==[1,145],(entry['path'],name)
 print('VALID_COPY',entry['path'],len(before),flush=True)
 return {'source':entry['path'],'target':copy['target'],'scenes':len(before),'original_sha256':entry['sha256'],'copy_sha256':copy['sha256'],'validation':'passed'}
with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool: results=list(pool.map(verify,original))
(root/'docs/20261104-blender-sky-validation.json').write_text(json.dumps({'results':results,'totalScenes':sum(x['scenes'] for x in results)},ensure_ascii=False,indent=2)+'\n',encoding='utf8')
print('VALID_TOTAL',len(results),'files',sum(x['scenes'] for x in results),'scenes',flush=True)
