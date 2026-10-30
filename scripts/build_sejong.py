import bpy, math, os, random
from mathutils import Vector

# Photo-proportioned architectural reconstruction. Coordinates are in metres;
# the supplied photographs do not establish surveyed measurements.
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
# Remove only the obsolete, internally generated photo-relief datablocks.
# The original reference images remain untouched under docs/references/.
for mat in list(bpy.data.materials):
 if (mat.name.startswith('Reference-guided') and 'photograph' in mat.name.lower()) or mat.name.startswith('Relief from supplied photograph'):
  bpy.data.materials.remove(mat,do_unlink=True)
for image in list(bpy.data.images):
 if image.name.startswith(('left-relief-reference.png','relief-reference.png','Reference relief crop','Left relief crop','Left relief reference','Left relief study')):
  bpy.data.images.remove(image,do_unlink=True)

def material(name, color, metallic=0, roughness=.72):
    m=bpy.data.materials.new(name); m.diffuse_color=(*color,1); m.use_nodes=True
    p=next(n for n in m.node_tree.nodes if n.type=='BSDF_PRINCIPLED')
    p.inputs['Base Color'].default_value=(*color,1); p.inputs['Metallic'].default_value=metallic; p.inputs['Roughness'].default_value=roughness
    return m

mats={
 'stone':material('밝은 화강석',(.68,.69,.67)),
 'stone2':material('밝은 석재 줄눈',(.56,.57,.55)),
 'terrace_stone':material('별관 외부 석재',(.60,.58,.53),0,.9),
 'roof':material('회색 지붕',(.37,.39,.39)),
 'roofedge':material('처마 하부',(.28,.30,.30)),
 'roofjoint':material('지붕 석재 이음매',(.29,.31,.31)),
 'beamjoint':material('처마보 판재 줄눈',(.235,.255,.255)),
 'copper':material('녹청색 지붕',(.29,.40,.37),.12,.8),
 'copperjoint':material('녹청 지붕 이음매',(.25,.35,.32),.12,.8),
 'dark':material('깊은 그늘',(.075,.09,.095)),
 'glass':material('짙은 유리',(.065,.13,.14),.35,.24),
 'connector_glass':material('연결동 세로창 유리',(.11,.22,.21),.18,.28),
 'shopglass':material('별관 상점 반투명 유리',(.16,.25,.24),.18,.22),
 'gold':material('청동 격자',(.62,.49,.28),.65,.3),
 'ground':material('광장 석재',(.59,.61,.60)),
 'line':material('포장 줄눈',(.43,.46,.45)),
 'white':material('옥상 벽',(.77,.78,.75)),
}
shop_shader=next(n for n in mats['shopglass'].node_tree.nodes if n.type=='BSDF_PRINCIPLED')
shop_shader.inputs['Alpha'].default_value=.42
mats['shopglass'].diffuse_color=(.16,.25,.24,.42)
mats['shopglass'].surface_render_method='BLENDED'

class MeshBuilder:
 def __init__(self): self.v=[]; self.f=[]
 def box(self,x,y,z,sx,sy,sz):
  self.poly([(x+dx*sx/2,y+dy*sy/2,z+dz*sz/2) for dx,dy,dz in [(-1,-1,-1),(1,-1,-1),(1,1,-1),(-1,1,-1),(-1,-1,1),(1,-1,1),(1,1,1),(-1,1,1)]])
 def poly(self,v):
  n=len(self.v); self.v.extend(v); self.f.extend([tuple(n+i for i in a) for a in [(0,3,2,1),(4,5,6,7),(0,1,5,4),(1,2,6,5),(2,3,7,6),(3,0,4,7)]])
 def bar(self,x1,y1,z1,x2,y2,z2,width=.035,depth=.035):
  # Rectangular strip in the XZ plane, with its face parallel to the facade.
  dx=x2-x1; dz=z2-z1; length=math.hypot(dx,dz)
  if length<1e-5:return
  nx=-dz/length*width/2; nz=dx/length*width/2
  self.poly([(x1+nx,y1-depth/2,z1+nz),(x2+nx,y2-depth/2,z2+nz),(x2-nx,y2-depth/2,z2-nz),(x1-nx,y1-depth/2,z1-nz),(x1+nx,y1+depth/2,z1+nz),(x2+nx,y2+depth/2,z2+nz),(x2-nx,y2+depth/2,z2-nz),(x1-nx,y1+depth/2,z1-nz)])
 def finish(self,name,mat):
  mesh=bpy.data.meshes.new(name); mesh.from_pydata(self.v,[],self.f); mesh.update()
  ob=bpy.data.objects.new(name,mesh); bpy.context.collection.objects.link(ob); ob.data.materials.append(mat); return ob

b={k:MeshBuilder() for k in mats}
def box(m,*args):b[m].box(*args)
def frustum(m,cx,cy,z0,z1,w0,d0,w1,d1):
 b[m].poly([(cx-w0/2,cy-d0/2,z0),(cx+w0/2,cy-d0/2,z0),(cx+w0/2,cy+d0/2,z0),(cx-w0/2,cy+d0/2,z0),(cx-w1/2,cy-d1/2,z1),(cx+w1/2,cy-d1/2,z1),(cx+w1/2,cy+d1/2,z1),(cx-w1/2,cy+d1/2,z1)])
def curved_capital(m,cx,cy,z0,z1,w0,d0,w1,d1,segments=12):
 # One continuous ring mesh.  The profile broadens toward the beam rather
 # than spreading at a constant angle; dimensions are photo-based estimates.
 builder=b[m];start=len(builder.v)
 for level in range(segments+1):
  t=level/segments
  spread=t**1.7
  w=w0+(w1-w0)*spread;d=d0+(d1-d0)*spread;z=z0+(z1-z0)*t
  builder.v.extend([(cx-w/2,cy-d/2,z),(cx+w/2,cy-d/2,z),
                    (cx+w/2,cy+d/2,z),(cx-w/2,cy+d/2,z)])
 builder.f.append(tuple(start+i for i in (3,2,1,0)))
 for level in range(segments):
  lower=start+4*level;upper=lower+4
  for i in range(4):
   j=(i+1)%4
   builder.f.append((lower+i,lower+j,upper+j,upper+i))
 top=start+4*segments
 builder.f.append(tuple(top+i for i in range(4)))
def hip_roof(m,cx,cy,z0,z1,width,depth,ridge,axis='x'):
 builder=b[m]; start=len(builder.v)
 base=[(cx-width/2,cy-depth/2,z0),(cx+width/2,cy-depth/2,z0),(cx+width/2,cy+depth/2,z0),(cx-width/2,cy+depth/2,z0)]
 if axis=='y':
  builder.v.extend(base+[(cx,cy-ridge/2,z1),(cx,cy+ridge/2,z1)])
  faces=[(0,1,4),(1,2,5,4),(2,3,5),(3,0,4,5),(3,2,1,0)]
 else:
  builder.v.extend(base+[(cx-ridge/2,cy,z1),(cx+ridge/2,cy,z1)])
  faces=[(0,1,5,4),(1,2,5),(2,3,4,5),(3,0,4),(3,2,1,0)]
 builder.f.extend([tuple(start+i for i in face) for face in faces])
def stone_pillar(cx,cy,z0,z1,w,d,bevel):
 # Eight-sided chamfered stone shaft; joints below remain separate fine lines.
 x=w/2; y=d/2; c=bevel
 loop=[(-x+c,-y),(x-c,-y),(x,-y+c),(x,y-c),(x-c,y),(-x+c,y),(-x,y-c),(-x,-y+c)]
 builder=b['stone']; start=len(builder.v)
 builder.v.extend([(cx+u,cy+v,z) for z in (z0,z1) for u,v in loop])
 builder.f.append(tuple(start+i for i in reversed(range(8))))
 builder.f.append(tuple(start+8+i for i in range(8)))
 builder.f.extend([(start+i,start+(i+1)%8,start+8+(i+1)%8,start+8+i) for i in range(8)])
