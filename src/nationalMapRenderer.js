import * as THREE from 'three';
import { createNationalMapSource, toSejongWorld, toSeoulWorld } from './nationalMapLayers.js';

// [좌표별 지도 조회 / Spatial inspection of map features]
// 도형 내부와 실제 선까지의 거리를 계산해 단순 경계 상자 오검출을 줄입니다.
// Measure against actual lines and polygon interiors, including holes.
const distance = (a,b) => Math.hypot(a[0]-b[0],a[1]-b[1]);
function segmentDistance(p,a,b) {
    const dx=b[0]-a[0],dy=b[1]-a[1],den=dx*dx+dy*dy;
    const t=den ? Math.max(0,Math.min(1,((p[0]-a[0])*dx+(p[1]-a[1])*dy)/den)) : 0;
    return Math.hypot(p[0]-(a[0]+t*dx),p[1]-(a[1]+t*dy));
}
function lineDistance(p,points) {
    if(!points.length)return Infinity;
    if(points.length===1)return distance(p,points[0]);
    let min=Infinity;for(let i=1;i<points.length;i++)min=Math.min(min,segmentDistance(p,points[i-1],points[i]));return min;
}
function insideRing(p,ring) {
    let inside=false;
    for(let i=0,j=ring.length-1;i<ring.length;j=i++) {
        const a=ring[i],b=ring[j];
        if((a[1]>p[1])!==(b[1]>p[1]) && p[0]<(b[0]-a[0])*(p[1]-a[1])/(b[1]-a[1])+a[0]) inside=!inside;
    }
    return inside;
}
function polygonHit(p,rings) {
    if(!rings.length)return {distance:Infinity,contains:false};
    const contains=insideRing(p,rings[0])&&!rings.slice(1).some(r=>insideRing(p,r));
    return {contains,distance:contains?0:Math.min(...rings.map(r=>lineDistance(p,r)))};
}
export function hitTestNationalFeature(feature,easting,northing) {
    const point=[easting,northing],g=feature?.geometry;if(!g)return {distance:Infinity,contains:false};
    const c=g.coordinates;
    switch(g.type) {
        case 'Point':return {distance:distance(point,c),contains:false};
        case 'MultiPoint':return {distance:Math.min(...c.map(x=>distance(point,x))),contains:false};
        case 'LineString':return {distance:lineDistance(point,c),contains:false};
        case 'MultiLineString':return {distance:Math.min(...c.map(x=>lineDistance(point,x))),contains:false};
        case 'Polygon':return polygonHit(point,c);
        case 'MultiPolygon': {const hits=c.map(x=>polygonHit(point,x));return {distance:Math.min(...hits.map(x=>x.distance)),contains:hits.some(x=>x.contains)};}
        default:return {distance:Infinity,contains:false};
    }
}
export function describeNationalFeature(feature) {
    const values=feature.properties?.fields || {};
    const label=['TEXTSTRING','사찰명','공항명','NPK_NM','RAILLINE_N','구분','소재지'].map(key=>values[key]).find(value=>value!==null&&value!==undefined&&String(value).trim()!=='');
    return {name:label===undefined ? feature.properties?.layer || '이름 미기재' : String(label),
        layer:feature.properties?.layer || '레이어 미기재',id:feature.id,
        anchorWgs84:feature.properties?.anchorWgs84 || null,
        fields:Object.entries(values).map(([name,value])=>({name,value:value===null||value===undefined||value===''?'미기재':String(value)}))};
}
const COLORS={temples:0xffc95a,'traditional-temples':0xffb64d,mountains:0x84c486,airports:0x71b5e6,ports:0x59c8e4,beaches:0x86d6e8,lighthouses:0xffc981,'national-parks':0x6bc17e,'national-border':0xf6ae98,'administrative-boundaries':0xf5d88b,'metro-boundaries':0xf5c167,coastlines:0x7dd7e2,watercourses:0x69b8ee,rail:0xcbb4ed,'express-rail':0xb999e5,graticule:0xcad8df};
const colorFor = id => COLORS[id] ?? 0xf1cc83;
const idOf = f => String(f.id || '').split(':')[0];
const pointFor = (mode,xy) => mode==='local' ? toSejongWorld(xy) : toSeoulWorld(xy);
const boxNear = (bbox,e,n,r) => bbox && bbox[0]<=e+r && bbox[2]>=e-r && bbox[1]<=n+r && bbox[3]>=n-r;
const worldToGeo = (mode,x,z) => mode==='local' ? [197897+z,552531+x] : [200000+x,550000-z];
// [카메라가 보는 지면 / Camera footprint on the ground]
// 수평선이 보이면 카메라 far까지 보수적으로 확장합니다.
// A horizon ray is conservatively extended to the camera's finite far plane.
export function groundBoundsFromCamera(camera,mode='seoul',height=2) {
    if(!camera||!['local','seoul'].includes(mode))throw new Error('카메라 좌표 모드가 올바르지 않습니다.');
    camera.updateMatrixWorld();const raycaster=new THREE.Raycaster(),limit=Math.min(Number.isFinite(camera.far)?camera.far:1000000,1000000);
    const coords=[];
    for(const x of [-1,0,1])for(const y of [-1,0,1]) {
        raycaster.setFromCamera(new THREE.Vector2(x,y),camera);
        const r=raycaster.ray,t=Math.abs(r.direction.y)>1e-9?(height-r.origin.y)/r.direction.y:-1;
        let point;
        if(t>=0&&t<=limit)point=r.at(t,new THREE.Vector3());
        else {const horizontal=new THREE.Vector2(r.direction.x,r.direction.z);if(horizontal.lengthSq())horizontal.normalize();point=new THREE.Vector3(r.origin.x+horizontal.x*limit,height,r.origin.z+horizontal.y*limit);}
        coords.push(worldToGeo(mode,point.x,point.z));
    }
    return [Math.min(...coords.map(c=>c[0])),Math.min(...coords.map(c=>c[1])),Math.max(...coords.map(c=>c[0])),Math.max(...coords.map(c=>c[1]))];
}

