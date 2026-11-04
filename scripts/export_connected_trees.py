"""Export only the existing streaming partitions that contain changed trees."""
import bpy, json, os, time
from io_scene_gltf2.io.exp import meshopt as meshopt_exporter
root=os.getcwd()
partition=json.load(open(os.path.join(root,'docs/sitevisit-review/20261103-export-partitions.json'),encoding='utf-8'))
webscene=bpy.data.scenes[partition['scene']]
bpy.context.window.scene=webscene
layer=bpy.context.view_layer
out=os.path.join(root,'public','model','trees-20261104')
os.makedirs(out,exist_ok=True)
changed={key:entry['objects'] for key,entry in partition['groups'].items() if any('Tree' in p['object'] for p in entry['objects'])}
assert len(changed)==12, len(changed)
previous=meshopt_exporter.EXP_FILTER_BITS
meshopt_exporter.EXP_FILTER_BITS=23
try:
    for key,items in changed.items():
        bpy.ops.object.select_all(action='DESELECT')
        for item in items:
            obj=webscene.objects.get(item['object'])
            assert obj is not None, (key,item)
            assert obj.name in layer.objects, obj.name
            obj.hide_set(False); obj.select_set(True)
        output=os.path.join(out,f'20261104-{key}.glb')
        started=time.time()
        bpy.ops.export_scene.gltf(filepath=output,export_format='GLB',use_selection=True,use_active_scene=True,
            export_meshopt_compression_enable=True,export_meshopt_extension='EXT_meshopt_compression',export_animations=False,export_lights=False)
        size=os.path.getsize(output)
        assert 0 < size < 25*1024*1024, (output,size)
        print('TREE_EXPORT',key,len(items),size,round(time.time()-started,1),flush=True)
finally:
    meshopt_exporter.EXP_FILTER_BITS=previous
