import bpy, math, os
from mathutils import Vector
scene=bpy.data.scenes.new('Tree anatomy temporary preview')
bpy.context.window.scene=scene
src=bpy.data.scenes['20261103 - streaming web export']
names=['Tree trunk 0']+['Tree foliage 0 shade %d'%i for i in range(4)]
anchor=src.objects[names[0]].location.copy()
for name in names:
    original=src.objects[name]; obj=original.copy(); obj.data=original.data; scene.collection.objects.link(obj); obj.location=original.location-anchor
world=bpy.data.worlds.new('Preview sky'); world.use_nodes=True
world.node_tree.nodes.get('Background').inputs['Color'].default_value=(.55,.65,.8,1)
world.node_tree.nodes.get('Background').inputs['Strength'].default_value=.7; scene.world=world
sun_data=bpy.data.lights.new('Preview sun','SUN'); sun_data.energy=2.4
sun=bpy.data.objects.new('Preview sun',sun_data); scene.collection.objects.link(sun); sun.rotation_euler=(math.radians(28),math.radians(-25),math.radians(-35))
cam_data=bpy.data.cameras.new('Preview camera'); cam=bpy.data.objects.new('Preview camera',cam_data); scene.collection.objects.link(cam)
cam.location=(12,-18,10); cam.rotation_euler=(Vector((0,0,4.8))-cam.location).to_track_quat('-Z','Y').to_euler(); cam_data.type='ORTHO';cam_data.ortho_scale=12.5;scene.camera=cam
scene.render.engine='BLENDER_EEVEE';scene.render.resolution_x=850;scene.render.resolution_y=850;scene.render.resolution_percentage=100
scene.render.image_settings.file_format='PNG'; scene.render.filepath=os.path.join(os.getcwd(),'docs','sitevisit-review','20261104-connected-tree.png')
bpy.ops.render.render(write_still=True)
