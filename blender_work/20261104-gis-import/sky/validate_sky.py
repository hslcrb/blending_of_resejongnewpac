"""Validate saved sky timeline and preserved non-day scenes without saving."""
import bpy,sys,math
from pathlib import Path
source=Path(sys.argv[sys.argv.index('--')+1]).resolve()
bpy.ops.wm.open_mainfile(filepath=str(source))
s=bpy.data.scenes['Scene']; sky=next(n for n in s.world.node_tree.nodes if n.type=='TEX_SKY'); sun=s.objects['Seoul time - Sun']
assert (s.frame_start,s.frame_end)==(1,145) and s.get('seoul_sky_axis') in ('local','seoul')
assert bpy.data.texts.get('Seoul live sky.py') is not None
s.frame_set(1);night=(sky.sun_elevation,sun.data.energy)
assert s.objects['Seoul time - night fill'].data.energy > 0
s.frame_set(73);noon=(sky.sun_elevation,sun.data.energy)
assert night[0]<0 and night[1]==0 and noon[0]>0 and noon[1]>0,(night,noon)
if s['seoul_sky_axis']=='local': assert bpy.data.scenes.get('Site visit - NIGHT') and len(bpy.data.scenes['Site visit - NIGHT'].objects)>=1300
print('PASS',source.name,'axis',s['seoul_sky_axis'],'midnight',night,'noon',noon)
