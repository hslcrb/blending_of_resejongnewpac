"""Render current copy at Seoul midnight/noon and an illustrative overcast noon."""
import bpy,datetime,sys
from pathlib import Path
from mathutils import Vector
from importlib.util import spec_from_file_location,module_from_spec
root=Path.cwd();spec=spec_from_file_location('sky',str(root/'scripts/seoul_weather_sky.py'));m=module_from_spec(spec);spec.loader.exec_module(m)
s=bpy.data.scenes['20261103 - aerial proportion review'];bpy.context.window.scene=s
camera=bpy.data.objects.new('temporary sky validation camera',bpy.data.cameras.new('temporary sky validation camera'));s.collection.objects.link(camera)
camera.location=(0,-140,38);camera.rotation_euler=(Vector((0,20,40))-camera.location).to_track_quat('-Z','Y').to_euler();camera.data.lens=37;s.camera=camera
s.render.engine='BLENDER_EEVEE';s.render.resolution_x=800;s.render.resolution_y=540;s.render.resolution_percentage=100
if hasattr(s,'eevee') and hasattr(s.eevee,'taa_render_samples'):s.eevee.taa_render_samples=16
s.render.image_settings.file_format='PNG'
date=datetime.date.fromisoformat(s['seoul_weather_sky_date']);midnight=datetime.datetime.combine(date,datetime.time(),m.KST)
for name,frame,weather in [('midnight',1,None),('noon',73,None),('noon-overcast',73,{'fraction':1,'observedAt':'illustration','cover':'OVC'})]:
 s.frame_set(frame);moment=midnight+datetime.timedelta(minutes=(frame-1)*10);m.apply(s,moment,weather,keyframe=frame);s.frame_set(frame);m.apply(s,moment,weather)
 s.render.filepath=str(root/'docs'/f'20261104-sky-{name}.png');bpy.ops.render.render(write_still=True);print('RENDERED',name,flush=True)
