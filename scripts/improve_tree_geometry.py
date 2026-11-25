"""Improve the five shared tree meshes in a copied scene, without rebuilding architecture.

Run in Blender 5.2 background mode with a COPY of the 20261103 aerial work file.
The trunk, twigs and petioles meet at their endpoints; every leaf starts at a petiole.
"""
import bpy, math, random, re, json, os
from pathlib import Path
from mathutils import Vector

expected=(Path.cwd()/"blender_work/20261104/sejong_trees_connected_20261104.blend").resolve()
assert Path(bpy.data.filepath).resolve()==expected, "Run on the dedicated tree copy only"

class MeshBuilder:
    def __init__(self):
        self.v, self.f = [], []
    def branch(self, a, b, ra, rb, sides=5):
        a, b = Vector(a), Vector(b)
        axis = (b-a).normalized()
        u = axis.cross(Vector((0,0,1)))
        if u.length < .0001: u = axis.cross(Vector((0,1,0)))
        u.normalize(); v = axis.cross(u).normalized(); n = len(self.v)
        for p, radius in ((a,ra),(b,rb)):
            for i in range(sides):
                angle=2*math.pi*i/sides
                self.v.append(tuple(p + radius*(u*math.cos(angle)+v*math.sin(angle))))
        self.f.extend([(n+i,n+(i+1)%sides,n+sides+(i+1)%sides,n+sides+i) for i in range(sides)])
        self.f.append(tuple(n+i for i in reversed(range(sides))))
        self.f.append(tuple(n+sides+i for i in range(sides)))
    def leaf(self, base, direction, length, width):
        # Rounded sides at five stations, tapered at both base and tip.
        base, axis=Vector(base),Vector(direction).normalized()
        side=axis.cross(Vector((0,0,1)))
        if side.length < .0001: side=axis.cross(Vector((0,1,0)))
        side.normalize(); normal=side.cross(axis).normalized()
        points=[base]
        levels=(.12,.28,.50,.72,.90)
        for t in levels: points.append(base+axis*(length*t)+side*(width*.5*math.sin(math.pi*t)**.8))
        points.append(base+axis*length)
        for t in reversed(levels): points.append(base+axis*(length*t)-side*(width*.5*math.sin(math.pi*t)**.8))
        n=len(self.v); self.v.extend(tuple(p) for p in points)
        self.v.append(tuple(base+axis*(length*.50)+normal*(width*.09)))
        self.f.extend((n+i,n+(i+1)%12,n+12) for i in range(12))
    def replace(self, mesh):
        mesh.clear_geometry(); mesh.from_pydata(self.v,[],self.f); mesh.polygons.foreach_set("use_smooth", [True]*len(mesh.polygons)); mesh.update()

def build_tree(template):
    r=random.Random(1309+template*53); wood=MeshBuilder(); leaves=[MeshBuilder() for _ in range(4)]
    trunk0=Vector((0,0,0)); trunk_mid=Vector((.03,-.02,3)); trunk_top=Vector((.2,-.12,8.2))
    wood.branch(trunk0,trunk_mid,.20,.145,9); wood.branch(trunk_mid,trunk_top,.145,.055,8)
    counts={'arms':0,'forks':0,'twigs':0,'leaves':0}
    for arm in range(9):
        angle=arm*2*math.pi/9+.15*(template%3)+r.uniform(-.12,.12)
        radial=Vector((math.cos(angle),math.sin(angle),0)); lateral=Vector((-math.sin(angle),math.cos(angle),0))
        z=3.3+.45*(arm%5); start=trunk_mid.lerp(trunk_top,(z-3)/5.2)
        end=radial*(2.25+.18*(arm%4))+Vector((.15,-.08,6.4+.55*(arm%5)))
        elbow=start.lerp(end,.48)+lateral*r.uniform(-.25,.25)+Vector((0,0,.18))
        wood.branch(start,elbow,.09,.056,6); wood.branch(elbow,end,.056,.024,6); counts['arms']+=1
        for fork in range(3):
            end2=end+radial*(.28+.18*fork)+lateral*((fork-1)*.68)+Vector((0,0,.38+.18*fork))
            wood.branch(end,end2,.025,.012,5); counts['forks']+=1
            for twig in range(14):
                origin = (elbow.lerp(end, .12 + .82*(twig+.5)/7) if twig < 7
                          else end.lerp(end2, .12 + .82*(twig-7+.5)/7))
                angle2=2*math.pi*(twig*.61803398875+r.random()*.15)
                direction=(radial*math.cos(angle2)+lateral*math.sin(angle2)+Vector((0,0,r.uniform(-.15,.5)))).normalized()
                tip=origin+direction*r.uniform(.48,.95)+Vector((0,0,r.uniform(-.15,.25)))
                wood.branch(origin,tip,.012,.0045,5); counts['twigs']+=1
                for leaf in range(6):
                    angle3=leaf*2*math.pi/6+r.uniform(-.15,.15)
                    leafdir=(radial*math.cos(angle3)+lateral*math.sin(angle3)+Vector((0,0,r.uniform(-.35,.08)))).normalized()
                    base=tip+leafdir*r.uniform(.035,.07)
                    wood.branch(tip,base,.0045,.0018,4)
                    leaves[(template+arm+fork+twig+leaf)%4].leaf(base,leafdir,r.uniform(.27,.40),r.uniform(.12,.19))
                    counts['leaves']+=1
    return wood, leaves, counts

pattern=re.compile(r'^Tree (trunk (\d)|foliage (\d) shade (\d))(?:\.\d+)?$')
meshes={}
for mesh in bpy.data.meshes:
    m=pattern.match(mesh.name)
    if m:
        key=('trunk',int(m.group(2)),0) if m.group(2) else ('foliage',int(m.group(3)),int(m.group(4)))
        meshes.setdefault(key,[]).append(mesh)
assert len(meshes)==25, ('unexpected prototypes', sorted(meshes))
report={}
for t in range(5):
    wood, leaves, counts=build_tree(t); report[t]=counts
    for mesh in meshes['trunk',t,0]: wood.replace(mesh)
    for shade in range(4):
        for mesh in meshes['foliage',t,shade]: leaves[shade].replace(mesh)

assert all(v['leaves']==2268 and v['twigs']==378 for v in report.values())
bpy.context.scene['tree_geometry_20261104']='Rounded pointed leaves; each leaf connected through a tapered petiole and twig to the trunk.'
bpy.ops.wm.save_as_mainfile(filepath=bpy.data.filepath)
print('TREE_REPORT',json.dumps(report))