def fine_beam(m,start,end,width):
 # Small solid strip between arbitrary points for roof standing seams.
 a=Vector(start);q=Vector(end);axis=(q-a).normalized()
 cross=axis.cross(Vector((0,0,1)))
 if cross.length<.001:cross=axis.cross(Vector((0,1,0)))
 u=cross.normalized()*width/2;v=axis.cross(u).normalized()*width/2
 b[m].poly([tuple(a-u-v),tuple(q-u-v),tuple(q+u-v),tuple(a+u-v),tuple(a-u+v),tuple(q-u+v),tuple(q+u+v),tuple(a+u+v)])
def hip_seams(cx,cy,z0,z1,width,depth,ridge,count,axis='x'):
 # The seam positions interpolate between the eaves and the ridge.
 if axis=='y':
  for sign in (-1,1):
   for i in range(count+1):
    f=i/count*2-1
    fine_beam('copperjoint',(cx+sign*width/2,cy+f*depth/2,z0+.025),(cx,cy+f*ridge/2,z1+.025),.025)
  fine_beam('copperjoint',(cx,cy-ridge/2,z1+.025),(cx,cy+ridge/2,z1+.025),.035)
 else:
  for sign in (-1,1):
   for i in range(count+1):
    f=i/count*2-1
    fine_beam('copperjoint',(cx+f*width/2,cy+sign*depth/2,z0+.025),(cx+f*ridge/2,cy,z1+.025),.025)
  fine_beam('copperjoint',(cx-ridge/2,cy,z1+.025),(cx+ridge/2,cy,z1+.025),.035)

# Stone forecourt and paved joints, extended behind the theatre.
# The deep plaza visible in the reference photos reaches well beyond the
# entrance gardens. Its front extent remains a visual estimate, not a survey.
box('ground',0,44,-.24,112,248,.48)
for x in range(-56,57,2): box('line',x,-38,.006,.018,84,.012)
for y in range(-80,5,2): box('line',0,y,.009,112,.018,.012)

# The source section gives longitudinal reference lines at 14.4, 64.4,
# 87.7 and 112.5 metres from the front, and roof levels above ground.
# The facade width and unsupported portions remain photo-based estimates.
def interpolate_axis(value,knots):
 for (a,b),(c,d) in zip(knots,knots[1:]):
  if value<=c:return b+(value-a)*(d-b)/(c-a)
 a,b=knots[-2];c,d=knots[-1]
 return b+(value-a)*(d-b)/(c-a)
def theatre_y(y):
 if y<=-3:return y
 return interpolate_axis(y,[(-3,-3),(2.5,11.4),(25,61.4),(34,84.7),(47.5,109.5)])
def theatre_z(z):
 if z<=0:return z
 return interpolate_axis(z,[(0,0),(.8,1.07),(4.6,4.6),(5.35,6.47),(18.55,24.349),(21.65,29.555),(23.3,31.2),(25.7,35.06),(27.5,45.045)])
def annex_z(z):
 if z<=0:return z
 if z<=5.35:return theatre_z(z)
 return 6.47+(z-5.35)*1.31
def inverse_annex_z(z):
 if z<=0:return z
 if z<=1.07:return z*.8/1.07
 if z<=4.6:return .8+(z-1.07)*3.8/3.53
 if z<=6.47:return 4.6+(z-4.6)*.75/1.87
 return 5.35+(z-6.47)/1.31
def apply_section(start,ymap,zmap):
 for key,builder in b.items():
  for i in range(start[key],len(builder.v)):
   x,y,z=builder.v[i];builder.v[i]=(x,ymap(y),zmap(z))

# Theatre: main mass, central glazed facade and stone end piers.
main_start={key:len(builder.v) for key,builder in b.items()}
cx=22; front=-3; back=34; W=54; D=37
# Open a real lobby in the front of the former solid auditorium block.
# The interior arrangement is a plausible reconstruction: the supplied photos
# document the exterior, not the lobby's actual fittings.
box('stone',cx,18.25,8.7,W,31.5,17.4)  # auditorium beyond the rear lobby wall
box('stone',-4.5,-.25,3.0,1.0,5.5,6.0)
box('stone',48.5,-.25,3.0,1.0,5.5,6.0)
box('stone',cx,-.25,.7,W,5.5,.2)  # continuous lobby floor, top at +1.07 m
box('stone',cx,-.25,5.3,W,5.5,.35)  # lobby ceiling
box('dark',cx,front+.55,11.225,41,1,11.75)
# The reference shows multiple entrance groups between the columns. The exact
# door count is obscured; these five openings follow the visible bay rhythm.
door_centers=(7.6,14.8,22,29.2,36.4)
door_ranges=[(x-1.1,x+1.1) for x in door_centers]
# Dark recessed wall panels give the entrance bays depth when viewed from the
# plaza. Their placement is interpretive; the supplied references are exterior.
for x in door_centers:box('dark',x,2.48,2.35,2.45,.05,3.10)
edge=1.5
for left,right in door_ranges:
 box('glass',(edge+left)/2,front-.02,3.2,left-edge,.18,5.8)
 box('glass',(left+right)/2,front-.02,4.8,right-left,.18,2.6)
 edge=right
box('glass',(edge+42.5)/2,front-.02,3.2,42.5-edge,.18,5.8)
for x in (-2.2,46.2):
 box('stone',x,front+.1,10.35,5.6,1.8,13.7)
 # The bottom of the monumental corner piers narrows toward the plinth.
 frustum('stone',x,front+.1,0,3.5,4.1,1.4,5.6,1.8)
# Separate courses and staggered joints on the two monumental stone piers.
# Joint strips slightly overlap the wall; sizes are photo-based estimates.
pier_base,pier_top,pier_course=3.6,17.2,.72
for center in (-2.2,46.2):
 z=pier_base
 while z<pier_top:
  box('stone2',center,front-.803,z,5.5,.012,.015)
  z+=pier_course
 rows=math.ceil((pier_top-pier_base)/pier_course)
 for row in range(rows):
  lo=pier_base+row*pier_course
  hi=min(pier_top,lo+pier_course)
  x=center-2.75+(row%2)*.68
  while x<center+2.75:
   if center-2.70<x<center+2.70:
    box('stone2',x,front-.803,(lo+hi)/2,.012,.012,hi-lo-.02)
   x+=1.36

# Projecting cornice: stacked beams, sloped outward roof edge, roof slab.
box('roofedge',cx,9.75,17.75,55,28.5,1.0)
# The broad inner lintel has its own stone-block courses beneath the eaves.
for z in (17.50,17.75,18.00):
 box('beamjoint',cx,-4.503,z,54.8,.012,.012)
for row in range(4):
 lo=17.25+row*.25;hi=lo+.25
 for i in range(26):
  x=cx-26.7+i*2.1+(row%2)*1.05
  if cx-27.35<x<cx+27.35:
   box('beamjoint',x,-4.503,(lo+hi)/2,.014,.012,.23)
box('dark',cx,9.5,18.35,57,31,.45)
frustum('roof',cx,9,18.55,21.65,60,32,57,29)
box('roofedge',cx,9,21.7,60.2,32.2,.26)
# Underside ribs run deep under all four eaves.
for x in [cx-28.2+i*.60 for i in range(95)]:
 box('stone2',x,-5.7,17.98,.20,3.1,.50); box('stone2',x,23.7,17.98,.20,3.1,.50)
# Finer ribs under the inner stone beam are visible from the entrance.
for x in [cx-26.5+i*.36 for i in range(148)]:
 box('stone2',x,-4.35,17.23,.055,1.0,.08)
