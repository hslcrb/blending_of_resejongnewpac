import bpy, math, os
from mathutils import Vector

# Photo-proportioned architectural reconstruction. Coordinates are in metres;
# the supplied photographs do not establish surveyed measurements.
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)

def material(name, color, metallic=0, roughness=.72):
    m=bpy.data.materials.new(name); m.diffuse_color=(*color,1); m.use_nodes=True
    p=next(n for n in m.node_tree.nodes if n.type=='BSDF_PRINCIPLED')
    p.inputs['Base Color'].default_value=(*color,1); p.inputs['Metallic'].default_value=metallic; p.inputs['Roughness'].default_value=roughness
    return m

mats={
 'stone':material('밝은 화강석',(.68,.69,.67)),
 'stone2':material('밝은 석재 줄눈',(.56,.57,.55)),
 'roof':material('회색 지붕',(.37,.39,.39)),
 'roofedge':material('처마 하부',(.28,.30,.30)),
 'copper':material('녹청색 지붕',(.29,.40,.37),.12,.8),
 'dark':material('깊은 그늘',(.075,.09,.095)),
 'glass':material('짙은 유리',(.065,.13,.14),.35,.24),
 'gold':material('청동 격자',(.62,.49,.28),.65,.3),
 'ground':material('광장 석재',(.59,.61,.60)),
 'line':material('포장 줄눈',(.43,.46,.45)),
 'white':material('옥상 벽',(.77,.78,.75)),
}

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
def hip_roof(m,cx,cy,z0,z1,width,depth,ridge):
 builder=b[m]; start=len(builder.v)
 builder.v.extend([(cx-width/2,cy-depth/2,z0),(cx+width/2,cy-depth/2,z0),(cx+width/2,cy+depth/2,z0),(cx-width/2,cy+depth/2,z0),(cx-ridge/2,cy,z1),(cx+ridge/2,cy,z1)])
 builder.f.extend([tuple(start+i for i in face) for face in [(0,1,5,4),(1,2,5),(2,3,4,5),(3,0,4),(3,2,1,0)]])
def stone_pillar(cx,cy,z0,z1,w,d,bevel):
 # Eight-sided chamfered stone shaft; joints below remain separate fine lines.
 x=w/2; y=d/2; c=bevel
 loop=[(-x+c,-y),(x-c,-y),(x,-y+c),(x,y-c),(x-c,y),(-x+c,y),(-x,y-c),(-x,-y+c)]
 builder=b['stone']; start=len(builder.v)
 builder.v.extend([(cx+u,cy+v,z) for z in (z0,z1) for u,v in loop])
 builder.f.append(tuple(start+i for i in reversed(range(8))))
 builder.f.append(tuple(start+8+i for i in range(8)))
 builder.f.extend([(start+i,start+(i+1)%8,start+8+(i+1)%8,start+8+i) for i in range(8)])

# Stone forecourt and paved joints.
box('ground',0,8,-.24,112,84,.48)
for x in range(-56,57,2): box('line',x,-15,.006,.018,38,.012)
for y in range(-34,5,2): box('line',0,y,.009,112,.018,.012)

# Theatre: main mass, central glazed facade and stone end piers.
cx=22; front=-3; back=34; W=54; D=37
box('stone',cx,18,8.7,W,31,17.4)
box('dark',cx,front+.55,8.8,41,1,16.6)
box('glass',cx,front-.02,3.2,41,.18,5.8)
for x in (-2.2,46.2):
 box('stone',x,front+.1,10.35,5.6,1.8,13.7)
 # The bottom of the monumental corner piers narrows toward the plinth.
 frustum('stone',x,front+.1,0,3.5,4.1,1.4,5.6,1.8)
# Façade panel stone coursing on end piers and return wall.
for z in [i*.72 for i in range(5,24)]:
 for x in (-2.2,46.2): box('stone2',x,front-.825,z,5.5,.018,.015)
for x in [-4.8,-3.4,-2,0,43.7,45.3,46.9,48.3]: box('stone2',x,front-.84,8.5,.012,.02,17)

