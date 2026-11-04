from pathlib import Path
import os, shutil
import concurrent.futures,subprocess,json
exe=os.environ.get('BLENDER_BIN') or shutil.which('blender') or r'C:\Program Files\Blender Foundation\Blender 5.2\blender.exe';root=Path.cwd()
entries=json.loads((root/'docs/20261104-blender-sky-copies.json').read_text(encoding='utf8'))['copies']
def get(path):
 out=subprocess.check_output([exe,'-b',str(root/path),'--python-exit-code','1','--python','scripts/audit_non_sky_geometry.py'],text=True,encoding='utf8',errors='replace',stderr=subprocess.STDOUT)
 return json.loads(next(s.removeprefix('GEOMETRY_AUDIT ') for s in out.splitlines() if s.startswith('GEOMETRY_AUDIT ')))
def check(e):
 before=get(e['source']);after=get(e['target']);assert before==after,(e['source'],before,after)
 print('GEOMETRY_OK',e['source'],flush=True);return {'source':e['source'],'geometry':before}
with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool: results=list(pool.map(check,entries))
(root/'docs/20261104-blender-geometry-validation.json').write_text(json.dumps({'results':results},ensure_ascii=False,indent=2)+'\n',encoding='utf8')
print('GEOMETRY_TOTAL',len(results),flush=True)
