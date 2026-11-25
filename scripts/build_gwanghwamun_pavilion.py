"""Rebuild the gatehouse alone. Preserve existing lower walls, Woldae and plaza.

Blender 5.0.1: blender -b --factory-startup --disable-autoexec --python-exit-code 1 \
  -P scripts/build_gwanghwamun_pavilion.py -- --gltfpack PATH_TO_GLTFPACK
"""
from __future__ import annotations
import argparse
import json
from hashlib import sha256
import subprocess
from math import ceil, cos, pi, sin
from pathlib import Path
import sys

import bpy
from mathutils import Vector

sys.path.insert(0, str(Path(__file__).resolve().parent))
from build_public_axis import Batch, GATE_X, GATE_Y, ROOT, MODEL, collection, export, glb_json, material

SOURCE = ROOT / 'blender_work/20261125-public-axis/sejong_public_axis_field.blend'
TARGET = SOURCE.with_name('sejong_gwanghwamun_pavilion.blend')
OUTPUT = 'gwanghwamun-pavilion.glb'
GT = lambda p: (GATE_X+p[1], GATE_Y-p[0], p[2])


def tube(batch, mat, path, width, height, sides=7, cap=True):
    """Sweep elliptical sections along a curve. One strip, no stacked boxes."""
    verts=[]
    for i, xyz in enumerate(path):
        center=Vector(xyz)
        direction=(Vector(path[min(i+1,len(path)-1)])-Vector(path[max(0,i-1)])).normalized()
        right=direction.cross(Vector((0,0,1)))
        if right.length<1e-5:
            right=Vector((1,0,0))
        right.normalize()
        up=right.cross(direction).normalized()
        verts += [tuple(center+right*width*cos(2*pi*j/sides)+up*height*sin(2*pi*j/sides)) for j in range(sides)]
    faces=[(i*sides+j,(i+1)*sides+j,(i+1)*sides+(j+1)%sides,i*sides+(j+1)%sides)
           for i in range(len(path)-1) for j in range(sides)]
    if cap:
        faces += [tuple(range(sides)),tuple(reversed(range(len(verts)-sides,len(verts))))]
    batch.shape(mat,verts,faces)


def column(batch, mat, x, y, z, top, radius):
    levels=[(z,radius*.97),(z+.19,radius),(z+(top-z)*.43,radius*1.015),
            (top-.21,radius*.89),(top,radius*.88)]
    vs=[(x+r*cos(j*pi/6),y+r*sin(j*pi/6),h) for h,r in levels for j in range(12)]
    fs=[(k*12+j,k*12+(j+1)%12,(k+1)*12+(j+1)%12,(k+1)*12+j) for k in range(4) for j in range(12)]
    batch.shape(mat,vs,fs+[tuple(reversed(range(12))),tuple(range(48,60))])


def roof_point(t,u,side,w,d,z,rise,hip,flare):
    """우진각: ridge-end inset converges at t=1, without a vertical gable."""
    xx=w-(w-hip)*t
    yy=d*(1-t)
    eave_lift=flare*(1-t)**2.25
    ridge_lift=.11*t**4*abs(u)**5
    zz=z+rise*(.40*t+.60*t*t)
    if side in (0,2):
        return (xx*u,yy*(-1 if side==0 else 1),zz+eave_lift*abs(u)**4+ridge_lift)
    return (xx*(1 if side==1 else -1),yy*u,zz+eave_lift+.11*t**4)