# Projecting cornice: stacked beams, sloped outward roof edge, roof slab.
box('roofedge',cx,15,17.75,55,39,1.0)
box('dark',cx,15,18.35,57,41,.45)
frustum('roof',cx,15,18.55,21.65,60,44,57,41)
box('roofedge',cx,15,21.7,60.2,44.2,.26)
# Underside ribs run deep under all four eaves.
for x in [cx-28.2+i*.60 for i in range(95)]:
 box('stone2',x,-5.7,17.98,.20,3.1,.50); box('stone2',x,35.7,17.98,.20,3.1,.50)
for y in [-3+i*.60 for i in range(64)]:
 box('stone2',-6.6,y,17.98,3.0,.20,.50); box('stone2',50.6,y,17.98,3.0,.20,.50)
# Finer ribs under the inner stone beam are visible from the entrance.
for x in [cx-26.5+i*.36 for i in range(148)]:
 box('stone2',x,-4.35,17.23,.055,1.0,.08)
for z in [19.15,19.8,20.45,21.1]:
 # Place the seams on the sloping front face, not in front of it.
 y=-7.0+(z-18.55)*(1.5/3.1)
 box('stone2',cx,y-.012,z,59,.025,.018)
# High theatre fly tower behind the hipped roof.
box('white',cx,17.5,22.2,36,20,2.2)
hip_roof('copper',cx,17.5,23.3,25.7,36,20,15)
box('stone',cx,29.0,25.5,30,8,4.0)
for z in [23.8+i*.65 for i in range(6)]: box('stone2',cx,24.98,z,30,.02,.015)
# Lower rear hall, seen beyond the fly tower in the site diagram.
rearx=32
box('stone',rearx,40.5,8.1,34,13,16.2)
box('roofedge',rearx,40.5,16.3,37.2,14,.45)
hip_roof('roof',rearx,40.5,16.52,19.0,37.2,14,20)
for x in [rearx-14+i*2 for i in range(15)]:
 box('glass',x,47.06,8.7,.75,.14,8.2)
for z in (4.5,12.8):box('stone2',rearx,47.15,z,33,.1,.13)

# Six tall rectilinear columns with flared capitals and seams.
columns=[4,11.2,18.4,25.6,32.8,40]
for x in columns:
 stone_pillar(x,front-1.0,.25,16.65,1.55,1.6,.19)
 frustum('stone',x,front-1.0,16.55,17.25,1.55,1.6,2.45,2.2)
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
# Ground floor window and door frames.
for x in [2+i*1.45 for i in range(29)]: box('gold',x,front-.18,2.6,.045,.06,4.7)
for z in (0.35,2.0,4.6): box('gold',cx,front-.2,z,40,.07,.055)
for x in (7.5,15,22.5,30,37.5):
 box('gold',x,front-.28,1.4,.06,.08,2.5); box('gold',x+.55,front-.31,1.4,.035,.08,.6)
# Side elevation: two colonnaded stretches separated by the long stone wall,
# as shown in the supplied axonometric site diagram.
side_bays=[(.4,12.0),(34.2,46.8)]
for a,q in side_bays:
 box('glass',49.1,(a+q)/2,7.5,.14,q-a,13)
 box('dark',49.12,(a+q)/2,12.7,.12,q-a,6.1)
for y in (1,6,11):
 stone_pillar(50,y,.05,16.55,1.5,1.55,.18)
 frustum('stone',50,y,16.48,17.25,1.5,1.55,2.2,2.4)
 box('stone',50,y,17.37,2.2,2.4,.24)
for y in (35,40.3,45.6):
 stone_pillar(49.4,y,.05,15.2,1.5,1.55,.18)
 frustum('stone',49.4,y,15.12,15.85,1.5,1.55,2.2,2.4)
 box('stone',49.4,y,15.96,2.2,2.4,.22)
for a,q in side_bays:
 for z in (4.8,8.3,15.8):box('roofedge',49.19,(a+q)/2,z,.22,q-a,.2)
 for y in [a+i*.9 for i in range(int((q-a)/.9)+1)]:box('gold',49.22,y,3.1,.06,.04,5.7)
