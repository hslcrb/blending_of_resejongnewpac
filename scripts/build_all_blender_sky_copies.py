"""Make sky copies for every inventoried file, never overwriting an existing copy."""
from pathlib import Path
import os, shutil
import concurrent.futures,subprocess,hashlib,json,shutil,sys
root=Path.cwd().resolve(); inventory=json.loads((root/'docs/20261104-blender-source-inventory.json').read_text(encoding='utf8'))['files']
allowed=(root/'blender_work/20261104-live-sky').resolve()
exe=os.environ.get('BLENDER_BIN') or shutil.which('blender') or r'C:\Program Files\Blender Foundation\Blender 5.2\blender.exe'
manifest=root/'docs/20261104-blender-sky-copies.json'
previous={x['source']:x for x in json.loads(manifest.read_text(encoding='utf8'))['copies']} if manifest.exists() else {}
repair='--repair-verified' in sys.argv
def digest(p):
 h=hashlib.sha256()
 with p.open('rb') as f:
  for block in iter(lambda:f.read(1024*1024),b''):h.update(block)
 return h.hexdigest()
def build(entry):
 source=(root/entry['path']).resolve();target=(allowed/entry['path']).resolve()
 assert source.is_relative_to(root) and not source.is_relative_to(allowed) and target.is_relative_to(allowed)
 assert digest(source)==entry['sha256'], 'Source differs from inventory: '+entry['path']
 if target.exists():
  if not repair:return {'source':entry['path'],'target':target.relative_to(root).as_posix(),'state':'existing-untouched','sha256':digest(target),'bytes':target.stat().st_size}
  assert entry['path'] in previous and previous[entry['path']]['sha256']==digest(target), 'Modified copy: refusing replacement'
 target.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(source,target)
 try:
  out=subprocess.check_output([exe,'-b',str(target),'--python-exit-code','1','--python','scripts/install_blender_weather_sky.py','--',str(target),'docs/20261104-initial-rkss-observation.json'],text=True,encoding='utf8',errors='replace',stderr=subprocess.STDOUT)
  assert 'SKY_SAVED ' in out
  assert digest(source)==entry['sha256'], 'Original file changed'
  print('COMPLETE',entry['path'],flush=True)
  return {'source':entry['path'],'target':target.relative_to(root).as_posix(),'state':'created','sha256':digest(target),'bytes':target.stat().st_size}
 except subprocess.CalledProcessError as e:
  print('FAILED',entry['path'],e.output[-2500:],flush=True);raise
with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool: output=list(pool.map(build,inventory))
(root/'docs/20261104-blender-sky-copies.json').write_text(json.dumps({'copies':output},ensure_ascii=False,indent=2)+'\n',encoding='utf8')
print('COPIES',len(output),'BYTES',sum(x['bytes'] for x in output))
