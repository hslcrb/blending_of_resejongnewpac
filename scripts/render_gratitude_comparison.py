"""Render the previous and revised Garden blends with matched cameras and light."""
import bpy
from mathutils import Vector
from pathlib import Path
import sys

before,after,out=(Path(p).resolve() for p in sys.argv[sys.argv.index('--')+1:])
out.mkdir(exist_ok=True,parents=True)

def render(source,stage,shots):
    bpy.ops.wm.open_mainfile(filepath=str(source),load_ui=False,use_scripts=False)
    scene=bpy.context.scene
    for c in list(scene.collection.children):
        if 'Garden of Gratitude' not in c.name:
            c.hide_render=True
    mat=bpy.data.materials.new('Comparison floor');mat.diffuse_color=(.44,.44,.42,1)
    # The isolation stage must keep the same stair opening as the web terrain.
    for a,b,d,e in [(10,110,-155,5),(122,170,-155,5),(110,122,-155,-66.95),(110,122,-57.05,5)]:
        floor=bpy.data.meshes.new('Comparison plane outside the stair opening')
        floor.from_pydata([(a,d,-.012),(b,d,-.012),(b,e,-.012),(a,e,-.012)],[],[(0,1,2,3)])
        obj=bpy.data.objects.new(floor.name,floor);scene.collection.objects.link(obj)
        floor.materials.append(mat)
    scene.render.engine='CYCLES'
    scene.cycles.device='CPU'
    scene.cycles.samples=9
    scene.cycles.max_bounces=4
    scene.cycles.use_denoising=True
    scene.render.resolution_x=1080
    scene.render.resolution_y=660
    scene.render.resolution_percentage=100
    scene.render.image_settings.file_format='JPEG'
    scene.render.image_settings.quality=87
    scene.world=bpy.data.worlds.new('Matched daylight')
    scene.world.use_nodes=True
    bg=scene.world.node_tree.nodes['Background']
    bg.inputs[0].default_value=(.71,.82,1,1)
    bg.inputs[1].default_value=.64
    sun=bpy.data.lights.new('Daylight','SUN');sun.energy=2.3;sun.angle=.037
    light=bpy.data.objects.new('Daylight',sun);scene.collection.objects.link(light)
    light.rotation_euler=(.44,-.55,1.10)
    optic=bpy.data.cameras.new('Matched evidence camera')
    camera=bpy.data.objects.new('Matched evidence camera',optic)
    scene.collection.objects.link(camera);scene.camera=camera
    for name,pos,look,lens in shots:
        camera.location=pos
        camera.rotation_euler=(Vector(look)-camera.location).to_track_quat('-Z','Y').to_euler()
        optic.lens=lens
        scene.render.filepath=str(out/f'{name}-{stage}.jpg')
        bpy.ops.render.render(write_still=True)

row=('garden-row',(55,-80.4,3.1),(74,-72.6,2.3),29)
render(before,'before',[row])
render(after,'after',[row,
 ('garden-stone',(83.64,-75.1,1.47),(88,-71.8,.99),34),
 ('garden-entry',(107.5,-63.5,2.3),(120.6,-63.5,-1.03),29)])