# Small square fixtures punctuate the inner soffit in the close-up photographs.
# A four-piece dark bezel meets the underside of the beam and holds a recessed
# glass lens; the quantity and spacing are estimates from the visible bays.
# Place them midway between the five principal columns and between the fine ribs.
for x in (7.6,14.8,22,29.2,36.4):
 for y in (-4.02,-3.33):
  for dx in (-.0875,.0875):
   box('dark',x+dx,y,17.20,.025,.20,.10)
  for dy in (-.0875,.0875):
   box('dark',x,y+dy,17.20,.15,.025,.10)
  box('glass',x,y,17.225,.15,.15,.04)
def cornice_joints(cx,cy,z0,z1,width,depth,inset,course=.42,block=2.4):
 # Joints are placed on the actual sloping faces of the stone cornice.
 rows=math.ceil((z1-z0)/course)
 for row in range(1,rows):
  z=min(z1,z0+row*course); t=(z-z0)/(z1-z0)
  w=width-2*inset*t; d=depth-2*inset*t
  for sign in (-1,1):
   box('roofjoint',cx,cy+sign*(d/2+.012),z,w-.12,.018,.017)
   box('roofjoint',cx+sign*(w/2+.012),cy,z,.018,d-.12,.017)
 for row in range(rows):
  zl=z0+row*course+.025;zh=min(z1-.025,z0+(row+1)*course-.025)
  if zh<=zl:continue
  tl=(zl-z0)/(z1-z0);th=(zh-z0)/(z1-z0)
  wl=width-2*inset*tl;wh=width-2*inset*th
  dl=depth-2*inset*tl;dh=depth-2*inset*th
  offset=(row%2)*block/2
  for i in range(-int(width/block/2),int(width/block/2)+1):
   x=cx+i*block+offset
   if abs(x-cx)>=min(wl,wh)/2-.2:continue
   for sign in (-1,1):
    ylo=cy+sign*(dl/2+.012);yhi=cy+sign*(dh/2+.012)
    b['roofjoint'].bar(x,ylo,zl,x,yhi,zh,.018,.016)
  for i in range(-int(depth/block/2),int(depth/block/2)+1):
   y=cy+i*block+offset
   if abs(y-cy)>=min(dl,dh)/2-.2:continue
   for sign in (-1,1):
    xl=cx+sign*(wl/2+.012);xh=cx+sign*(wh/2+.012); q=.009
    b['roofjoint'].poly([(xl-.008,y-q,zl),(xl-.008,y+q,zl),(xh-.008,y+q,zh),(xh-.008,y-q,zh),(xl+.008,y-q,zl),(xl+.008,y+q,zl),(xh+.008,y+q,zh),(xh+.008,y-q,zh)])
cornice_joints(cx,9,18.55,21.65,60,32,1.5)
# High theatre fly tower behind the hipped roof.
box('stone',cx,29.5,20.45,30,9,6.1)
box('stone',cx,29.5,25.5,30,9,4.0)
for z in [23.8+i*.65 for i in range(6)]: box('stone2',cx,24.98,z,30,.02,.015)
# Rear hall, beyond the fly tower.  The supplied rear photograph shows a
# recessed bronze-patterned upper facade, a lower diamond screen, narrow dark
# windows between them and a continuous terrace above the ground-floor glazing.
# Counts, depths and the obscured lower level remain visual estimates.
rearhall_cx=32
box('stone',rearhall_cx,40.75,8.1,34,13.5,16.2)
box('roofedge',rearhall_cx,40.75,16.3,37.2,14.5,.45)
hip_roof('roof',rearhall_cx,40.75,16.52,19.0,37.2,14.5,20)
# Paired end piers and six shafts rise to the underside of the rear beam.
for x in (16.5,47.5):
 box('stone',x,47.32,9.80,3,.36,12.4)
rearhall_columns=[18.3+i*5.48 for i in range(6)]
for x in rearhall_columns:
 stone_pillar(x,47.40,3.55,15.40,1.08,1.0,.13)
 curved_capital('stone',x,47.40,15.32,16.08,1.08,1.0,1.65,1.20)
 box('stone2',x,47.92,9.35,.014,.025,11.6)
 for z in [4.1+i*1.25 for i in range(9)]:
  box('stone2',x,47.92,z,1.06,.025,.014)
# The background and windows lie behind the shafts, keeping actual depth.
box('dark',rearhall_cx,47.57,9.76,28.0,.10,12.16)
box('glass',rearhall_cx,47.65,4.70,27.8,.08,2.18)
box('glass',rearhall_cx,47.65,8.92,27.8,.08,1.05)
for z in (3.55,5.82,8.28,9.50,15.82):
 box('roofedge',rearhall_cx,47.72,z,28.0,.18,.13)
for x in [18.4+i*.92 for i in range(30)]:
 box('gold',x,47.73,4.70,.035,.13,2.18)
for z in (4.0,5.1):
 box('gold',rearhall_cx,47.73,z,27.8,.13,.045)
for x in [18.4+i*1.1 for i in range(26)]:
 box('roofedge',x,47.72,8.92,.04,.16,1.05)
# Original stepped motifs are individually modeled; no photo pixels are used.
for i in range(49):
 x=18.75+i*.55
 for j in range(10):
  z=10.05+j*.55
  pts=[(-.22,-.16),(-.22,.17),(.10,.17),(.10,-.05),(-.07,-.05),(-.07,.05),(.22,.05),(.22,-.22)]
  c=math.sqrt(.5)
  pts=[(x+(u-v)*c,z+(u+v)*c) for u,v in pts]
  for a,q in zip(pts,pts[1:]):
   if 18.6<a[0]<45.4 and 18.6<q[0]<45.4 and 9.65<a[1]<15.68 and 9.65<q[1]<15.68:
    b['gold'].bar(a[0],47.74,a[1],q[0],47.74,q[1],.04,.035)
# Crossed bars are clipped to the lower rectangular panel.
for slope in (-1,1):
 lo=5.95-slope*45.4 if slope==1 else 5.95-slope*18.6
 hi=8.17-slope*18.6 if slope==1 else 8.17-slope*45.4
 k=lo
 while k<=hi:
  pts=[]
  for x in (18.6,45.4):
   z=slope*x+k
   if 5.95<=z<=8.17:pts.append((x,z))
  for z in (5.95,8.17):
   x=(z-k)/slope
   if 18.6<=x<=45.4:pts.append((x,z))
  if len(pts)>=2:b['gold'].bar(pts[0][0],47.75,pts[0][1],pts[1][0],47.75,pts[1][1],.025,.035)
  k+=.37
# The low balcony and glazing below are deliberately separate pieces.
box('stone',rearhall_cx,47.65,3.35,34,1.3,.46)
box('glass',rearhall_cx,47.58,1.65,30,.08,3.0)
for x in [17.5+i*2.9 for i in range(11)]:
 box('roofedge',x,47.67,1.65,.07,.13,3.0)
for z in (.20,2.90):
 box('roofedge',rearhall_cx,47.67,z,30,.13,.08)

# Rear stone wing: the additional rear photograph shows a flat-roofed,
# elongated upper facade with many narrow windows over a recessed ground
# level carried by tall columns. Counts and dimensions are visual estimates.
rear_left,rear_right=-22,15
rearx=(rear_left+rear_right)/2
rear_width=rear_right-rear_left
rear_y0,rear_y1=34,47.5
# Inset inner volume leaves a sheltered approach beneath the projecting wing.
box('stone',rearx,38.6,5.45,rear_width,9.2,10.9)
box('dark',rearx,44.0,2.70,rear_width-.6,.16,5.35)
box('glass',rearx,44.12,2.70,rear_width-1,.08,5.15)
box('stone',rearx,45.4,.12,rear_width,4.2,.24)
for x in (-20.9,-15,-9.1,-3.2,2.7,8.6,14.5):
 box('stone',x,47.05,2.85,1.02,1.05,5.70)
