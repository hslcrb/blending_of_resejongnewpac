"""Build a photo-interpreted grand theatre scene and a compact web asset.

Run with Blender background and -- --source /absolute/original.blend.
The existing source scene stays intact in the saved copy; new work is isolated.
Coordinates are illustrative, not surveyed dimensions.
"""
import bpy, math, json, random, sys
from pathlib import Path
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[1]
args=sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else []
if len(args)<2 or args[0]!='--source': raise RuntimeError('Pass -- --source <original.blend> [--no-render]')
source=Path(args[1]).resolve()
if not source.is_file(): raise RuntimeError('Original Blender scene is missing')
output=ROOT/'public/model/grand-theatre'; output.mkdir(parents=True,exist_ok=True)
copy=ROOT/'blender_work/20261104-live-sky/grand-theatre'; copy.mkdir(parents=True,exist_ok=True)
bpy.ops.wm.open_mainfile(filepath=str(source),load_ui=False)
original=bpy.context.scene
scene=bpy.data.scenes.new('대극장 내부 · Grand Theatre')
bpy.context.window.scene=scene
scene.world=original.world
scene.frame_start=original.frame_start; scene.frame_end=original.frame_end; scene.frame_set(original.frame_current)
for key in original.keys():
    if key.startswith('seoul_weather_'): scene[key]=original[key]
for key in ('seoul_weather_sun','seoul_weather_night_fill'):
    ob=bpy.data.objects.get(scene.get(key,''))
    if ob and ob.name not in scene.collection.objects: scene.collection.objects.link(ob)

# The web geometry uses real material images and repeatable, metre-based UVs.
def material(name,color,metallic=0,rough=.7,texture=False,emission=0):
    m=bpy.data.materials.new(name);m.diffuse_color=(*color,1);m.use_nodes=True
    p=m.node_tree.nodes.get('Principled BSDF');p.inputs['Base Color'].default_value=(*color,1)
    p.inputs['Roughness'].default_value=rough;p.inputs['Metallic'].default_value=metallic
    if emission:
        p.inputs['Emission Color'].default_value=(*color,1);p.inputs['Emission Strength'].default_value=emission
    if texture:
        image=bpy.data.images.new(name+' texture',width=128,height=128,alpha=True)
        rng=random.Random(name);pixels=[]
        for v in range(128):
            for u in range(128):
                grain=0.88+0.09*math.sin(u*.32+2*math.sin(v*.037))+rng.random()*.07
                pixels.extend((min(1,color[0]*grain),min(1,color[1]*grain),min(1,color[2]*grain),1))
        image.pixels.foreach_set(pixels);image.pack()
        node=m.node_tree.nodes.new('ShaderNodeTexImage');node.image=image;node.extension='REPEAT'
        m.node_tree.links.new(node.outputs['Color'],p.inputs['Base Color'])
    return m

