"""Refine the preserved campus shell so the existing theatre fits inside it.
Run inside Blender on the project-owned 20261105 copy, never the source file.
"""
from pathlib import Path
import json, math
import bpy, bmesh
from mathutils import Vector
ROOT=Path(__file__).resolve().parents[1]
PREFIX='Unified shell - '

def components(obj):
 m=obj.data;adj=[[] for _ in m.vertices]
 for e in m.edges:
  a,b=e.vertices;adj[a].append(b);adj[b].append(a)
 seen=set();result=[]
 for v in m.vertices:
  if v.index in seen:continue
  todo=[v.index];seen.add(v.index);ids=[]
  while todo:
   i=todo.pop();ids.append(i)
   for j in adj[i]:
    if j not in seen:seen.add(j);todo.append(j)
  coords=[m.vertices[i].co for i in ids]
  result.append((ids,tuple(min(c[k] for c in coords) for k in range(3)),tuple(max(c[k] for c in coords) for k in range(3))))
 return result

def remove_component(obj,predicate,expected):
 chosen=[c for c in components(obj) if predicate(c[1],c[2])]
 if len(chosen)!=expected:raise RuntimeError(f'{obj.name}: expected {expected}, found {len(chosen)}')
 indices={i for ids,_,_ in chosen for i in ids};bm=bmesh.new();bm.from_mesh(obj.data);bm.verts.ensure_lookup_table()
 bmesh.ops.delete(bm,geom=[bm.verts[i] for i in indices],context='VERTS');bm.to_mesh(obj.data);bm.free();obj.data.update()
 return [{'object':obj.name,'vertices':len(ids),'min':lo,'max':hi} for ids,lo,hi in chosen]

def box(name,lo,hi,mat,scene):
 vs=[(x,y,z) for z in (lo[2],hi[2]) for y in (lo[1],hi[1]) for x in (lo[0],hi[0])]
 faces=[(0,2,3,1),(4,5,7,6),(0,1,5,4),(2,6,7,3),(0,4,6,2),(1,3,7,5)]
 mesh=bpy.data.meshes.new(PREFIX+name);mesh.from_pydata(vs,[],faces);mesh.materials.append(mat);mesh.update()
 uv=mesh.uv_layers.new(name='UVMap')
 for poly in mesh.polygons:
  axis=max(range(3),key=lambda i:abs(poly.normal[i]));axes=[i for i in range(3)if i!=axis]
  for li in poly.loop_indices:
   v=mesh.vertices[mesh.loops[li].vertex_index].co;uv.data[li].uv=(v[axes[0]]/2,v[axes[1]]/2)
 o=bpy.data.objects.new(PREFIX+name,mesh);scene.collection.objects.link(o);return o

def transparent_material(source,name):
 mat=source.copy();mat.name=name;mat.use_nodes=True
 bsdf=next(n for n in mat.node_tree.nodes if n.type=='BSDF_PRINCIPLED')
 bsdf.inputs['Base Color'].default_value=(.48,.69,.68,1);bsdf.inputs['Alpha'].default_value=.22;bsdf.inputs['Roughness'].default_value=.14
 if bsdf.inputs.get('Transmission Weight'):bsdf.inputs['Transmission Weight'].default_value=0
 if bsdf.inputs.get('IOR'):bsdf.inputs['IOR'].default_value=1.45
 mat.diffuse_color=(.48,.69,.68,.22)
 prop=mat.bl_rna.properties.get('surface_render_method')
 if prop:
  choices=[i.identifier for i in prop.enum_items]
  if 'BLENDED' in choices:mat.surface_render_method='BLENDED'
  elif 'DITHERED' in choices:mat.surface_render_method='DITHERED'
 return mat