# A continuous slab joins the ground-floor supports to the upper facade.
box('stone',rearx,40.75,5.78,rear_width,13.5,.36)
box('stone',rearx,40.75,11.34,rear_width+.6,14.0,.42)
# Build the facade around actual open slots; the glass is recessed behind it.
rear_window_x=[-20.7+i*1.68 for i in range(21)]
rear_half_width=.23
rear_window_bottom,rear_window_top=6.25,10.85
def rear_wall_segment(x0,x1,z0,z1):
 if x1>x0 and z1>z0:
  box('stone',(x0+x1)/2,47.32,(z0+z1)/2,x1-x0,.36,z1-z0)
cursor=rear_left
for x in rear_window_x:
 rear_wall_segment(cursor,x-rear_half_width,5.96,11.13)
 rear_wall_segment(x-rear_half_width,x+rear_half_width,5.96,rear_window_bottom)
 rear_wall_segment(x-rear_half_width,x+rear_half_width,rear_window_top,11.13)
 box('glass',x,47.06,(rear_window_bottom+rear_window_top)/2,2*rear_half_width,.055,rear_window_top-rear_window_bottom)
 cursor=x+rear_half_width
rear_wall_segment(cursor,rear_right,5.96,11.13)
# Back the upper level and close its end walls, without filling the window slots.
box('stone',rearx,45.0,8.55,rear_width,3.6,5.18)
for x in (rear_left+.16,rear_right-.16):
 box('stone',x,46.32,8.55,.32,2.0,5.18)
# Stone courses stop at each window opening.
for z in (6.38,7.15,7.92,8.69,9.46,10.23,11.0):
 cursor=rear_left
 for x in rear_window_x:
  if x-rear_half_width>cursor:
   box('stone2',(cursor+x-rear_half_width)/2,47.512,z,x-rear_half_width-cursor,.022,.014)
  cursor=x+rear_half_width
 if cursor<rear_right:
  box('stone2',(cursor+rear_right)/2,47.512,z,rear_right-cursor,.022,.014)
# Low mechanical penthouse with horizontal panels behind the flat parapet.
box('roofedge',rearx,40.8,13.00,25,8.0,3.0)
box('white',rearx,40.8,13.02,25.08,8.08,.66)
box('roofedge',rearx,40.8,14.55,25.2,8.2,.10)

# Six tall rectilinear columns with flared capitals and seams.
columns=[4,11.2,18.4,25.6,32.8,40]
for x in columns:
 stone_pillar(x,front-1.0,.25,16.65,1.55,1.6,.19)
 curved_capital('stone',x,front-1.0,16.55,17.25,1.55,1.6,2.45,2.2)
 box('stone',x,front-1.0,17.38,2.45,2.2,.26)
 box('stone2',x,front-1.815,8.5,.018,.02,16.4)
 for z in [i*1.25 for i in range(1,14)]: box('stone2',x,front-1.815,z,1.53,.02,.018)

# Gold upper fretwork: repetitive rectilinear interlocking paths, kept behind the columns.
box('dark',cx,front-.14,12.95,40,.12,6.4)
for i in range(73):
 x=2.2+i*.55
 for j in range(11):
  z=9.95+j*.55
  # Angled, stepped fretwork, like the diagonal maze in the photographs.
  pts=[(-.22,-.16),(-.22,.17),(.10,.17),(.10,-.05),(-.07,-.05),(-.07,.05),(.22,.05),(.22,-.22)]
  c=math.sqrt(.5)
  pts=[(x+(u-v)*c,z+(u+v)*c) for u,v in pts]
  for a,q in zip(pts,pts[1:]):
   if 2.05<a[0]<41.95 and 2.05<q[0]<41.95 and 9.8<a[1]<16.05 and 9.8<q[1]<16.05:
    b['gold'].bar(a[0],front-.24,a[1],q[0],front-.24,q[1],.04,.035)

# Fine diagonal diamond lattice across the lower balcony.
box('dark',cx,front-.18,6.7,40,.12,2.8)
def lattice(xmin,xmax,zmin,zmax,y,spacing=.37):
 # Intersect 45-degree diagonals with a rectangle.
 for slope in (-1,1):
  low=zmin-slope*xmax if slope==1 else zmin-slope*xmin
  high=zmax-slope*xmin if slope==1 else zmax-slope*xmax
  k=low
  while k<=high:
   pts=[]
   for x in (xmin,xmax):
    z=slope*x+k
    if zmin<=z<=zmax:pts.append((x,z))
   for z in (zmin,zmax):
    x=(z-k)/slope
    if xmin<=x<=xmax:pts.append((x,z))
   if len(pts)>=2: b['gold'].bar(pts[0][0],y,pts[0][1],pts[1][0],y,pts[1][1],.025,.035)
   k+=spacing
lattice(2,42,5.35,8.15,front-.29)
for z in (5.28,8.2,9.55,16.25): box('roofedge',cx,front-.36,z,40.5,.24,.16)
# Behind the projecting pillars, the photographs show dark glazed strips
# between the fretwork levels and just beneath the soffit.  Model the panes
# and their vertical mullions instead of leaving the bands as a blank wall.
# Their number and widths are visual estimates from the exterior photographs.
for left,right in zip(columns,columns[1:]):
 bay_start,bay_end=left+.83,right-.83
 for lo,hi in ((8.28,9.47),(16.33,17.25)):
  box('glass',(bay_start+bay_end)/2,front-.11,(lo+hi)/2,bay_end-bay_start,.08,hi-lo)
  for i in range(5):
   x=bay_start+(bay_end-bay_start)*i/4
   box('roofedge',x,front-.20,(lo+hi)/2,.05,.20,hi-lo)
# Ground floor window and door frames.
for x in [2+i*1.45 for i in range(29)]:
 if not any(left < x < right for left,right in door_ranges):
  # Meet the stone sill and the underside of the upper beam; the added
  # depth also connects the vertical member to that beam.
  box('gold',x,front-.18,(.35+5.20)/2,.045,.16,5.20-.35)
for z in (.35,2.0):
 edge=2
 for left,right in door_ranges:
  box('gold',(edge+left)/2,front-.2,z,left-edge,.07,.055)
  edge=right
 box('gold',(edge+42)/2,front-.2,z,42-edge,.07,.055)
box('gold',cx,front-.2,4.6,40,.07,.055)
for left,right in door_ranges:
 for x in (left,right):box('gold',x,front-.2,2.15,.075,.09,2.7)
 box('gold',(left+right)/2,front-.2,3.5,right-left,.09,.075)
# Side elevation: two colonnaded stretches separated by the long stone wall,
# as shown in the supplied axonometric site diagram.
side_bays=[(.4,12.0),(34.2,46.8)]
for a,q in side_bays:
 box('glass',49.1,(a+q)/2,7.5,.14,q-a,13)
 box('dark',49.12,(a+q)/2,12.7,.12,q-a,6.1)
for y in (1,6,11):
 stone_pillar(50,y,0,16.55,1.5,1.55,.18)
 curved_capital('stone',50,y,16.48,17.25,1.5,1.55,2.2,2.4)
 box('stone',50,y,17.37,2.2,2.4,.24)
for y in (35,40.3,45.6):
 stone_pillar(49.4,y,0,15.2,1.5,1.55,.18)
 curved_capital('stone',49.4,y,15.12,15.85,1.5,1.55,2.2,2.4)
 box('stone',49.4,y,15.96,2.2,2.4,.24)
