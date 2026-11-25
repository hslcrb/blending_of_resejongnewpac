"""Generate editable Blender components and the website's public-axis GLBs.

blender -b --factory-startup --disable-autoexec -t 4 --python-exit-code 1 \
    -P scripts/build_public_axis.py -- --source path/to/sejong_survey_colonnade_refined.blend
Only named public ground and Freedom Hall entry meshes are read from the source.
"""
from __future__ import annotations
import argparse
from collections import defaultdict
import hashlib
import json
from math import cos, pi, sin
from pathlib import Path
import struct
import sys
from tempfile import TemporaryDirectory

import bpy
import numpy as np
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[1]
MODEL = ROOT / "public/model/public-axis-20261125"
BLEND = ROOT / "blender_work/20261125-public-axis/sejong_public_axis_components.blend"
ORIGINAL = ROOT / "blender_work/20261115-survey/sejong_survey_colonnade_refined.blend"
GROUND_NAMES = ("ground", "Surroundings - continuous plaza foundation")
PAVILION_NAMES = (
    "Pavilion - dark metal grid", "Pavilion - low stone plinth",
    "Pavilion - SEJONG S THEATER letters", "Pavilion - tinted glazing",
    "Pavilion - unlit garden uplights", "Pavilion - upper band and suggested entry",
)
THEATRE = {"minX": 28.9, "maxX": 36.5, "minY": 111.25, "maxY": 122.5,
           "doorMinY": 119.7, "doorMaxY": 121.65,
           "wellMinX": 30.15, "wellMaxX": 35.4, "wellMinY": 112.6,
           "wellMaxY": 119.15, "stairTopY": 118.6, "stairBottomY": 113.48,
           "top": .24, "bottom": -3.16, "steps": 20}
COUNTRIES = ("United States", "United Kingdom", "Australia", "Netherlands", "Canada",
             "France", "New Zealand", "Philippines", "Sweden", "Turkiye", "Thailand",
             "South Africa", "India", "Greece", "Belgium", "Luxembourg", "Denmark",
             "Ethiopia", "Colombia", "Norway", "Italy", "Germany", "Republic of Korea")
GATE_X, GATE_Y = 413.324, -72.957
IDENTITY = lambda p: p


class Batch:
    """Merge repeated parts by finish, while leaving named sculptures and floors editable."""
    def __init__(self, name, collection, transform=IDENTITY):
        self.name, self.collection, self.transform = name, collection, transform
        self.parts = defaultdict(lambda: ([], []))

    def shape(self, finish, points, faces):
        verts, polys = self.parts[finish]
        offset = len(verts)
        verts.extend(self.transform(v) for v in points)
        polys.extend(tuple(i + offset for i in face) for face in faces)

    def box(self, finish, x0, x1, y0, y1, z0, z1):
        self.shape(finish, [(x,y,z) for z in (z0,z1) for y in (y0,y1) for x in (x0,x1)],
                   [(0,2,3,1),(4,5,7,6),(0,1,5,4),(1,3,7,5),(3,2,6,7),(2,0,4,6)])

    def extrude_x(self, finish, x0, x1, outline):
        n = len(outline)
        self.shape(finish, [(x,y,z) for x in (x0,x1) for y,z in outline],
                   [tuple(reversed(range(n))),tuple(range(n,2*n))] +
                   [(i,(i+1)%n,(i+1)%n+n,i+n) for i in range(n)])

    def beam(self, finish, a, b, width, depth=None):
        p,q = Vector(a),Vector(b)
        ax = (q-p).normalized()
        transverse = ax.cross(Vector((0,0,1)))
        if transverse.length < 1e-7:
            transverse = ax.cross(Vector((1,0,0)))
        u = transverse.normalized()*width*.5
        v = ax.cross(u).normalized()*(depth if depth is not None else width)*.5
        self.shape(finish, [tuple(w+su*u+sv*v) for w in (p,q) for su,sv in ((-1,-1),(1,-1),(1,1),(-1,1))],
                   [(3,2,1,0),(4,5,6,7),(0,1,5,4),(1,2,6,5),(2,3,7,6),(3,0,4,7)])

    def finish(self):
        results = []
        for material,(verts,faces) in self.parts.items():
            mesh = bpy.data.meshes.new(self.name + " / " + material.name)
            mesh.from_pydata(verts, [], faces)
            mesh.update()
            uv = mesh.uv_layers.new(name="Surface in metres")
            scale = material.get("uvPeriod", 2.0)
            for poly in mesh.polygons:
                first = max(range(3), key=lambda i: abs(poly.normal[i]))
                u,v = [i for i in range(3) if i != first]
                for li in poly.loop_indices:
                    co = mesh.vertices[mesh.loops[li].vertex_index].co
                    uv.data[li].uv = (co[u]/scale, co[v]/scale)
            obj = bpy.data.objects.new(mesh.name,mesh)
            obj.data.materials.append(material)
            self.collection.objects.link(obj)
            results.append(obj)
        return results


