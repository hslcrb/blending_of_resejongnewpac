"""Rebuild the owned integrated copy from preserved exterior/interior sources.
Run: blender --background --python scripts/rebuild_unified_building.py -- <new-output.blend>
"""
import sys,json
from pathlib import Path
import bpy
ROOT=Path(__file__).resolve().parents[1];sys.path.insert(0,str(ROOT/'scripts'))
from refine_unified_shell import apply
from append_campus_interior import append_campus_interior
from export_unified_core import export_core
from validate_unified_building import validate

def rebuild(output):
 output=Path(output).resolve();base=ROOT/'blender_work/20261105-unified'
 if not output.is_relative_to(base.resolve()) or output.exists():raise ValueError('A new file under the owned unified directory is required')
 source=ROOT/'blender_work/20261104-live-sky/blender_work/20261104/sejong_trees_connected_20261104.blend'
 bpy.ops.wm.open_mainfile(filepath=str(source));output.parent.mkdir(parents=True,exist_ok=True);bpy.ops.wm.save_as_mainfile(filepath=str(output));apply()
 append_campus_interior(bpy.context.scene,ROOT/'blender_work/20261104-live-sky/grand-theatre/sejong_grand_theatre_20261104.blend')
 old=bpy.context.scene;scene=bpy.data.scenes['20261103 - streaming web export']
 for o in list(old.objects):
  if o.name.startswith('Unified shell - ') and o.name not in scene.objects:scene.collection.objects.link(o)
 scene.collection.children.link(bpy.data.collections['CampusGrandTheatreInterior_20261105']);bpy.context.window.scene=scene;scene.name='세종문화회관 실내외 통합'
 for o in list(scene.objects):
  if o.name.startswith('Lobby '):
   if o.name in scene.collection.objects:scene.collection.objects.unlink(o)
   else:o.hide_render=True;o.hide_set(True)
 result=export_core();validate();bpy.ops.wm.save_as_mainfile(filepath=str(output));return result
if __name__=='__main__':
 args=sys.argv[sys.argv.index('--')+1:] if '--'in sys.argv else []
 if len(args)!=1:raise SystemExit('Pass a new .blend output under blender_work/20261105-unified')
 print(rebuild(args[0]))