# The courtyard-facing west return has its own glazed colonnade; the
# connecting building hides part of its lower level in the photographs.
box('glass',-5.1,6.2,7.5,.14,11.6,13)
box('dark',-5.12,6.2,12.7,.12,11.6,6.1)
box('dark',-5.12,6.2,6.7,.12,11.6,2.8)
for y in (1,6,11):
 stone_pillar(-6,y,0,16.55,1.5,1.55,.18)
 curved_capital('stone',-6,y,16.48,17.25,1.5,1.55,2.2,2.4)
 box('stone',-6,y,17.37,2.2,2.4,.24)
for z in (4.8,8.3,15.8):box('roofedge',-5.19,6.2,z,.22,11.6,.2)
for y in [.4+i*.9 for i in range(13)]:box('gold',-5.22,y,3.1,.06,.04,5.7)
for a,q in side_bays:
 for z in (4.8,8.3,15.8):box('roofedge',49.19,(a+q)/2,z,.22,q-a,.2)
 for y in [a+i*.9 for i in range(int((q-a)/.9)+1)]:box('gold',49.22,y,3.1,.06,.04,5.7)
# Pale stone panels and recessed windows on the long middle wall.  The
# photographs show small vertical windows grouped into aligned rows, but the
# exact number, spacing, and dimensions below are visual estimates, not a survey.
side_window_half_width=.07
side_window_half_height=.31
side_window_groups=[
 (14.2,(0,)), (18.0,(-.11,.11)), (21.7,(-.22,0,.22)),
 (26.0,(-.22,0,.22)), (30.8,(-.11,.11)),
]
side_windows=[
 (round(center+offset,4),z)
 for z in (9.7,13.9)
 for center,offsets in side_window_groups
 for offset in offsets
]
# The lower row has fewer visible windows; the rear is obscured by trees.
side_windows.extend([(17.89,5.5),(18.11,5.5),(26.0,5.5)])
side_window_centers=sorted(set(y for y,_ in side_windows))
side_y0,side_y1=12,34
side_z0,side_z1=0,17.2
def side_wall_span(y0,y1,z0,z1):
 if y1>y0 and z1>z0:box('stone',49.13,(y0+y1)/2,(z0+z1)/2,.27,y1-y0,z1-z0)
cursor=side_y0
for y in side_window_centers:
 side_wall_span(cursor,y-side_window_half_width,side_z0,side_z1)
 bottom=side_z0
 for _,z in sorted((wy,wz) for wy,wz in side_windows if wy==y):
  side_wall_span(y-side_window_half_width,y+side_window_half_width,bottom,z-side_window_half_height)
  box('glass',49.04,y,z,.045,2*side_window_half_width,2*side_window_half_height)
  bottom=z+side_window_half_height
 side_wall_span(y-side_window_half_width,y+side_window_half_width,bottom,side_z1)
 cursor=y+side_window_half_width
side_wall_span(cursor,side_y1,side_z0,side_z1)
# Intersecting mortar lines stop at the openings rather than bridging them.
for z in [i*.72 for i in range(1,24)]:
 cursor=side_y0
 for y,_ in sorted((y,wz) for y,wz in side_windows if abs(wz-z)<side_window_half_height+.008):
  if y-side_window_half_width>cursor:
   box('stone2',49.28,(cursor+y-side_window_half_width)/2,z,.025,y-side_window_half_width-cursor,.016)
  cursor=y+side_window_half_width
 if cursor<side_y1:box('stone2',49.28,(cursor+side_y1)/2,z,.025,side_y1-cursor,.016)
for y in [12.6+i*1.35 for i in range(16)]:
 cursor=0
 for _,z in sorted((wy,z) for wy,z in side_windows if abs(wy-y)<side_window_half_width+.008):
  if z-side_window_half_height>cursor:
   box('stone2',49.29,y,(cursor+z-side_window_half_height)/2,.025,.016,z-side_window_half_height-cursor)
  cursor=z+side_window_half_height
 if cursor<17:box('stone2',49.29,y,(cursor+17)/2,.025,.016,17-cursor)
# The bronze fretwork continues on both stretches of the side colonnade.
def side_bar(y1,z1,y2,z2,width=.04,x=49.18):
 dx=y2-y1; dz=z2-z1; length=math.hypot(dx,dz)
 if not length:return
 ny=-dz/length*width/2; nz=dx/length*width/2; d=.035
 b['gold'].poly([(x-d/2,y1+ny,z1+nz),(x-d/2,y2+ny,z2+nz),(x-d/2,y2-ny,z2-nz),(x-d/2,y1-ny,z1-nz),(x+d/2,y1+ny,z1+nz),(x+d/2,y2+ny,z2+nz),(x+d/2,y2-ny,z2-nz),(x+d/2,y1-ny,z1-nz)])
for i in range(85):
 for j in range(10):
  y=.6+i*.55; z=10+j*.55; c=math.sqrt(.5)
  if not any(a+.3<y<q-.3 for a,q in side_bays):continue
  pts=[(-.22,-.16),(-.22,.17),(.10,.17),(.10,-.05),(-.07,-.05),(-.07,.05),(.22,.05),(.22,-.22)]
  pts=[(y+(u-v)*c,z+(u+v)*c) for u,v in pts]
  for a,q in zip(pts,pts[1:]):
   side_bar(a[0],a[1],q[0],q[1])
   if .7<y<11.7:side_bar(a[0],a[1],q[0],q[1],x=-5.18)

# A plinth with steps that rise towards the entrances, and return along the side.
box('stone',cx,-4.725,.4,54,3.65,.8)
for i in range(8):
 top=.17+i*.09; y=-10+i*.46
 box('stone',cx,y,top/2,54,.47,top)
 box('stone2',cx,y-.235,top+.009,54,.025,.018)
box('stone',50.45,4.25,.4,2.9,15.5,.8)
for i in range(6):
 top=.17+i*.09; x=54.1-i*.43
 box('stone',x,4.25,top/2,.44,15.5,top)
 box('stone2',x+.22,4.25,top+.009,.025,15.5,.018)
apply_section(main_start,theatre_y,theatre_z)
# Rear court stairs descend toward the garden, beside the junction of the
# rear hall and the long wing. The photograph establishes the stair's
# relationship to both facades, but its precise footprint is an estimate.
# Create the treads in final Y/Z space to keep all risers the same height
# despite the section's non-linear mapping.
rear_stair_left,rear_stair_right=1.0,13.7
rear_stair_center=(rear_stair_left+rear_stair_right)/2
rear_stair_width=rear_stair_right-rear_stair_left
rear_landing_height=theatre_z(3.58)
rear_stair_count=24
rear_stair_rise=rear_landing_height/rear_stair_count
for i in range(rear_stair_count):
 y=119.40-i*.39
 top=(i+1)*rear_stair_rise
 box('stone',rear_stair_center,y,top/2,rear_stair_width,.40,top)
 box('stone2',rear_stair_center,y+.195,top+.008,rear_stair_width,.018,.014)
 # Filled retaining edges overlap each tread and touch the paving beneath.
 for x in (rear_stair_left-.10,rear_stair_right+.10):
  box('stone',x,y,(top+.28)/2,.20,.40,top+.28)
# Raised landing overlaps the innermost tread and extends back to the
# recessed ground-floor frontage; the precise rear circulation is obscured.
box('stone',rear_stair_center,106.73,rear_landing_height-.12,rear_stair_width,7.04,.24)
for x in (rear_stair_left+.22,rear_stair_right-.22):
 for y in (104.0,109.8):
  box('stone',x,y,(rear_landing_height-.24)/2,.28,.28,rear_landing_height-.24)
