"""Export only the original campus core and its owned structural refinements."""
import contextlib,io,json,struct,hashlib
from pathlib import Path
import bpy
ROOT=Path(__file__).resolve().parents[1]
def export_core(output=None):
 output=Path(output) if output else ROOT/'public/model/stream/20261105-unified-core.glb'
 original=(ROOT/'public/model/stream/20261103-core.glb').read_bytes();n=struct.unpack_from('<I',original,12)[0];source=json.loads(original[20:20+n]);names=[x['name']for x in source['nodes']if 'mesh'in x]
 scene=bpy.context.scene
 required=[bpy.data.objects[n]for n in names]+[o for o in scene.objects if o.name.startswith('Unified shell - ')]
 for o in scene.objects:o.select_set(False)
 for o in required:o.hide_set(False);o.select_set(True)
 bpy.context.view_layer.objects.active=required[0]
 with contextlib.redirect_stdout(io.StringIO()):bpy.ops.export_scene.gltf(filepath=str(output),export_format='GLB',use_selection=True,use_active_scene=True,export_cameras=False,export_lights=False,export_animations=False)
 raw=output.read_bytes();n=struct.unpack_from('<I',raw,12)[0];g=json.loads(raw[20:20+n]);actual={x.get('name')for x in g['nodes']if 'mesh'in x};allowed={o.name for o in required};extras=actual-allowed
 if extras:raise ValueError(f'Unexpected exported mesh: {extras}')
 if len(raw)>25*1024*1024:raise ValueError('Pages asset limit exceeded')
 return {'url':'/model/stream/'+output.name,'bytes':len(raw),'objects':sum('mesh'in x for x in g['nodes']),'sha256':hashlib.sha256(raw).hexdigest()}