# Pale stone panels and small irregularly spaced windows on the long middle wall.
box('stone',49.13,23,8.6,.27,22,17.2)
for z in [i*.72 for i in range(1,24)]:box('stone2',49.28,23,z,.025,22,.016)
for y in [12.6+i*1.35 for i in range(16)]:box('stone2',49.29,y,8.5,.025,.016,17)
for y,z in [(14.2,5.6),(17.5,6.6),(21,5.6),(24.5,6.6),(28,5.6),(31.5,6.6),(14.2,10.2),(17.5,11.2),(21,10.2),(24.5,11.2),(28,10.2),(31.5,11.2)]:
 box('glass',49.31,y,z,.045,.32,.62)
# The bronze fretwork continues on both stretches of the side colonnade.
def side_bar(y1,z1,y2,z2,width=.04):
 dx=y2-y1; dz=z2-z1; length=math.hypot(dx,dz)
 if not length:return
 ny=-dz/length*width/2; nz=dx/length*width/2; x=49.18; d=.035
 b['gold'].poly([(x-d/2,y1+ny,z1+nz),(x-d/2,y2+ny,z2+nz),(x-d/2,y2-ny,z2-nz),(x-d/2,y1-ny,z1-nz),(x+d/2,y1+ny,z1+nz),(x+d/2,y2+ny,z2+nz),(x+d/2,y2-ny,z2-nz),(x+d/2,y1-ny,z1-nz)])
for i in range(85):
 for j in range(10):
  y=.6+i*.55; z=10+j*.55; c=math.sqrt(.5)
  if not any(a+.3<y<q-.3 for a,q in side_bays):continue
  pts=[(-.22,-.16),(-.22,.17),(.10,.17),(.10,-.05),(-.07,-.05),(-.07,.05),(.22,.05),(.22,-.22)]
  pts=[(y+(u-v)*c,z+(u+v)*c) for u,v in pts]
  for a,q in zip(pts,pts[1:]):side_bar(a[0],a[1],q[0],q[1])

# A plinth with steps that rise towards the entrances, and return along the side.
box('stone',cx,-5.35,.4,54,2.0,.8)
for i in range(8):
 z=.08+i*.09; y=-10+i*.46
 box('stone',cx,y,z,54,.47,.18)
 box('stone2',cx,y-.235,z+.09,54,.025,.018)
box('stone',50.45,15,.4,2.9,37,.8)
for i in range(6):
 z=.08+i*.09; x=54.1-i*.43
 box('stone',x,15,z,.44,37,.18)
 box('stone2',x+.22,15,z+.09,.025,37,.018)

# Smaller west hall: similar roof and colonnade, prominent central screen.
ax=-39; af=-3; aw=25; ad=24
box('stone',ax,10.5,7.0,aw,22,14)
box('dark',ax,af-.08,7.2,19,.18,12.8)
box('glass',ax,af-.2,3.1,19,.16,5.6)
for x in (ax-10.8,ax+10.8):box('stone',x,af-.05,7,3.4,1.7,14)
for x in (ax-7.3,ax-2.4,ax+2.4,ax+7.3):
 stone_pillar(x,af-.85,.25,13.8,1.15,1.3,.14)
 frustum('stone',x,af-.85,13.72,14.3,1.15,1.3,1.7,1.8)
 box('stone',x,af-.85,14.4,1.7,1.8,.20)
box('roofedge',ax,9,14.55,26.5,26.8,.85)
box('dark',ax,9,15.12,28,28,.30)
frustum('roof',ax,9,15.25,17.55,29,29,27,27)
box('roofedge',ax,9,17.6,29.2,29.2,.2)
for x in [ax-13.8+i*.53 for i in range(53)]:
 box('stone2',x,-4.7,14.84,.16,2.2,.46);box('stone2',x,22.7,14.84,.16,2.2,.46)
for y in [-3+i*.54 for i in range(48)]:
 box('stone2',ax-13.7,y,14.84,2,.16,.46);box('stone2',ax+13.7,y,14.84,2,.16,.46)
