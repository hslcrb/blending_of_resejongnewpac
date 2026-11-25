"""Bake only the Garden of Gratitude, preserving earlier theatre and gate assets.

blender -b --factory-startup --disable-autoexec -t 4 --python-exit-code 1 \
  -P scripts/build_gratitude_plaza.py -- --source <pinned survey blend> --gltfpack <bin>
"""
import argparse
import hashlib
import json
from math import cos, pi, sin
from pathlib import Path
import random
import sys
from tempfile import TemporaryDirectory

sys.path.insert(0,str(Path(__file__).resolve().parent))
import bpy
from build_public_axis import Batch, ROOT, MODEL, collection, export, grain, material, ORIGINAL

LAYOUT_FILE = ROOT/'src/gratitudeGardenLayout.json'
CONF = json.loads(LAYOUT_FILE.read_text())
ASSET = ROOT/'scripts/assets/gratitude-plaque-atlas.jpg'
EDIT = ROOT/'blender_work/20261125-public-axis/sejong_gratitude_plaza.blend'
OUTPUT_NAME = 'gratitude-plaza.glb'

# Photo-fit cross-section. s increases east (Blender -Y); the north–south
# centreline is independent of the silhouette. Only height/count are official.
PROFILE = (
    (.389,5.96,-.20,.424), (.44,4.85,-.197,.424), (.49,3.62,-.193,.423),
    (.59,2.57,-.181,.418), (.75,1.99,-.167,.401), (.98,1.57,-.143,.386),
    (1.26,1.25,-.122,.367), (1.62,1.00,-.105,.335), (2.04,.815,-.094,.302),
    (2.53,.684,-.084,.274), (3.09,.590,-.073,.251), (3.73,.521,-.060,.225),
    (4.40,.467,-.040,.208), (5.07,.411,-.020,.193), (5.69,.374,.005,.181),
    (6.25,.348,.028,.169),
)
COURSES = (.389,1.30,2.07,3.11,4.41,5.13,6.25)
# Confirmed installed examples only: seven opening modules and October Sweden.
# The numerical material colours are visual approximations, not source textures.
DONATIONS = {'nl':(.77,.78,.84),'in':(.55,.37,.26),'gr':(.69,.69,.67),
             'be':(.19,.22,.24),'lu':(.57,.49,.40),'no':(.27,.31,.37),
             'de':(.53,.51,.44),'se':(.45,.40,.36)}

def profile(z):
    for a,b in zip(PROFILE, PROFILE[1:]):
        if a[0] <= z <= b[0]:
            t=(z-a[0])/(b[0]-a[0])
            return tuple(u+(v-u)*t for u,v in zip(a[1:],b[1:]))
    return PROFILE[-1][1:]

def ring(g,z,front,back,w,ch=.048):
    return [g(x,s,z) for x,s in [
        (-w+ch,back),(-w,back+ch),(-w,front-ch),(-w+ch,front),
        (w-ch,front),(w,front-ch),(w,back+ch),(w-ch,back),
    ]]

def band(b, materials, rings):
    for a,d in zip(rings,rings[1:]):
        for j,mat in enumerate(materials):
            k=(j+1)%len(a)
            b.shape(mat,[a[j],a[k],d[k],d[j]],[(0,1,2,3)])
    b.shape(materials[0],rings[0],[tuple(reversed(range(len(rings[0]))))])
    b.shape(materials[0],rings[-1],[tuple(range(len(rings[-1])))])

def atlas_quad(c,name,mat,rect,points):
    mesh=bpy.data.meshes.new(name)
    mesh.from_pydata(points,[],[(0,1,2,3)])
    mesh.update()
    x0,y0,x1,y1=rect
    uv=mesh.uv_layers.new(name='Packed label atlas')
    for i,(x,y) in enumerate(((x0,y1),(x1,y1),(x1,y0),(x0,y0))):
        uv.data[i].uv=(x/1024,1-y/768)
    obj=bpy.data.objects.new(name,mesh)
    mesh.materials.append(mat)
    c.objects.link(obj)

