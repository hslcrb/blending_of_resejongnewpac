"""Original modeled detail for the Sejong scene; no reference-photo pixels.

Executed by build_sejong.py inside Blender after the architectural shells exist.
The curated planting plan is based on the supplied frontal and oblique photos.
The lobby is an interpretation, because the references do not show its interior.
"""
import math
import random
from mathutils import Vector


class DetailMesh:
    def __init__(self):
        self.vertices = []
        self.faces = []

    def box(self, center, size):
        x, y, z = center
        sx, sy, sz = size
        start = len(self.vertices)
        self.vertices += [(x + a*sx/2, y + b*sy/2, z + c*sz/2)
                          for a, b, c in [(-1,-1,-1),(1,-1,-1),(1,1,-1),(-1,1,-1),
                                          (-1,-1,1),(1,-1,1),(1,1,1),(-1,1,1)]]
        self.faces += [tuple(start+i for i in face) for face in
                       [(0,3,2,1),(4,5,6,7),(0,1,5,4),(1,2,6,5),(2,3,7,6),(3,0,4,7)]]

    def branch(self, start, end, r0, r1, sides=7):
        a, z = Vector(start), Vector(end)
        axis = (z-a).normalized()
        u = axis.cross(Vector((0,0,1)))
        if u.length < .001:
            u = axis.cross(Vector((0,1,0)))
        u.normalize()
        v = axis.cross(u).normalized()
        n = len(self.vertices)
        for point, radius in ((a,r0),(z,r1)):
            for i in range(sides):
                angle = 2*math.pi*i/sides
                self.vertices.append(tuple(point+radius*(u*math.cos(angle)+v*math.sin(angle))))
        self.faces.append(tuple(n+i for i in reversed(range(sides))))
        self.faces.append(tuple(n+sides+i for i in range(sides)))
        self.faces += [(n+i,n+(i+1)%sides,n+sides+(i+1)%sides,n+sides+i) for i in range(sides)]

    def leaf(self, point, direction, length, width):
        center = Vector(point)
        axis = Vector(direction).normalized()
        side = axis.cross(Vector((0,0,1)))
        if side.length < .01:
            side = axis.cross(Vector((0,1,0)))
        side.normalize()
        # Five points form a small folded lanceolate leaf, rather than a green sphere.
        tip = center + axis*length*.52
        base = center - axis*length*.52
        left = center + side*width*.5
        right = center - side*width*.5
        ridge = center + Vector((0,0,.025))
        n = len(self.vertices)
        self.vertices += list(map(tuple,(base,left,tip,right,ridge)))
        self.faces += [(n,n+1,n+4),(n+1,n+2,n+4),(n+2,n+3,n+4),(n+3,n,n+4)]

    def finish(self, name, mat):
        mesh = bpy.data.meshes.new(name)
        mesh.from_pydata(self.vertices, [], self.faces)
        mesh.update()
        obj = bpy.data.objects.new(name, mesh)
        bpy.context.collection.objects.link(obj)
        obj.data.materials.append(mat)
        return obj


def detail_material(name, color, metallic=0, roughness=.8):
    return material(name, color, metallic, roughness)


soil = detail_material('Garden soil', (.19,.19,.13))
grass = detail_material('Garden groundcover', (.25,.37,.17))
curb = detail_material('Warm pale garden edging', (.63,.64,.60))
bark = detail_material('Tree bark', (.26,.22,.17), roughness=.95)
leaf_mats = [detail_material('Deciduous foliage %d' % i, color, roughness=.9) for i,color in enumerate([
    (.27,.43,.14),(.34,.51,.18),(.22,.36,.12),(.43,.56,.22)])]
wood = detail_material('Oiled timber', (.27,.16,.105), roughness=.72)
metal = detail_material('Dark bronze fittings', (.16,.17,.15), metallic=.48, roughness=.44)
interior = detail_material('Lobby warm limestone', (.72,.70,.64), roughness=.83)
light = detail_material('Lobby light diffuser', (.95,.88,.70), roughness=.55)

# Low raised, planted beds are deliberately placed rather than scattered.
beds = [(-61,-23,23,12), (14,-22,25,11), (58,-22,29,11)]
garden = DetailMesh()
edge = DetailMesh()
for x,y,w,d in beds:
    garden.box((x,y,.09),(w,d,.18))
    for yy in (y-d/2,y+d/2):
        edge.box((x,yy,.15),(w+.4,.22,.30))
    for xx in (x-w/2,x+w/2):
        edge.box((xx,y,.15),(.22,d,.30))