for x in (rear_stair_left-.10,rear_stair_right+.10):
 for i in (0,6,12,18,23):
  y=119.40-i*.39
  top=(i+1)*rear_stair_rise+.28
  box('roofedge',x,y,top+.45,.045,.045,.90)
 fine_beam('roofedge',(x,119.40,rear_stair_rise+1.18),
           (x,110.43,rear_landing_height+1.18),.055)
# Return-face joints use physical distances after the depth transformation.
beam_y0,beam_y1=theatre_y(-4.5),theatre_y(24)
beam_z0,beam_z1=theatre_z(17.25),theatre_z(18.25)
for x in (cx-27.503,cx+27.503):
 for part in (1,2,3):
  z=beam_z0+(beam_z1-beam_z0)*part/4
  box('beamjoint',x,(beam_y0+beam_y1)/2,z,.012,beam_y1-beam_y0-.1,.012)
 for row in range(4):
  lo=beam_z0+(beam_z1-beam_z0)*row/4
  hi=beam_z0+(beam_z1-beam_z0)*(row+1)/4
  y=beam_y0+.3+(row%2)*1.35
  while y<beam_y1-.2:
   box('beamjoint',x,y,(lo+hi)/2,.012,.014,hi-lo-.02)
   y+=2.7
# Use final-space diagonals so the lower lattice remains a diamond after
# the section's nonlinear depth and height transforms.
def side_lattice(x,ymin,ymax,zmin,zmax,spacing=.38):
 for slope in (-1,1):
  low=zmin-slope*ymax if slope==1 else zmin-slope*ymin
  high=zmax-slope*ymin if slope==1 else zmax-slope*ymax
  k=low
  while k<=high:
   pts=[]
   for y in (ymin,ymax):
    z=slope*y+k
    if zmin<=z<=zmax:pts.append((y,z))
   for z in (zmin,zmax):
    y=(z-k)/slope
    if ymin<=y<=ymax:pts.append((y,z))
   if len(pts)>=2:side_bar(pts[0][0],pts[0][1],pts[1][0],pts[1][1],.025,x)
   k+=spacing
side_lattice(-5.24,theatre_y(.4),theatre_y(12),theatre_z(5.35),theatre_z(8.15))
side_lattice(49.24,theatre_y(.4),theatre_y(12),theatre_z(5.35),theatre_z(8.15))
# Place the side ribs after the depth transform: equal physical spacing
# matches the front cornice and remains uniform across section boundaries.
side_pitch=.60*(24.349/17.25)
rib_lo=theatre_z(17.73);rib_hi=theatre_z(18.23)
for i in range(math.floor((61.4-(-3))/side_pitch)+1):
 y=-3+i*side_pitch
 for x in (-6.6,50.6):box('stone2',x,y,(rib_lo+rib_hi)/2,3,.20,rib_hi-rib_lo)
# The converted section shows a near-flat structural audience roof at about
# +34.71 to +34.86m.  The visible hipped covering sits above that structure;
# its ridge orientation follows the supplied site diagram and roof photograph.
roof_front=theatre_y(2.5);roof_back=theatre_y(25)
roof_base=35.06;roof_peak=37.2
box('white',cx,(roof_front+roof_back)/2,(29.555+roof_base)/2,46,roof_back-roof_front,roof_base-29.555)
# The aerial reference shows a lengthwise ridge and a pale triangular front
# gable; its height and the hidden rear termination remain photo estimates.
ridge_length=roof_back-roof_front
hip_roof('copper',cx,(roof_front+roof_back)/2,roof_base,roof_peak,46,roof_back-roof_front,ridge_length,axis='y')
hip_seams(cx,(roof_front+roof_back)/2,roof_base,roof_peak,46,roof_back-roof_front,ridge_length,16,axis='y')
gable=b['white'];n=len(gable.v)
gable.v.extend([(cx-23,roof_front-.09,roof_base),(cx+23,roof_front-.09,roof_base),
                (cx,roof_front-.09,roof_peak),(cx-23,roof_front+.09,roof_base),
                (cx+23,roof_front+.09,roof_base),(cx,roof_front+.09,roof_peak)])
gable.f.extend([tuple(n+i for i in face) for face in
                [(0,2,1),(3,4,5),(0,1,4,3),(1,2,5,4),(2,0,3,5)]])
# Low paired service enclosures sit on the flat apron in front of the gable.
# Their function and exact dimensions are not identifiable in the photograph.
for x in (cx-15,cx+15):
 box('white',x,roof_front-2.05,30.47,13,4.1,1.55)
 box('dark',x,roof_front-4.11,31.05,12.75,.025,.23)
 box('white',x,roof_front-2.05,31.29,13.2,4.25,.10)

# Smaller west hall: similar roof and colonnade, prominent central screen.
annex_start={key:len(builder.v) for key,builder in b.items()}
ax=-39; af=-3; aw=25; ad=24
box('stone',ax,10.5,7.0,aw,22,14)
box('dark',ax,af-.08,7.2,19,.18,12.8)
box('glass',ax,af-.2,3.1,19,.16,5.6)
for x in (ax-10.8,ax+10.8):box('stone',x,af-.05,7,3.4,1.7,14)
# The two visible front columns flank the screen in the reference photographs.
# The area behind the screen is obscured and its structure remains an estimate.
for x in (ax-7.3,ax+7.3):
 box('stone',x,af-.85,.15,1.55,1.7,.30)
 stone_pillar(x,af-.85,.25,13.8,1.15,1.3,.14)
 curved_capital('stone',x,af-.85,13.72,14.3,1.15,1.3,1.7,1.8)
 box('stone',x,af-.85,14.4,1.7,1.8,.20)
# The lower stone band narrows towards its underside, as in the oblique photos.
# Its end levels and upper footprint match the former beam; the slope is estimated.
frustum('roofedge',ax,9,14.125,14.975,25.7,26.0,26.5,26.8)
box('dark',ax,9,15.12,28,28,.30)
frustum('roof',ax,9,15.25,17.55,29,29,27,27)
box('roofedge',ax,9,17.6,29.2,29.2,.2)
cornice_joints(ax,9,15.25,17.55,29,29,1,course=.38,block=2.0)
for x in [ax-13.8+i*.53 for i in range(53)]:
 box('stone2',x,-4.7,14.84,.16,2.2,.46);box('stone2',x,22.7,14.84,.16,2.2,.46)
for y in [-3+i*.54 for i in range(48)]:
 box('stone2',ax-13.7,y,14.84,2,.16,.46);box('stone2',ax+13.7,y,14.84,2,.16,.46)
box('white',ax,12,18.4,23,19,1.7)
hip_roof('copper',ax,12,19.25,20.6,23,19,9,axis='y')
hip_seams(ax,12,19.25,20.6,23,19,9,8,axis='y')
box('stone',ax,15.5,20.7,17,9,3.2)
lattice(ax-9.8,ax+9.8,9.6,12.8,af-.24,.4)
# The display projects forward of the colonnade, in a deep metal housing.
screen_y=af-1.7
screen_lift=1.5
box('dark',ax,screen_y,7.3+screen_lift,8.4,.4,5.7)
for x in (ax-4.31,ax+4.31):box('white',x,screen_y-.22,7.3+screen_lift,.24,.35,5.94)
for z in (4.40+screen_lift,10.20+screen_lift):box('white',ax,screen_y-.22,z,8.86,.35,.14)
# Brackets run back to the facade at two levels; avoid exposed freestanding
# posts under the screen. The exact support system is hidden in the photos.
for x in (ax-3.3,ax+3.3):
 box('stone2',x,af-.75,4.38+screen_lift,.16,1.6,.16)
 box('stone2',x,af-.75,9.0+screen_lift,.16,1.6,.16)
