"""Blender-only integration checks; does not save or alter any source file."""
import bpy,sys,importlib.util,hashlib,json,struct
from pathlib import Path
from mathutils import Vector
root=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('campus_interior',root/'scripts'/'append_campus_interior.py');m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
args=sys.argv[sys.argv.index('--')+1:];source=Path(args[0]).resolve()
bpy.ops.wm.open_mainfile(filepath=str(source),load_ui=False)
def digest(obj):
 h=hashlib.sha256()
 for v in obj.data.vertices:h.update(struct.pack('<3d',*v.co))
 for f in obj.data.polygons:h.update(struct.pack('<I',len(f.vertices)));h.update(struct.pack('<'+'I'*len(f.vertices),*f.vertices))
 return h.hexdigest()
original={name:digest(bpy.data.objects[name]) for name in m.REQUIRED}
scene=bpy.data.scenes.get('Scene') or bpy.context.scene;bpy.context.window.scene=scene
collection=m.append_campus_interior(scene,source)
assert collection.name in [c.name for c in scene.collection.children]
assert all(digest(bpy.data.objects[name])==value for name,value in original.items())
assert len([o for o in collection.objects if o.get('source_object') in m.REQUIRED])==16
assert len([o for o in collection.objects if o.name.startswith('CampusLobby_') and o.type=='MESH'])==9
# The central exterior lobby doorway is truly open in the authored lobby mesh.
origin=Vector(m.to_campus((0,1.7,61)));origin=Vector((origin.x,-origin.z,origin.y));direction=Vector((0,1,0))
blocked=[]
for obj in collection.objects:
 if obj.type!='MESH':continue
 inv=obj.matrix_world.inverted();local_origin=inv@origin;local_direction=inv.to_3x3()@direction
 hit,location,normal,index=obj.ray_cast(local_origin,local_direction.normalized(),distance=2/m.SCALE)
 if hit:blocked.append(obj.name)
assert not blocked,blocked
# Rear technical stage now stays inside the available tall mass without altering seats.
rear_vertices=0
for obj in collection.objects:
 if obj.type!='MESH' or obj.get('source_object') not in m.REQUIRED:continue
 for vertex in obj.data.vertices:
  local=(vertex.co.x,vertex.co.z,-vertex.co.y)
  if local[2] < -10.24:
   rear_vertices+=1
   assert -7.20001<=local[0]<=15.00001,(obj.name,local)
   assert local[1]<=15.50001,(obj.name,local)
assert rear_vertices>0
output=root/'public/model/grand-theatre/grand-theatre-campus.glb'
m.export_local_theatre(collection,output)
raw=output.read_bytes();size=struct.unpack_from('<I',raw,12)[0];document=json.loads(raw[20:20+size]);names={n.get('name') for n in document['nodes']}
assert set(m.REQUIRED).issubset(names),names
report={'rearVerticesFitted':rear_vertices,'glbBytes':len(raw),'appendedMeshes':16,'lobbyMeshes':9,'lights':len([o for o in collection.objects if o.type=='LIGHT']),'sourceGeometryHashesUnchanged':True,'centralLobbyDoorClear':True,'scene':scene.name}
print('INTEGRATED_INTERIOR_VERIFIED',json.dumps(report),flush=True)
