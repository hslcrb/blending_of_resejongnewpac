"""Place the existing theatre and lobby into the campus scene without remaking its seats.

Blender entry: append_campus_interior(scene, theatre_blend). Nothing is opened or
saved by this module. Caller owns the exterior cutout and final copy/export.
"""
from __future__ import annotations
import math
from pathlib import Path

SCALE=1.25
OFFSET=(33.1,1.07,-71.9)  # Three Y-up campus coordinates.
COLLECTION='CampusGrandTheatreInterior_20261105'
OWNER='sejong-campus-interior-20261105'
REQUIRED=('Grand_seat','Grand_seat_side','Grand_floor','Grand_floor_dark','Grand_wood','Grand_wood2','Grand_cream','Grand_black','Grand_steel','Grand_gold','Grand_pipe','Grand_light','Grand_carpet','GrandCurtain','GrandAcousticShell','GrandProjectionScreen')
LIGHT_NAMES=('객석 따뜻한 반사광','무대 조명','발코니 아래 반사광','위층 반사광','벽면 반사광 왼쪽','벽면 반사광 오른쪽','뒤편 안전 조명')

def to_campus(point):
    if len(point)!=3 or not all(math.isfinite(v) for v in point):raise ValueError('A finite Three-coordinate point is required')
    return tuple(OFFSET[i]+SCALE*point[i] for i in range(3))

def campus_bounds(minimum,maximum):
    return to_campus(minimum),to_campus(maximum)

def fit_backstage(point):
    """Fit the existing rear stage to the actual tall rear mass, retaining thickness."""
    x,y,z=point
    amount=max(0,min(1,(-z-9.0)/1.24));amount=amount*amount*(3-2*amount)
    fitted=-7.2+(x+15.2)*(22.2/30.4)
    return x+(fitted-x)*amount,y+(min(y,15.5)-y)*amount,z

