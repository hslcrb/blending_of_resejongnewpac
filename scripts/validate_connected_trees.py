"""Validate that every generated petiole and twig is supported by its parent."""
import bpy, math
from mathutils import Vector

def distance_to_segment(p,a,b):
    d=b-a; t=max(0,min(1,(p-a).dot(d)/d.length_squared)); return (p-(a+d*t)).length

def check(a,b,label):
    assert (a-b).length < .00003,(label,tuple(a),tuple(b))

def supported(p,a,b,label):
    d=distance_to_segment(p,a,b); assert d < .00003,(label,d)

for tree in range(5):
    bark=bpy.data.meshes[f'Tree trunk {tree}.006']; cursor=0
    def branch(sides):
        global cursor
        data=bark.vertices
        a=sum((data[cursor+i].co for i in range(sides)),Vector())/sides
        b=sum((data[cursor+sides+i].co for i in range(sides)),Vector())/sides
        cursor += 2*sides
        return a,b
    root,mid=branch(9); mid2,top=branch(8);check(mid,mid2,'trunk join')
    leaves=[bpy.data.meshes[f'Tree foliage {tree} shade {i}.006'] for i in range(4)]
    counts=[0]*4
    for arm in range(9):
        a,elbow=branch(6);supported(a,mid,top,'arm trunk');elbow2,end=branch(6);check(elbow,elbow2,'arm elbow')
        for fork in range(3):
            e,end2=branch(5);check(e,end,'fork')
            for twig in range(14):
                origin,tip=branch(5)
                supported(origin,elbow,end,'twig arm') if twig<7 else supported(origin,end,end2,'twig fork')
                for leaf in range(6):
                    start,base=branch(4);check(start,tip,'petiole twig')
                    shade=(tree+arm+fork+twig+leaf)%4
                    point=leaves[shade].vertices[counts[shade]*13].co
                    check(point,base,'leaf petiole');counts[shade]+=1
    assert cursor==len(bark.vertices), (tree,cursor,len(bark.vertices))
    assert all(counts[i]*13==len(leaves[i].vertices) for i in range(4)),counts
    print('VALID_TREE',tree,'twigs',378,'leaves',sum(counts),'supported',True)
