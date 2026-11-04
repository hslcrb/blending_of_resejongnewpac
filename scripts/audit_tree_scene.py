"""Digest all scenes, object placements and non-tree mesh vertices for copy comparison."""
import bpy, hashlib, array, json
h=hashlib.sha256(); total=0
for scene in sorted(bpy.data.scenes,key=lambda s:s.name):
    h.update(scene.name.encode()); h.update('\0'.join(sorted(o.name for o in scene.objects)).encode())
for obj in sorted(bpy.data.objects,key=lambda o:o.name):
    h.update((obj.name+'|'+obj.type).encode())
    for row in obj.matrix_world: h.update(array.array('f',row).tobytes())
for mesh in sorted(bpy.data.meshes,key=lambda m:m.name):
    if mesh.name.startswith('Tree trunk ') or mesh.name.startswith('Tree foliage '): continue
    h.update(mesh.name.encode()); data=array.array('f',[0.0])*(len(mesh.vertices)*3)
    mesh.vertices.foreach_get('co',data);h.update(data.tobytes());total+=1
print('SCENE_AUDIT',json.dumps({'digest':h.hexdigest(),'scenes':len(bpy.data.scenes),'objects':len(bpy.data.objects),'non_tree_meshes':total}))
