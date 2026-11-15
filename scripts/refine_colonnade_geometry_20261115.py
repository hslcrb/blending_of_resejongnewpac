"""Photo092/095: broaden octagonal column shoulders; retain centres and outer envelope.
Dimensions are a photo-based visual fit, not a site measurement. Source asset is preserved.
"""
import bpy,math,json
from pathlib import Path
from mathutils import Vector
root=Path.cwd();out=root/'public/model/survey-20261115';doc=root/'docs/survey-20261115'
centres=[-27.4434261322+i*8.3280639648 for i in range(7)];cy=108.6733322144;hw=.7198829651;hl=.9644470215
names=['stone','Rear columns - beveled stone joints and foot','Rear columns - vertical stone panel joints']
changed={}
for name in names:
 o=bpy.data.objects[name];o.data=o.data.copy();inv=o.matrix_world.inverted();count=0
 eligible=None
 if name=='stone':
  adj={v.index:[]for v in o.data.vertices}
  for e in o.data.edges:a,b=e.vertices;adj[a].append(b);adj[b].append(a)
  todo=set(adj);eligible=set()
  while todo:
   q=[todo.pop()];ids=[]
   while q:
    i=q.pop();ids.append(i)
    for j in adj[i]:
     if j in todo:todo.remove(j);q.append(j)
   pts=[o.matrix_world@o.data.vertices[i].co for i in ids]
   if len(ids)==16 and min(p.y for p in pts)>107.7 and max(p.y for p in pts)<109.7 and min(p.z for p in pts)<.01 and 6.9<max(p.z for p in pts)<7:eligible.update(ids)
  assert len(eligible)==112, len(eligible)
 for v in o.data.vertices:
  if eligible is not None and v.index not in eligible:continue
  p=o.matrix_world@v.co;cx=min(centres,key=lambda x:abs(p.x-x))
  if not(abs(p.x-cx)<hw+.02 and abs(p.y-cy)<hl+.02 and -.02<p.z<6.96):continue
  x=p.x-cx;y=p.y-cy
  if abs(x)+abs(y)<1e-8:continue
  a=abs(x);b=abs(y)
  old=min(hw/max(a,1e-9),hl/max(b,1e-9),(hw+hl-.12)/(a+b))
  new=min(hw/max(a,1e-9),hl/max(b,1e-9),(hw+hl-.38)/(a+b))
  if new<old-1e-7:p.x=cx+x*new/old;p.y=cy+y*new/old;v.co=inv@p;count+=1
 o.data.update();changed[name]=count
# The photographed underside is dark charcoal, not pale silver; retain actual slat/access geometry.
ceil=bpy.data.objects['Rear colonnade - linear ceiling and access panels'];ceil.data=ceil.data.copy()
for i,old in enumerate(ceil.data.materials):
 m=old.copy();m.name=old.name+' survey092';ceil.data.materials[i]=m;p=m.node_tree.nodes.get('Principled BSDF')
 color=(.055,.06,.055,1) if 'warm charcoal' in old.name else (.025,.027,.025,1) if 'recessed seams' in old.name else (.18,.19,.18,1)
 p.inputs['Base Color'].default_value=color;p.inputs['Roughness'].default_value=.68
assert changed['stone']==112, changed
exportnames=names+[ceil.name]
s=bpy.data.scenes['20261115 답사 - 야간 조명'];bpy.context.window.scene=s
bpy.ops.object.select_all(action='DESELECT')
for name in exportnames:bpy.data.objects[name].select_set(True)
bpy.context.view_layer.objects.active=bpy.data.objects['stone']
bpy.ops.export_scene.gltf(filepath=str(out/'colonnade-geometry.glb'),export_format='GLB',use_selection=True,use_active_scene=True,export_cameras=False,export_lights=False,export_animations=False)
(out/'colonnade-replacements.json').write_text(json.dumps({'version':1,'meshNames':exportnames,'photoIndices':[92,95],'note':'Photo-inferred 0.38 m chamfer, not measured; original column centres and envelope retained','changedVertices':changed},ensure_ascii=False,indent=2))
for scene,label in [(s,'night'),(bpy.data.scenes['20261115 답사 - 주간'],'day')]:
 bpy.context.window.scene=scene;scene.render.filepath=str(doc/f'colonnade-{label}-refined.png');bpy.ops.render.render(write_still=True)
bpy.context.window.scene=s;bpy.ops.wm.save_as_mainfile(filepath=str(root/'blender_work/20261115-survey/sejong_survey_colonnade_refined.blend'),compress=True)
print('GEOMETRY_CHANGE',changed,flush=True)