mats={
 'wood':material('붉은 목재 음향판',(.42,.12,.075),texture=True),
 'wood2':material('목재 테두리',(.23,.058,.034),texture=True),
 'floor':material('무대 오크 바닥',(.63,.39,.20),texture=True),
 'floor_dark':material('객석 원목 디딤판',(.32,.16,.09),texture=True),
 'seat':material('깊은 붉은 객석 천',(.40,.035,.042),rough=.95,texture=True),
 'seat_side':material('객석 목재 측판',(.19,.035,.025),rough=.6,texture=True),
 'carpet':material('다홍색 통로 카펫',(.28,.025,.035),rough=1,texture=True),
 'cream':material('음향 천장 패널',(.68,.48,.39),rough=.8),
 'black':material('무대 후면 암흑',(.025,.024,.026),rough=.9),
 'steel':material('백스테이지 철골',(.075,.08,.085),metallic=.55),
 'gold':material('오르간과 난간 금속',(.58,.37,.15),metallic=.75,rough=.34),
 'pipe':material('파이프 오르간 금속',(.55,.54,.46),metallic=.7,rough=.3),
 'light':material('따뜻한 객석 조명',(.92,.66,.35),rough=.4,emission=1.8),
 'curtain':material('무대 적갈색 커튼',(.14,.012,.022),rough=.95,texture=True),
 'screen':material('영사 스크린',(.035,.035,.037),rough=.9),
 'shell':material('무대 밝은 음향 반사판',(.64,.42,.22),rough=.8,texture=True),
}
class Builder:
 def __init__(self): self.v=[];self.f=[]
 def box(self,x,y,z,w,d,h):
    n=len(self.v);self.v.extend([(x+sx*w/2,y+sy*d/2,z+sz*h/2) for sx,sy,sz in [(-1,-1,-1),(1,-1,-1),(1,1,-1),(-1,1,-1),(-1,-1,1),(1,-1,1),(1,1,1),(-1,1,1)]])
    self.f.extend([tuple(n+i for i in face) for face in ((0,3,2,1),(4,5,6,7),(0,1,5,4),(1,2,6,5),(2,3,7,6),(3,0,4,7))])
 def strip(self,x0,x1,y0,y1,z0,z1,curve=.010):
    # Fan-shaped rows follow a gently curved proscenium-facing footprint.
    n=len(self.v);self.v.extend([(x0,y0-curve*x0*x0,z0),(x1,y0-curve*x1*x1,z0),(x1,y1-curve*x1*x1,z0),(x0,y1-curve*x0*x0,z0),(x0,y0-curve*x0*x0,z1),(x1,y0-curve*x1*x1,z1),(x1,y1-curve*x1*x1,z1),(x0,y1-curve*x0*x0,z1)])
    self.f.extend([tuple(n+i for i in face) for face in ((0,3,2,1),(4,5,6,7),(0,1,5,4),(1,2,6,5),(2,3,7,6),(3,0,4,7))])
 def quad(self,points):
    n=len(self.v);self.v.extend(points);self.f.append(tuple(range(n,n+len(points))))
 def rounded_panel(self,x,y,z,w,d,h):
    # Tapered, bevelled silhouette for upholstered seat backs.
    r=min(w*.15,h*.12);outline=[(-w/2+r,-h/2),(w/2-r,-h/2),(w/2,-h/2+r),(w/2,h/2-r),(w/2-r,h/2),(-w/2+r,h/2),(-w/2,h/2-r),(-w/2,-h/2+r)]
    n=len(self.v)
    for yy in (y-d/2,y+d/2):self.v.extend((x+px,yy,z+pz) for px,pz in outline)
    self.f.append(tuple(n+i for i in range(7,-1,-1)));self.f.append(tuple(n+8+i for i in range(8)))
    for i in range(8):j=(i+1)%8;self.f.append((n+i,n+j,n+8+j,n+8+i))
 def cylinder(self,x,y,z,r,h,segments=10):
    n=len(self.v)
    for zz in (z-h/2,z+h/2):
        for i in range(segments):
            a=2*math.pi*i/segments;self.v.append((x+math.cos(a)*r,y+math.sin(a)*r,zz))
    self.f.append(tuple(n+i for i in range(segments-1,-1,-1)));self.f.append(tuple(n+segments+i for i in range(segments)))
    for i in range(segments):j=(i+1)%segments;self.f.append((n+i,n+j,n+segments+j,n+segments+i))
 def finish(self,name,mat):
    mesh=bpy.data.meshes.new(name);mesh.from_pydata(self.v,[],self.f);mesh.update()
    uv=mesh.uv_layers.new(name='Materials')
    for face in mesh.polygons:
        ax=max(range(3),key=lambda i:abs(face.normal[i]));a,b=((1,2) if ax==0 else (0,2) if ax==1 else (0,1))
        for li in face.loop_indices:
            v=mesh.vertices[mesh.loops[li].vertex_index].co;uv.data[li].uv=(v[a]/2,v[b]/2)
    ob=bpy.data.objects.new(name,mesh);scene.collection.objects.link(ob);ob.data.materials.append(mat);return ob
