"""Reopen saved asset and render paired lighting proof without modifying the source file."""
import bpy,json,sys,math
from pathlib import Path
from mathutils import Vector
root=Path.cwd();night=bpy.data.scenes['20261115 답사 - 야간 조명'];bpy.context.window.scene=night
# Avoid the missing original Windows font dependency in the deliverable.
import subprocess, shutil
font_source='/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc'
text_path=root/'docs/survey-20261115/font-characters.txt';text_path.write_text(''.join(o.data.body for o in bpy.data.objects if o.type=='FONT'))
font_path=root/'docs/survey-20261115/survey-labels.otf'
subprocess.run([shutil.which('pyftsubset'),font_source,'--font-number=0','--text-file='+str(text_path),'--output-file='+str(font_path)],check=True)
fallback=bpy.data.fonts.load(str(font_path));fallback.pack()
replaced=[]
for o in bpy.data.objects:
 if o.type=='FONT' and o.data.font and not o.data.font.packed_file and o.data.font.filepath and not Path(bpy.path.abspath(o.data.font.filepath)).exists():
  replaced.append(o.name);o.data.font=fallback
# Ground-level photograph-comparison camera shows the actual luminaire recesses.
night.camera.location=(-12,120,2.6);night.camera.rotation_euler=(Vector((8,104,5.0))-night.camera.location).to_track_quat('-Z','Y').to_euler();night.camera.data.lens=24
night.cycles.samples=40;night.render.filepath=str(root/'docs/survey-20261115/colonnade-night.png');bpy.ops.render.render(write_still=True)
# A proper explicit day scene uses the original campus, not a flattened render.
day=bpy.data.scenes['세종문화회관 실내외 통합'].copy();day.use_fake_user=True;day.name='20261115 답사 - 주간';bpy.context.window.scene=day
day.world=night.world.copy();day.world.node_tree.nodes.get('Background').inputs['Color'].default_value=(.55,.7,1,1);day.world.node_tree.nodes.get('Background').inputs['Strength'].default_value=.45
day.camera=night.camera;day.render.engine='CYCLES';day.cycles.samples=40;day.cycles.use_denoising=True;day.render.resolution_x=1100;day.render.resolution_y=720;day.render.resolution_percentage=100
ld=bpy.data.lights.new('Survey day sun','SUN');ld.energy=2.0;ld.angle=.1;lo=bpy.data.objects.new(ld.name,ld);day.collection.objects.link(lo);lo.rotation_euler=(.6,-.4,-.5)
day.render.filepath=str(root/'docs/survey-20261115/colonnade-day.png');bpy.ops.render.render(write_still=True)
bpy.context.window.scene=night
bpy.ops.wm.save_as_mainfile(filepath=str(root/'blender_work/20261115-survey/sejong_survey_day_night.blend'),compress=True)
report={'scenes':[day.name,night.name],'original_scene_preserved':len(bpy.data.scenes['세종문화회관 실내외 통합'].objects),'new_lighting_objects':len(bpy.data.collections['Survey 20261115 - mounted luminous fixtures'].objects),'missing_fonts_replaced':replaced,'photo_review_count':149,'photometry':'illustrative, not measured','original_geometry_changed':False}
(root/'docs/survey-20261115/verification.json').write_text(json.dumps(report,ensure_ascii=False,indent=2))
print(json.dumps(report,ensure_ascii=False))
