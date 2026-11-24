"""Compare the four-mesh component at a fixed low viewpoint without saving it.

Usage: blender -b [saved_component.blend | omitted if passing --source GLB]
  --python-exit-code 1 -P scripts/render_colonnade_base_20261124.py
  -- --output <jpg> [--source <GLB>] [--view detail|row]
The neutral ground/fixture lights are review aids, not exported building geometry.
"""
import argparse, sys
import bpy
from mathutils import Vector

parser=argparse.ArgumentParser()
parser.add_argument('--source')
parser.add_argument('--view',default='row',choices=('row','detail'))
parser.add_argument('--output',required=True)
args=parser.parse_args(sys.argv[sys.argv.index('--')+1:])
if args.source:
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete(use_global=False)
    bpy.ops.import_scene.gltf(filepath=args.source)

def orient(obj, center):
    obj.rotation_euler=(Vector(center)-obj.location).to_track_quat('-Z','Y').to_euler()

for x in [-27.44,-19.12,-10.79,-2.46,5.87,14.20,22.53]:
    for y in (106.75,109.14):
        data=bpy.data.lights.new('Review fixture','AREA')
        data.energy=210
        data.size=.28
        data.color=(.89,.94,1)
        obj=bpy.data.objects.new('Review fixture',data)
        bpy.context.scene.collection.objects.link(obj)
        obj.location=(x,y,6.63)
        # Default local -Z direction. Ensure slots aren't facing the ceiling.
        orient(obj,(x,y,0))
key=bpy.data.lights.new('Review soft fill','AREA');key.energy=1700;key.size=12
key_obj=bpy.data.objects.new('Review soft fill',key);bpy.context.scene.collection.objects.link(key_obj)
key_obj.location=(10,117,6);orient(key_obj,(6,108,1.2))
bpy.ops.mesh.primitive_plane_add(size=125,location=(0,100,-.007))
floor=bpy.context.object
floor.name='Review neutral pavement, not exported'
ground=bpy.data.materials.new('Review neutral pavement')
ground.diffuse_color=(.26,.24,.22,1)
floor.data.materials.append(ground)
cam=bpy.data.cameras.new('Matched review camera')
camera=bpy.data.objects.new(cam.name,cam)
bpy.context.scene.collection.objects.link(camera)
if args.view=='detail':
    camera.location=(19.2,106.5,1.36); orient(camera,(14.2,108.2,1.25)); cam.lens=38
else:
    camera.location=(25.6,106.85,1.67); orient(camera,(1.0,108.0,2.65)); cam.lens=26
scene=bpy.context.scene
scene.camera=camera
scene.render.engine='CYCLES';scene.cycles.samples=14;scene.cycles.use_denoising=True
world=bpy.data.worlds.new('Review dusk')
world.use_nodes=True
world.node_tree.nodes.get('Background').inputs[0].default_value=(.38,.43,.62,1)
world.node_tree.nodes.get('Background').inputs[1].default_value=.31
scene.world=world
scene.render.resolution_x=980;scene.render.resolution_y=630
scene.render.resolution_percentage=100
scene.render.image_settings.file_format='JPEG';scene.render.image_settings.quality=88
scene.render.filepath=args.output
bpy.ops.render.render(write_still=True)