def material(name, color, rough=.6, metal=0., alpha=1., emission=0., texture=None, period=2.):
    m = bpy.data.materials.new(name)
    m.diffuse_color = (*color,alpha)
    m.use_nodes = True
    m["uvPeriod"] = period
    p = m.node_tree.nodes.get("Principled BSDF")
    for key,val in {"Base Color":(*color,1),"Roughness":rough,"Metallic":metal,"Alpha":alpha,
                    "Emission Color":(*color,1),"Emission Strength":emission,"IOR":1.48}.items():
        p.inputs[key].default_value = val
    if alpha < 1:
        m.surface_render_method = 'BLENDED'
    if texture:
        t=m.node_tree.nodes.new("ShaderNodeTexImage")
        t.image=texture
        m.node_tree.links.new(t.outputs["Color"],p.inputs["Base Color"])
    return m


def grain(name, color, seed, folder, tiles=False):
    """Original small tileable albedo, never a photograph or a network asset."""
    size = 128
    r = np.random.default_rng(seed)
    y,x = np.mgrid[0:size,0:size] * (2*pi/size)
    large = np.sin(3*x+2*y)+.8*np.cos(5*x-3*y)+.45*np.sin(15*x+12*y)
    fine = np.clip(r.normal(0,.065,(size,size)),-.16,.16)
    fleck = np.where(r.random((size,size))>.97, .12, 0)
    val = .041*large + fine + fleck
    if tiles:
        val -= .21*((np.mod(np.arange(size),64)[:,None]<1)|(np.mod(np.arange(size),64)[None,:]<1))
    a = np.ones((size,size,4),dtype=np.float32)
    a[:,:,:3] = np.clip(np.array(color)[None,None,:]+val[:,:,None],0,1)**2.2
    img = bpy.data.images.new(name,width=size,height=size,alpha=False)
    img.pixels.foreach_set(a.ravel())
    img.filepath_raw=str(Path(folder)/(name+".jpg"))
    img.file_format="JPEG"
    img.save()
    img.pack()
    return img


def collection(name, scene):
    c=bpy.data.collections.new(name)
    scene.collection.children.link(c)
    return c


def glb_json(path):
    with path.open('rb') as stream:
        magic, version, length, size, tag = struct.unpack('<4sIII4s',stream.read(20))
        assert (magic,version,tag)==(b'glTF',2,b'JSON') and length==path.stat().st_size
        return json.loads(stream.read(size))


def export(c, filename, pack):
    bpy.ops.object.select_all(action='DESELECT')
    objs=list(c.objects)
    for obj in objs: obj.select_set(True)
    bpy.ops.export_scene.gltf(filepath=str(MODEL/filename), export_format='GLB', use_selection=True,
        export_texcoords=True, export_yup=True, export_animations=False, export_cameras=False, export_lights=False)
    coords=[obj.matrix_world @ Vector(p) for obj in objs for p in obj.bound_box]
    bounds={"min":[],"max":[]}
    for i, f in ((0,min),(1,max)):
        world=[(p.x,p.z,-p.y) for p in coords]
        bounds[("min","max")[i]] = [round(f(v[a] for v in world),4) for a in range(3)]
    path=MODEL/filename
    if pack and filename!="theatre.glb":
        import subprocess
        packed=MODEL/("packed-"+filename)
        subprocess.run([str(pack),"-i",str(path),"-o",str(packed),"-cc","-kn","-vtf"],check=True)
        packed.replace(path)
    data=glb_json(path)
    return {"url":"/model/public-axis-20261125/"+filename,"bytes":path.stat().st_size,
            "objects":len(data["nodes"]),"bounds":bounds,"sha256":hashlib.sha256(path.read_bytes()).hexdigest()}


