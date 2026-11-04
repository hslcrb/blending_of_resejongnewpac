"""Read-only Blender file and scene inventory, including content hashes."""
import bpy, json
from pathlib import Path
import hashlib
p=Path(bpy.data.filepath); h=hashlib.sha256()
with p.open('rb') as f:
    for block in iter(lambda:f.read(1024*1024),b''): h.update(block)
scenes=[]
for s in bpy.data.scenes:
    scenes.append({'name':s.name,'objects':len(s.objects),'renderable':sum(o.type in {'MESH','CURVE','FONT','SURFACE','META','VOLUME'} and not o.hide_render for o in s.objects),'camera':bool(s.camera),'world':s.world.name if s.world else None,'frames':[s.frame_start,s.frame_end],'existingSky':bool(s.get('seoul_sky_axis'))})
print('SKY_INVENTORY',json.dumps({'sha256':h.hexdigest(),'bytes':p.stat().st_size,'scenes':scenes},ensure_ascii=False))
