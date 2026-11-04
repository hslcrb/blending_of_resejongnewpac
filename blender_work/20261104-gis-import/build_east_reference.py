"""Add a non-rendering east-side footprint comparison to the working scene."""
import bpy, json
from pathlib import Path
import sys
IMPORT_ROOT=Path(__file__).resolve().parent
sys.dont_write_bytecode = True
sys.path.insert(0,str(IMPORT_ROOT))
from gis_blender import open_scene_job,save_new_scene
_, target = open_scene_job(__doc__)
ROOT = IMPORT_ROOT
NAME = 'GIS - eastern footprints comparison (hidden)'
if bpy.data.collections.get(NAME):
    raise RuntimeError('Eastern reference collection already exists')
data = json.loads((ROOT / 'east-reference-5186.geojson').read_text(encoding='utf8'))
col = bpy.data.collections.new(NAME)
bpy.context.scene.collection.children.link(col)
mat = bpy.data.materials.get('GIS footprint - comparison orange') or bpy.data.materials.new('GIS footprint - comparison orange')
mat.diffuse_color = (1.0,0.22,0.02,1.0)
mat.use_nodes = True
next(n for n in mat.node_tree.nodes if n.type == 'BSDF_PRINCIPLED').inputs['Base Color'].default_value = mat.diffuse_color
for feature in data['features']:
    ident = feature['properties']['A0']
    curve = bpy.data.curves.new(f'GIS east reference {ident}', 'CURVE')
    curve.dimensions = '3D'; curve.bevel_depth = 0.35; curve.materials.append(mat)
    for ring in feature['geometry']['coordinates']:
        spline = curve.splines.new('POLY'); spline.points.add(len(ring)-1)
        for point, xy in zip(spline.points,ring):
            point.co = (xy[1]-552531,197897-xy[0],130.0,1)
        spline.use_cyclic_u = True
    obj = bpy.data.objects.new(curve.name,curve)
    obj.show_in_front = True; obj.hide_render = True
    obj['source_height_attribute_m'] = feature['properties']['A16']
    obj['source_floor_attribute'] = feature['properties']['A26']
    col.objects.link(obj)
col.hide_render = True; col.hide_viewport = True
col['note'] = 'Provisional registration; comparison outlines lifted to z=130m, not real elevation.'
print('Created', len(col.objects), 'east reference outlines')

save_new_scene(target)
