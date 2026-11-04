"""Add four GIS-footprint-based southern context masses to the working scene."""
import bpy,bmesh,json
from pathlib import Path
import sys
IMPORT_ROOT=Path(__file__).resolve().parent
sys.dont_write_bytecode = True
sys.path.insert(0,str(IMPORT_ROOT))
from gis_blender import open_scene_job,save_new_scene
_, target = open_scene_job(__doc__)
root=IMPORT_ROOT
name='GIS - southern building context (provisional)'
if bpy.data.collections.get(name): raise RuntimeError('Southern context already exists')
data=json.loads((root/'south-buildings-5186.geojson').read_text(encoding='utf8'))
col=bpy.data.collections.new(name);bpy.context.scene.collection.children.link(col)
mat=bpy.data.materials.get('GIS context - warm stone')
if mat is None: raise RuntimeError('Expected existing GIS context material')
for feature in data['features']:
    props=feature['properties']; rings=feature['geometry']['coordinates']
    if feature['geometry']['type']!='Polygon' or len(rings)!=1: raise RuntimeError('Unexpected polygon geometry')
    ring=rings[0][:-1] if rings[0][0]==rings[0][-1] else rings[0]
    points=[(p[1]-552531,197897-p[0]) for p in ring]
    h=props['A16'] if props['A16']>0 else props['A26']*3.2
    n=len(points); verts=[(x,y,z) for z in (0.0,h) for x,y in points]
    faces=[tuple(reversed(range(n))),tuple(range(n,2*n))]+[(i,(i+1)%n,(i+1)%n+n,i+n) for i in range(n)]
    mesh=bpy.data.meshes.new(f"GIS south {props['A0']} mesh"); mesh.from_pydata(verts,[],faces);mesh.update()
    bm=bmesh.new();bm.from_mesh(mesh);bmesh.ops.recalc_face_normals(bm,faces=bm.faces);bm.to_mesh(mesh);bm.free()
    obj=bpy.data.objects.new(f"GIS south building {props['A0']}",mesh);col.objects.link(obj);mesh.materials.append(mat)
    obj['height_m']=h;obj['height_basis']='A16 candidate (unverified)' if props['A16']>0 else 'A26 floors x 3.2m (estimate)'
col['registration']='EPSG:5186 E,N -> Blender X=N-552531, Y=197897-E; approximate fit'
print('Created',len(col.objects),'southern GIS masses')

save_new_scene(target)
