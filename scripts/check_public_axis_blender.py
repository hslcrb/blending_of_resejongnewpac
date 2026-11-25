"""Geometry and repeatable renders for the public-axis change; never saves a source scene."""
from __future__ import annotations
import argparse
import json
from pathlib import Path
import sys
import bpy
from mathutils import Vector

root=Path(__file__).resolve().parents[1]
data=json.loads((root/"public/model/public-axis-20261125/build-evidence.json").read_text())
parser=argparse.ArgumentParser()
parser.add_argument('--source',required=True,type=Path)
parser.add_argument('--output',required=True,type=Path)
parser.add_argument('--render',action='store_true')
parser.add_argument('--engine',choices=('CYCLES','BLENDER_EEVEE','BLENDER_WORKBENCH'),default='CYCLES')
args=parser.parse_args(sys.argv[sys.argv.index('--')+1:])
args.output.mkdir(parents=True,exist_ok=True)
packed=root/"blender_work/20261125-public-axis/sejong_public_axis_components.blend"
bpy.ops.wm.open_mainfile(filepath=str(args.source),load_ui=False)
scene=next((s for s in bpy.data.scenes if '주간' in s.name),bpy.context.scene)
bpy.context.window.scene=scene
view=bpy.context.view_layer
names=set(data["hideFromCore"])


def locates(prefix,objs):
 return [o for o in objs if o.name.startswith(prefix)]


def ray_z(x,y,objs):
 origin=Vector((x,y,1.4)); direction=Vector((0,0,-1))
 zs=[]
 for o in objs:
  if o.type!='MESH':continue
  m=o.matrix_world
  hit,p,*_=o.ray_cast(m.inverted()@origin,m.inverted().to_3x3()@direction)
  if hit: zs.append((m@p).z)
 return max(zs,default=None)


def check_close(value,expected):
 if value is None or abs(value-expected)>0.011:
  raise ValueError(f"Height {value} vs {expected}")


def render(name,pos,target,lens=37):
 if not args.render:return
 scene.render.engine=args.engine
 scene.cycles.samples=7
 scene.cycles.use_denoising=True
 scene.cycles.max_bounces=4
 scene.cycles.transparent_max_bounces=9
 scene.render.threads_mode='FIXED'
 scene.render.threads=6
 scene.render.resolution_x=1024;scene.render.resolution_y=648;scene.render.resolution_percentage=100
 scene.render.image_settings.file_format='JPEG';scene.render.image_settings.quality=85
 scene.render.film_transparent=False
 if hasattr(scene,'eevee'):
  scene.eevee.taa_render_samples=20
 for obj in scene.objects:
  if obj.type=='LIGHT':obj.hide_render=True
 scene.world=bpy.data.worlds.new("Public-axis soft daylight")
 scene.world.use_nodes=True
 bg=scene.world.node_tree.nodes.get("Background")
 bg.inputs[0].default_value=(.61,.74,.91,1);bg.inputs[1].default_value=.55
 scene.view_settings.view_transform='AgX'
 for name_, kind, where, energy, size, rot in (
  ('High sky','AREA',(40,35,82),2600,82,(0,0,0)),
  ('Afternoon sun','SUN',(0,0,30),2.5,1,(.40,-.45,-.45)),
 ):
  lamp=bpy.data.lights.new(name_,kind);lamp.energy=energy
  if kind=='AREA':lamp.shape='DISK';lamp.size=size
  else:lamp.angle=.15
  o=bpy.data.objects.new(name_,lamp);scene.collection.objects.link(o);o.location=where;o.rotation_euler=rot
 lensData=bpy.data.cameras.new("Comparison camera")
 lensData.lens=lens;lensData.clip_end=1400
 lensData.clip_start=.095
 camera=bpy.data.objects.new("Comparison camera",lensData);scene.collection.objects.link(camera)
 camera.location=pos;camera.rotation_euler=(Vector(target)-camera.location).to_track_quat('-Z','Y').to_euler()
 scene.camera=camera
 scene.render.filepath=str(args.output/(name+".jpg"))
 bpy.ops.render.render(write_still=True)
 bpy.data.objects.remove(camera,do_unlink=True)

oldfloors=[o for o in scene.objects if o.name in names and (o.name=='ground' or o.name.startswith('Surroundings'))]
check_close(ray_z(33,115,oldfloors),0)
render("theatre-before",(21,126,2.65),(32,116,2.35),33)
render("gratitude-before",(53,-82,4.2),(77,-71,2.3),45)
render("north-before",(341,-55,23),(396,-75,6.2),42)

with bpy.data.libraries.load(str(packed),link=False) as (src,dst):
 dst.collections=[n for n in src.collections if n[:2] in ("01","02","03")]
for c in dst.collections:
 scene.collection.children.link(c)
new=[o for c in dst.collections for o in c.objects]
for o in scene.objects:
 if o.name in names or o.name.startswith(('DAY pavilion','NIGHT pavilion','DAY interpretive open glass door','NIGHT interpretive open glass door','Survey glow - Pavilion')):
  o.hide_render=True
 # Objects loaded with matching original names acquire .001 suffixes; distinguish by the linked collection.
 if o not in new and (o.name.startswith(('Gratitude ','Freedom ')) or o.name=='Watercourse pedestrian bridge at crossing'):
  o.hide_render=True
view.update()

ground=locates("Axis ground replacement",new)
t=locates("S Theatre / sunken",new)+ground
checks=[(33,118.72,.24),(33,118.45,.07),(33,117.86,-.27),(33,115.1,-2.14),(33,112.93,-3.16),(27.8,117,0)]
# Height expectations follow drawn steps and measured mesh, not box boundaries inferred from the renderer.
for x,y,h in checks:check_close(ray_z(x,y,t),h)
assert not ray_z(33,115,ground)
check_close(ray_z(155,-116,locates("Watercourse pedestrian bridge",new)),.115)
assert len({o.name.split(' / ')[0] for o in new if o.name.startswith('Gratitude Light')})==23
for prefix in ["Gwanghwamun /","Woldae plaque /"]:
 assert locates(prefix,new)
print('PUBLIC AXIS: legacy terrain, six new floor samples, bridge, 23 sculptures and gate verified',flush=True)
render("theatre-after",(21,126,2.65),(32,116,2.35),33)
render("theatre-skylight",(31.4,120.4,2.0),(33,115,-.6),29)
render("gratitude-after",(53,-82,4.2),(77,-71,2.3),45)
render("north-after",(341,-55,23),(396,-75,6.2),42)
render("north-detail",(355,-70,3.1),(412,-73,9),38)
