"""Read binary accessors to check localized color, geometry and the original texture."""

from collections import Counter
import json
import math
from pathlib import Path
import struct
import sys

FULL = 65535
CENTRES = [-27.4434261322 + i * 8.3280639648 for i in range(7)]
CY = 108.6733322144
EXPECTED = {
    "stone",
    "Rear columns - beveled stone joints and foot",
    "Rear columns - vertical stone panel joints",
    "Rear colonnade - linear ceiling and access panels",
}

def load(path):
    data=Path(path).read_bytes()
    assert struct.unpack_from("<4sII",data)==(b"glTF",2,len(data))
    n,t=struct.unpack_from("<I4s",data,12)
    assert t==b"JSON" and data[24+n:28+n]==b"BIN\0"
    return json.loads(data[20:20+n]),data[28+n:]


def rows(g,b,i):
    a=g["accessors"][i]
    v=g["bufferViews"][a["bufferView"]]
    n={"SCALAR":1,"VEC2":2,"VEC3":3,"VEC4":4}[a["type"]]
    fmt="<"+{5121:"B",5123:"H",5125:"I",5126:"f"}[a["componentType"]]*n
    base=v.get("byteOffset",0)+a.get("byteOffset",0)
    stride=v.get("byteStride",struct.calcsize(fmt))
    return [struct.unpack_from(fmt,b,base+i*stride) for i in range(a["count"])]


def meshmap(g):
    assert len(g["scenes"])==1
    nodes={n["name"]:n for n in g["nodes"] if "mesh" in n}
    assert set(nodes)==EXPECTED and len(g["nodes"])==4
    assert all(set(x)=={"mesh","name"} for x in nodes.values()),nodes
    return {name:g["meshes"][node["mesh"]]["primitives"] for name,node in nodes.items()}


def column(p):
    for i,cx in enumerate(CENTRES):
        x,y=abs(p[0]-cx),abs(-p[2]-CY)
        if x<=.721 and y<=.966 and x+y<=1.306:
            return i
    return None


def triangles(g,b,primitive,ignoreshaft):
    a=primitive["attributes"]
    pos=rows(g,b,a["POSITION"])
    idx=rows(g,b,primitive["indices"])
    key=lambda i:tuple(round(x,4) for x in pos[i])
    result=Counter()
    for n in range(0,len(idx),3):
        t=[pos[idx[n+j][0]] for j in range(3)]
        col={column(p) for p in t}
        if ignoreshaft and len(col)==1 and None not in col and max(p[1] for p in t)>0.01 and all(
            min(abs(p[1]-z) for z in (0,.33,.74,1.08,6.94))<.012 for p in t
        ):
            continue
        result[tuple(sorted(key(idx[n+j][0]) for j in range(3)))]+=1
    return result


def embedded_image(g,b):
    i=g["images"][0]
    assert len(g["images"])==1 and len(g["textures"])==1
    assert "uri" not in i and "uri" not in g["buffers"][0]
    view=g["bufferViews"][i["bufferView"]]
    start=view.get("byteOffset",0)
    return b[start:start+view["byteLength"]]


def verify(base,output):
    before,b0=load(base)
    after,b1=load(output)
    ms0,ms1=meshmap(before),meshmap(after)
    assert embedded_image(before,b0)==embedded_image(after,b1),"Existing stone image changed"
    assert len(after["materials"])==len(before["materials"])==6
    total0=total1=0
    for name in sorted(EXPECTED):
        p0,p1=ms0[name],ms1[name]
        assert len(p0)==len(p1)
        for i,(q0,q1) in enumerate(zip(p0,p1)):
            total0+=before["accessors"][q0["indices"]]["count"]//3
            total1+=after["accessors"][q1["indices"]]["count"]//3
            t0=triangles(before,b0,q0,name=="stone")
            t1=triangles(after,b1,q1,name=="stone")
            assert t0==t1,(name,i,sum(t0.values()),sum(t1.values()),len(t0-t1),len(t1-t0))
            pbr0=before["materials"][q0["material"]]["pbrMetallicRoughness"]
            pbr1=after["materials"][q1["material"]]["pbrMetallicRoughness"]
            if name!="Rear columns - beveled stone joints and foot" or i!=1:
                assert pbr0==pbr1,(name,i)
            else:
                assert pbr1["baseColorFactor"][0]<pbr0["baseColorFactor"][0]
                assert pbr1["roughnessFactor"]<pbr0["roughnessFactor"]
    p=ms1["stone"][0]["attributes"]
    assert "COLOR_0" in p and "COLOR_1" not in p and "TEXCOORD_0" in p
    a=after["accessors"][p["COLOR_0"]]
    assert a["componentType"]==5123 and a["normalized"]
    pos=rows(after,b1,p["POSITION"])
    col=rows(after,b1,p["COLOR_0"])
    changed={}
    for position,rgba in zip(pos,col):
        assert all(math.isfinite(v) for v in position) and rgba[-1]==FULL
        if any(c!=FULL for c in rgba[:3]):
            idx=column(position)
            assert idx is not None and -.001<=position[1]<=1.081
            changed[idx]=changed.get(idx,0)+1
    assert set(changed)==set(range(7))
    assert Path(output).stat().st_size<850_000
    result={"meshNames":sorted(EXPECTED),"trianglesBefore":total0,"trianglesAfter":total1,
            "nonWhiteExportedVertices":sum(changed.values()),"nonWhitePerColumn":changed,
            "outsideShaftTrianglesPreserved":True,"textureBytesPreserved":True,
            "bytesBefore":Path(base).stat().st_size,"bytesAfter":Path(output).stat().st_size}
    print(json.dumps(result,ensure_ascii=False,indent=2))


if __name__=="__main__":
    verify(*sys.argv[1:])