b={name:Builder() for name in mats}
box=lambda mat,*values:b[mat].box(*values)

# Main stage, rake and side walls. The central rear doorway stays open.
box('floor',0,6.8,-.13,28,20,.26)
box('black',0,19.5,5.8,30,.45,11.6)
for x in (-17.25,17.25): box('wood2',x,-13,8.6,.5,33,17.2)
for x in (-9.8,9.8): box('wood2',x,-29.2,8.5,14.4,.5,17)
box('wood2',0,-29.2,10.75,5.2,.5,12.5)
box('wood2',0,-29.2,17.55,34,.5,1.4)
box('floor_dark',0,-13.6,-.18,34,31,.35)
for row in range(24):
    y=-(3.2+row*.98);z=row*.085
    for x in range(-16,17):b['floor_dark'].strip(x-.5,x+.5,y-.49,y+.49,z-.22,z)
# Rear landing joins the last curved tread to the central exit.
for x in range(-16,17):
    front=-26.22-.010*x*x
    if front > -29.2: b['floor_dark'].strip(x-.5,x+.5,-29.2+.010*x*x,front+.010*x*x,-.2,1.96)
# Aisles are visible and intentionally free of seats.
for x in (-8.4,0,8.4):
 for row in range(24):box('carpet',x,-(3.2+row*.98)-.010*x*x,row*.085+.018,1.0,.96,.035)

# Three seating levels, each chair tied to a web camera position.
seats=[]
def seating(level,rows,start_y,base_height,step):
 for row in range(rows):
  for col in range(-21,22):
   x=col*.71
   if abs(x)<.85 or abs(abs(x)-8.4)<.63: continue
   y=-(start_y+row*.98)-.010*x*x;z=base_height+row*step
   beginnings={name:len(b[name].v) for name in ('seat','seat_side')}
   box('seat',x,y,z+.39,.59,.55,.14)
   b['seat'].rounded_panel(x,y-.245,z+.76,.59,.12,.78)
   box('seat_side',x-.32,y,z+.44,.055,.66,.65);box('seat_side',x+.32,y,z+.44,.055,.66,.65)
   angle=math.atan2(x,-y+5);c=math.cos(angle);s=math.sin(angle)
   for name,start in beginnings.items():
    for i in range(start,len(b[name].v)):
     vx,vy,vz=b[name].v[i];dx=vx-x;dy=vy-y;b[name].v[i]=(x+c*dx-s*dy,y+s*dx+c*dy,vz)
   seats.append({'id':f'{level}-{row+1:02d}-{col+22:02d}','level':level,'row':row+1,'position':[round(x,3),round(z,3),round(-y,3)],'eyeHeight':1.4,'lookAt':[0,5,0]})
seating(1,24,3.3,0,.085)
# Layered, gently curved balcony rails and seats overlooking the floor.
for level,height in ((2,6.4),(3,11.0)):
    for row in range(7):
        y=-(19.6+row*.98);z=height+row*.12
        for x in range(-16,17):b['wood2'].strip(x-.5,x+.5,y-.49,y+.49,z-.40,z)
        for x in (-8.4,0,8.4):box('carpet',x,y-.010*x*x,z+.018,1,.96,.035)
    for x in range(-16,17):
        front=-25.97-.010*x*x
        if front > -29.2:b['wood2'].strip(x-.5,x+.5,-29.2+.010*x*x,front+.010*x*x,height+.32,height+.72)
    for x in range(-16,17):
        arc=.010*x*x
        box('wood',x,-18.9-arc,height-.50,.98,.35,1.15)
        box('gold',x,-18.68-arc,height+.13,.99,.08,.07)
        if x%4==0:box('gold',x,-18.65-arc,height-.30,.22,.045,.22)
    seating(level,7,19.65,height,.12)

