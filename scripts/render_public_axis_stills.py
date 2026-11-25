import bpy
from pathlib import Path
import sys
from mathutils import Vector
scene=bpy.context.scene
scene.render.engine='CYCLES'
scene.cycles.device='CPU'
scene.cycles.samples=10
scene.cycles.max_bounces=5
scene.cycles.transparent_max_bounces=9
scene.cycles.use_denoising=True
scene.render.resolution_x=1100
scene.render.resolution_y=700
scene.render.resolution_percentage=100
scene.render.film_transparent=False
scene.render.image_settings.file_format='JPEG'
scene.render.image_settings.quality=87
scene.view_settings.view_transform='AgX'
scene.world=bpy.data.worlds.new('Neutral blue daylight')
scene.world.use_nodes=True
bg=scene.world.node_tree.nodes['Background']
bg.inputs[0].default_value=(.62,.76,.96,1)
bg.inputs[1].default_value=.55
sun=bpy.data.lights.new('Afternoon daylight','SUN');sun.energy=2.35;sun.angle=.075
light=bpy.data.objects.new('Afternoon daylight',sun);scene.collection.objects.link(light)
light.rotation_euler=(.46,-.47,1.15)
optic=bpy.data.cameras.new('Evidence camera');optic.clip_end=1300
camera=bpy.data.objects.new('Evidence camera',optic);scene.collection.objects.link(camera);scene.camera=camera
def image(title, pos, focal, lens):
 camera.location=pos;camera.rotation_euler=(Vector(focal)-camera.location).to_track_quat('-Z','Y').to_euler()
 optic.lens=lens
 scene.render.filepath=str(Path(sys.argv[sys.argv.index('--')+1])/f'{title}.jpg')
 bpy.ops.render.render(write_still=True)
image('s-theatre-sunken',(30.6,119.32,3.91),(33.6,115.8,-1.0),25)
image('gwanghwamun-roof-forecourt',(368,-96,11),(404,-71,8.3),44)
image('gratitude-stone-detail',(55,-80,3.1),(69,-71,2.38),44)
