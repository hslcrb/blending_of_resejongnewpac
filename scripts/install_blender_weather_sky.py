"""Install Seoul animated sky on every scene in a dedicated file copy."""
import bpy, sys, json, datetime
from pathlib import Path
from importlib.util import spec_from_file_location, module_from_spec

args=sys.argv[sys.argv.index('--')+1:]
assert len(args)==2, 'Expected target copy and weather JSON paths'
root=Path.cwd().resolve();target=Path(args[0]).resolve(); weather_path=Path(args[1]).resolve()
allowed=(root/'blender_work/20261104-live-sky').resolve()
assert target.is_relative_to(allowed) and target.suffix=='.blend', 'Target must be an isolated sky copy'
assert bpy.app.background and Path(bpy.data.filepath).resolve()==target
spec=spec_from_file_location('seoul_weather_sky',str(root/'scripts/seoul_weather_sky.py'));m=module_from_spec(spec);spec.loader.exec_module(m)
raw=json.loads(weather_path.read_text(encoding='utf8')) if weather_path.exists() else None
weather=m.parse_weather(raw)
text=bpy.data.texts.get('Seoul weather live.py') or bpy.data.texts.new('Seoul weather live.py')
text.clear();text.write((root/'scripts/seoul_weather_sky.py').read_text(encoding='utf8'))
now=datetime.datetime.now(m.KST);midnight=now.replace(hour=0,minute=0,second=0,microsecond=0)
for scene in bpy.data.scenes:
    scene['seoul_weather_original_frames']=f'{scene.frame_start}:{scene.frame_end}'
    scene['seoul_weather_original_world']=scene.world.name if scene.world else ''
    axis='seoul' if 'seoul_buildings_overview' in target.name else 'local'
    scene['seoul_weather_sky_axis']=axis
    scene['seoul_weather_sky_date']=midnight.date().isoformat()
    scene['seoul_weather_sky_timeline']='1=00:00 KST, 145=24:00 KST, 10 minutes per frame'
    # Original sun lights remain present but are muted in this copy to avoid doubled daylight.
    for old in scene.objects:
        if old.type=='LIGHT' and old.data.type=='SUN':old.hide_render=True;old.hide_viewport=True;old['seoul_weather_original_sun_muted']=True
    world=bpy.data.worlds.new(f'Seoul weather - {scene.name}');world.use_nodes=True;scene.world=world
    nodes=world.node_tree.nodes;nodes.clear();links=world.node_tree.links
    sky=nodes.new('ShaderNodeTexSky');sky.name='Seoul solar atmosphere'
    options=[x.identifier for x in sky.bl_rna.properties['sky_type'].enum_items]
    sky.sky_type='MULTIPLE_SCATTERING' if 'MULTIPLE_SCATTERING' in options else options[0]
    coord=nodes.new('ShaderNodeTexCoord');noise=nodes.new('ShaderNodeTexNoise');noise.inputs['Scale'].default_value=7.0;noise.inputs['Detail'].default_value=4.0
    ramp=nodes.new('ShaderNodeValToRGB');ramp.name='Seoul cloud coverage'
    mix=nodes.new('ShaderNodeMixRGB');mix.name='Seoul clouds';mix.blend_type='MIX'
    night=nodes.new('ShaderNodeRGB');night.name='Seoul night ambient'
    add=nodes.new('ShaderNodeMixRGB');add.name='Seoul sky and ambient';add.blend_type='ADD';add.inputs[0].default_value=1
    background=nodes.new('ShaderNodeBackground');background.name='Seoul weather background';output=nodes.new('ShaderNodeOutputWorld')
    links.new(coord.outputs['Normal'],noise.inputs['Vector']);links.new(noise.outputs['Fac'],ramp.inputs['Fac']);links.new(ramp.outputs['Color'],mix.inputs[0])
    links.new(sky.outputs['Color'],mix.inputs[1]);links.new(mix.outputs['Color'],add.inputs[1]);links.new(night.outputs['Color'],add.inputs[2])
    links.new(add.outputs['Color'],background.inputs['Color']);links.new(background.outputs['Background'],output.inputs['Surface'])
    sun_data=bpy.data.lights.new(f'Seoul weather sun - {scene.name}','SUN');sun=bpy.data.objects.new(f'Seoul weather sun - {scene.name}',sun_data);scene.collection.objects.link(sun)
    fill_data=bpy.data.lights.new(f'Seoul weather night - {scene.name}','SUN');fill_data.color=(.55,.68,1.0)
    fill=bpy.data.objects.new(f'Seoul weather night - {scene.name}',fill_data);scene.collection.objects.link(fill);fill.rotation_euler=(.3,.2,0)
    scene['seoul_weather_sun']=sun.name;scene['seoul_weather_night_fill']=fill.name
    for frame in range(1,146):m.apply(scene,midnight+datetime.timedelta(minutes=(frame-1)*10),weather,keyframe=frame)
    scene.frame_start=1;scene.frame_end=145;scene.frame_set(1+(now.hour*60+now.minute)//10);m.apply(scene,now,weather)
    print('SKY_INSTALLED',scene.name,axis,flush=True)
# Keep pre-existing unlinked data blocks: Blender otherwise discards zero-user assets on save.
for family in ('objects','meshes','materials','images','cameras','lights','curves','collections','worlds','actions','node_groups','texts','fonts','armatures'):
    for item in getattr(bpy.data,family):
        if item.users == 0: item.use_fake_user=True
bpy.context.preferences.filepaths.save_version=0
bpy.ops.wm.save_as_mainfile(filepath=str(target),compress=True)
print('SKY_SAVED',str(target),len(bpy.data.scenes),weather['observedAt'] if weather else 'unavailable',flush=True)