def roof(c,m,label,w,d,z,rise,hip,flare):
    skin=Batch(label+' / four continuous hipped roof planes',c,GT)
    ornament=Batch(label+' / ridges, tile lips and underside',c,GT)
    for side in range(4):
        seam=side in (0,2)
        n=ceil(2*(w if seam else d)/.315)
        nt=12
        def surface(t,u,offset=0):
            x,y,h=roof_point(t,u,side,w,d,z,rise,hip,flare)
            return x,y,h+offset
        # Half-wave barrel rolls are 3D; faces between them stay a closed roof skin.
        nu=2*n
        verts=[surface(i/nt,-1+2*j/nu,(-.014 if (j%2) else .025)*(1-.38*i/nt))
               for i in range(nt+(1 if seam else 0)) for j in range(nu+1)]
        count=nt if seam else nt-1
        for j0 in range(3):
            # Small deterministic finish differences give tiles life without a photo texture.
            faces=[]
            for i in range(count):
                for j in range(nu):
                    if ((j//2)*13+side*11)%9//3!=j0: continue
                    a=i*(nu+1)+j;b=a+nu+1
                    f=(a,a+1,b+1,b)
                    faces.append(f if side in (0,1) else tuple(reversed(f)))
            if not seam and j0==0:
                k=len(verts)
                tip=surface(1,0,.015)
                verts.append(tip)
                for j in range(nu):
                    a=(nt-1)*(nu+1)+j
                    faces.append((a,a+1,k) if side==1 else (a,k,a+1))
            # Mesh subset compacts material batches and keeps payload bounded.
            used=sorted({i for f in faces for i in f})
            index={v:i for i,v in enumerate(used)}
            skin.shape(m['tile'+str(j0)],[verts[v] for v in used],[tuple(index[v] for v in f) for f in faces])
        for j in range(n):
            u=-1+(j+.5)*2/n
            x,y,h=surface(0,u,.031)
            inner=(x+.085*(0 if seam else (-1 if side==1 else 1)),
                   y+.085*((1 if side==0 else -1) if seam else 0),h+.021)
            tube(ornament,m['tile-cap'],[inner,(x,y,h)],.092,.088,sides=8)
            if j%2==0:
                # The brighter, recessed timber ends read from street level.
                outer=surface(0,u,-.205)
                inside=(outer[0]*(.88 if not seam else .994),outer[1]*(.83 if seam else .995),outer[2]-.052)
                tube(ornament,m['rafter'],[inside,outer],.081,.088,sides=7)
                # Circular painted rafter ends below the mineral tile caps.
                vx,vy = (0,-1 if side==0 else 1) if seam else (1 if side==1 else -1,0)
                x,y,h=outer
                tube(ornament,m['ivory'],[(x,y,h),(x+.026*vx,y+.026*vy,h)],.068,.073,sides=8)
                tube(ornament,m['red-dot'],[(x+.027*vx,y+.027*vy,h),(x+.037*vx,y+.037*vy,h)],.037,.040,sides=8)
        points=[surface(0,-1+j/28*2,-.075) for j in range(29)]
        tube(ornament,m['eave'],points,.135,.123,sides=6)
    tube(ornament,m['ridge'],[(hip*u,0,z+rise+.11*abs(u)**5+.105) for u in [i/12 for i in range(-12,13)]],.218,.185)
    for sx in (-1,1):
        for sy in (-1,1):
            side=0 if sy<0 else 2
            ps=[roof_point(t,sx,side,w,d,z,rise,hip,flare) for t in [i/22 for i in range(23)]]
            tube(ornament,m['ridge'],[(x,y,h+.135) for x,y,h in ps],.147,.132)
            # Roof-end statuette silhouettes: distinct squatting profiles, not an asserted census.
            for j,t in enumerate((.11,.18,.25,.32,.39,.46,.53)):
                x,y,h=roof_point(t,sx,side,w,d,z,rise,hip,flare)
                height=.43-.022*j
                tube(ornament,m['ridge'],[(x,y,h+.11),(x+.025*sx,y+.035*sy,h+.23),
                    (x-.045*sx,y-.06*sy,h+height*.83),(x+.023*sx,y+.032*sy,h+height)],.09,.076,6)
    skin.finish()
    ornament.finish()


def timber(c,m,label,w,d,base,beam,upper):
    """Four primary facade columns frame three bays; sides have a center post."""
    b=Batch(label+' / posts, recessed windows and dancheong joinery',c,GT)
    posts=[-w,-.361*w,.361*w,w]
    sides=[-d,0,d]
    for y in (-d,d):
        for x in posts:
            column(b,m['post'],x,y,base,beam,.275 if upper else .32)
            b.box(m['foot'] ,x-.34,x+.34,y-.34,y+.34,base-.08,base+.10)
    for x in (-w,w):
        column(b,m['post'],x,0,base,beam,.26)
    def face(q,along,depth,z):
        f,side=q
        return (along,side*(d+depth),z) if not f else (side*(w+depth),along,z)
    for f in (0,1):
        for side in (-1,1):
            q=(f,side); joints=posts if not f else sides
            for l,r in zip(joints,joints[1:]):
                # Pick out broad bay openings under a dark, layered eave.
                lo,hi=l+.28,r-.28
                b.beam(m['dark'],face(q,lo,-.30,base+(beam-base)*.48),face(q,hi,-.30,base+(beam-base)*.48),.175,(beam-base)*.83)
                sill=base+(.65 if upper else .46)
                head=beam-.49
                for zz in (sill,head):
                    b.beam(m['post'],face(q,lo,-.04,zz),face(q,hi,-.04,zz),.14,.14)
                panel_count=4 if not f else 3
                for j in range(panel_count+1):
                    xx=lo+(hi-lo)*j/panel_count
                    b.beam(m['frame'],face(q,xx,-.12,sill),face(q,xx,-.12,head),.103)
                # Diagonal lattice confined to each framed sash, not across posts.
                for panel in range(panel_count):
                    x0=lo+(hi-lo)*panel/panel_count+.077
                    x1=lo+(hi-lo)*(panel+1)/panel_count-.077
                    y0,y1=sill+.09,head-.085
                    width,height=x1-x0,y1-y0
                    # Clip both diagonals to the inset before generating a beam.
                    for slant in (-1,1):
                        for j in range(-ceil(height/.185),ceil(width/.185)+1):
                            tip=j*.185
                            a=max(0,-tip); z=min(height,width-tip)
                            if z-a<.035:continue
                            aa,zz=tip+a,tip+z
                            if slant<0: aa,zz=width-aa,width-zz
                            b.beam(m['lattice'],face(q,x0+aa,-.139,y0+a),
                                   face(q,x0+zz,-.139,y0+z),.029,.029)
            for zz,mat,h in ((base+.18,'post',.21),(beam-.33,'juniper',.22),(beam-.143,'ivory',.048),
                             (beam+.17,'post',.20),(beam+.28,'ochre',.035),(beam+.36,'eave',.12)):
                b.beam(m[mat],face(q,joints[0]-.16,.012,zz),face(q,joints[-1]+.16,.012,zz),.31,h)
            for lo,hi in zip(joints,joints[1:]):
                n=max(2,round((hi-lo)/1.27))
                for j in range(n):
                    xx=lo+(hi-lo)*(j+.5)/n
                    b.beam(m['juniper'],face(q,xx,-.02,beam-.70),face(q,xx,.48,beam-.21),.245,.21)
                    b.beam(m['azure'],face(q,xx,.16,beam-.46),face(q,xx,.72,beam-.04),.21,.153)
                    b.beam(m['juniper'],face(q,xx-.27,.45,beam-.262),face(q,xx+.27,.45,beam-.262),.18,.115)
                    b.beam(m['post'],face(q,xx,.58,beam-.09),face(q,xx,.92,beam+.20),.22,.13)
                    b.beam(m['ivory'],face(q,xx-.14,.62,beam-.24),face(q,xx+.14,.62,beam-.24),.043,.037)
                    b.beam(m['ochre'],face(q,xx,.607,beam-.42),face(q,xx,.657,beam-.34),.062,.07)
    b.finish()


def low_parapet(c,m):
    b=Batch('Pavilion plinth / low stone edge and open intervals',c,GT)
    for y in (-8.19,7.70):
        b.box(m['foot'],-16.74,16.74,y-.135,y+.135,7.54,7.76)
        for j in range(21):
            x=(j-10)*1.62
            b.box(m['parapet'],x-.37,x+.37,y-.145,y+.145,7.72,8.02)
            b.box(m['parapet'],x-.413,x+.413,y-.18,y+.18,7.98,8.075)
    b.finish()


def sign(c,m,y):
    b=Batch('Upper / black plaque and carved frame',c,GT)
    b.box(m['plaque-back'],-2.31,2.31,y-.095,y,14.10,15.65)
    for z in (14.10,15.57):
        b.box(m['frame'],-2.38,2.38,y-.142,y+.01,z,z+.08)
        b.box(m['ochre'],-2.22,2.22,y-.153,y-.145,z+.056,z+.078)
    for x in (-2.36,2.31):
        b.box(m['frame'],x,x+.052,y-.145,y,14.11,15.62)
    for x in (-1.80,1.80):
        b.beam(m['eave'],(x,y+.02,15.59),(x,-4.58,15.88),.106,.094)
    for i in range(21):
        x=(i-10)*.216
        for z in (14.153,15.624):
            tube(b,m['azure'] if i%2 else m['ivory'],[(x,y-.147,z),(x,y-.167,z)],.048,.031,8)
    b.finish()
    fontpath=next((p for p in (Path('/usr/share/fonts/opentype/noto/NotoSerifCJK-Bold.ttc'),
                              Path('/System/Library/Fonts/Supplemental/Songti.ttc'),
                              Path('C:/Windows/Fonts/mingliu.ttc')) if p.is_file()),None)
    if not fontpath:
        raise RuntimeError('CJK serif font required for the plaque; no blank export')
    font=bpy.data.fonts.load(str(fontpath))
    for char,x in zip('門化光',(-1.22,0,1.22)):
        curve=bpy.data.curves.new('Plaque '+char,'FONT')
        curve.body=char;curve.font=font;curve.align_x='CENTER';curve.size=1.75
        curve.extrude=.015;curve.bevel_depth=.007;curve.bevel_resolution=1;curve.resolution_u=7
        o=bpy.data.objects.new('Plaque gilt '+char,curve);c.objects.link(o)
        o.location=GT((x,y-.164,14.414));o.rotation_euler=(pi/2,0,-pi/2)
        o.data.materials.append(m['gilt'])
        bpy.ops.object.select_all(action='DESELECT')
        o.select_set(True);bpy.context.view_layer.objects.active=o
        bpy.ops.object.convert(target='MESH')
        o.select_set(False)


def finishes():
    palette={
        'post':(.31,.061,.037), 'frame':(.205,.052,.027), 'lattice':(.103,.192,.127),
        'foot':(.36,.34,.29), 'dark':(.022,.037,.027), 'juniper':(.085,.27,.139),
        'azure':(.039,.153,.135), 'ochre':(.45,.223,.068), 'ivory':(.63,.58,.40), 'red-dot':(.52,.102,.043), 'parapet':(.52,.51,.47),
        'rafter':(.26,.145,.083), 'eave':(.058,.092,.071), 'ridge':(.09,.094,.093),
        'tile-cap':(.112,.115,.117), 'tile0':(.098,.101,.101), 'tile1':(.109,.110,.108),
        'tile2':(.119,.118,.115), 'plaque-back':(.014,.012,.01), 'gilt':(.83,.546,.091),
    }
    return {k:material('Gwanghwamun finish / '+k,v,.67 if k.startswith('tile') else .53,.22 if k=='gilt' else 0) for k,v in palette.items()}


def main():
    parser=argparse.ArgumentParser()
    parser.add_argument('--gltfpack',type=Path,required=True)
    args=parser.parse_args(sys.argv[sys.argv.index('--')+1:])
    bpy.ops.wm.open_mainfile(filepath=str(SOURCE),load_ui=False)
    old=bpy.data.collections['03 Gwanghwamun Woldae and northern plaza']
    keep=[o for o in old.objects if not o.name.startswith(('Gwanghwamun / two timber halls','Woldae plaque'))]
    scene=bpy.context.scene
    gate=collection('Gwanghwamun / gatehouse, existing stone base and ground',scene)
    for o in keep:
        gate.objects.link(o)
    for c in list(scene.collection.children):
        if c!=gate: scene.collection.children.unlink(c)
    m=finishes()
    timber(gate,m,'Lower pavilion',13.52,5.97,7.54,10.54,False)
    low_parapet(gate,m)
    roof(gate,m,'Lower pavilion',17.15,8.55,11.20,1.75,10.59,.60)
    # The second floor starts inside the first roof, not on a second floating slab.
    timber(gate,m,'Upper pavilion',11.13,4.73,12.29,15.52,True)
    roof(gate,m,'Upper pavilion',14.75,7.00,16.23,3.43,8.62,.64)
    sign(gate,m,-5.71)
    bpy.context.view_layer.update()
    bpy.context.preferences.filepaths.save_version=0
    bpy.ops.wm.save_as_mainfile(filepath=str(TARGET),compress=True)
    evidence=export(gate,OUTPUT,None)
    raw=MODEL/OUTPUT
    packed=raw.with_suffix('.packed.glb')
    # The north chunk spans 199 m; keep thin joinery at world coordinates with 16-bit float quantization.
    subprocess.run([str(args.gltfpack),'-i',str(raw),'-o',str(packed),'-cc','-kn','-vtf','-vpf','-vp','16'],check=True)
    packed.replace(raw)
    evidence.update(bytes=raw.stat().st_size, objects=len(glb_json(raw)['nodes']),
                    sha256=sha256(raw.read_bytes()).hexdigest())
    (MODEL/'gwanghwamun-pavilion-evidence.json').write_text(json.dumps(evidence,indent=2)+'\n')
    print('GATEHOUSE',json.dumps(evidence))


if __name__=='__main__':
    main()