function addLine(target,points,mode,height) {
    for(let i=1;i<points.length;i++) {
        const a=pointFor(mode,points[i-1]),b=pointFor(mode,points[i]);
        target.push(a.x,height,a.z,b.x,height,b.z);
    }
}
function collectLines(target,g,mode,height) {
    const c=g.coordinates;
    if(g.type==='LineString')addLine(target,c,mode,height);
    else if(g.type==='MultiLineString'||g.type==='Polygon')c.forEach(x=>addLine(target,x,mode,height));
    else if(g.type==='MultiPolygon')c.forEach(poly=>poly.forEach(x=>addLine(target,x,mode,height)));
}
function freeObjects(group) {
    for(const child of [...group.children]) {group.remove(child);child.geometry?.dispose();if(Array.isArray(child.material))child.material.forEach(m=>m.dispose());else child.material?.dispose();}
}

// [지연 로딩 투사 / Lazy map projection]
// 보이는 범위만 요청하고 이전 요청·GPU 리소스·오버레이를 명시적으로 정리합니다.
// Load only visible bounds and dispose stale requests, GPU resources and the overlay.
export function createNationalMapRenderer({scene,camera,host=null,controls=null,source=null,draw=()=>{},onStatus=()=>{},onInspect=()=>{},height=2,maxLabels=25}={}) {
    const ownsSource=!source;source ||= createNationalMapSource();
    if(!scene||!camera)throw new Error('지도 장면과 카메라가 필요합니다.');
    const group=new THREE.Group();group.name='백지도 부가 레이어';scene.add(group);
    let destroyed=false,sequence=0,inspectSequence=0,request=null,inspectRequest=null,features=[],layerIds=[],mode='seoul',sight=false,refreshTimer=null;
    let overlay=null,ctx=null;
    if(host) {
        overlay=document.createElement('canvas');overlay.className='national-map-labels';overlay.setAttribute('aria-hidden','true');
        Object.assign(overlay.style,{position:'absolute',inset:'0',width:'100%',height:'100%',pointerEvents:'none'});
        host.appendChild(overlay);ctx=overlay.getContext('2d');
    }
    function clearGeometry(){freeObjects(group);features=[];if(ctx)ctx.clearRect(0,0,overlay.width,overlay.height);}
    function build(data) {
        const pointBuckets=new Map(),lineBuckets=new Map();
        for(const f of data) {
            const g=f.geometry;if(!g)continue;const id=idOf(f);
            if(g.type==='Point'||g.type==='MultiPoint') {
                const list=pointBuckets.get(id)||[];pointBuckets.set(id,list);
                const coords=g.type==='Point'?[g.coordinates]:g.coordinates;
                for(const xy of coords){const p=pointFor(mode,xy);list.push(p.x,height,p.z);}
            } else {const list=lineBuckets.get(id)||[];lineBuckets.set(id,list);collectLines(list,g,mode,height);}
        }
        for(const [id,items] of pointBuckets) if(items.length) {
            const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(items,3));
            const material=new THREE.PointsMaterial({color:colorFor(id),size:7,sizeAttenuation:false,depthTest:false,depthWrite:false});
            const points=new THREE.Points(geometry,material);points.name=`백지도 점 · ${id}`;points.renderOrder=800;group.add(points);
        }
        for(const [id,items] of lineBuckets) if(items.length) {
            const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(items,3));
            const material=new THREE.LineBasicMaterial({color:colorFor(id),transparent:true,opacity:.85,depthTest:false,depthWrite:false});
            const lines=new THREE.LineSegments(geometry,material);lines.name=`백지도 경계 · ${id}`;lines.renderOrder=750;group.add(lines);
        }
    }
    async function update({layers=[],bounds,mode:nextMode='seoul',sight:nextSight=false}={}) {
        if(destroyed)return false;
        if(!Array.isArray(layers))throw new Error('지도 레이어 형식이 올바르지 않습니다.');
        if(nextMode!=='local'&&nextMode!=='seoul')throw new Error('지도 좌표 모드가 올바르지 않습니다.');
        request?.abort();inspectRequest?.abort();const token=++sequence;inspectSequence++;
        request=new AbortController();const current=request;layerIds=[...new Set(layers)];mode=nextMode;sight=!!nextSight;
        clearGeometry();draw();
        if(!layerIds.length){onStatus({state:'idle',message:''});return true;}
        onStatus({state:'loading',message:'백지도 부가 레이어를 불러오고 있습니다.'});
        try {
            const queryBounds=bounds ?? groundBoundsFromCamera(camera,mode,height);
            const data=await source.query({layers:layerIds,bounds:queryBounds,signal:current.signal});
            if(destroyed||token!==sequence||current.signal.aborted)return false;
            features=data.filter(f=>f.geometry);build(features);onStatus({state:'ready',message:`백지도 원본 ${features.length.toLocaleString('ko-KR')}건 · 실제 상태와 다를 수 있음`});draw();return true;
        } catch(error) {
            if(destroyed||token!==sequence||current.signal.aborted)return false;
            clearGeometry();draw();onStatus({state:'error',message:'백지도 부가 자료를 불러오지 못했습니다. 다시 시도해 주세요.'});throw error;
        }
    }
    async function inspectAt({easting,northing,radius=100,signal}={}) {
        if(destroyed||!layerIds.length)return [];
        if(!Number.isFinite(easting)||!Number.isFinite(northing)||!Number.isFinite(radius)||radius<0)throw new Error('조회 위치가 올바르지 않습니다.');
        inspectRequest?.abort();const current=new AbortController();inspectRequest=current;const token=++inspectSequence,sourceToken=sequence;
        const cancel=()=>current.abort();if(signal?.aborted)cancel();else signal?.addEventListener('abort',cancel,{once:true});
        try {
            const data=await source.query({layers:layerIds,bounds:[easting-radius,northing-radius,easting+radius,northing+radius],signal:current.signal});
            if(destroyed||token!==inspectSequence||sourceToken!==sequence||current.signal.aborted)return null;
            const hits=[];
            for(const feature of data) {
                if(!boxNear(feature.bbox,easting,northing,radius))continue;
                const hit=hitTestNationalFeature(feature,easting,northing);
                if(hit.contains||hit.distance<=radius)hits.push({feature,...hit});
            }
            hits.sort((a,b)=>Number(b.contains)-Number(a.contains)||a.distance-b.distance);
            onInspect(hits);return hits;
        } catch(error) {
            if(destroyed||token!==inspectSequence||sourceToken!==sequence||current.signal.aborted)return null;
            onStatus({state:'error',message:'지도 위치의 원본 정보를 불러오지 못했습니다. 다시 선택해 주세요.'});throw error;
        } finally {signal?.removeEventListener('abort',cancel);}
    }
    function paint() {
        if(!ctx||destroyed)return;
        const w=host.clientWidth,h=host.clientHeight;
        if(overlay.width!==w||overlay.height!==h){overlay.width=w;overlay.height=h;}
        ctx.clearRect(0,0,w,h);if(!sight||!w||!h)return;
        const occupied=[];let labels=0;
        for(const f of features) {
            if(f.geometry.type!=='Point')continue;
            const p=pointFor(mode,f.geometry.coordinates),v=new THREE.Vector3(p.x,height,p.z).project(camera);
            if(v.z < -1 || v.z > 1 || Math.abs(v.x)>1 || Math.abs(v.y)>1)continue;
            if(labels>=maxLabels)break;
            const x=(v.x+1)*w/2,y=(1-v.y)*h/2,text=describeNationalFeature(f).name.slice(0,25);
            ctx.font='14px sans-serif';const width=Math.min(200,ctx.measureText(text).width+12),left=Math.max(0,Math.min(w-width,x+4)),top=Math.max(0,Math.min(h-24,y-24));
            if(occupied.some(r=>left<r.right+4&&left+width+4>r.left&&top<r.bottom+4&&top+28>r.top))continue;
            occupied.push({left,top,right:left+width,bottom:top+24});labels++;
            ctx.fillStyle='rgba(20,38,43,.88)';ctx.fillRect(left,top,width,24);ctx.fillStyle='#fff';ctx.fillText(text,left+6,top+17,188);
        }
    }
    const refresh=()=>update({layers:layerIds,mode,sight});
    const scheduleRefresh=()=>{clearTimeout(refreshTimer);refreshTimer=setTimeout(()=>void refresh().catch(()=>{}),250);};
    controls?.addEventListener('end',scheduleRefresh);
    return {update,refresh,inspectAt,paint,setSight(value){sight=!!value;paint();draw();},dispose(){if(destroyed)return;destroyed=true;sequence++;inspectSequence++;request?.abort();inspectRequest?.abort();clearTimeout(refreshTimer);controls?.removeEventListener('end',scheduleRefresh);clearGeometry();group.removeFromParent();overlay?.remove();if(ownsSource)source.clearCache();draw();}};
}
