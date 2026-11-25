"""Validate actual geometry in the unified Blender scene, independently of web collision."""
from pathlib import Path
import bpy,json
from mathutils import Vector
ROOT=Path(__file__).resolve().parents[1]
def validate():
 sc=bpy.context.scene;collection=bpy.data.collections.get('CampusGrandTheatreInterior_20261105')
 assert collection and collection.name in sc.collection.children,'Interior must belong to the campus scene'
 meshes=[o for o in collection.objects if o.type=='MESH'];assert len(meshes)>=25,'Existing theatre and actual lobby required'
 for name in ['Campus_GrandCurtain','Campus_GrandAcousticShell','Campus_GrandProjectionScreen']:
  assert name in sc.objects,f'Missing interior mesh {name}'
 dep=bpy.context.evaluated_depsgraph_get()
 for start,length in [((33.1,-5,2.77),24),((33.1,0,2.77),20)]:
  hit,loc,_,_,obj,_=sc.ray_cast(dep,Vector(start),Vector((0,1,0)),distance=length)
  assert not hit,f'Entrance blocked by {obj.name} at {loc}'
 hit,loc,_,_,obj,_=sc.ray_cast(dep,Vector((60,75,23.4)),Vector((-1,0,0)),distance=12)
 assert hit and obj.name=='Unified shell - flytower east wall','Flytower lower exterior band must be closed'
 glass=bpy.data.objects['glass'].data.materials[0];bsdf=next(n for n in glass.node_tree.nodes if n.type=='BSDF_PRINCIPLED')
 assert bsdf.inputs['Alpha'].default_value<.5,'Foyer glazing must be transparent'
 assert bpy.data.objects['Unified shell - east structural wall'].type=='MESH'
 assert bpy.data.objects['Unified shell - rear service back wall'].type=='MESH'
 result={'scene':sc.name,'interiorMeshes':len(meshes),'entranceRaysClear':2,'glassAlpha':bsdf.inputs['Alpha'].default_value,'sameScene':True}
 (ROOT/'docs/20261105-unified-geometry-validation.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n',encoding='utf8');return result
if __name__=='__main__':print(validate())