box('white',ax,12,18.4,20,15,1.7)
hip_roof('copper',ax,12,19.25,20.6,20,15,8)
box('stone',ax,15.5,20.7,17,9,3.2)
lattice(ax-9.8,ax+9.8,9.6,12.8,af-.24,.4)
box('dark',ax,af-.41,7.3,8.4,.2,5.7)
for x in (ax-4.35,ax+4.35): box('white',x,af-.58,7.3,.25,.28,6.1)
for z in (4.25,10.35):box('white',ax,af-.58,z,8.95,.28,.24)
# The screen is carried on two short metal struts, not painted on the glazing.
for x in (ax-3.3,ax+3.3):box('stone2',x,af-.65,3.8,.18,.45,.8)
# Glazed terrace volume projecting toward the central court.
box('roofedge',-25.6,1.4,4.85,8.0,8,.50)
box('glass',-25.6,1.4,6.7,7.8,7.8,3.5)
box('stone2',-25.6,1.4,8.55,8,8,.20)
for x in [-29.45+i*1.3 for i in range(7)]:
 box('white',x,-2.55,6.7,.07,.10,3.55);box('white',x,5.35,6.7,.07,.10,3.55)
for y in [-2.5+i*1.3 for i in range(7)]:
 box('white',-21.65,y,6.7,.10,.07,3.55);box('white',-29.55,y,6.7,.10,.07,3.55)
for z in (5.0,6.7,8.45):
 box('white',-25.6,-2.57,z,8,.10,.08);box('white',-21.63,1.4,z,.10,8,.08)
for y in (-1.8,4.6):box('stone',-22.2,y,2.4,.38,.38,4.8)
# Front low terrace and the banner fascia.
box('stone',ax,-8.1,2.0,25,7.7,4)
box('glass',ax,-12.02,1.65,19,.13,2.5)
box('white',ax,-12.12,3.6,23,.18,1.0)
for x in [ax-9+i*1.8 for i in range(11)]:box('stone2',x,-12.13,1.6,.08,.08,2.4)

# Connecting building and broad ascending central stair.
box('stone',-13.1,16,5.8,20,13,11.6)
box('glass',-13.1,9.42,1.8,19,.16,3.4)
for x in [-22+i*1.6 for i in range(13)]:
 for z in (5.1,8.0):box('glass',x,9.37,z,.32,.08,1.45)
for z in [4+i*.65 for i in range(12)]:box('stone2',-13.1,9.33,z,20,.02,.015)
for i in range(36):
 y=-15+i*.37; z=.05+i*.09
 box('stone',-13.1,y,z,20,.38,.11)
 box('stone2',-13.1,y-.185,z+.055,20,.022,.018)
box('stone',-13.1,4.6,3.25,20,10, .25)
for x in (-23.5,-2.7):
 for i in range(6):
  y=-13.65+i*2.65; h=.65+i*.53
  box('stone',x,y,h/2,.65,2.7,h)
  box('stone2',x,y,h+.035,.76,2.7,.07)
 for i in range(10):
  y=-14+i*1.45; z=.22+(y+15)*.243
  box('roofedge',x,y,z+.47,.055,.055,.9)
 # Railing follows the slope of the stairs.
 x1=x-.03;x2=x+.03;y1=-14.4;y2=-.5;z1=1.24;z2=4.62
 b['roofedge'].poly([(x1,y1,z1-.03),(x1,y2,z2-.03),(x2,y2,z2-.03),(x2,y1,z1-.03),(x1,y1,z1+.03),(x1,y2,z2+.03),(x2,y2,z2+.03),(x2,y1,z1+.03)])