def load_public_meshes(source, theatre, garden):
    garden_names=lambda n: n == "Watercourse pedestrian bridge at crossing" or n.startswith(("Freedom entrance ","Freedom entry ","Freedom stair ","Freedom Hall entrance "))
    with bpy.data.libraries.load(str(source),link=False) as (available,target):
        target.objects=[n for n in available.objects if n in GROUND_NAMES or garden_names(n)]
    found=set()
    for o in target.objects:
        if not o or o.type!='MESH':
            continue
        o.hide_render=False
        o.hide_viewport=False
        if o.name in GROUND_NAMES:
            theatre.objects.link(o)
            found.add(o.name)
            o.name="Axis ground replacement / "+o.name
        else:
            garden.objects.link(o)
    if found!=set(GROUND_NAMES):
        raise ValueError(f"Missing source ground: {set(GROUND_NAMES)-found}")


def theatre_model(c, mats):
    m=mats
    p=THEATRE; a,b,s,n=(p[k] for k in ("minX","maxX","minY","maxY"))
    w0,w1,ws,wn=(p[k] for k in ("wellMinX","wellMaxX","wellMinY","wellMaxY"))
    d0,d1=p["doorMinY"],p["doorMaxY"]
    for obj in tuple(c.objects):
        if not obj.name.startswith("Axis ground replacement"):
            continue
        # Carve both base meshes so the original z=0 surfaces cannot cover the treads.
        bpy.ops.mesh.primitive_cube_add(size=1,location=((w0+w1)/2,(ws+wn)/2,-.05))
        cutter=bpy.context.object
        cutter.dimensions=(w1-w0,wn-ws,4.0)
        bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
        # Overlapping boxes in the original foundation are separate closed islands.
        # Cut each island separately so the boolean resolver never drops a competing
        # shell or covers one of the original Haechi/Freedom voids.
        import bmesh
        bm=bmesh.new();bm.from_mesh(obj.data)
        left=set(bm.verts)
        srcmesh=bpy.data.meshes.new(obj.name+" reconstructed")
        combined=bmesh.new()
        while left:
            todo=[left.pop()];known=set(todo)
            while todo:
                for e in todo.pop().link_edges:
                    for other in e.verts:
                        if other in left:
                            left.remove(other);known.add(other);todo.append(other)
            bb=[[min(v.co[i] for v in known),max(v.co[i] for v in known)] for i in range(3)]
            piece=bmesh.new()
            mapping={v:piece.verts.new(v.co) for v in known}
            layer=bm.loops.layers.uv.active
            newuv=piece.loops.layers.uv.new() if layer else None
            for f in (f for f in bm.faces if f.verts[0] in known):
                face=piece.faces.new([mapping[v] for v in f.verts])
                face.material_index=f.material_index
                if layer:
                    for j,loop in enumerate(face.loops): loop[newuv].uv=f.loops[j][layer].uv
            if bb[0][0] < w1 and bb[0][1] > w0 and bb[1][0] < wn and bb[1][1] > ws:
                pm=bpy.data.meshes.new("Ground island")
                piece.to_mesh(pm)
                helper=bpy.data.objects.new("Ground island temporary",pm);c.objects.link(helper)
                helper.matrix_world=obj.matrix_world.copy()
                with bpy.context.temp_override(object=helper,active_object=helper):
                    mod=helper.modifiers.new("S Theatre public stair well","BOOLEAN")
                    mod.operation='DIFFERENCE'; mod.solver='EXACT';mod.object=cutter
                    bpy.ops.object.modifier_apply(modifier=mod.name)
                piece.clear();piece.from_mesh(helper.data)
                bpy.data.objects.remove(helper,do_unlink=True)
            # Copy each island through a temporary mesh to keep UVs in the combined mesh.
            tmp=bpy.data.meshes.new("Public ground island");piece.to_mesh(tmp)
            combined.from_mesh(tmp);bpy.data.meshes.remove(tmp);piece.free()
        combined.to_mesh(srcmesh);combined.free();bm.free()
        for mat in obj.data.materials: srcmesh.materials.append(mat)
        obj.data=srcmesh
        bpy.data.objects.remove(cutter,do_unlink=True)
    shell=Batch("S Theatre / frames, glass and accessible threshold",c)
    z0,z1=.24,5.95
    for x in (a,b):
        for y in (s,n):
            shell.box(m["steel"],x-.06,x+.06,y-.06,y+.06,.17,z1+.07)
    for y in (s,n):
        for i in range(6):
            x=a+(b-a)*i/5
            shell.box(m["steel"],x-.057,x+.057,y-.038,y+.038,z0,z1)
        for z in (z0,3.08,z1):
            shell.box(m["steel"],a,b,y-.055,y+.055,z-.045,z+.045)
        shell.box(m["glass"],a,b,y-.018,y+.018,z0+.035,z1-.04)
    for x in (a,b):
        for i in range(1,10):
            y=s+(n-s)*i/10
            bottom=3.1 if x==a and d0<y<d1 else z0
            shell.box(m["steel"],x-.043,x+.043,y-.052,y+.052,bottom,z1)
        for z in (3.08,z1):
            shell.box(m["steel"],x-.055,x+.055,s,n,z-.045,z+.045)
        for low,high in ([(s,d0),(d1,n)] if x==a else [(s,n)]):
            shell.box(m["glass"],x-.014,x+.014,low,high,z0+.03,3.03)
            shell.box(m["steel"],x-.045,x+.045,low,high,z0,z0+.043)
        shell.box(m["glass"],x-.014,x+.014,s,n,3.12,z1)
    for y in (d0,d1):
        shell.box(m["steel"],a-.07,a+.08,y-.07,y+.07,z0,3.12)
    shell.box(m["steel"],a-.6,a+.14,d0-.13,d1+.13,3.09,3.16)
    for i in range(9):
        x=a+(b-a)*i/8
        shell.box(m["steel"],x-.05,x+.05,s,n,z1-.05,z1+.055)
    for i in range(10):
        y=s+(n-s)*i/9
        shell.box(m["steel"],a,b,y-.05,y+.05,z1-.03,z1+.055)
        shell.box(m["inner"],a+.12,b-.12,y-.049,y+.049,z1-.29,z1-.125)
    shell.box(m["roofglass"],a,b,s,n,z1,z1+.024)
    shell.finish()

    interior=Batch("S Theatre / sunken stairs and stone floor",c)
    for x0,x1,y0,y1 in ((a,w0,s,n),(w1,b,s,n),(w0,w1,s,ws),(w0,w1,wn,n)):
        interior.box(m["floor"],x0,x1,y0,y1,-.04,p["top"])
    interior.box(m["floor"],a-.46,a, d0-.16,d1+.16,.0,.16)
    interior.box(m["wall"],w0,w0+.12,ws,wn,p["bottom"]-.12,p["top"])
    interior.box(m["wall"],w1-.12,w1,ws,wn,p["bottom"]-.12,p["top"])
    interior.box(m["wall"],w0,w1,ws,ws+.12,p["bottom"]-.12,p["top"])
    interior.box(m["floor"],w0,w1,ws,p["stairBottomY"],p["bottom"]-.22,p["bottom"])
    interior.box(m["floor"],w0,w1,p["stairTopY"],wn,.05,p["top"])
    step=(p["stairTopY"]-p["stairBottomY"])/p["steps"]
    for i in range(p["steps"]):
        y=p["stairTopY"]-i*step
        h=p["top"]-(p["top"]-p["bottom"])*(i+1)/p["steps"]
        interior.box(m["steps"],w0+.12,w1-.12,y-step,y,h-.176,h)
        interior.box(m["nosings"],w0+.12,w1-.12,y-step,y-step+.027,h,h+.006)
    for x in (w0,w1):
        interior.box(m["glass"],x-.018,x+.018,p["stairTopY"],wn,.23,1.28)
        for i in range(5):
            y=p["stairBottomY"]+(p["stairTopY"]-p["stairBottomY"])*i/4
            h=p["bottom"]+(p["top"]-p["bottom"])*i/4
            interior.box(m["polished"],x-.024,x+.024,y-.024,y+.024,h,h+.9)
        interior.beam(m["polished"],(x,p["stairBottomY"],p["bottom"]+.89),(x,p["stairTopY"],p["top"]+.89),.046)
        interior.box(m["polished"],x-.025,x+.025,ws,ws+.07,.25,1.12)
        interior.box(m["glass"],x-.02,x+.02,ws,p["stairTopY"],.25,1.13)
        interior.beam(m["polished"],(x,ws,1.13),(x,p["stairTopY"],1.13),.041)
    interior.box(m["glass"],w0,w1,ws-.018,ws+.018,.23,1.13)
    interior.beam(m["polished"],(w0,ws,1.13),(w1,ws,1.13),.041)
    interior.box(m["wall"],w0+.12,w1-.12,ws+.12,ws+.24,p["bottom"],.24)
    interior.box(m["tactile"],a+.12,w0-.11,d0+.09,d1-.09,.24,.255)
    interior.finish()


