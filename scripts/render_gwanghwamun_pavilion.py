"""Camera-locked before/after checks of the same north-axis scene in Blender."""
import bpy
from pathlib import Path
import sys
from mathutils import Vector

directory=Path(sys.argv[sys.argv.index('--')+1])
label=sys.argv[sys.argv.index('--')+2]
scene=bpy.context.scene
for child in tuple(scene.collection.children):
    if 'Gwanghwamun' not in child.name:
        scene.collection.children.unlink(child)
scene.render.engine='CYCLES'; scene.cycles.device='CPU'; scene.cycles.samples=14
scene.cycles.use_denoising=True
scene.render.resolution_x=1250; scene.render.resolution_y=790
scene.render.resolution_percentage=100
scene.render.image_settings.file_format='JPEG'; scene.render.image_settings.quality=88
scene.view_settings.view_transform='AgX'
scene.world=bpy.data.worlds.new('Blue-grey daylight')
scene.world.use_nodes=True
bg=scene.world.node_tree.nodes['Background']
bg.inputs[0].default_value=(.52,.68,.89,1)
bg.inputs[1].default_value=.72
sun=bpy.data.lights.new('Sun','SUN');sun.energy=3.1;sun.angle=.065
light=bpy.data.objects.new('Sun',sun);scene.collection.objects.link(light)
light.rotation_euler=(.48,-.61,.95)
optic=bpy.data.cameras.new('Camera');optic.clip_end=1000
camera=bpy.data.objects.new('Camera',optic);scene.collection.objects.link(camera);scene.camera=camera
shots={
 'front':((360,-72.957,2.8),(413.324,-72.957,9.7),44),
 'eaves':((380,-101,10.2),(413,-72,13.5),35),
}
for name,(position,target,lens) in shots.items():
    camera.location=position
    camera.rotation_euler=(Vector(target)-camera.location).to_track_quat('-Z','Y').to_euler()
    optic.lens=lens
    scene.render.filepath=str(directory/f'gwanghwamun-{label}-{name}.jpg')
    bpy.ops.render.render(write_still=True)