# The dark sloping canopy below the screen is visible in the terrace view.
# Four corners and a shallow solid thickness make it a real surface, not a
# projection from the photograph. Dimensions and support details are inferred.
canopy_rear_y,canopy_front_y=screen_y-.05,screen_y-2.0
canopy_rear_z,canopy_front_z=4.34+screen_lift,3.86+screen_lift
b['dark'].poly([
 (ax-5.1,canopy_front_y,canopy_front_z-.04),
 (ax+5.1,canopy_front_y,canopy_front_z-.04),
 (ax+4.2,canopy_rear_y,canopy_rear_z-.04),
 (ax-4.2,canopy_rear_y,canopy_rear_z-.04),
 (ax-5.1,canopy_front_y,canopy_front_z),
 (ax+5.1,canopy_front_y,canopy_front_z),
 (ax+4.2,canopy_rear_y,canopy_rear_z),
 (ax-4.2,canopy_rear_y,canopy_rear_z)])
box('dark',ax,canopy_front_y,canopy_front_z-.09,10.2,.07,.18)
# Glazed terrace volume projecting toward the central court.
box('roofedge',-25.6,1.4,4.85,8.0,8,.50)
# The close views show a row of small dark rectangular recesses below the
# terrace glazing, returning around the court-facing end. Their count and
# dimensions are estimates from photographs, not a measured elevation.
# The frames and backing form real recesses; the top meets the slab at z=4.6.
fascia_bottom,fascia_top=4.05,4.60
fascia_open_bottom,fascia_open_top=4.17,4.48
for z0,z1 in ((fascia_bottom,fascia_open_bottom),(fascia_open_top,fascia_top)):
 box('stone',-25.6,-2.49,(z0+z1)/2,8,.26,z1-z0)
 box('stone',-21.71,1.4,(z0+z1)/2,.26,8,z1-z0)
for i in range(11):
 x=-29.6+i*.8
 box('stone',x,-2.49,(fascia_open_bottom+fascia_open_top)/2,.12,.26,fascia_open_top-fascia_open_bottom)
 y=-2.6+i*.8
 box('stone',-21.71,y,(fascia_open_bottom+fascia_open_top)/2,.26,.12,fascia_open_top-fascia_open_bottom)
box('dark',-25.6,-2.39,(fascia_open_bottom+fascia_open_top)/2,8,.04,fascia_open_top-fascia_open_bottom)
box('dark',-21.83,1.4,(fascia_open_bottom+fascia_open_top)/2,.04,8,fascia_open_top-fascia_open_bottom)
box('glass',-25.6,1.4,6.7,7.8,7.8,3.5)
box('stone2',-25.6,1.4,8.55,8,8,.20)
for x in [-29.45+i*1.3 for i in range(7)]:
 box('white',x,-2.55,6.7,.07,.10,3.55);box('white',x,5.35,6.7,.07,.10,3.55)
for y in [-2.5+i*1.3 for i in range(7)]:
 box('white',-21.65,y,6.7,.10,.07,3.55);box('white',-29.55,y,6.7,.10,.07,3.55)
for z in (5.0,6.7,8.45):
 box('white',-25.6,-2.57,z,8,.10,.08);box('white',-21.63,1.4,z,.10,8,.08)
for y in (-1.8,4.6):box('stone',-22.2,y,2.4,.38,.38,4.8)
# The low terrace is a supported shell with recessed shop bays, rather than a
# solid stone block with a decorative glass sheet stuck to the front.
box('stone',ax,-8.1,.04,25,7.7,.08)
box('stone',ax,-8.1,3.825,25,7.7,.35)
box('stone',ax,-4.4,1.85,25,.30,3.7)
box('stone',ax-12.2,-8.1,1.85,.6,7.7,3.7)
box('terrace_stone',ax+12.2,-8.1,1.85,.6,7.7,3.7)
# Terrace return-wall masonry sits on the actual outer face, near the stair.
for z in (.58,1.16,1.74,2.32,2.90,3.48):
 box('stone2',ax+12.503,-8.1,z,.012,7.58,.012)
for row in range(7):
 lo=row*.58;hi=min(3.7,lo+.58)
 if hi<=lo:continue
 y=-11.85+(row%2)*.62
 while y<-4.35:
  box('stone2',ax+12.503,y,(lo+hi)/2,.012,.012,hi-lo-.02)
  y+=1.24
for x in (ax-9,ax-3.1,ax+3.1,ax+9):box('stone',x,-11.64,1.83,.55,.55,3.66)
for x in (ax-11,ax+11):box('stone',x,-11.64,1.83,3,.55,3.66)
box('dark',ax,-4.57,1.85,23,.05,3.6)
shop_centers=(ax-6.2,ax,ax+6.2)
shop_ranges=[(x-.8,x+.8) for x in shop_centers]
edge=ax-9.5
for left,right in shop_ranges:
 box('shopglass',(edge+left)/2,-11.30,1.65,left-edge,.13,2.5)
 box('stone2',(edge+left)/2,-11.30,.24,left-edge,.13,.32)
 box('shopglass',(left+right)/2,-11.30,2.82,right-left,.13,.16)
 edge=right
box('shopglass',(edge+ax+9.5)/2,-11.30,1.65,ax+9.5-edge,.13,2.5)
box('stone2',(edge+ax+9.5)/2,-11.30,.24,ax+9.5-edge,.13,.32)
box('stone2',ax,-11.30,3.0,19,.13,.2)
box('white',ax,-12.12,3.6,23,.18,1.0)
for x in [ax-9+i*1.8 for i in range(11)]:
 if not any(left<x<right for left,right in shop_ranges):box('stone2',x,-11.41,1.6,.08,.08,2.4)
for left,right in shop_ranges:
 for x in (left,right):box('gold',x,-11.41,1.45,.06,.08,2.7)
 box('gold',(left+right)/2,-11.41,2.80,right-left,.08,.07)

# Connecting building and broad ascending central stair.
connector_min,connector_max=-23.1,-3.1
connector_windows=[-22+i*1.6 for i in range(12)]
# Preserve the rear mass while making a real 0.47m recess in the front wall.
box('stone',-13.1,16.25,5.8,20,12.5,11.6)
window_bands=[]
for z in (5.1,8.0):
 center=annex_z(z)
 window_bands.append((inverse_annex_z(center-.95),inverse_annex_z(center+.95)))
def connector_stone_span(x0,x1,z0,z1):
 if x1>x0 and z1>z0:box('stone',(x0+x1)/2,9.75,(z0+z1)/2,x1-x0,.5,z1-z0)
connector_stone_span(connector_min,connector_max,0,window_bands[0][0])
connector_stone_span(connector_min,connector_max,window_bands[0][1],window_bands[1][0])
connector_stone_span(connector_min,connector_max,window_bands[1][1],11.6)
for lo,hi in window_bands:
 edge=connector_min
 for x in connector_windows:
  connector_stone_span(edge,x-.16,lo,hi)
  box('connector_glass',x,9.99,(lo+hi)/2,.32,.04,hi-lo)
  edge=x+.16
 connector_stone_span(edge,connector_max,lo,hi)
box('glass',-13.1,9.42,1.8,19,.16,3.4)
for z in [4+i*.65 for i in range(12)]:
 if any(lo<z<hi for lo,hi in window_bands):
  edge=connector_min
  for x in connector_windows:
   if x-.16>edge:box('stone2',(edge+x-.16)/2,9.493,z,x-.16-edge,.015,.015)
   edge=x+.16
  if connector_max>edge:box('stone2',(edge+connector_max)/2,9.493,z,connector_max-edge,.015,.015)
 else:box('stone2',-13.1,9.493,z,20,.015,.015)