def garden_model(c,m):
    # Keep the existing opening and approach. Replace the installation's visible skins.
    for i,country in enumerate(COUNTRIES):
        x=63+2*i; curve=.14*(1-((i-11)/11)**2)
        y=-70.+curve
        b=Batch(f"Gratitude Light {i+1:02} / {country}",c)
        # Profile sampled through every stone course; no overlaid duplicate faces.
        outer=lambda h: y+.15-(.12*(h/6.25)**2)
        # Upright face with visible bed joints, following the photographed stone silhouette.
        for low,high in zip((.055,.88,1.94,3.08,4.22,5.32),(.88,1.94,3.08,4.22,5.32,6.25)):
            def inner(z):
                angle=np.arccos(np.clip(1-(z-.16)/5.6,0,1))
                return y-6.03+.51*max(0,(z-.048)/.112) if z<.16 else y-.12-5.4*(1-sin(angle)) if z<5.76 else y-.12
            za=low+.004 if low>.055 else low
            zb=high-.004 if high<6.25 else high
            poly=[(inner(za),za),(outer(za),za),(outer(zb),zb),(inner(zb),zb)]
            # Add intermediate samples to preserve the continuous concavity through the joint.
            samples=[(inner(z),z) for z in np.linspace(zb,za,9)[1:-1]]
            b.extrude_x(m["granite"],x-.27,x+.27,poly+samples)
        b.box(m["stone_dark"],x-.19,x+.19,y-.14,y+.07,.84,1.64)
        b.box(m["bronze"],x-.285,x-.267,y-.81,y-.39,.98,1.28)
        b.box(m["plaque"],x-.288,x-.283,y-.77,y-.43,1.018,1.24)
        b.box(m["warm"],x-.17,x+.17,y-.15,y+.11,6.235,6.25)
        b.finish()
    p=Batch("Freedom Hall / door head and illuminated handrail edge",c)
    p.box(m["stone_dark"],121.58,121.72,-65.25,-61.7,-.69,-.31)
    for y in (-65.18,-61.82):
        p.beam(m["warm"],(110.11,y,.955),(119.88,y,-2.34),.019)
    p.finish()


