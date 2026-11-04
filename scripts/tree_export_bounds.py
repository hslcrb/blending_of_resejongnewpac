import bpy,json,os
from mathutils import Vector
root=os.getcwd(); parts=json.load(open('docs/sitevisit-review/20261103-export-partitions.json',encoding='utf-8'))
scene=bpy.data.scenes[parts['scene']]; bpy.context.window.scene=scene; bpy.context.view_layer.update()
result={}
for key,group in parts['groups'].items():
 if not any('Tree' in item['object'] for item in group['objects']):continue
 points=[]
 for item in group['objects']:
  obj=scene.objects[item['object']]
  if obj.type!='MESH':continue
  for v in obj.bound_box:
   p=obj.matrix_world @ Vector(v);points.append((p.x,p.z,-p.y))
 result[key]={'min':[round(min(p[i] for p in points),5) for i in range(3)],'max':[round(max(p[i] for p in points),5) for i in range(3)]}
json.dump(result,open('public/model/trees-20261104/bounds.json','w'),indent=2)
print('TREE_BOUNDS',len(result))
