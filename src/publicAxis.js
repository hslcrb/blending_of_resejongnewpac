// Blender metres use +X north, +Y west, +Z up. GLB maps (x,y,z) to (x,z,-y).
import axis from './publicAxisLayout.json' with { type: 'json' };

export const NORTH_AXIS_ID = 'gwanghwamun-north-axis';
const { theatre: t, north: n } = axis;

const toModelX = (x) => t.publicFace === 'north' ? t.minX + t.maxX - x : x;
const valid = (x,lo,hi)=>x>=lo&&x<=hi;
export function sTheatreHeight(x,z) {
    const y=-z;
    x=toModelX(x);
    if (!valid(x,t.minX,t.maxX)||!valid(y,t.minY,t.maxY)) return null;
    if (!valid(x,t.wellMinX,t.wellMaxX)||!valid(y,t.wellMinY,t.stairTopY)) return t.top;
    const count = Math.min(t.steps, 1 + Math.floor((t.stairTopY-y) * t.steps / (t.stairTopY-t.stairBottomY)));
    return t.top-(t.top-t.bottom)*count/t.steps;
}

export function sTheatreObstructed(x,z) {
    const y=-z;
    x=toModelX(x);
    const edge=.22;
    const at=(val,center)=>Math.abs(val-center)<=edge;
    if (valid(y,t.minY-edge,t.maxY+edge)) {
        if (at(x,t.maxX)) return true;
        if (at(x,t.minX) && !valid(y,t.doorMinY+edge,t.doorMaxY-edge)) return true;
    }
    if (valid(x,t.minX-edge,t.maxX+edge) && (at(y,t.minY)||at(y,t.maxY))) return true;
    // Open only where the floor joins the descent; glass rails keep users off the sides.
    if (valid(y,t.wellMinY-edge,t.stairTopY+edge) && (at(x,t.wellMinX)||at(x,t.wellMaxX))) return true;
    return valid(x,t.wellMinX-edge,t.wellMaxX+edge)&&at(y,t.wellMinY);
}

export function northAxisWalkable(x,z) {
    if (x > n.walkLimitX) return false;
    if (x < 346.5) {
        const k=Math.max(0,Math.min(1,(x-239)/107));
        return z>=62-14*k+.40 && z<=125-13*k-.40;
    }
    if (x < 361.5) return valid(z, n.z-5.75, n.z+6);
    if (!valid(z,n.z-29,n.z+29)) return false;
    // Stop at the gate sill rather than claiming the palace is walkable.
    if (x >= n.x-48.7 && x <= n.x-8.6 && Math.abs(z-n.z)>14.0) return false;
    return true;
}

export function northAxisHeight(x,z) {
    if(x<239||!northAxisWalkable(x,z)) return null;
    const stepDist=x-(n.x-48.7);
    if(Math.abs(z-n.z)>14.85||stepDist<0) return x>=346.5&&x<361.5?.049:.032;
    if(stepDist<2.4) return .164*(Math.floor(stepDist/.48)+1);
    if(x<=n.walkLimitX) return Math.abs(z-n.z)<=3.5?.85:.82;
    return null;
}

// Validate all replacements first. Do not remove old meshes if any target or new part is missing.
export function installSTheatrePatch(base, replacement, names) {
    if (!Array.isArray(names)||names.length!==8||new Set(names).size!==8) throw new Error('Invalid S Theatre replacement names');
    if (!base?.isObject3D || !replacement?.isObject3D || replacement.parent) throw new Error('Invalid S Theatre replacement scene');
    const selected = new Map();
    const targets = new Set(names);
    base.traverse(object=>{
        const name=object.userData.name||object.name;
        if(!targets.has(name))return;
        if(selected.has(name))throw new Error('Ambiguous S Theatre original');
        selected.set(name,object);
    });
    if(selected.size!==names.length)throw new Error('Incomplete S Theatre originals');
    const distinct=new Set();
    let floors=0;
    for(const obj of replacement.children){
        const name=(obj.userData.name||obj.name);
        if(distinct.has(name)||!obj.isMesh||!obj.geometry?.attributes.position)throw new Error('Invalid S Theatre mesh');
        distinct.add(name);
        if(name.startsWith('Axis ground replacement'))floors++;
    }
    if(floors!==2||distinct.size<10)throw new Error('Incomplete stairs and grounds');
    for(const target of selected.values())target.visible=false;
    base.add(replacement);
}

// This legacy interior lived in a separate streamed chunk, not in the base core.
const LEGACY_INTERIOR = new Set([
    'DAY interpretive open glass door','DAY pavilion inner door frame',
    'DAY pavilion inner structural columns','DAY pavilion interior back wall',
    'DAY pavilion interior floor','DAY pavilion interior low seating',
    'DAY pavilion internal counter','DAY pavilion internal counter top',
    'DAY pavilion original art graphic marks','DAY pavilion rear partition and opening',
    'DAY pavilion temporary original art board',
]);
export function hideOldPavilionInterior(root) {
    root.traverse(o=>{
        if(LEGACY_INTERIOR.has(o.userData.name||o.name)) o.visible=false;
    });
}

export function publicAxisWalkStart(name, available) {
    if (name === 's-theatre' && available?.theatre)
        return { x:toModelX(t.minX-2.2),
            z:-(t.doorMinY+t.doorMaxY)/2, yaw:t.publicFace === 'north' ? Math.PI/2 : -Math.PI/2 };
    if (name === 'north-axis' && available?.north)
        return { x:343, z:n.z, yaw:-Math.PI/2 };
    return null;
}