def gate_model(c,m):
    # Gate local x points east. Its southern face looks down the public plaza.
    gt=lambda p:(GATE_X+p[1],GATE_Y-p[0],p[2])
    p=Batch("Gwanghwamun / Woldae stair, royal path and stone rails",c,gt)
    stair_length=2.4
    for i in range(5):
        lo=-48.7+i*stair_length/5
        p.box(m["stone"],-14.85,14.85,lo,lo+stair_length/5,.03,.164*(i+1))
    p.box(m["granite"],-14.85,14.85,-46.3,-8.78,.03,.76)
    p.box(m["stone"],-14.72,14.72,-46.3,-8.65,.76,.82)
    p.box(m["stone_lite"],-3.5,3.5,-46.3,-8.55,.821,.85)
    for x in (-14.3,14.3):
        for i in range(15):
            y=-46+i*2.56
            p.box(m["stone"],x-.17,x+.17,y-.19,y+.19,.81,1.83)
            p.box(m["stone_lite"],x-.23,x+.23,y-.25,y+.25,1.72,1.86)
        p.box(m["stone"],x-.105,x+.105,-46,-10.15,1.52,1.65)
    for y in np.arange(-45.4,-8.8,2.6):
        for x0,x1 in ((-14.62,-3.55),(3.55,14.62)):
            p.box(m["joint"],x0,x1,y,y+.024,.820,.823)
    p.finish()

    wall=Batch("Gwanghwamun / three vaulted stone passages",c,gt)
    wall.box(m["granite"],-17,17,-8.9,8.4,5.05,7.55)
    for side in (-1,1):
        x=side*18
        wall.box(m["granite"],min(x,side*54),max(x,side*54),-2.3,2.3,0,4.24)
        wall.box(m["tile"],min(x,side*54),max(x,side*54),-2.5,2.5,4.24,4.54)
    opening=[(-10.3,1.62,2.73),(0,2.13,3.63),(10.3,1.62,2.73)]
    spans=[-17]+[x+v*w for x,w,_ in opening for v in (-1,1)]+[17]
    for l,r in zip(spans[::2],spans[1::2]):
        wall.box(m["granite"],l,r,-8.9,8.4,0,5.06)
    for x,width,spring in opening:
        crown=min(4.97,spring+width*.78)
        radius=crown-spring
        for i in range(19):
            t0=pi*i/19;t1=pi*(i+1)/19
            a=x-width*cos(t0);b=x-width*cos(t1)
            z0=spring+radius*sin(t0);z1=spring+radius*sin(t1)
            wall.shape(m["granite"],[(a,-8.9,z0),(b,-8.9,z1),(a,-8.9,5.06),(b,-8.9,5.06),
                        (a,8.4,z0),(b,8.4,z1),(a,8.4,5.06),(b,8.4,5.06)],
                       [(0,2,3,1),(4,5,7,6),(0,1,5,4),(2,6,7,3)])
            wall.beam(m["stone_lite"],(a,-8.94,z0+.075),(b,-8.94,z1+.075),.18)
    for z in (.94,1.82,2.71,3.6,4.48,5.35,6.26,7.13):
        for x in np.arange(-16.7,16.7,1.57):
            if z<5.07 and any(abs(x+.65-o)<w+.8 for o,w,_ in opening):
                continue
            wall.box(m["joint"],x,min(x+1.55,16.98),-8.925,-8.9,z,z+.012)
            wall.box(m["joint"],x,x+.015,-8.925,-8.9,z-.65,z)
    wall.finish()

    timber=Batch("Gwanghwamun / two timber halls with dancheong",c,gt)
    for level,(W,D,z,H) in enumerate(((15.3,6.55,7.49,3.77),(11.15,4.4,12.85,3.24))):
        timber.box(m["wood"],-W,W,-D,D,z,z+H)
        for y in (-D,D):
            for i in range(10):
                x=W*(i/4.5-1)
                timber.box(m["vermillion"],x-.11,x+.11,y-.13,y+.13,z,z+H)
                if i<9:
                    timber.box(m["lattice"],x+.19,x+2*W/9-.19,y-.087,y+.087,z+.56,z+H-.59)
                    for j in range(1,7):
                        xx=x+j*(2*W/9)/7
                        timber.box(m["teal"],xx-.028,xx+.028,y-.12,y+.12,z+.59,z+H-.6)
            for h,mat in ((z+.45,m["vermillion"]),(z+H-.43,m["teal"]),(z+H-.18,m["ochre"])):
                timber.box(mat,-W,W,y-.18,y+.18,h,h+.108)
            for x in np.linspace(-W+.18,W-.18,34):
                timber.box(m["teal"],x-.14,x+.14,y-.27,y+.27,z+H-.62,z+H-.23)
                timber.box(m["ochre"],x-.065,x+.065,y-.305,y+.305,z+H-.43,z+H-.29)
        for x in (-W,W):
            for y in np.linspace(-D,D,6):
                timber.box(m["vermillion"],x-.13,x+.13,y-.11,y+.11,z,z+H)
            timber.box(m["teal"],x-.16,x+.16,-D,D,z+H-.38,z+H-.16)
        # Hip-and-gable roof: curved eaves, narrower ridge, continuous slate skin.
        ww,dd,rise=W+2.55,D+2.45,2.47 if level==0 else 2.55
        top=z+H
        def ring(t,u,side):
            # side 0/2 are long eaves, 1/3 are hips.
            w=ww*(1-.29*t); d=dd*(1-t)
            lift=.66*(abs(2*u-1)**5)*(1-t)**2
            if side in (0,2): return ((2*u-1)*w,(-1 if side==0 else 1)*d,top+rise*t**1.67+lift)
            return ((1 if side==1 else -1)*w,(2*u-1)*d,top+rise*t**1.67+.66*(1-t)**2)
        for side in range(4):
            # Main skin is tessellated; slender eave/ridge seams are separate geometry.
            nt,nu=11,(28 if side%2==0 else 15)
            vs=[ring(t/nt,u/nu,side) for t in range(nt+1) for u in range(nu+1)]
            fs=[(i,i+1,i+nu+2,i+nu+1) for i in (t*(nu+1)+u for t in range(nt) for u in range(nu))]
            if side in (2,3):fs=[tuple(reversed(f)) for f in fs]
            timber.shape(m["tile"],vs,fs)
            def edge(t,u):
                x,y,z=ring(t,u,side)
                return(x,y,z+.045)
            for j in range(0,nu+1):
                for k in range(7):
                    timber.beam(m["tile_edge"],edge(k/7,j/nu),edge((k+1)/7,j/nu),.046 if side%2==0 else .035)
            for j in range(nu):
                timber.beam(m["tile_edge"],edge(0,j/nu),edge(0,(j+1)/nu),.155)
        timber.beam(m["tile_edge"],(-ww*.71,0,top+rise),(ww*.71,0,top+rise),.30)
    timber.box(m["sign"],-2.0,2.0,-4.56,-4.47,14.05,15.32)
    timber.finish()
    fontpath=next((p for p in (
        Path("/usr/share/fonts/opentype/noto/NotoSerifCJK-Bold.ttc"),
        Path("/System/Library/Fonts/Supplemental/Songti.ttc"),
        Path("C:/Windows/Fonts/mingliu.ttc"),
    ) if p.exists()),None)
    if fontpath:
        # A typeset approximation, not a copy of the historic brush lettering.
        font=bpy.data.fonts.load(str(fontpath))
        text=bpy.data.curves.new("Woldae plaque lettering",'FONT')
        text.body="門化光"; text.font=font; text.align_x='CENTER'
        text.size=1.1; text.extrude=.010; text.resolution_u=6
        inscription=bpy.data.objects.new("Woldae plaque / gold inscription",text)
        inscription.location=gt((0,-4.58,14.28))
        # Blender local x maps left-to-right when looking at the south facade.
        inscription.rotation_euler=(pi/2,0,-pi/2)
        c.objects.link(inscription)
        inscription.data.materials.append(m["ochre"])
        with bpy.context.temp_override(object=inscription,active_object=inscription,selected_editable_objects=[inscription]):
            inscription.select_set(True); bpy.ops.object.convert(target='MESH')
        inscription.select_set(False)
        bpy.data.fonts.remove(font)
    p=Batch("Gwanghwamun / northern square and front approach",c)
    # Stitch to the existing public paving at x=240, then turn into the gate axis.
    p.shape(m["floor"],[(239,-125,.032),(346,-112,.032),(346,-48,.032),(239,-62,.032)],[(0,1,2,3)])
    p.box(m["stone"],346,438,-145,-38,-.28,.019)
    p.box(m["asphalt"],346.5,361.5,-145,-37,.020,.043)
    for i in range(8):
        y=GATE_Y-5.9+i*1.62
        p.box(m["stripe"],346.65,361.35,y,y+.67,.043,.049)
    p.box(m["stone"],361.5,435,GATE_Y-54,GATE_Y+54,-.25,.03)
    p.box(m["green"],259,329,-66,-42,.032,.055)
    p.box(m["green"],263,316,-143,-124,.032,.055)
    p.finish()