def sculpture(c,m,i,country):
    code,_,en=country
    center=CONF['originX']+i*CONF['spacingX']
    def g(x,s,z): return (center+x,-CONF['spineZ']-s,z)
    b=Batch(f'Gratitude Light {i+1:02} / {en}',c)
    w,back,front,h=[CONF[k] for k in ('halfWidth','backZ','frontZ','plinthHeight')]
    # The bench-height solid toe ends with a nearly vertical face, NOT at grade.
    # A 56mm upper chamfer catches a thin edge of light under the daylight sky.
    material_band=[m['dark'],m['edge'],m['dark'],m['edge'],m['edge'],m['dark'],m['edge'],m['dark']]
    intervals=[(back,3.93,None),(3.938,4.79,m['donations'].get(code)),(4.798,front,None)] if code in DONATIONS else [(back,front,None)]
    for lo,hi,finish in intervals:
        finish_band=[finish]*8 if finish else material_band
        band(b,finish_band,[ring(g,.006,hi,lo,w),ring(g,h-.056,hi,lo,w),
                            ring(g,h,hi-.027,lo+.027,w-.04,.028)])
    for i2,(low,high) in enumerate(zip(COURSES,COURSES[1:])):
        za=low+(.004 if i2 else 0)
        zb=high-(.004 if high<CONF['height'] else 0)
        heights=sorted({za,zb,*[row[0] for row in PROFILE if za<row[0]<zb],
                        *[za+(zb-za)*j/5 for j in range(1,5)]})
        rr=[]
        for z in heights:
            s1,s0,wide=profile(z)
            rr.append(ring(g,z,s1,s0,wide,min(.054,(s1-s0)*.17)))
        band(b,[m['dark'],m['edge'],m['dark'],m['edge'],m['edge'],m['dark'],m['edge'],m['dark']],rr)
    p=profile(6.25)
    b.box(m['lens'],center-.073,center+.073,-CONF['spineZ']-.224,-CONF['spineZ']-.142,6.246,6.251)
    b.finish()
    # Check the taper at both edges before placing the brass plane, so its two
    # edges sit on the dark side surface instead of wrapping onto the chamfer.
    za,zb=1.37,1.71
    xa=profile(za)[2]+.0028
    xb=profile(zb)[2]+.0028
    u,v=(i%5)*192,(i//5)*120
    atlas_quad(c,f'Country plaque {i+1:02} / {en}',m['atlas'],(u+4,v+4,u+188,v+117),
               [g(-xa,.20,za),g(-xa,.69,za),g(-xb,.69,zb),g(-xb,.20,zb)])

def public_context(c,m):
    b=Batch('Garden plaza / grey apron and joints',c)
    # Narrow paving overlay stays outside the original Freedom Hall stair void.
    # The base plaza Z is zero; do not create a second coplanar surface.
    b.box(m['pavers'],55,108.4,-89,-67,-.03,.023)
    b.box(m['pavers'],108.4,123,-89,-67.09,-.03,.023)
    b.box(m['pavers'],105,123,-56.91,-50.5,-.03,.023)
    for x in (59.25,99.2):
        b.box(m['recess'],x,x+.64,-85.7,-85.06,.022,.024)
        b.box(m['pavers'],x+.028,x+.612,-85.672,-85.088,.024,.025)
    b.finish()

    beds=Batch('Freedom Hall / marked garden beds and granite borders',c)
    for x0,x1,y0,y1 in ((110.45,122.75,-56.0,-53.95),(108,122.7,-51.35,-49.3)):
        beds.box(m['edge'],x0,x1,y0,y1,.019,.165)
        beds.box(m['soil'],x0+.13,x1-.13,y0+.13,y1-.13,.16,.182)
    beds.box(m['dark'],110.45,114.10,-56.10,-55.91,.166,.72)
    beds.finish()
    atlas_quad(c,'Garden of Gratitude / apron sign',m['atlas'],(2,605,747,673),
               [(110.58,-56.104,.32),(113.97,-56.104,.32),(113.97,-56.104,.64),(110.58,-56.104,.64)])
    # Lintel and paired names face the public stairs. Existing glass/rails and
    # the load-bearing surroundings have not been relocated.
    p=Batch('Freedom Hall / light-grey entrance lintel',c)
    p.box(m['entrance'],121.58,121.71,-65.27,-61.71,-.66,-.28)
    for y in (-65.18,-61.82):
        p.beam(m['warm'],(110.11,y,.955),(119.88,y,-2.34),.019)
    p.finish()
    atlas_quad(c,'Freedom Hall / bilingual lintel lettering',m['atlas'],(7,682,741,752),
               [(121.575,-62.00,-.578),(121.575,-65.00,-.578),(121.575,-65.00,-.339),(121.575,-62.00,-.339)])

    foliage=Batch('Garden / low mixed flowering borders',c)
    rng=random.Random(20261125)
    for x0,x1,y0,y1 in ((110.9,122.5,-55.82,-54.1),(108.2,122.5,-51.17,-49.5)):
        for i in range(200):
            x,y=rng.uniform(x0,x1),rng.uniform(y0,y1)
            if x0>110 and x<114.1 and y<-55.86+.18: continue
            h,w=rng.uniform(.075,.20),rng.uniform(.07,.14)
            angle=rng.random()*pi
            for a in (angle,angle+pi/2):
                u,v=cos(a)*w,sin(a)*w
                foliage.shape(m['leaf'],[(x-u,y-v,.182),(x+u,y+v,.182),(x+u*.6,y+v*.6,.182+h),(x-u*.6,y-v*.6,.182+h)],[(0,1,2,3)])
            if rng.random()<.65:
                mat=m['flowers'][int((x-x0)/.92)%3]
                z=.182+h; r=rng.uniform(.043,.066)
                pts=[(x+r*cos(j*pi/3),y+r*sin(j*pi/3),z) for j in range(6)]
                foliage.shape(mat,pts,[(0,1,2,3,4,5)])
    foliage.finish()

def carry_reference(source,c):
    # Reuse only the pre-existing stair and bridge elements. The old side sign
    # was in the wrong place and competes with the real lintel identification.
    def keep(name):
        return name=='Watercourse pedestrian bridge at crossing' or name.startswith(('Freedom entrance ','Freedom entry ','Freedom stair '))
    with bpy.data.libraries.load(str(source),link=False) as (available,target):
        target.objects=[n for n in available.objects if keep(n)]
    for obj in target.objects:
        if obj and obj.type=='MESH':
            if obj.parent:
                world=obj.matrix_world.copy(); obj.parent=None; obj.matrix_world=world
            c.objects.link(obj)

def check(c):
    ids={o.name.split(' / ')[0] for o in c.objects if o.name.startswith('Gratitude Light ')}
    assert len(ids)==CONF['count']
    for i,country in enumerate(CONF['countries']):
        n=f'Gratitude Light {i+1:02} / {country[2]} /'
        points=[v.co for ob in c.objects if ob.name.startswith(n) for v in ob.data.vertices]
        assert .0 <= min(v.z for v in points) < .02 and 6.2495 <= max(v.z for v in points) <= 6.2515
        end=-CONF['spineZ']-CONF['frontZ']
        toe=[p for p in points if p.y<end+.03]
        assert len(toe)>=8 and max(p.z for p in toe)>.36
        assert c.objects.get(f'Country plaque {i+1:02} / {country[2]}')
    assert c.objects.get('Watercourse pedestrian bridge at crossing')
    assert c.objects.get('Freedom entrance descending treads')
    assert c.objects.get('Freedom Hall / bilingual lintel lettering')

def main():
    p=argparse.ArgumentParser()
    p.add_argument('--source',type=Path,default=ORIGINAL)
    p.add_argument('--gltfpack',type=Path)
    a=p.parse_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else [])
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.context.preferences.filepaths.save_version=0
    c=collection('20261125 · Garden of Gratitude plaza correction',bpy.context.scene)
    carry_reference(a.source,c)
    with TemporaryDirectory() as tmp:
        def grained(n,k,seed,period,tiles=False):
            return material(n,k,.83,texture=grain(n,k,seed,tmp,tiles),period=period)
        texture=bpy.data.images.load(str(ASSET))
        texture.pack()
        m={
            'dark':grained('Salt-and-pepper charcoal granite',(.365,.399,.425),193,.67),
            'edge':grained('Honed granite bevel',(.452,.481,.506),194,.72),
            'pavers':grained('Pale grey squared plaza paving',(.59,.59,.575),220,1.14,True),
            'entrance':grained('Warm grey granite lintel',(.62,.606,.557),250,1.25),
            'recess':material('Dark paving seams',(.26,.265,.26),.9),
            'warm':material('Warm stair railing lens',(.95,.64,.32),.55,emission=.75),
            'lens':material('Recessed top optic',(.235,.259,.275),.35),
            'soil':material('Dark soil in low planting beds',(.115,.092,.057),.90),
            'leaf':material('Cut perennial leaves',(.187,.275,.058),.91),
            'flowers':[material('Flower group '+name,col,.81) for name,col in
                       [('yellow',(.87,.69,.12)),('pink',(.60,.22,.42)),('purple',(.31,.21,.50))]],
            'atlas':material('National flags and bilingual brass signage',(.77,.66,.45),.64,.03,texture=texture),
            'donations':{code:grained('Inset donated stone '+code,col,250+i,.47)
                         for i,(code,col) in enumerate(DONATIONS.items())},
        }
        for i,country in enumerate(CONF['countries']):
            sculpture(c,m,i,country)
        public_context(c,m)
        bpy.context.view_layer.update()
        check(c)
        bpy.ops.wm.save_as_mainfile(filepath=str(EDIT),compress=True)
        data=export(c,OUTPUT_NAME,a.gltfpack)
        data['sourceGitBlob']=hashlib.sha1(('blob '+str(a.source.stat().st_size)+'\0').encode()+a.source.read_bytes()).hexdigest()
        data['layoutSha256']=hashlib.sha256(LAYOUT_FILE.read_bytes()).hexdigest()
        data['atlasSha256']=hashlib.sha256(ASSET.read_bytes()).hexdigest()
        data['donationModules']=list(DONATIONS)
        (MODEL/'gratitude-plaza-evidence.json').write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n')
        print(json.dumps(data,ensure_ascii=False))

if __name__=='__main__':
    main()