# Wood relief panels resemble the irregular acoustic wall blocks in photographs.
rng=random.Random(1188)
for side in (-1,1):
 for row in range(9):
  for col in range(18):
   y=-1.2-col*1.43;z=1.2+row*1.7
   if z>12.8 and y<-18.8:continue
   depth=.12+rng.choice((0,.08,.16,.25))
   box('wood' if (row+col)%3 else 'wood2',side*(16.96-depth/2),y,z,depth,1.36,1.56)

# Ceiling vault and warm recessed fixtures.
for col in range(34):
    x=-17+col
    z0=17.8-3.3*(x/17)**2;z1=17.8-3.3*((x+1)/17)**2
    b['cream'].quad([(x,-29,z0),(x+1,-29,z1),(x+1,.2,z1),(x,.2,z0)])
for yy in range(-27,0,3):
 for xx in range(-15,16,3):
    zz=17.8-3.3*(xx/17)**2-.08
    box('light',xx,yy,zz,.13,.13,.04)

# Proscenium, wings, pipe organ and stage rigging.
for x in (-14.35,14.35):box('black',x,1.0,6.7,1.7,2.3,13.4)
box('black',0,1,13.9,30,2.2,1.0)
box('black',0,.2,16.0,30,.45,3.5)
box('black',0,10.5,14.5,30,21,.25)
for side in (-1,1):
 x=side*15.7
 for i in range(19):
    yy=-.7-(i%4)*.45; h=2.6+7.0*(1-abs(i-9)/10)+(.2*(i%3))
    b['pipe'].cylinder(x+(i-9)*.095,yy,4.8+h/2,.075,h,8)
 for i in range(4):box('wood2',x,-.9-i*.48,4.3,.32,.25,1.2)
# Behind the movable shell is a deep black technical stage, with rails and portal frames.
for x in (-14.7,14.7):
 box('black',x,11,7,.5,18,14)
 for y in (4.4,9,13.6,18):
  box('steel',x,y,7,.12,.12,14)
  for z in (1.5,4.5,7.5,10.5,13.5):box('steel',x,y,z,.12,4.5,.10)
for y in (4,8,12,16,19):
 box('steel',0,y,13.9,29,.12,.16)
 for x in range(-12,13,4):box('steel',x,y,13.7,.09,.1,.45)
for x in (-10,-5,0,5,10):box('gold',x,12,-.005,.025,14,.015)

# Movable groups are separate named GLB nodes; an app can switch their visibility.
curtain=Builder()
for i in range(88):
 x=-13.85+i*.318
 curtain.box(x,.35+math.sin(i*1.15)*.09,6.62,.35,.20,13.24)
curtain.finish('GrandCurtain',mats['curtain'])
shell=Builder()
shell.box(0,9.0,6.4,26,.28,12.8)
for x in (-12.7,12.7):shell.box(x,5.2,6.4,.28,7.7,12.8)
shell.box(0,5.2,12.65,25.4,7.8,.28)
for x in range(-12,13,2):shell.box(x,8.82,6.4,.025,.02,12.8)
shell.finish('GrandAcousticShell',mats['shell'])
screen=Builder();screen.box(0,1.12,6.75,16.0,.08,9.0)
screen_object=screen.finish('GrandProjectionScreen',mats['screen'])
# The projection's full 16:9 face maps to the whole video, not a repeated tile.
screen_uv=screen_object.data.uv_layers.active
for face in screen_object.data.polygons:
 for li in face.loop_indices:
  v=screen_object.data.vertices[screen_object.data.loops[li].vertex_index].co
  screen_uv.data[li].uv=((v.x+8.0)/16.0,(v.z-2.25)/9.0)

for name,builder in b.items():
 if builder.v:builder.finish('Grand_'+name,mats[name])

# Warm fill lights model stage ambience in the authored Blender file. Web supplies its own lights.
def area(name,position,power,size,color,target):
 data=bpy.data.lights.new(name,'AREA');data.energy=power;data.shape='DISK';data.size=size;data.color=color
 ob=bpy.data.objects.new(name,data);scene.collection.objects.link(ob);ob.location=position;ob.rotation_euler=(Vector(target)-ob.location).to_track_quat('-Z','Y').to_euler()
