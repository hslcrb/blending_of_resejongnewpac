import * as THREE from 'three';
import {geoToWorld, worldToGeo, latLonTo5186, grid5186ToLatLon, lonLatToTile, tileToLonLat} from './mapProjection.js';

// [제공처와 출처 / Providers and attribution]
// 지도는 보이는 타일만 불러오고 브라우저의 HTTP 캐시를 따른다.
// Fetch only visible tiles and preserve the browser's HTTP cache behavior.
export const BASEMAP_PROVIDERS = Object.freeze({
    ground: {
        maxZoom: 18,
        url: (z, x, y) => `https://tile.openstreetmap.org/${z}/${x}/${y}.png`,
        attribution: '© OpenStreetMap contributors · https://www.openstreetmap.org/copyright',
    },
    satellite: {
        maxZoom: 14,
        url: (z, x, y) => `https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless_3857/default/g/${z}/${y}/${x}.jpg`,
        attribution: 'EOxCloudless https://cloudless.eox.at by EOX IT Services GmbH (Contains modified Copernicus Sentinel data 2016) · CC BY 4.0 https://creativecommons.org/licenses/by/4.0/ · 2016년 저해상도 합성 영상',
    },
});
const MAX_TILES = 24, MAX_CONCURRENT = 4, MIN_ZOOM = 3;

// [보이는 지면 / Visible ground footprint]
// 절두체의 12개 변과 지면의 교차로 화면에 들어오는 다각형을 구한다.
// Intersect the camera frustum's 12 edges with the ground plane.
export function groundFootprint(camera, height = 0) {
    camera.updateMatrixWorld(true);
    const vertices = [];
    for (const depth of [-1, 1]) for (const [x,y] of [[-1,-1],[1,-1],[1,1],[-1,1]])
        vertices.push(new THREE.Vector3(x,y,depth).unproject(camera));
    const edges = [[0,1],[1,2],[2,3],[3,0],[4,5],[5,6],[6,7],[7,4],[0,4],[1,5],[2,6],[3,7]];
    const points = [];
    const add = p => { if (!points.some(v => Math.hypot(v.x-p.x,v.z-p.z)<0.001)) points.push({x:p.x,z:p.z}); };
    for (const [a,b] of edges) {
        const p=vertices[a], q=vertices[b], da=p.y-height, db=q.y-height;
        if (Math.abs(da)<1e-8) add(p);
        if (Math.abs(db)<1e-8) add(q);
        if (da * db < 0) { const t = da / (da - db); add({x:p.x+t*(q.x-p.x),z:p.z+t*(q.z-p.z)}); }
    }
    if (points.length < 3) return [];
    const cx=points.reduce((s,p)=>s+p.x,0)/points.length, cz=points.reduce((s,p)=>s+p.z,0)/points.length;
    return points.sort((a,b)=>Math.atan2(a.z-cz,a.x-cx)-Math.atan2(b.z-cz,b.x-cx));
}