def append_campus_interior(scene, theatre_blend):
    import bpy
    from mathutils import Matrix,Vector
    source=Path(theatre_blend).resolve()
    if not source.is_file() or source.suffix.lower()!='.blend':raise ValueError('Existing theatre Blender source is required')
    if COLLECTION in bpy.data.collections:raise ValueError('Integrated interior already exists; use a fresh exterior copy')
    collection=bpy.data.collections.new(COLLECTION);scene.collection.children.link(collection);collection['owner']=OWNER
    transform=Matrix.Translation((OFFSET[0],-OFFSET[2],OFFSET[1]))@Matrix.Scale(SCALE,4)
    loaded=[]
    missing=[name for name in REQUIRED if bpy.data.objects.get(name) is None]
    if missing:
        with bpy.data.libraries.load(str(source),link=False) as (available,wanted):
            names=[name for name in REQUIRED+LIGHT_NAMES if name in available.objects]
            if any(name not in names for name in REQUIRED):raise ValueError('Theatre source does not contain the existing stage and seat meshes')
            wanted.objects=names
        loaded=[obj for obj in wanted.objects if obj]
    sources={obj.name.split('.')[0]:obj for obj in loaded}
    for name in REQUIRED+LIGHT_NAMES:
        obj=sources.get(name) or bpy.data.objects.get(name)
        if obj is None:
            if name in REQUIRED:raise ValueError(f'Missing authored geometry: {name}')
            continue
        copy=obj.copy();copy.name='Campus_'+name;collection.objects.link(copy);copy.matrix_world=transform@obj.matrix_world
        if copy.type=='MESH' and name in ('Grand_black','Grand_floor','Grand_steel','Grand_gold'):
            copy.data=obj.data.copy()
            for vertex in copy.data.vertices:
                x,y,z=fit_backstage((vertex.co.x,vertex.co.z,-vertex.co.y))
                vertex.co=(x,-z,y)
            copy.data.update()

        copy['source_object']=name;copy['owner']=OWNER
        if copy.type=='LIGHT':copy.data=obj.data.copy();copy.data.energy*=SCALE*SCALE
    # The local lobby matches src/theatreLobby.js; only this addition is authored here.
    def material(name,color,rough=.7,metal=0,glass=False,emit=0):
        m=bpy.data.materials.new('CampusLobby '+name);m.use_nodes=True;m.diffuse_color=(*color,1)
        p=next(n for n in m.node_tree.nodes if n.type=='BSDF_PRINCIPLED');p.inputs['Base Color'].default_value=(*color,1);p.inputs['Roughness'].default_value=rough;p.inputs['Metallic'].default_value=metal
        if glass:p.inputs['Transmission Weight'].default_value=.86;p.inputs['IOR'].default_value=1.45
        if emit:p.inputs['Emission Color'].default_value=(*color,1);p.inputs['Emission Strength'].default_value=emit
        if name in ('Stone','Floor'):
            noise=m.node_tree.nodes.new('ShaderNodeTexNoise');noise.inputs['Scale'].default_value=2.5;noise.inputs['Detail'].default_value=3
            ramp=m.node_tree.nodes.new('ShaderNodeValToRGB');ramp.color_ramp.elements[0].color=(*(v*.74 for v in color),1);ramp.color_ramp.elements[1].color=(*(min(1,v*1.12) for v in color),1)
            m.node_tree.links.new(noise.outputs['Fac'],ramp.inputs['Fac']);m.node_tree.links.new(ramp.outputs['Color'],p.inputs['Base Color'])
        return m
    mats={'Stone':material('Stone',(.65,.56,.43)), 'Floor':material('Floor',(.61,.54,.43)), 'Ceiling':material('Ceiling',(.78,.66,.49)), 'Bronze':material('Bronze',(.48,.31,.13),.3,.72),'Dark':material('Dark',(.035,.026,.035)), 'Burgundy':material('Burgundy',(.12,.035,.07)), 'Glass':material('Glass',(.62,.73,.80),.12,0,True),'Red':material('Red',(.3,.025,.05),.95),'Light':material('Light',(.95,.78,.48),.4,emit=2)}
    meshes={name:{'v':[],'f':[]} for name in mats}
    def box(mat,x,y,z,w,h,d,angle=0):
        data=meshes[mat];base=len(data['v']);c=math.cos(angle);s=math.sin(angle)
        for sx,sy,sz in ((-1,-1,-1),(1,-1,-1),(1,1,-1),(-1,1,-1),(-1,-1,1),(1,-1,1),(1,1,1),(-1,1,1)):
            lx=sx*w/2;ly=sy*h/2;lz=sz*d/2
            # Rotation is Three X-axis; convert Three coordinates into Blender Z-up.
            py=y+c*ly-s*lz;pz=z+s*ly+c*lz
            data['v'].append((x+lx,-pz,py))
        # Conversion [x,y,z] -> [x,-z,y] has positive determinant.
        data['f'].extend(tuple(base+i for i in face) for face in ((0,3,2,1),(4,5,6,7),(0,1,5,4),(1,2,6,5),(2,3,7,6),(3,0,4,7)))
    box('Floor',0,-.12,45,31,.24,30)
    box('Floor',0,.98,33.5,6.8,.16,9.3,math.atan(1.96/9))
    box('Ceiling',0,11.35,45,31,.35,30)
    for x in (-15.4,15.4):box('Stone',x,5.5,45,.35,11,30)
    for x in (-9.5,9.5):box('Stone',x,5.5,30,12,11,.35)
    box('Bronze',0,7.1,30,7,1.3,.4)
    for x in (-3.7,3.7):box('Bronze',x,3.35,30,.32,6.7,.5)
    for x in (-11,-7,-3,3,7,11):
        box('Glass',x,3,59.9,3.8,6,.16);box('Bronze',x-1.9,3,59.8,.12,6,.16)
    box('Bronze',0,6.1,59.8,31,.28,.3)
    for sign in (-1,1):
        box('Stone',sign*11,3.85,45,9,.35,30);box('Burgundy',sign*6.45,3.65,45,.25,1.2,30)
        for y,h in ((4.25,.09),(5.05,.12),(4.22,.1)):box('Bronze',sign*6.4,y,45,.14,h,30)
        for i in range(76):box('Bronze',sign*6.4,4.64,30+i*.4,.055,.8,.055)
        for i in range(10):
            z=31.5+i*2.8;box('Dark',sign*15.15,7.1,z,.12,3.3,2.45);box('Bronze',sign*15.05,8.8,z,.1,.06,2.5)
        for z in (34,40,46,52,58):
            box('Stone',sign*10,5.65,z,1.35,11.3,1.35);box('Bronze',sign*10,.12,z,1.6,.24,1.6);box('Bronze',sign*10,10.85,z,1.62,.3,1.62)
        for i in range(12):box('Red',sign*13.2,.12+i*.3,58.4-i*.36,3,.24,.42)
        box('Bronze',sign*11.55,2.1,56.4,.1,.1,5)
    for i in range(73):box('Bronze',-6.42,7.3,30.5+i*.4,.045,4.3,.045)
    for i in range(11):box('Bronze',-6.42,5.2+i*.42,45,.04,.04,29)
    for i in range(15):
        z=31.5+i*2
        for x in (-4.5,4.5):box('Light',x,11.12,z,1.6,.08,.2)
    for name,data in meshes.items():
        if not data['v']:continue
        mesh=bpy.data.meshes.new('CampusLobby '+name);mesh.from_pydata(data['v'],[],data['f']);mesh.update()
        obj=bpy.data.objects.new('CampusLobby_'+name,mesh);collection.objects.link(obj);obj.data.materials.append(mats[name]);obj.matrix_world=transform;obj['owner']=OWNER
    for z in (32,38,44,50,56):
        data=bpy.data.lights.new('CampusLobby overhead','AREA');data.energy=1000*SCALE*SCALE;data.shape='DISK';data.size=5*SCALE;data.color=(1,.82,.63)
        obj=bpy.data.objects.new('CampusLobby overhead',data);collection.objects.link(obj);local=Matrix.Translation((0,-z,9));obj.matrix_world=transform@local;obj['owner']=OWNER
    # Remove only temporary unlinked library objects, retaining meshes used by the copies.
    for obj in loaded:
        if not obj.users_collection:bpy.data.objects.remove(obj)
    collection['scale']=SCALE;collection['campus_offset']=list(OFFSET);collection['seat_count']=1368
    collection['note']='Existing authored theatre geometry and web-equivalent lobby physically placed inside the campus exterior.'
    return collection