garden.finish('Curated garden beds', grass)
edge.finish('Garden stone edging', curb)

# An explicit site plan. Each tree's *shape* varies, but its position is fixed.
tree_positions = [(-69,-23,8.7),(-61,-20,9.3),(-53,-25,8.1),
                  (4,-20,8.3),(12,-24,9.2),(21,-20,8.9),
                  (46,-23,9.0),(54,-19,8.5),(62,-24,9.4),(70,-20,8.0)]
branches = DetailMesh()
leaves = [DetailMesh() for _ in leaf_mats]
for tree_id,(x,y,height) in enumerate(tree_positions):
    rng = random.Random(1309+tree_id*53)
    root = Vector((x,y,.18))
    stem_top = root+Vector((.2,-.12,height*.82))
    branches.branch(root, root+Vector((.03,-.02,height*.30)), .20,.145, 9)
    branches.branch(root+Vector((.03,-.02,height*.30)), stem_top, .145,.055, 8)
    for arm in range(9):
        angle=arm*2*math.pi/9+.15*(tree_id%3)
        radial=Vector((math.cos(angle),math.sin(angle),0))
        lateral=Vector((-math.sin(angle),math.cos(angle),0))
        start=root+Vector((.07,-.04,height*(.33+.045*(arm%5))))
        end=root+radial*(2.0+.18*(arm%4))+Vector((.15,-.08,height*(.64+.055*(arm%5))))
        branches.branch(start,end,.09,.024,6)
        for fork in range(3):
            end2=end+radial*(.28+.18*fork)+lateral*((fork-1)*.68)+Vector((0,0,.38+.18*fork))
            branches.branch(end,end2,.025,.009,5)
            for leaf_id in range(100):
                # Leaves fill the crown along the limbs, not only at twig tips.
                p=start.lerp(end2, rng.uniform(.40,1.0))
                p+=radial*rng.uniform(-.35,.55)+lateral*rng.uniform(-.52,.52)+Vector((0,0,rng.uniform(-.32,.60)))
                direction=(radial*rng.uniform(-1,1)+lateral*rng.uniform(-1,1)+Vector((0,0,rng.uniform(-.5,1))))
                leaves[(tree_id+arm+fork+leaf_id)%len(leaves)].leaf(p,direction,rng.uniform(.29,.48),rng.uniform(.14,.25))
branches.finish('Individual tree trunks and branching', bark)
for i,builder in enumerate(leaves):
    ob=builder.finish('Deciduous foliage %d' % i, leaf_mats[i])
    # Blender and glTF both render the small, double-sided foliage from either side.
    ob.data.materials[0].use_backface_culling=False

# Groundcover grows within the explicitly placed beds; low, varied foliage
# makes their edges read as planted gardens at walking height.
groundcover=[DetailMesh(),DetailMesh()]
for bed_id,(x,y,w,d) in enumerate(beds):
    rng=random.Random(602+bed_id)
    for row in range(4):
        for col in range(int(w/1.4)):
            px=x-w/2+.75+col*1.4+rng.uniform(-.18,.18)
            py=y-d/2+1.0+row*(d-2)/3+rng.uniform(-.18,.18)
            for j in range(24):
                angle=j*2*math.pi/24+rng.uniform(-.10,.10)
                radius=rng.uniform(.04,.42)
                base=Vector((px+math.cos(angle)*radius,py+math.sin(angle)*radius,.18+rng.uniform(.08,.22)))
                direction=Vector((math.cos(angle)*.6,math.sin(angle)*.6,rng.uniform(.35,1)))
                groundcover[(col+row+j)%2].leaf(base,direction,rng.uniform(.18,.38),rng.uniform(.08,.14))
for i,builder in enumerate(groundcover):
    builder.finish('Layered garden groundcover %d' % i,leaf_mats[i+1])

# Benches and lighting are aligned with the plaza, with visible feet and slats.
bench = DetailMesh()
fittings = DetailMesh()
for x,y in [(-55,-30),(-45,-30),(7,-29),(19,-29),(49,-29),(62,-29)]:
    for j in range(5):
        bench.box((x,y+(j-2)*.10,.56),(2.9,.075,.09))
    for xx in (x-1.05,x+1.05):
        fittings.box((xx,y,.29),(.11,.45,.54))
for x,y in [(-73,-31),(-35,-31),(0,-31),(35,-31),(75,-31)]:
    fittings.box((x,y,2.2),(.10,.10,4.4))
    fittings.box((x,y-.42,4.35),(.12,.9,.12))
    fittings.box((x,y-.8,4.28),(.20,.25,.12))