function clipPolygon(poly, axis, bound, keepGreater) {
    const out=[];
    for (let i=0;i<poly.length;i++) {
        const a=poly[i], b=poly[(i+1)%poly.length], av=a[axis], bv=b[axis];
        const ain=keepGreater ? av>=bound : av<=bound, bin=keepGreater ? bv>=bound : bv<=bound;
        if (ain) out.push(a);
        if (ain !== bin) {
            const t=(bound-av)/(bv-av);
            out.push({x:a.x+t*(b.x-a.x), y:a.y+t*(b.y-a.y)});
        }
    }
    return out;
}
function intersectsTile(polygon, x, y) {
    let p=polygon;
    for (const [axis,bound,greater] of [['x',x,true],['x',x+1,false],['y',y,true],['y',y+1,false]]) {
        if (!p.length) return false;
        p=clipPolygon(p,axis,bound,greater);
    }
    return p.length >= 3;
}
function getVisibleTiles(footprint, mode, width, maxZoom) {
    const geo=footprint.map(({x,z})=>worldToGeo(mode,x,z));
    const longLat=geo.map(({easting,northing})=>grid5186ToLatLon(easting,northing));
    if (longLat.some(p=>!Number.isFinite(p.lon)||!Number.isFinite(p.lat)||p.lon < 120||p.lon > 135||p.lat < 30||p.lat > 43)) return [];
    const east=geo.map(p=>p.easting), north=geo.map(p=>p.northing);
    const metres=Math.max(Math.max(...east)-Math.min(...east),Math.max(...north)-Math.min(...north),1);
    const lat=longLat.reduce((v,p)=>v+p.lat,0)/longLat.length;
    const target=metres/Math.max(width,1);
    let zoom=Math.max(MIN_ZOOM,Math.min(maxZoom,Math.round(Math.log2(156543.033928 * Math.cos(lat*Math.PI/180)/target))));
    for (;zoom>=MIN_ZOOM;zoom--) {
        const poly=longLat.map(p=>lonLatToTile(p.lon,p.lat,zoom));
        const x1=Math.floor(Math.min(...poly.map(p=>p.x))), x2=Math.floor(Math.max(...poly.map(p=>p.x)));
        const y1=Math.floor(Math.min(...poly.map(p=>p.y))), y2=Math.floor(Math.max(...poly.map(p=>p.y)));
        if ((x2-x1+1)*(y2-y1+1)>MAX_TILES*4) continue;
        const result=[];
        for(let x=x1;x<=x2;x++) for(let y=y1;y<=y2;y++)
            if (x>=0 && y>=0 && x<2**zoom && y<2**zoom && intersectsTile(poly,x,y)) result.push({z:zoom,x,y});
        if (result.length<=MAX_TILES) return result;
    }
    return [];
}

function makeGeometry(tile, mode, height) {
    const vertices=[], uvs=[];
    for (const [dx,dy,u,v] of [[0,0,0,1],[1,0,1,1],[0,1,0,0],[1,1,1,0]]) {
        const ll=tileToLonLat(tile.x+dx,tile.y+dy,tile.z);
        const grid=latLonTo5186(ll.lon,ll.lat), world=geoToWorld(mode,grid.easting,grid.northing);
        vertices.push(world.x,height,world.z); uvs.push(u,v);
    }
    const geometry=new THREE.BufferGeometry();
    geometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));
    geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));
    geometry.setIndex([0,2,1,1,2,3]); geometry.computeVertexNormals();
    return geometry;
}
async function defaultLoadImage(url, signal) {
    const response=await fetch(url,{mode:'cors',signal,credentials:'omit'});
    if (!response.ok) throw new Error(`타일 요청 실패: ${response.status}`);
    // ImageBitmap ignores Texture.flipY; flip while decoding to match standard UVs.
    return createImageBitmap(await response.blob(),{imageOrientation:'flipY'});
}

