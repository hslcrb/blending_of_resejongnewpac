"""Digest pre-existing geometry and object identities, excluding added sky lights."""
import bpy,hashlib,array,json
h=hashlib.sha256()
for obj in sorted(bpy.data.objects,key=lambda o:o.name):
 if obj.name.startswith(('Seoul weather sun - ','Seoul weather night - ')):continue
 h.update((obj.name+'|'+obj.type+'\0').encode())
for mesh in sorted(bpy.data.meshes,key=lambda x:x.name):
 h.update((mesh.name+'\0').encode())
 coords=array.array('f',[0.0])*(len(mesh.vertices)*3);mesh.vertices.foreach_get('co',coords);h.update(coords.tobytes())
 loops=array.array('i',[0])*len(mesh.loops);mesh.loops.foreach_get('vertex_index',loops);h.update(loops.tobytes())
print('GEOMETRY_AUDIT',json.dumps({'sha256':h.hexdigest(),'mesh_count':len(bpy.data.meshes)}))