bench.finish('Plaza benches, wood slats', wood)
fittings.finish('Bench legs and plaza lights', metal)

# Simple lobby fittings and the two doors standing open against their jambs.
lobby = DetailMesh()
lobby_trim = DetailMesh()
for x in (facade_x(20.9),facade_x(23.1)):
    lobby_trim.box((x,-2.1,2.30),(.08,1.55,2.45))
    lobby_trim.box((x,-2.1,1.10),(.08,1.55,.08))
    lobby_trim.box((x,-2.1,3.50),(.08,1.55,.08))
for x in (17,48):
    lobby.box((x,7.7,1.62),(5.8,1.2,1.1))
    lobby_trim.box((x,7.7,2.19),(6.1,1.4,.12))
for x in (7,57):
    lobby.box((x,3.6,1.37),(4.3,.95,.60))
    lobby_trim.box((x,3.6,1.68),(4.4,1.0,.09))
for x in (9,21,33,45,57):
    lobby_trim.box((x,4,6.13),(2.0,.28,.05))
lobby.finish('Lobby benches and counters', interior)
lobby_trim.finish('Lobby open doors and fittings', metal)

ceiling_lights = DetailMesh()
for x in (9,21,33,45,57):
    ceiling_lights.box((x,4,6.09),(1.85,.22,.04))
ceiling_lights.finish('Lobby light strips', light)

# The exterior photos do not disclose the interior signage, so this is an
# expressly interpretive lobby sign, set from Korean font outlines in Blender.
font_path=r'C:\Windows\Fonts\malgun.ttf'
if os.path.exists(font_path):
    korean_font=bpy.data.fonts.load(font_path,check_existing=True)
    for text_value,z,size in [('세종문화회관',4.35,.82),('SEJONG CENTER',3.62,.30)]:
        lettering=bpy.data.curves.new('Lobby lettering','FONT')
        lettering.body=text_value
        lettering.font=korean_font
        lettering.align_x='CENTER'
        lettering.size=size
        lettering.extrude=.002
        text_obj=bpy.data.objects.new('Lobby lettering '+text_value,lettering)
        bpy.context.collection.objects.link(text_obj)
        text_obj.location=(33.1,11.36,z)
        text_obj.rotation_euler=(math.pi/2,0,0)
        text_obj.data.materials.append(metal)
        bpy.ops.object.select_all(action='DESELECT')
        text_obj.select_set(True)
        bpy.context.view_layer.objects.active=text_obj
        bpy.ops.object.convert(target='MESH')

# Original low reliefs modeled as shallow curved stone strokes; no source photo
# is sampled or projected onto the mesh. The obscured sculpture is interpretive.
relief_mat=detail_material('Carved pale stone', (.63,.64,.61), roughness=.95)
contours=[
 [(-.82,.03),(-.88,.24),(-.70,.47),(-.48,.59),(-.35,.84)],
 [(-.38,.84),(-.22,1.12),(-.02,1.30),(.22,1.35),(.38,1.22)],
 [(.38,1.22),(.50,1.02),(.39,.82),(.24,.71),(.19,.56)],
 [(.16,.54),(.44,.45),(.57,.25),(.58,.06),(.44,-.16)],
 [(-.46,.57),(-.28,.43),(-.24,.24),(-.42,.04),(-.59,-.22)],
 [(-.60,-.22),(-.61,-.49),(-.43,-.72),(-.13,-.82),(.15,-.76),(.34,-.60)],
 [(.44,-.16),(.30,-.34),(.13,-.49),(-.10,-.55),(-.35,-.48)],
 [(-.75,-.32),(-.77,-.57),(-.63,-.85),(-.34,-1.03),(.01,-1.10),(.41,-1.00)],
 [(-.31,.53),(-.13,.66),(.11,.71),(.28,.68)],
 [(-.51,.13),(-.30,.21),(-.12,.20),(.08,.12),(.22,-.02)],
 [(-.55,-.34),(-.31,-.30),(-.12,-.23),(.10,-.09)],
 [(-.28,-.70),(-.10,-.64),(.11,-.53),(.30,-.38)],
 [(-.25,1.04),(-.09,1.10),(.10,1.08),(.22,.99)],
 [(-.20,.91),(-.04,.87),(.12,.90)],
 [(-.90,-.76),(-.65,-1.07),(-.27,-1.23),(.18,-1.25),(.52,-1.10)],
]
for panel,center in enumerate((-2.2,46.2)):
    for index,points in enumerate(contours):
        curve=bpy.data.curves.new('Hand modeled relief line','CURVE')
        curve.dimensions='3D'
        curve.resolution_u=8
        curve.bevel_depth=.018 if index>7 else .032
        curve.bevel_resolution=2
        spline=curve.splines.new('BEZIER')
        spline.bezier_points.add(len(points)-1)
        for bp,(u,v) in zip(spline.bezier_points,points):
            if panel: u=-u
            bp.co=(facade_x(center+u*1.40),front-1.005,theatre_z(10.15+v*2.45))
            bp.handle_left_type='AUTO'
            bp.handle_right_type='AUTO'
        obj=bpy.data.objects.new('Original carved relief %d %02d' % (panel,index),curve)
        bpy.context.collection.objects.link(obj)
        obj.data.materials.append(relief_mat)
        bpy.ops.object.select_all(action='DESELECT')
        obj.select_set(True)
        bpy.context.view_layer.objects.active=obj
        bpy.ops.object.convert(target='MESH')

