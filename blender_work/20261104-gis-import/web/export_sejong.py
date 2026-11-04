"""Export the copied Sejong scene to a web GLB without altering the blend."""
import bpy
from pathlib import Path
import sys
from io_scene_gltf2.io.exp import meshopt as meshopt_exporter

IMPORT_ROOT = Path(__file__).resolve().parents[1]
sys.dont_write_bytecode = True
sys.path.insert(0, str(IMPORT_ROOT))
from gis_blender import open_scene_job
source, target = open_scene_job(__doc__)
if target.suffix.lower() != '.glb': raise ValueError('Output must be a GLB file')
bpy.ops.object.select_all(action='DESELECT')
visible_fonts = [o for o in bpy.context.scene.objects if o.type == 'FONT' and o.visible_get() and not o.hide_render]
for obj in visible_fonts:
    obj.select_set(True)
if visible_fonts:
    bpy.context.view_layer.objects.active = visible_fonts[0]
    bpy.ops.object.convert(target='MESH')
bpy.ops.object.select_all(action='DESELECT')
selected = [o for o in bpy.context.scene.objects if o.type == 'MESH' and o.visible_get() and not o.hide_render]
for obj in selected:
    obj.select_set(True)
assert len(selected) >= 1200
assert sum(o.name.startswith('GIS west building') for o in selected) == 28
assert sum(o.name.startswith('GIS south building') for o in selected) == 4
assert all(i.packed_file for i in bpy.data.images if i.source == 'FILE')
if target.exists() or target.is_symlink(): raise FileExistsError(f'Refusing to overwrite {target}')
previous = meshopt_exporter.EXP_FILTER_BITS
try:
    meshopt_exporter.EXP_FILTER_BITS = 23
    bpy.ops.export_scene.gltf(filepath=str(target), export_format='GLB', use_selection=True,
        export_animations=False, export_cameras=False, export_lights=False,
        export_meshopt_compression_enable=True, export_meshopt_extension='EXT_meshopt_compression')
finally:
    meshopt_exporter.EXP_FILTER_BITS = previous
print('Exported', len(selected), 'visible meshes including', len(visible_fonts), 'converted labels;', target.stat().st_size, 'bytes')