// [타일 수명 / Tile lifecycle]
// 뷰 밖 요청을 중단하고 도형·텍스처를 즉시 해제한다.
// Abort offscreen requests and dispose geometry, materials, and textures.
export function createBasemapLayer({scene, attributionElement, onStatus=()=>{}, invalidate=()=>{}, loadImage=defaultLoadImage, height=0.02, providers=BASEMAP_PROVIDERS}) {
    if (!scene || !attributionElement) throw new Error('scene과 표시할 출처 요소가 필요합니다.');
    const group=new THREE.Group(); group.name='실제 지도 배경'; scene.add(group);
    const entries=new Map();
    let provider=null, mode='local', last=null, inflight=0, destroyed=false, lastStatus='', brightness=1;
    const report=()=>{const values=[...entries.values()];const status={provider,total:values.length,loaded:values.filter(e=>e.state==='ready').length,failed:values.filter(e=>e.state==='error').length};const key=JSON.stringify(status);if(key!==lastStatus){lastStatus=key;onStatus(status);}};
    const release=entry=>{
        entry.controller?.abort();
        if (entry.mesh) {group.remove(entry.mesh);entry.mesh.geometry.dispose();entry.mesh.material.map?.dispose();entry.mesh.material.dispose();entry.image?.close?.();}
    };
    const clear=()=>{for(const entry of entries.values()) release(entry);entries.clear();invalidate();};
    function pump() {
        if (destroyed || !provider) return;
        while(inflight<MAX_CONCURRENT) {
            const entry=[...entries.values()].find(e=>e.state==='queued');
            if (!entry) break;
            entry.state='loading'; entry.controller=new AbortController();inflight++;
            const source=providers[provider];
            Promise.resolve().then(()=>loadImage(source.url(entry.tile.z,entry.tile.x,entry.tile.y),entry.controller.signal)).then(image=>{
                if (destroyed || entry.controller.signal.aborted || entries.get(entry.key)!==entry) {image?.close?.();return;}
                const texture=new THREE.Texture(image); texture.colorSpace=THREE.SRGBColorSpace; texture.flipY=false; texture.needsUpdate=true;
                const material=new THREE.MeshBasicMaterial({map:texture,side:THREE.DoubleSide,toneMapped:false});material.color.setScalar(brightness);
                entry.image=image; entry.mesh=new THREE.Mesh(makeGeometry(entry.tile,mode,height),material);
                entry.mesh.name=`지도 타일 ${entry.key}`;group.add(entry.mesh);entry.state='ready'; invalidate();
            }).catch(error=>{
                if (!destroyed && !entry.controller.signal.aborted && entries.get(entry.key)===entry) {entry.state='error';entry.error=error;}
            }).finally(()=>{inflight--; if (!destroyed) {report();pump();}});
        }
        report();
    }
    function update(camera, viewport) {
        if (destroyed) return;
        if (!camera || !viewport || !Number.isFinite(viewport.width) || viewport.width<=0) return;
        const nextMode=viewport.mode || mode;
        if (nextMode !== 'local' && nextMode !== 'seoul') throw new Error('알 수 없는 지도 좌표계');
        if (nextMode!==mode) {mode=nextMode;clear();}
        last={camera,viewport:{...viewport,mode}};
        if (!provider) {clear();report();return;}
        const source=providers[provider], polygon=groundFootprint(camera,height);
        const tiles=polygon.length ? getVisibleTiles(polygon,mode,viewport.width,source.maxZoom) : [];
        const wanted=new Set(tiles.map(t=>`${t.z}/${t.x}/${t.y}`));
        let changed=false;
        for (const [key,entry] of entries) if (!wanted.has(key)) {release(entry);entries.delete(key);changed=true;}
        for (const tile of tiles) {
            const key=`${tile.z}/${tile.x}/${tile.y}`;
            if (!entries.has(key)) {entries.set(key,{key,tile,state:'queued'});changed=true;}
        }
        pump(); if(changed) invalidate();
    }
    function writeAttribution(text) {
        attributionElement.textContent=text;
        const doc=attributionElement.ownerDocument;
        if (!doc || typeof attributionElement.replaceChildren!=='function') return;
        const parts=text.split(/(https:\/\/[^\s]+)/g).map(part=>{
            if (!part.startsWith('https://')) return doc.createTextNode(part);
            const a=doc.createElement('a');a.href=part;a.textContent=part;a.target='_blank';a.rel='noopener noreferrer';return a;
        });
        attributionElement.replaceChildren(...parts);
    }
    function setProvider(next) {
        if (destroyed) return;
        if (next!==null && (!Object.hasOwn(providers,next) || typeof providers[next].url !== 'function' || !providers[next].attribution || !Number.isInteger(providers[next].maxZoom))) throw new Error('알 수 없거나 불완전한 지도 제공처');
        if (provider===next) return;
        clear();provider=next;attributionElement.hidden=!next;writeAttribution(next?providers[next].attribution:'');
        if(last) update(last.camera,last.viewport);else report();
    }
    function retry() {
        if (destroyed) return;
        for (const entry of entries.values()) if (entry.state==='error') {entry.state='queued';entry.error=null;}
        pump();
    }
    function setBrightness(value) {
        if (destroyed) return;
        if (!Number.isFinite(value)) throw new Error('밝기는 유한한 숫자여야 합니다.');
        const next=Math.max(0,Math.min(1,value));if(next===brightness)return;brightness=next;
        for(const entry of entries.values()) if(entry.mesh) entry.mesh.material.color.setScalar(brightness);
        invalidate();
    }
    function dispose() {if(destroyed)return;destroyed=true;clear();scene.remove(group);attributionElement.hidden=true;attributionElement.textContent='';}
    setProvider(null);attributionElement.hidden=true;attributionElement.textContent='';
    return {group, update, setProvider, setBrightness, retry, dispose};
}