# Shallow incised suggestion on the left end panel; the right is photo-guided below.
# The full relief is interpretive because it is not visible in the supplied close-up.
for x in (-2.2,):
 paths=[
  [(-.35,10.6),(-.58,10.25),(-.65,9.85),(-.87,9.48),(-.68,9.35),(-.64,9.04),(-.42,8.75),(-.08,8.55),(.28,8.62),(.54,8.95),(.66,9.45),(.53,10.03),(.17,10.5),(-.35,10.6)],
  [(-.58,9.85),(-.39,9.95),(-.18,9.92),(-.08,9.82),(-.29,9.78),(-.48,9.81)],
  [(-.41,9.3),(-.24,9.24),(-.08,9.26),(.08,9.34)],
  [(-.36,9.13),(-.17,9.08),(.02,9.12)],
 ]
 for n in range(7):
  pts=[]
  for i in range(23):
   t=i/22
   pts.append((-.85+n*.28+.34*math.sin(t*math.pi*1.25+n*.15),11.95-t*3.5))
  paths.append(pts)
 # A shallow light-coloured raised profile with a fine darker incised edge.
 # The curves deliberately remain an interpretation, not a scan of the artwork.
 for pts in paths:
  for a,c in zip(pts,pts[1:]):
   a=(a[0]*1.45,10.4+(a[1]-10.4)*1.9);c=(c[0]*1.45,10.4+(c[1]-10.4)*1.9)
   b['stone2'].bar(x+a[0]+.04,front-.865,a[1]-.04,x+c[0]+.04,front-.865,c[1]-.04,.07,.025)
   b['stone'].bar(x+a[0],front-.91,a[1],x+c[0],front-.91,c[1],.13,.08)

for k,v in b.items():v.finish(k,mats[k])

# The right pier uses the supplied close-up as a softly blended surface reference.
# Small height changes provide a shallow relief; the unseen sculpture depth remains estimated.
# Load a fresh copy so the packed image always matches the asset on disk.
relief_image=bpy.data.images.load(os.path.abspath('assets/relief-reference.png'),check_existing=False)
relief_image.pack()
rw,rh=relief_image.size; pix=list(relief_image.pixels[:])
def intensity(px,py):
 px=max(0,min(rw-1,px));py=max(0,min(rh-1,py));i=(py*rw+px)*4
 return (pix[i]+pix[i+1]+pix[i+2])/3
nu,nv=40,56
verts=[];faces=[]
for j in range(nv+1):
 for i in range(nu+1):
  u=i/nu;v=j/nv;px=round(u*(rw-1));py=round(v*(rh-1))
  detail=intensity(px,py)-sum(intensity(px+dx,py+dy) for dx,dy in [(-4,0),(4,0),(0,-4),(0,4)])/4
  verts.append((46.2+(u-.5)*4.5,front-.95-max(-.04,min(.04,detail*.13)),10.25+(v-.5)*7.5))
for j in range(nv):
 for i in range(nu):
  a=j*(nu+1)+i;faces.append((a,a+1,a+nu+2,a+nu+1))
mesh=bpy.data.meshes.new('Photo-guided shallow relief');mesh.from_pydata(verts,[],faces);mesh.update()
relief=bpy.data.objects.new('Reference-guided right relief',mesh);bpy.context.collection.objects.link(relief)
uv=mesh.uv_layers.new(name='Relief UV')
for poly in mesh.polygons:
 for li in poly.loop_indices:
  idx=mesh.loops[li].vertex_index; uv.data[li].uv=((idx%(nu+1))/nu,(idx//(nu+1))/nv)
mat=bpy.data.materials.new('Relief from supplied photograph');mat.use_nodes=True
shader=next(n for n in mat.node_tree.nodes if n.type=='BSDF_PRINCIPLED')
texture=mat.node_tree.nodes.new('ShaderNodeTexImage');texture.image=relief_image
mat.node_tree.links.new(texture.outputs['Color'],shader.inputs['Base Color'])
mat.node_tree.links.new(texture.outputs['Alpha'],shader.inputs['Alpha'])
shader.inputs['Roughness'].default_value=.85
methods=[item.identifier for item in bpy.types.Material.bl_rna.properties['surface_render_method'].enum_items]
mat.surface_render_method='BLENDED' if 'BLENDED' in methods else methods[0]
mesh.materials.append(mat)
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
bpy.ops.export_scene.gltf(filepath=glb_path,export_format='GLB')
print('Saved',blend_path,glb_path,'objects',len(scene.objects),'vertices',sum(len(o.data.vertices) for o in scene.objects if o.type=='MESH'))
