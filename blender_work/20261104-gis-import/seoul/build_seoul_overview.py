"""Build a citywide 50m aggregate overview; real building outlines are not represented."""
import bpy, gzip, json, math
from pathlib import Path
from mathutils import Vector

ROOT = Path(__file__).resolve().parent
with gzip.open(ROOT / 'seoul-grid-50m.json.gz', 'rt', encoding='utf8') as f:
    data=json.load(f)
assert data['crs']=='EPSG:5186' and data['cell_size_m']==50
if not bpy.app.background:
    raise RuntimeError('Run this generator with Blender in background mode')
bpy.ops.wm.read_factory_settings(use_empty=True)
scene=bpy.context.scene
scene.unit_settings.system='METRIC'
scene['description']='Seoul building overview: 50m aggregate cells, not building footprints or city boundary'
scene['source_crs']='EPSG:5186'
scene['local_origin_easting_northing']='200000,550000'
scene['excluded_outside_envelope']=data['counts']['outside_envelope']

def material(name, color):
    m=bpy.data.materials.new(name); m.diffuse_color=(*color,1); m.use_nodes=True
    bsdf=next(n for n in m.node_tree.nodes if n.type=='BSDF_PRINCIPLED')
    bsdf.inputs['Base Color'].default_value=(*color,1); bsdf.inputs['Roughness'].default_value=0.85
    return m
m_known=material('At least half reported height', (0.42,0.51,0.56))
m_mixed=material('Less than half reported - mixed values', (0.68,0.65,0.56))
m_unknown=material('All heights unavailable - placeholder', (0.67,0.46,0.30))
m_base=material('Neutral background', (0.13,0.18,0.20))
groups={}
for row in data['cells']: groups.setdefault(row[0],[]).append(row)
for code, rows in sorted(groups.items()):
    verts=[]; faces=[]; material_indices=[]
    for _,e,n,count,height,unknown,estimated,reported in rows:
        x=e*50-200000; y=n*50-550000; z=height
        i=len(verts); w=47
        verts.extend([(x,y,0),(x+w,y,0),(x+w,y+w,0),(x,y+w,0),
                      (x,y,z),(x+w,y,z),(x+w,y+w,z),(x,y+w,z)])
        faces.extend([(i+4,i+5,i+6,i+7),(i,i+1,i+5,i+4),(i+1,i+2,i+6,i+5),(i+2,i+3,i+7,i+6),(i+3,i,i+4,i+7)])
        material_indices.extend([2 if unknown==count else (0 if reported*2>=count else 1)]*5)
    mesh=bpy.data.meshes.new('District '+code+' cells')
    mesh.from_pydata(verts,[],faces); mesh.update()
    for mat in (m_known,m_mixed,m_unknown): mesh.materials.append(mat)
    for face, index in zip(mesh.polygons,material_indices): face.material_index=index
    obj=bpy.data.objects.new('District '+code+' - 50m aggregate',mesh)
    scene.collection.objects.link(obj)
    obj['cells']=len(rows); obj['buildings_in_assigned_cells']=sum(r[3] for r in rows)
    del verts,faces,material_indices
# Backdrop only: its rectangular extent is not a municipal boundary.
mesh=bpy.data.meshes.new('Backdrop mesh')
mesh.from_pydata([(-22000,-15000,-20),(22000,-15000,-20),(22000,19000,-20),(-22000,19000,-20)],[],[(0,1,2,3)]);mesh.update()
back=bpy.data.objects.new('Backdrop - not administrative boundary',mesh);scene.collection.objects.link(back);mesh.materials.append(m_base)
world=bpy.data.worlds.new('Seoul overview world');scene.world=world;world.use_nodes=True
world.node_tree.nodes.get('Background').inputs['Color'].default_value=(0.12,0.16,0.18,1)
world.node_tree.nodes.get('Background').inputs['Strength'].default_value=0.8
light_data=bpy.data.lights.new('Sun','SUN');light_data.energy=2.0
sun=bpy.data.objects.new('Sun',light_data);scene.collection.objects.link(sun);sun.rotation_euler=(0.45,-0.5,-0.3)
cam_data=bpy.data.cameras.new('City overview camera');cam=bpy.data.objects.new('City overview camera',cam_data);scene.collection.objects.link(cam)
cam.location=(-29000,-37000,41000); target=Vector((-450,1700,0));cam.rotation_euler=(target-cam.location).to_track_quat('-Z','Y').to_euler();cam_data.type='ORTHO';cam_data.ortho_scale=52000;cam_data.clip_end=200000;scene.camera=cam
scene.render.resolution_x=1600;scene.render.resolution_y=1100;scene.render.resolution_percentage=100
scene.world.color=(0.12,0.16,0.18)
scene.view_settings.view_transform='AgX'
for screen in bpy.data.screens:
    for area in screen.areas:
        if area.type == 'VIEW_3D': area.spaces.active.clip_end = 200000
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'seoul_buildings_overview.blend'),compress=True)
print('saved district objects',len(groups),'cells',len(data['cells']))