def export_local_theatre(collection,output):
    """Export only the reused/refitted theatre meshes in their original local coordinates."""
    import bpy,json,struct
    from mathutils import Matrix
    output=Path(output).resolve();output.parent.mkdir(parents=True,exist_ok=True)
    selected=list(bpy.context.selected_objects);active=bpy.context.view_layer.objects.active
    objects=[o for o in collection.objects if o.type=='MESH' and o.get('source_object') in REQUIRED]
    matrices={o:o.matrix_world.copy() for o in objects}
    bpy.ops.object.select_all(action='DESELECT')
    try:
        for obj in objects:obj.matrix_world=Matrix.Identity(4);obj.select_set(True)
        bpy.ops.export_scene.gltf(filepath=str(output),export_format='GLB',use_selection=True,use_active_scene=True,export_yup=True,export_apply=True)
    finally:
        for obj,matrix in matrices.items():obj.matrix_world=matrix;obj.select_set(False)
        for obj in selected:obj.select_set(True)
        bpy.context.view_layer.objects.active=active
    raw=output.read_bytes();chunks=[];cursor=12
    while cursor<len(raw):
        size,kind=struct.unpack_from('<II',raw,cursor);data=raw[cursor+8:cursor+8+size];cursor+=8+size
        if kind==0x4e4f534a:
            document=json.loads(data)
            for key in ('nodes','meshes'):
                for item in document.get(key,[]):
                    if item.get('name','').startswith('Campus_'):item['name']=item['name'][7:]
            data=json.dumps(document,ensure_ascii=False,separators=(',',':')).encode('utf-8');data+=b' '*((-len(data))%4)
        chunks.append(struct.pack('<II',len(data),kind)+data)
    body=b''.join(chunks);output.write_bytes(struct.pack('<4sII',b'glTF',2,12+len(body))+body)
    if output.stat().st_size>=25*1024*1024:raise ValueError('Theatre GLB exceeds the Pages asset limit')
    return output