for x in (-23.5,-2.7):
 for i in range(6):
  y=-13.65+i*2.65; h=.65+i*.53
  box('stone',x,y,h/2,.80,2.7,h)
  box('stone2',x,y,h+.035,.82,2.7,.07)
 for i in range(10):
  y=-14+i*1.45
  tier=max(0,min(5,math.floor((y+15)/2.65)))
  support_top=.65+tier*.53+.07
  # The handrail is a straight solid in final space. Interpolate its final
  # height first so each post actually reaches it after nonlinear mapping.
  t=(y+14.4)/13.9
  rail_bottom=annex_z(1.24-.03)*(1-t)+annex_z(4.62-.03)*t
  top=inverse_annex_z(rail_bottom)+.01
  box('roofedge',x,y,(support_top+top)/2,.055,.055,top-support_top)
 # Railing follows the slope of the stairs.
 x1=x-.03;x2=x+.03;y1=-14.4;y2=-.5;z1=1.24;z2=4.62
 b['roofedge'].poly([(x1,y1,z1-.03),(x1,y2,z2-.03),(x2,y2,z2-.03),(x2,y1,z1-.03),(x1,y1,z1+.03),(x1,y2,z2+.03),(x2,y2,z2+.03),(x2,y1,z1+.03)])
apply_section(annex_start,lambda y:y,annex_z)
# Rebuild the 36 stair treads in final space so the nonlinear height mapping
# cannot produce a sudden change in riser height halfway up the flight.
first_tread=annex_z(.105);last_tread=annex_z(.105+35*.09)
stair_rise=(last_tread-first_tread)/35
for i in range(36):
 y=-15+i*.37;top=first_tread+stair_rise*i
 box('stone',-13.1,y,top/2,20,.38,top)
 box('stone2',-13.1,y-.185,top+.009,20,.022,.018)
# The landing begins at the back edge of the last tread, one riser above it.
landing_top=last_tread+stair_rise
box('stone',-13.1,3.87,landing_top/2,20,11.46,landing_top)

# Preserve the photo's facade proportions after applying measured section
# heights.  This width scale is an estimate; it is not a plan measurement.
facade_scale=24.349/17.25
def facade_x(x):return -5+(x+5)*facade_scale
for builder in b.values():
 for i,(x,y,z) in enumerate(builder.v):builder.v[i]=(facade_x(x),y,z)

for k,v in b.items():v.finish(k,mats[k])

# The original RGB values below describe linear shader colors. Image textures
# are stored as sRGB so GLB/Three.js decodes them back to those same values.
def linear_to_srgb(value):
 value=max(0,min(1,value))
 return 12.92*value if value<=.0031308 else 1.055*(value**(1/2.4))-.055

# Low-contrast granite grain, generated and packed in Blender.  UVs are
# projected per face so the stone keeps a consistent scale on all elevations.
rng=random.Random(418)
granite=bpy.data.images.new('Fine granite',width=256,height=256,alpha=True)
pixels=[]
for py in range(256):
 for px in range(256):
  fleck=rng.gauss(0,.012)
  if rng.random()<.006:fleck-=.035
  mottling=.006*math.sin(2*math.pi*px/64)*math.cos(2*math.pi*py/64)
  value=fleck+mottling
  pixels.extend((linear_to_srgb(.55+value),linear_to_srgb(.56+value),
                 linear_to_srgb(.54+value),1))
granite.pixels[:]=pixels;granite.pack()
stone_obj=bpy.data.objects['stone'];uv=stone_obj.data.uv_layers.new(name='Granite projection')
for face in stone_obj.data.polygons:
 normal=face.normal;axes=max(range(3),key=lambda i:abs(normal[i]))
 for li in face.loop_indices:
  v=stone_obj.data.vertices[stone_obj.data.loops[li].vertex_index].co
  uv.data[li].uv=((v.y/2,v.z/2) if axes==0 else (v.x/2,v.z/2) if axes==1 else (v.x/2,v.y/2))
stone_shader=next(n for n in mats['stone'].node_tree.nodes if n.type=='BSDF_PRINCIPLED')
stone_texture=mats['stone'].node_tree.nodes.new('ShaderNodeTexImage');stone_texture.image=granite
mats['stone'].node_tree.links.new(stone_texture.outputs['Color'],stone_shader.inputs['Base Color'])

# Subtle, original stone finishes distinguish the secondary masonry and
# weathered terrace wall. Packed pixels are generated in Blender, not sampled
# from the reference photographs. Roof finishes stay untextured because the
# tested fine-grain texture produced distracting moiré in the web viewer.
def add_stone_finish(key,base,seed,weather_strength=.002):
 rng=random.Random(seed)
 image=bpy.data.images.new('Original '+key+' stone grain',width=256,height=256,alpha=True)
 pxs=[]
 for py in range(256):
  for px in range(256):
   grain=rng.gauss(0,.004)
   mottling=.003*math.sin(px*2*math.pi/53)*math.cos(py*2*math.pi/71)
   weather=-weather_strength*max(0,math.sin(px*2*math.pi/31))
   delta=grain+mottling+weather
   pxs.extend((*[linear_to_srgb(c+delta) for c in base],1))
 image.pixels[:]=pxs
 image.pack()
 obj=bpy.data.objects[key]
 uv=obj.data.uv_layers.new(name='Stone finish projection')
 for face in obj.data.polygons:
  axis=max(range(3),key=lambda i:abs(face.normal[i]))
  for li in face.loop_indices:
   v=obj.data.vertices[obj.data.loops[li].vertex_index].co
   uv.data[li].uv=((v.y/3,v.z/3) if axis==0 else (v.x/3,v.z/3) if axis==1 else (v.x/3,v.y/3))
 shader=next(n for n in mats[key].node_tree.nodes if n.type=='BSDF_PRINCIPLED')
 tex=mats[key].node_tree.nodes.new('ShaderNodeTexImage')
 tex.image=image
 mats[key].node_tree.links.new(tex.outputs['Color'],shader.inputs['Base Color'])
add_stone_finish('stone2',(.56,.57,.55),626)
add_stone_finish('terrace_stone',(.60,.58,.53),627,.018)

# The reliefs, planting, fittings and artwork are original Blender geometry.
# Reference photographs are retained as research material, never sampled.
exec(compile(open(os.path.join('scripts','scene_details.py'),encoding='utf-8').read(),'scripts/scene_details.py','exec'))
for ob in bpy.context.scene.objects:
 if ob.type=='MESH':
  ob.select_set(True)
  # Weighted normals keep the many architectural edges crisp.
  ob.data.update()

scene=bpy.context.scene
scene.world.color=(.35,.35,.35)
scene.unit_settings.system='METRIC'
scene.render.engine='BLENDER_EEVEE'
os.makedirs(os.path.join(os.getcwd(),'public','model'),exist_ok=True)
blend_path=os.path.join(os.getcwd(),'public','model','sejong.blend')
glb_path=os.path.join(os.getcwd(),'public','model','sejong.glb')
bpy.ops.wm.save_as_mainfile(filepath=blend_path)
# Blender 5.2's meshopt exporter defaults to 12-bit exponential filtering,
# which can move vertices by centimetres. Use 23 bits for architectural detail
# and restore its process-wide setting immediately after this export.
from io_scene_gltf2.io.exp import meshopt as meshopt_exporter
previous_meshopt_bits=meshopt_exporter.EXP_FILTER_BITS
try:
 meshopt_exporter.EXP_FILTER_BITS=23
 bpy.ops.export_scene.gltf(filepath=glb_path,export_format='GLB',
                           export_meshopt_compression_enable=True,
                           export_meshopt_extension='EXT_meshopt_compression')
finally:
 meshopt_exporter.EXP_FILTER_BITS=previous_meshopt_bits
print('Saved',blend_path,glb_path,'objects',len(scene.objects),'vertices',sum(len(o.data.vertices) for o in scene.objects if o.type=='MESH'))
