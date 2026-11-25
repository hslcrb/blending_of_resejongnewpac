"""Add 24-hour Seoul solar sky to the main scene without changing other scenes."""
import bpy, sys, datetime
from pathlib import Path
from importlib.util import spec_from_file_location, module_from_spec
IMPORT_ROOT=Path(__file__).resolve().parents[1]
sys.dont_write_bytecode = True
sys.path.insert(0,str(IMPORT_ROOT))
from gis_blender import open_scene_job,save_new_scene
source,target=open_scene_job(__doc__)
scene=bpy.data.scenes.get('Scene')
if scene is None: raise RuntimeError('Main scene not found')
axis=scene.get('seoul_sky_axis') or ('seoul' if scene.get('local_origin_easting_northing') == '200000,550000' or 'seoul_buildings_overview' in source.name else 'local')
existing=bool(scene.get('seoul_sky_axis'))
scene['seoul_sky_axis']=axis
if not existing: scene['seoul_sky_original_frames']=f'{scene.frame_start}:{scene.frame_end}'
scene['seoul_sky_timeline']='Frame 1=00:00 KST, frame 145=24:00 KST, each frame=10 minutes on generation date'
if not existing:
 world=bpy.data.worlds.new('Seoul time - atmosphere');world.use_nodes=True
 scene.world=world
 nodes=world.node_tree.nodes;nodes.clear()
 background=nodes.new('ShaderNodeBackground');sky=nodes.new('ShaderNodeTexSky');output=nodes.new('ShaderNodeOutputWorld')
 world.node_tree.links.new(sky.outputs['Color'],background.inputs['Color']);world.node_tree.links.new(background.outputs['Background'],output.inputs['Surface'])
 light=bpy.data.lights.new('Seoul time - Sun','SUN');sun=bpy.data.objects.new('Seoul time - Sun',light);scene.collection.objects.link(sun)
world=scene.world;nodes=world.node_tree.nodes
sky=next(n for n in nodes if n.type=='TEX_SKY');background=next(n for n in nodes if n.type=='BACKGROUND')
night=nodes.get('Seoul night ambient') or nodes.new('ShaderNodeRGB');night.name='Seoul night ambient'
mix=nodes.get('Seoul sky and ambient') or nodes.new('ShaderNodeMixRGB');mix.name='Seoul sky and ambient';mix.blend_type='ADD';mix.inputs[0].default_value=1
world.node_tree.links.new(sky.outputs['Color'],mix.inputs[1]);world.node_tree.links.new(night.outputs['Color'],mix.inputs[2]);world.node_tree.links.new(mix.outputs['Color'],background.inputs['Color'])
fill=scene.objects.get('Seoul time - night fill')
if not fill:
 fill_data=bpy.data.lights.new('Seoul time - night fill','SUN');fill_data.color=(0.55,0.68,1.0)
 fill=bpy.data.objects.new('Seoul time - night fill',fill_data);scene.collection.objects.link(fill);fill.rotation_euler=(0.3,0.2,0)
if axis=='seoul':
 old=scene.objects.get('Sun')
 if old: old.hide_render=True; old.hide_set(True); old['seoul_sky_disabled_original']=True
path=Path(__file__).resolve().parent/'seoul_sky.py'
spec=spec_from_file_location('seoul_sky',str(path)); module=module_from_spec(spec);spec.loader.exec_module(module)
text=bpy.data.texts.get('Seoul live sky.py') or bpy.data.texts.new('Seoul live sky.py');text.clear();text.write(path.read_text(encoding='utf-8-sig'))
now=datetime.datetime.now(module.KST); midnight=now.replace(hour=0,minute=0,second=0,microsecond=0)
for i in range(145): module.apply(scene,midnight+datetime.timedelta(minutes=10*i),keyframe=i+1)
scene.frame_start=1;scene.frame_end=145;scene.frame_set(1+(now.hour*60+now.minute)//10)
module.apply(scene,now)
scene['seoul_sky_animation_date']=midnight.date().isoformat()
save_new_scene(target)
print('Saved copy',target.name,'axis',axis,'frames',scene.frame_start,scene.frame_end,'time',now.isoformat())