def apply(scene=None):
 scene=scene or bpy.context.scene
 if any(o.name.startswith(PREFIX) for o in scene.objects):raise RuntimeError('Shell refinement already applied')
 if '20261105-unified' not in bpy.data.filepath:raise RuntimeError('Use only the owned unified copy')
 stone=bpy.data.objects['stone'];dark=bpy.data.objects['dark'];edge=bpy.data.objects['roofedge'];removed=[]
 removed+=remove_component(stone,lambda a,b:abs(a[0]+5)<.01 and abs(a[1]-11.4)<.01 and b[2]>22 and b[2]<23,1)
 removed+=remove_component(stone,lambda a,b:abs(a[0]+5)<.01 and abs(a[1]+3)<.01 and 5<a[2]<6.1 and 6.5<b[2]<6.8,1)
 removed+=remove_component(edge,lambda a,b:a[0]<-5 and b[0]>71 and a[1]<-4 and b[1]>59 and 22<a[2]<23,1)
 removed+=remove_component(dark,lambda a,b:a[0]<-7 and b[0]>73 and 23.7<a[2]<24 and b[1]>61,1)
 removed+=remove_component(dark,lambda a,b:31<a[0]<32 and 34<b[0]<35 and 11<a[1]<11.4 and b[2]<4,1)
 removed+=remove_component(stone,lambda a,b:11<a[0]<12 and 61<a[1]<62 and 22<a[2]<23 and b[2]>31 and b[2]<32,1)
 removed+=remove_component(stone,lambda a,b:11<a[0]<12 and 61<a[1]<62 and 31<a[2]<32 and b[2]>45,1)
 rear=bpy.data.objects['Rear hall - reconstructed mass around entry']
 removed+=remove_component(rear,lambda a,b:23<a[0]<24 and 84<a[1]<85 and b[0]<50 and b[2]>21,1)
 mat=stone.data.materials[0];dm=dark.data.materials[0];em=edge.data.materials[0]
 # True structural side walls leave the existing lobby and theatre volume open.
 for name,lo,hi in [
 ('west structural wall',(-5,11.4,1.07),(-4.1,84.7,22.791)),('east structural wall',(70.32,11.4,1.07),(71.223,84.7,22.791)),
 ('ground slab',(-5,11.4,.803),(71.223,84.7,1.07)),
 ('rear service west wall',(23.231,84.7,1.07),(24.0,109.5,21.166)),('rear service back wall',(24,108.7,1.07),(49,109.5,21.166)),
 ('rear service floor',(24,84.7,.803),(49,109.5,1.07)),
 ('flytower west wall',(11.938,61.4,22.791),(12.7,84.7,45.045)),('flytower east wall',(53.5,61.4,22.791),(54.285,84.7,45.045)),
 ('flytower front wall',(12.7,61.4,22.791),(53.5,62.2,45.045)),('flytower rear wall',(12.7,83.9,22.791),(53.5,84.7,45.045)),
 ('flytower roof',(12.7,62.2,44.4),(53.5,83.9,45.045)),
 ('foyer west gallery slab',(-5,-3,5.909),(13.4,11.4,6.639)),('foyer east gallery slab',(52.8,-3,5.909),(71.223,11.4,6.639)),
 ('foyer front lintel',(13.4,-3,5.909),(52.8,-1.4,6.639))]:box(name,lo,hi,mat,scene)
 # Preserve outside eaves, open the hidden filled centre, keep a real ceiling above the theatre.
 for name,lo,hi,material in [
 ('west eave',(-5.706,-4.5,22.588),(10,59.178,23.943),em),('east eave',(57,-4.5,22.588),(71.929,59.178,23.943),em),
 ('front eave',(10,-4.5,22.588),(57,-.5,23.943),em),
 ('roof west shadow reveal',(-7.117,-6,23.773),(10,61.4,24.391),dm),('roof east shadow reveal',(57,-6,23.773),(73.34,61.4,24.391),dm),
 ('roof front shadow reveal',(10,-6,23.773),(57,-.5,24.391),dm),('auditorium upper ceiling',(10,-.5,24.08),(57,61.4,24.391),dm)]:box(name,lo,hi,material,scene)
 for name in ['glass','connector_glass']:
  ob=bpy.data.objects.get(name)
  if ob:
   for i,m in enumerate(ob.data.materials):
    if m:ob.data.materials[i]=transparent_material(m,'Unified clear '+name+str(i))
 clear=bpy.data.objects['glass'].data.materials[0]
 # Two real glazed leaves stand open beside a 2.3m clear entrance, with frames and handles.
 for side in (-1,1):
  hinge=bpy.data.objects.new(PREFIX+('left' if side<0 else 'right')+' door hinge',None);scene.collection.objects.link(hinge)
  hinge.location=(31.6 if side<0 else 34.6,-3.02,1.07);hinge.rotation_euler.z=math.radians(76 if side<0 else -76)
  x0,x1=(0,1.43) if side<0 else (-1.43,0)
  leaf=box(('left' if side<0 else 'right')+' clear door',(x0,-.025,.08),(x1,.025,2.48),clear,scene);leaf.parent=hinge
  for j,(lo,hi) in enumerate([((x0-.025,-.045,0),(x0+.025,.045,2.55)),((x1-.025,-.045,0),(x1+.025,.045,2.55)),((x0,-.045,2.5),(x1,.045,2.55)),((x0,-.045,0),(x1,.045,.06))]):
   frame=box(f'door {side} frame {j}',lo,hi,dm,scene);frame.parent=hinge
  hx=x1-.15 if side<0 else x0+.15;handle=box(f'door {side} handle',(hx-.025,-.11,.9),(hx+.025,-.07,1.45),dm,scene);handle.parent=hinge
 # Visual stone joints and an unobstructed stone approach match the front entrance rhythm.
 box('entry threshold',(31.55,-3.3,1.04),(34.65,-2.72,1.07),mat,scene)
 report={'removedSolidComponents':removed,'entranceWorldThree':[33.1,1.07,3.1],'newObjects':[o.name for o in scene.objects if o.name.startswith(PREFIX)]}
 (ROOT/'docs/20261105-shell-edits.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf8')
 return report