def main():
    parser=argparse.ArgumentParser()
    parser.add_argument("--source",type=Path,default=ORIGINAL)
    parser.add_argument("--gltfpack",type=Path,help="Optional meshoptimizer gltfpack 0.25")
    a=parser.parse_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else [])
    for path in (MODEL,BLEND.parent): path.mkdir(parents=True,exist_ok=True)
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.context.preferences.filepaths.save_version=0
    scene=bpy.context.scene
    scene.name="20261125 · Public entrances & northern axis"
    theatre=collection("01 S Theatre public entrance and terrain replacement",scene)
    garden=collection("02 Garden of Gratitude and Freedom Hall entry",scene)
    gate=collection("03 Gwanghwamun Woldae and northern plaza",scene)
    source=a.source.resolve()
    load_public_meshes(source,theatre,garden)
    with TemporaryDirectory(prefix="sejong-axis-materials-") as tmp:
        def stone(name,c,seed,period=2.,tiles=False):
            return material(name,c,texture=grain(name,c,seed,tmp,tiles),period=period)
        m={
         "granite":stone("Granite fine salt and pepper",(.48,.50,.53),44,.48),
         "stone":stone("Warm pale cut stone",(.64,.61,.56),25,.74),
         "floor":stone("Hewn grey pavers",(.6,.61,.60),58,2.7,True),
         "steps":stone("Charcoal stair paving",(.28,.30,.31),82,.62),
         "wall":stone("S Theatre pale mineral wall",(.78,.77,.70),67,1.9),
         "tile":stone("Dark ink ceramic roof tiles",(.21,.25,.235),91,.44),
         "asphalt":stone("North road aggregate",(.31,.33,.34),79,.79),
         "steel":material("Dark anodized curtainwall",(.035,.047,.050),.35,.42),
         "inner":material("Light steel skylight framing",(.46,.53,.43),.39,.35),
         "glass":material("Neutral green clear glass",(.50,.71,.64),.12,.16,.19),
         "roofglass":material("Neutral roof glass",(.50,.68,.75),.14,.10,.24),
         "polished":material("Brushed stainless steel",(.48,.48,.44),.34,.60),
         "bronze":material("Brass markers",(.49,.29,.12),.39,.64),
         "plaque":material("Ochre plaques",(.61,.46,.22),.61,.3),
         "stone_dark":material("Inset unpolished stone",(.14,.15,.17),.68),
         "tactile":material("Ochre tactile threshold",(.8,.53,.1),.71),
         "warm":material("Warm light channels",(.98,.57,.27),.42,0.,1.,1.1),
         "nosings":material("Stair anti-slip nosing",(.33,.29,.22),.67),
         "stone_lite":material("Polished pale stone edge",(.65,.63,.56),.57),
         "joint":material("Recessed mineral seams",(.22,.23,.23),.85),
         "wood":material("Deep stained timber",(.14,.05,.033),.6),
         "vermillion":material("Dancheong muted red",(.35,.078,.054),.59),
         "teal":material("Dancheong pine green",(.075,.25,.17),.54),
         "ochre":material("Dancheong fine ochre",(.54,.32,.12),.56),
         "lattice":material("Dark wooden lattice",(.085,.12,.074),.69),
         "tile_edge":material("Roof ridge and roll tiles",(.074,.097,.085),.57),
         "sign":material("Gate inscription board",(.11,.076,.041),.55),
         "stripe":material("Crosswalk paint",(.79,.78,.74),.83),
         "green":stone("Yukjo lawn aggregate",(.29,.39,.19),97,1.9),
        }
        theatre_model(theatre,m)
        garden_model(garden,m)
        gate_model(gate,m)
        bpy.context.view_layer.update()
        bpy.ops.wm.save_as_mainfile(filepath=str(BLEND),compress=True)
        meta={
          "version":1,"sourceGitBlob":hashlib.sha1(("blob "+str(source.stat().st_size)+"\0").encode()+source.read_bytes()).hexdigest(),
          "theatre":export(theatre,"theatre.glb",a.gltfpack),
          "garden":export(garden,"gratitude.glb",a.gltfpack),
          "north":export(gate,"gwanghwamun.glb",a.gltfpack),
          "hideFromCore":[*GROUND_NAMES,*PAVILION_NAMES],
          "theatreLayout":THEATRE,
          "northAnchor":{"latitude":37.576044,"longitude":126.977019,"x":GATE_X,"z":-GATE_Y},
        }
        (MODEL/"build-evidence.json").write_text(json.dumps(meta,ensure_ascii=False,indent=2)+"\n")
        print(json.dumps(meta,ensure_ascii=False))


if __name__=="__main__":
    main()
