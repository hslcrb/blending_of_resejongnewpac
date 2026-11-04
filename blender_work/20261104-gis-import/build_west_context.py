"""Add a provisional, GIS-footprint-based western context to a copy of the scene."""
import bpy
import bmesh
import json
from pathlib import Path
import sys
IMPORT_ROOT=Path(__file__).resolve().parent
sys.dont_write_bytecode = True
sys.path.insert(0,str(IMPORT_ROOT))
from gis_blender import open_scene_job,save_new_scene
_, target = open_scene_job(__doc__)

ROOT = IMPORT_ROOT
DATA = ROOT / 'west-buildings.geojson'
COLLECTION = 'GIS - western building context (provisional)'

def build():
    if bpy.data.collections.get(COLLECTION) or bpy.data.collections.get('GIS - Sejong footprint reference (hidden)'):
        raise RuntimeError('GIS collection already exists; refusing to duplicate it')
    data = json.loads(DATA.read_text(encoding='utf-8'))
    col = bpy.data.collections.new(COLLECTION)
    bpy.context.scene.collection.children.link(col)
    mat = bpy.data.materials.new('GIS context - warm stone')
    mat.diffuse_color = (0.47, 0.46, 0.43, 1.0)
    mat.use_nodes = True
    shader = next(n for n in mat.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')
    shader.inputs['Base Color'].default_value = mat.diffuse_color
    shader.inputs['Roughness'].default_value = 0.82
    for idx, feature in enumerate(data['features'], 1):
        ring = feature['geometry']['coordinates'][0]
        if ring[0] == ring[-1]: ring = ring[:-1]
        points = [(p[1] - 552531, 197897 - p[0]) for p in ring]
        props = feature['properties']
        height = props['height_attribute_m'] or props['floors_attribute'] * 3.2
        n = len(points)
        verts = [(x,y,z) for z in (0.0, height) for x,y in points]
        faces = [tuple(reversed(range(n))), tuple(range(n,2*n))]
        faces += [(i,(i+1)%n,(i+1)%n+n,i+n) for i in range(n)]
        mesh = bpy.data.meshes.new(f'GIS west {idx:02d} mesh')
        mesh.from_pydata(verts, [], faces)
        mesh.update()
        bm = bmesh.new()
        bm.from_mesh(mesh)
        bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
        bm.to_mesh(mesh)
        bm.free()
        obj = bpy.data.objects.new(f'GIS west building {idx:02d}', mesh)
        col.objects.link(obj)
        obj.data.materials.append(mat)
        obj['height_basis'] = 'source A16 (unverified)' if props['height_attribute_m'] else 'A26 floors x 3.2m (estimate)'
        obj['height_m'] = height
    col['registration'] = 'EPSG:5186 E,N -> Blender X=N-552531, Y=197897-E; approximate fit'
    # Retain the source parcel outlines as an independently switchable reference.
    ref = bpy.data.collections.new('GIS - Sejong footprint reference (hidden)')
    bpy.context.scene.collection.children.link(ref)
    footprint = json.loads((ROOT / 'sejong-parcel-5186.geojson').read_text(encoding='utf-8'))
    ref_mat = bpy.data.materials.new('GIS footprint - comparison orange')
    ref_mat.diffuse_color = (1.0, 0.22, 0.02, 1.0)
    ref_mat.use_nodes = True
    ref_shader = next(n for n in ref_mat.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')
    ref_shader.inputs['Base Color'].default_value = ref_mat.diffuse_color
    for i, feature in enumerate(footprint['features'], 1):
        curve = bpy.data.curves.new(f'GIS Sejong footprint {i:02d}', 'CURVE')
        curve.dimensions = '3D'
        curve.bevel_depth = 0.22
        curve.materials.append(ref_mat)
        for ring in feature['geometry']['coordinates']:
            spline = curve.splines.new('POLY')
            spline.points.add(len(ring)-1)
            for point, xy in zip(spline.points, ring):
                point.co = (xy[1]-552531,197897-xy[0],50.0,1)
            spline.use_cyclic_u = True
        obj = bpy.data.objects.new(curve.name, curve)
        obj.show_in_front = True
        obj.hide_render = True
        ref.objects.link(obj)
    ref.hide_viewport = True
    ref.hide_render = True
    ref['note'] = 'Approximate registration; orange viewport-only overlay lifted to z=50m for comparison.'
    # Extend the existing foundation only where the western context exceeds it.
    ground = bpy.data.meshes.new('GIS west ground extension mesh')
    ground.from_pydata([(-210,168,-0.01),(240,168,-0.01),(240,200,-0.01),(-210,200,-0.01)], [], [(0,1,2,3)])
    ground.update()
    ground_obj = bpy.data.objects.new('GIS west ground extension', ground)
    col.objects.link(ground_obj)
    original = bpy.data.objects.get('Surroundings - continuous plaza foundation')
    if original and original.data.materials:
        ground.materials.append(original.data.materials[0])
    print('Created', len(data['features']), 'GIS buildings and ground extension')

if __name__ == '__main__':
    build()
    save_new_scene(target)