area('객석 따뜻한 반사광',(0,-10,14),26000,14,(1,.72,.52),(0,-10,0))
area('무대 조명',(0,3,12),17000,10,(1,.84,.67),(0,1,0))
area('발코니 아래 반사광',(0,-22,6.0),13000,10,(1,.71,.53),(0,-21,0))
area('위층 반사광',(0,-23,10.8),11000,10,(1,.74,.55),(0,-22,6.4))
area('벽면 반사광 왼쪽',(-12,-12,13),9000,8,(1,.70,.48),(-16,-13,4))
area('벽면 반사광 오른쪽',(12,-12,13),9000,8,(1,.70,.48),(16,-13,4))
area('뒤편 안전 조명',(0,17,10),2400,7,(.65,.72,1),(0,12,0))

camera_data=bpy.data.cameras.new('Grand Theatre camera');camera=bpy.data.objects.new('Grand Theatre camera',camera_data);scene.collection.objects.link(camera)
camera.location=(12.0,-15.0,9.2);camera.rotation_euler=(Vector((0,-1.5,5.3))-camera.location).to_track_quat('-Z','Y').to_euler();camera_data.lens=18;scene.camera=camera
scene.render.engine='CYCLES';scene.cycles.samples=8;scene.render.threads_mode='FIXED';scene.render.threads=2;scene.render.resolution_x=800;scene.render.resolution_y=450;scene.render.resolution_percentage=100
scene.view_settings.view_transform='AgX';scene.render.image_settings.file_format='PNG'

layout={'coordinates':'three-y-up-meters','reference':'User-supplied photographs and plan; dimensions are interpretations, not a measured venue plan.',
'nodes':{'curtain':'GrandCurtain','shell':'GrandAcousticShell','screen':'GrandProjectionScreen'},
'entrance':{'x':0,'y':1.96,'z':29.0},'stage':{'x':0,'y':0,'z':-3},'backstage':{'x':0,'y':0,'z':-14},
'projectionScreen':{'position':[0,6.75,-1.12],'width':16,'height':9},
'aisles':[{'x':-8.4,'width':1.0},{'x':0,'width':1.0},{'x':8.4,'width':1.0}],
'seats':seats}
(output/'layout.json').write_text(json.dumps(layout,ensure_ascii=False,separators=(',',':'))+'\n',encoding='utf-8')
# Save a separate copy; the original scene and its Seoul weather script remain intact.
bpy.context.preferences.filepaths.save_version=0
bpy.ops.wm.save_as_mainfile(filepath=str(copy/'sejong_grand_theatre_20261104.blend'))
# Export only newly authored meshes; no original campus model or lights in this asset.
bpy.ops.object.select_all(action='DESELECT')
for ob in scene.objects:
 if ob.type=='MESH':ob.select_set(True)
bpy.ops.export_scene.gltf(filepath=str(output/'grand-theatre.glb'),export_format='GLB',use_selection=True,use_active_scene=True,export_yup=True,export_apply=True)
if '--no-render' not in args:
 scene.render.filepath=str(ROOT/'docs/grand-theatre-preview-20261104.png')
 scene.render.image_settings.file_format='PNG';bpy.ops.render.render(write_still=True)
 bpy.data.objects['GrandCurtain'].hide_render=True;bpy.data.objects['GrandProjectionScreen'].hide_render=True
 camera.location=(0,4,6.5);camera.rotation_euler=(Vector((0,-20,6))-camera.location).to_track_quat('-Z','Y').to_euler();camera_data.lens=21
 scene.render.filepath=str(ROOT/'docs/grand-theatre-auditorium-20261104.png');bpy.ops.render.render(write_still=True)
print('GRAND_THEATRE_DONE',len(seats),flush=True)