# Graphics are original SVG drawings rasterized to textures, not source photos.
def graphic_plane(name, filepath, left, right, y, bottom, top, emission=0):
    image=bpy.data.images.load(os.path.abspath(filepath),check_existing=True)
    image.pack()
    mesh=bpy.data.meshes.new(name)
    mesh.from_pydata([(left,y,bottom),(right,y,bottom),(right,y,top),(left,y,top)],[],[(0,1,2,3)])
    mesh.update()
    layer=mesh.uv_layers.new(name='Artwork UV')
    for face in mesh.polygons:
        for index in face.loop_indices:
            vertex=mesh.loops[index].vertex_index
            layer.data[index].uv=[(0,0),(1,0),(1,1),(0,1)][vertex]
    obj=bpy.data.objects.new(name,mesh)
    bpy.context.collection.objects.link(obj)
    mat=bpy.data.materials.new(name+' original vector artwork')
    mat.use_nodes=True
    shader=next(n for n in mat.node_tree.nodes if n.type=='BSDF_PRINCIPLED')
    texture=mat.node_tree.nodes.new('ShaderNodeTexImage')
    texture.image=image
    mat.node_tree.links.new(texture.outputs['Color'],shader.inputs['Base Color'])
    if emission:
        mat.node_tree.links.new(texture.outputs['Color'],shader.inputs['Emission Color'])
        shader.inputs['Emission Strength'].default_value=emission
    mesh.materials.append(mat)
    return obj

graphic_plane('Annex screen • original art','assets/graphics/annex-screen.png',
              facade_x(-43.12),facade_x(-34.88),-4.91,annex_z(4.48),annex_z(10.12),.18)
banner_left,banner_right=facade_x(-50.4),facade_x(-27.6)
banner_mid=(banner_left+banner_right)/2
for i,(left,right) in enumerate(((banner_left,banner_mid),(banner_mid,banner_right))):
    graphic_plane('Terrace banner %d • original art' % i,'assets/graphics/annex-banner.png',
                  left,right,-12.225,annex_z(2.95),annex_z(4.25))

# A subtly varied, packed paving texture remains visible at pedestrian scale.
random_texture=random.Random(8127)
paving=bpy.data.images.new('Original fine plaza paving',width=256,height=256,alpha=True)
pix=[]
for py in range(256):
    for px in range(256):
        grain=random_texture.gauss(0,.008)
        broad=.007*math.sin(px*2*math.pi/61)*math.sin(py*2*math.pi/97)
        v=grain+broad
        pix.extend((max(0,min(1,.59+v)),max(0,min(1,.61+v)),max(0,min(1,.60+v)),1))
paving.pixels[:]=pix
paving.pack()
ground_obj=bpy.data.objects['ground']
ground_uv=ground_obj.data.uv_layers.new(name='Plaza paving projection')
for face in ground_obj.data.polygons:
    for index in face.loop_indices:
        point=ground_obj.data.vertices[ground_obj.data.loops[index].vertex_index].co
        ground_uv.data[index].uv=(point.x/2,point.y/2)
ground_shader=next(n for n in mats['ground'].node_tree.nodes if n.type=='BSDF_PRINCIPLED')
ground_texture=mats['ground'].node_tree.nodes.new('ShaderNodeTexImage')
ground_texture.image=paving
mats['ground'].node_tree.links.new(ground_texture.outputs['Color'],ground_shader.inputs['Base Color'])
