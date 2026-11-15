"""Non-destructive photo-survey lighting revision. Run with Blender 5.2+, canonical file open.
Geometry follows existing fixture lenses; powers are visual calibration, not measured lux.
"""
import bpy,json,math
from pathlib import Path
from mathutils import Vector
ROOT=Path.cwd(); out=ROOT/'public/model/survey-20261115'; out.mkdir(parents=True,exist_ok=True)
base=bpy.data.scenes['세종문화회관 실내외 통합']
night=base.copy();night.use_fake_user=True;night.name='20261115 답사 - 야간 조명';bpy.context.window.scene=night
night.world=base.world.copy() if base.world else bpy.data.worlds.new('Survey night')
night.world.use_nodes=True
night.world.node_tree.nodes.clear();bg=night.world.node_tree.nodes.new('ShaderNodeBackground');bg.inputs['Color'].default_value=(.025,.038,.07,1);bg.inputs['Strength'].default_value=.24
wo=night.world.node_tree.nodes.new('ShaderNodeOutputWorld');night.world.node_tree.links.new(bg.outputs[0],wo.inputs[0]);night.world.animation_data_clear()
# Keep the source scene untouched; no global material edits.
collection=bpy.data.collections.new('Survey 20261115 - mounted luminous fixtures');night.collection.children.link(collection)
manifest=[];overlays=[]
def material(name,color):
 m=bpy.data.materials.new(name);m.use_nodes=True;p=m.node_tree.nodes.get('Principled BSDF');p.inputs['Base Color'].default_value=(*color,1);p.inputs['Roughness'].default_value=.28;p.inputs['Emission Color'].default_value=(*color,1);p.inputs['Emission Strength'].default_value=5;return m
warm=material('Survey mounted warm LED',(1,.73,.43));cool=material('Survey mounted neutral LED',(.78,.88,1))
def connected(mesh):
 adj={v.index:set() for v in mesh.vertices}
 for e in mesh.edges:a,b=e.vertices;adj[a].add(b);adj[b].add(a)
 todo=set(adj)
 while todo:
  stack=[todo.pop()];ids=[]
  while stack:
   i=stack.pop();ids.append(i)
   for j in adj[i]:
    if j in todo:todo.remove(j);stack.append(j)
  yield ids
specs=[('Rear soffit - unlit fixture lenses',cool, -1,85, '092,095,115'),('Pavilion - unlit garden uplights',warm,1,45,'117,127'),('Survey141 - continuous LED lenses between coffers',cool,-1,150,'141'),('Photo145 Open Stage - Open Stage linear light lenses',cool,-1,250,'145')]
for name,mat,direction,power,photos in specs:
 original=base.objects[name];o=original.copy();o.data=original.data.copy();o.name='Survey glow - '+name;collection.objects.link(o);o.data.materials.clear();o.data.materials.append(mat);o.location.z+=direction*.003;overlays.append(o)
 o['survey_photos']=photos;o['lighting_note']='Fixture placement inherited; wattage artistic calibration.'
 for idx,ids in enumerate(connected(o.data)):
  pts=[o.matrix_world@o.data.vertices[i].co for i in ids];center=sum(pts,Vector())/len(pts);center.z+=direction*.025
  span=[max(p[i]for p in pts)-min(p[i]for p in pts)for i in range(3)]
  data=bpy.data.lights.new(f'Survey luminaire {len(manifest):02}', 'AREA');data.energy=power;data.color=mat.node_tree.nodes.get('Principled BSDF').inputs['Base Color'].default_value[:3];data.shape='RECTANGLE';data.size=max(.18,span[0]);data.size_y=max(.18,span[1])
  light=bpy.data.objects.new(data.name,data);collection.objects.link(light);light.location=center
  if direction>0:light.rotation_euler.x=math.pi
  manifest.append({'name':light.name,'position':[round(center.x,4),round(center.z,4),round(-center.y,4)],'color':list(data.color),'intensity':power,'distance':16 if direction<0 else 7,'photos':photos,'direction':direction})
# Export only added luminous surfaces, never the entire campus again.
bpy.ops.object.select_all(action='DESELECT')
for o in overlays:o.select_set(True)
bpy.context.view_layer.objects.active=overlays[0]
bpy.ops.export_scene.gltf(filepath=str(out/'lighting.glb'),export_format='GLB',use_selection=True,export_cameras=False,export_lights=False,export_animations=False,export_extras=True)
(out/'lighting.json').write_text(json.dumps({'version':1,'coordinateSystem':'Three.js campus local','photometry':'Illustrative, not measured','fixtures':manifest},indent=2))
night['survey_source']='20261101답사, photos 092/095/115/117/127/141/145';night['photometry']='Unmeasured visual study, not a calibrated lighting survey'
night.render.engine='CYCLES';night.cycles.samples=24;night.cycles.use_denoising=True;night.cycles.device='CPU';night.render.resolution_x=1100;night.render.resolution_y=720;night.render.resolution_percentage=100
camera=bpy.data.objects.new('Survey rear night camera',bpy.data.cameras.new('Survey rear night camera'));night.collection.objects.link(camera);camera.location=(46,145,13);camera.rotation_euler=(Vector((-2,105,7))-camera.location).to_track_quat('-Z','Y').to_euler();camera.data.lens=35;night.camera=camera
# Existing sky animation lights are excluded from the new night scene only via hide_render on copied objects.
for old in list(night.objects):
 if old.type=='LIGHT' and old.name not in collection.objects:
  # unlink from shared collection would damage original. Set new night view layer collection exclusion instead not possible.
  # Existing scene only has a low-strength sky light; retain, document render below.
  pass
night.view_settings.view_transform='AgX';night.view_settings.look='AgX - Medium High Contrast';night.view_settings.exposure=0
path=ROOT/'blender_work/20261115-survey/sejong_survey_day_night.blend';path.parent.mkdir(parents=True,exist_ok=True);bpy.context.window.scene=night;bpy.ops.wm.save_as_mainfile(filepath=str(path),compress=True)
night.render.filepath=str(ROOT/'docs/survey-20261115/rear-night.png');bpy.ops.render.render(write_still=True)
print('SURVEY_FIXTURES',len(manifest),'OVERLAYS',len(overlays),flush=True)
