import * as THREE from 'three';
import {worldToGeo,geoToWorld,latLonTo5186} from './mapProjection.js';

// [백지도 층과 범례 / Overview layers and legend]
// 원본은 소축척이며 서울 자치구 이름을 완전하게 포함하지 않는다.
// The source is small-scale and does not contain all Seoul district names.
export const GEOGRAPHY_NOTICE = 'QGIS 소축척 백지도 및 2026-10-01 행정동 · 행정동은 법정동이나 지적·필지 경계가 아닙니다';
export const ADMIN_ATTRIBUTION = '출처: 국가데이터처 통계지리정보서비스(SGIS, https://sgis.kostat.go.kr); 가공: vuski/admdongkor(https://github.com/vuski/admdongkor), CC BY 4.0 https://creativecommons.org/licenses/by/4.0/; 추가 가공: 광역별 분할 및 서울 자치구 경계 병합.';
export const GEOGRAPHY_CATEGORIES = Object.freeze({
    province:{label:'시도 경계',color:0xf6c653}, district:{label:'시군구 백지도',color:0xffe697},
    admin:{label:'행정 경계선',color:0xffb75b}, water:{label:'하천',color:0x52cce7},
    roads:{label:'국도·지방도',color:0xeee7d8}, rail:{label:'철도',color:0xc5a6ed},
    'district-detail':{label:'서울 자치구 경계',color:0xffd464},
    'admin-detail':{label:'행정동 경계',color:0xff8b4c},
});
const DEFAULT_FILES={national:'/gis/national-admin.json.gz',seoul:'/gis/seoul-ground.json.gz',seoulDistricts:'/gis/admin-dong/seoul-districts.geojson.gz'};
function dataUrl(key) {
    if(Object.hasOwn(DEFAULT_FILES,key))return DEFAULT_FILES[key];
    if(/^dong:[0-9]{2}$/.test(key))return `/gis/admin-dong/regions/${key.slice(5)}.geojson.gz`;
    throw new Error('알 수 없는 지도 자료입니다.');
}
const CELL=1000;
function categoryFor(layer) {
    if(layer==='시도_백지도')return 'province';
    if(layer==='시군구_백지도_')return 'district';
    if(layer==='행정경계'||layer==='특별광역자치시도경계')return 'admin';
    if(layer==='실폭하천'||layer==='해안선')return 'water';
    if(layer==='고속국도'||layer==='일반국도'||layer==='지방도')return 'roads';
    if(layer==='고속철도'||layer==='일반철도')return 'rail';
    return 'admin-detail';
}
async function defaultLoadDataset(key,signal) {
    const response=await fetch(dataUrl(key),{signal});
    if(!response.ok)throw new Error(`지도 자료 요청 실패: ${response.status}`);
    const bytes=new Uint8Array(await response.arrayBuffer());
    const binary=bytes[0]===0x1f&&bytes[1]===0x8b;
    if(binary && typeof DecompressionStream==='undefined')throw new Error('이 브라우저는 압축 지도 자료를 해제할 수 없습니다.');
    const raw=binary?await new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer():bytes;
    return JSON.parse(new TextDecoder().decode(raw));
}
function projectedGeometry(geometry,crs) {
    if(crs==='EPSG:5186')return geometry;
    const project=value=>{
        if(typeof value[0]==='number') {const g=latLonTo5186(value[0],value[1]);return [g.easting,g.northing];}
        return value.map(project);
    };
    return {...geometry,coordinates:project(geometry.coordinates)};
}
function pathsOf(geometry) {
    if(!geometry)return [];
    const c=geometry.coordinates;
    switch(geometry.type){
        case 'LineString':return [c];
        case 'MultiLineString':case 'Polygon':return c;
        case 'MultiPolygon':return c.flat();
        default:return [];
    }
}
function boundsOf(paths) {
    let minE=Infinity,minN=Infinity,maxE=-Infinity,maxN=-Infinity;
    for(const path of paths)for(const point of path){
        if(!Number.isFinite(point[0])||!Number.isFinite(point[1]))continue;
        minE=Math.min(minE,point[0]);maxE=Math.max(maxE,point[0]);minN=Math.min(minN,point[1]);maxN=Math.max(maxN,point[1]);
    }
    return {minE,minN,maxE,maxN};
}
function ringContains(ring,e,n) {
    let inside=false;
    for(let i=0,j=ring.length-1;i<ring.length;j=i++) {
        const [ei,ni]=ring[i], [ej,nj]=ring[j];
        if((ni>n)!==(nj>n)&&e<(ej-ei)*(n-ni)/(nj-ni)+ei)inside=!inside;
    }
    return inside;
}
function polygonContains(geom,e,n) {
    if(geom.type!=='Polygon'&&geom.type!=='MultiPolygon')return false;
    const polygons=geom.type==='Polygon'?[geom.coordinates]:geom.coordinates;
    return polygons.some(p=>p.length>0&&ringContains(p[0],e,n)&&!p.slice(1).some(r=>ringContains(r,e,n)));
}
// [행정구역 이름 위치 / Interior positions for administrative labels]
// 가장 큰 외곽선의 무게중심을 쓰고, 바깥이면 가로 단면에서 내부점을 찾는다.
// Prefer the largest exterior centroid; fall back to an interior scanline.
function labelPoint(record) {
    if(record.labelPoint!==undefined)return record.labelPoint;
    const geom=record.geometry;
    if(!['Polygon','MultiPolygon'].includes(geom.type))return record.labelPoint=null;
    const polygons=geom.type==='Polygon'?[geom.coordinates]:geom.coordinates;
    let ring=null,best=0;
    for(const p of polygons){
        if(!p.length||p[0].length<4)continue;
        const r=p[0],origin=r[0];let area=0,cx=0,cy=0;
        for(let i=1;i<r.length;i++){
            const ax=r[i-1][0]-origin[0],ay=r[i-1][1]-origin[1],bx=r[i][0]-origin[0],by=r[i][1]-origin[1],cross=ax*by-bx*ay;
            area+=cross;cx+=(ax+bx)*cross;cy+=(ay+by)*cross;
        }
        if(Math.abs(area)>best){best=Math.abs(area);ring={r,point:area?{e:origin[0]+cx/(3*area),n:origin[1]+cy/(3*area)}:null};}
    }
    if(!ring)return record.labelPoint=null;
    if(ring.point&&polygonContains(geom,ring.point.e,ring.point.n))return record.labelPoint=ring.point;
    const b=record.bounds;let chosen=null,width=0;
    for(const fraction of [0.5,0.25,0.75,0.125,0.875]){
        const n=b.minN+(b.maxN-b.minN)*fraction,x=[];
        for(const path of record.paths)for(let i=1;i<path.length;i++){
            const a=path[i-1],z=path[i];
            if((a[1]>n)!==(z[1]>n))x.push(a[0]+(n-a[1])*(z[0]-a[0])/(z[1]-a[1]));
        }
        x.sort((a,b)=>a-b);
        for(let i=1;i<x.length;i++){
            const e=(x[i-1]+x[i])/2,span=x[i]-x[i-1];
            if(span>width&&polygonContains(geom,e,n)){width=span;chosen={e,n};}
        }
    }
    return record.labelPoint=chosen;
}
function pathDistance(paths,e,n) {
    let min=Infinity;
    for(const path of paths)for(let i=1;i<path.length;i++) {
        const a=path[i-1],b=path[i],dx=b[0]-a[0],dy=b[1]-a[1],len=dx*dx+dy*dy;
        const t=len?Math.max(0,Math.min(1,((e-a[0])*dx+(n-a[1])*dy)/len)):0;
        min=Math.min(min,Math.hypot(e-(a[0]+dx*t),n-(a[1]+dy*t)));
    }
    return min;
}
function buildDataset(id,data,{category,modes=['local','seoul','national'],indexed=false,height=0.08,region=null}={}) {
    const crs=data?.crs?.properties?.name||data?.metadata?.crs;
    if(data?.type!=='FeatureCollection'||!Array.isArray(data.features)||!['EPSG:5186','EPSG:4326'].includes(crs))
        throw new Error('지도 자료는 EPSG:5186 또는 EPSG:4326 FeatureCollection이어야 합니다.');
    const records=[],groups=new Map(),index=new Map(),broad=[];
    for(const feature of data.features) {
        const geometry=projectedGeometry(feature.geometry,crs);const paths=pathsOf(geometry);if(!paths.length)continue;
        const bounds=boundsOf(paths);if(!Number.isFinite(bounds.minE))continue;
        const group=category||categoryFor(feature.properties?.layer), record={feature,geometry,paths,bounds,category:group};
        const recordIndex=records.length;records.push(record);
        if(!groups.has(group))groups.set(group,[]);groups.get(group).push(record);
        if(indexed){
            const x1=Math.floor(bounds.minE/CELL),x2=Math.floor(bounds.maxE/CELL),y1=Math.floor(bounds.minN/CELL),y2=Math.floor(bounds.maxN/CELL);
            if((x2-x1+1)*(y2-y1+1)>2500)broad.push(recordIndex);
            else for(let x=x1;x<=x2;x++)for(let y=y1;y<=y2;y++){
                const key=`${x},${y}`;if(!index.has(key))index.set(key,[]);index.get(key).push(recordIndex);
            }
        }
    }
    const group=new THREE.Group();group.name=`GIS ${id}`;
    for(const [kind,list] of groups){
        let segments=0;
        for(const record of list)for(const path of record.paths)segments+=Math.max(0,path.length-1);
        if(!segments)continue;
        const vertices=new Float32Array(segments*6);let offset=0;
        for(const record of list)for(const path of record.paths)for(let i=1;i<path.length;i++){
            for(const point of [path[i-1],path[i]]){vertices[offset++]=point[0]-200000;vertices[offset++]=height;vertices[offset++]=550000-point[1];}
        }
        const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.BufferAttribute(vertices,3));
        const material=new THREE.LineBasicMaterial({color:GEOGRAPHY_CATEGORIES[kind]?.color??0xff8b4c,transparent:true,opacity:0.9,depthTest:false,depthWrite:false,toneMapped:false});
        const line=new THREE.LineSegments(geometry,material);line.name=`GIS ${kind}`;line.userData.geographyCategory=kind;line.renderOrder=900;line.frustumCulled=false;group.add(line);
    }
    const source=data.metadata||{crs,description:'사용자 제공 소축척 QGIS 자료; 원본 출처와 이용조건 미확인'};
    return {id,group,records,index,broad,indexed,modes,region,source};
}
function candidates(dataset,e,n,radius) {
    if(!dataset.indexed)return dataset.records;
    const x1=Math.floor((e-radius)/CELL),x2=Math.floor((e+radius)/CELL),y1=Math.floor((n-radius)/CELL),y2=Math.floor((n+radius)/CELL);
    if((x2-x1+1)*(y2-y1+1)>3000)return dataset.records;
    const result=new Set(dataset.broad);
    for(let x=x1;x<=x2;x++)for(let y=y1;y<=y2;y++)
        for(const i of dataset.index.get(`${x},${y}`)||[])result.add(i);
    return [...result].map(i=>dataset.records[i]);
}

// [그리기·속성 조회·자원 수명 / Rendering, inspection and resource lifetime]
// 원본 선들을 범주별로 합치고 검색은 공간 인덱스로 좁힌다.
// Batch source lines by category and narrow metadata searches with a spatial index.
export function createGeographyLayer({scene,onStatus=()=>{},invalidate=()=>{},loadDataset=defaultLoadDataset,height=0.08}={}) {
    if(!scene)throw new Error('지도 레이어에 scene이 필요합니다.');
    const group=new THREE.Group();group.name='GIS 행정·지면 경계';group.visible=false;scene.add(group);
    const datasets=new Map(),pending=new Map(),errors=new Map(),controllers=new Map();
    let visible=false,mode='local',categories=null,destroyed=false,lastStatus='',regions=new Set();
    const activeRegions=()=>new Set([...regions,...(mode==='national'?[]:['11'])]);
    const required=()=>[...new Set(['national',...(mode==='national'?[]:['seoul']),...(activeRegions().has('11')?['seoulDistricts']:[]),...[...activeRegions()].map(code=>`dong:${code}`)])];
    const inMode=dataset=>dataset.modes.includes(mode)&&(!dataset.region||activeRegions().has(dataset.region));
    function report() {
        const needed=required(),failed=needed.filter(k=>errors.has(k)),loaded=needed.filter(k=>datasets.has(k));
        const state=!visible?'idle':failed.length?'error':loaded.length===needed.length?'ready':'loading';
        const status={state,mode,loaded,total:needed.length,failed,notice:GEOGRAPHY_NOTICE,attribution:ADMIN_ATTRIBUTION};
        const key=JSON.stringify(status);if(key!==lastStatus){lastStatus=key;onStatus(status);}
    }
    function updateGroups() {
        group.visible=visible;
        group.rotation.y=mode==='local'?-Math.PI/2:0;
        group.position.set(mode==='local'?-2531:0,0,mode==='local'?2103:0);
        for(const dataset of datasets.values()) {
            dataset.group.visible=inMode(dataset);
            for(const child of dataset.group.children)child.visible=!categories||categories.has(child.userData.geographyCategory);
        }
        group.updateMatrixWorld(true);invalidate();report();
    }
    function disposeDataset(dataset) {
        group.remove(dataset.group);
        for(const child of dataset.group.children){child.geometry.dispose();child.material.dispose();}
    }
    function addDataset(id,data,options={}) {
        if(destroyed)throw new Error('이미 해제된 지도 레이어입니다.');
        if(datasets.has(id))throw new Error(`이미 존재하는 자료: ${id}`);
        const dataset=buildDataset(id,data,{...options,height});datasets.set(id,dataset);group.add(dataset.group);updateGroups();return dataset.records.length;
    }
    function removeDataset(id) {
        const dataset=datasets.get(id);if(!dataset)return;
        disposeDataset(dataset);datasets.delete(id);updateGroups();
    }
    function ensure(key) {
        if(destroyed||datasets.has(key)||errors.has(key))return Promise.resolve();
        if(pending.has(key))return pending.get(key);
        const controller=new AbortController();controllers.set(key,controller);errors.delete(key);report();
        const promise=Promise.resolve().then(()=>loadDataset(key,controller.signal)).then(data=>{
            if(destroyed||controller.signal.aborted)return;
            const region=key==='seoulDistricts'?'11':key.startsWith('dong:')?key.slice(5):null;
            const category=key==='seoulDistricts'?'district-detail':key.startsWith('dong:')?'admin-detail':undefined;
            addDataset(key,data,{category,region,indexed:key==='seoul'||Boolean(region),modes:key==='seoul'?['local','seoul']:['local','seoul','national']});
        }).catch(error=>{
            if(!destroyed&&!controller.signal.aborted)errors.set(key,error);
        }).finally(()=>{pending.delete(key);controllers.delete(key);if(!destroyed)report();});
        pending.set(key,promise);return promise;
    }
    async function ensureAll(keys) {for(let i=0;i<keys.length&&!destroyed;i+=3)await Promise.all(keys.slice(i,i+3).map(ensure));}
    async function loadRequired() {await ensureAll(required());if(!destroyed)updateGroups();}
    async function setVisible(next) {if(destroyed)return;visible=Boolean(next);updateGroups();if(visible)await loadRequired();}
    async function setMode(next) {
        if(destroyed)return;
        if(!['local','seoul','national'].includes(next))throw new Error('알 수 없는 지도 범위입니다.');
        mode=next;updateGroups();if(visible)await loadRequired();
    }
    function setCategories(next) {if(destroyed)return;categories=next==null?null:new Set(next);updateGroups();}
    async function setRegions(next) {
        if(destroyed)return;
        if(!Array.isArray(next)||next.some(code=>!/^\d{2}$/.test(code)))throw new Error('광역 지역 코드는 두 자리 문자열이어야 합니다.');
        regions=new Set(next);updateGroups();if(visible)await loadRequired();
    }
    async function retry() {if(destroyed)return;for(const key of required())errors.delete(key);await loadRequired();}
    async function query({x,z,mode:queryMode=mode,radius=100,limit=Infinity,categories:queryCategories}={}) {
        if(destroyed)return [];
        if(!Number.isFinite(x)||!Number.isFinite(z)||!Number.isFinite(radius)||radius<0)throw new Error('유효한 위치와 반경이 필요합니다.');
        const coordinateMode=queryMode==='national'?'seoul':queryMode;
        const {easting:e,northing:n}=worldToGeo(coordinateMode,x,z);
        const active=new Set([...regions,...(queryMode==='national'?[]:['11'])]);
        const keys=[...new Set(['national',...(queryMode==='national'?[]:['seoul']),...(active.has('11')?['seoulDistricts']:[]),...[...active].map(code=>`dong:${code}`)])];
        await ensureAll(keys);
        if(destroyed)return [];
        const failed=keys.filter(key=>errors.has(key));
        if(failed.length)throw new Error(`지도 자료를 불러오지 못했습니다: ${failed.join(', ')}`);
        const filter=queryCategories?new Set(queryCategories):categories;
        const hits=[];
        for(const dataset of datasets.values()) {
            if(!dataset.modes.includes(queryMode)||(dataset.region&&!active.has(dataset.region)))continue;
            for(const record of candidates(dataset,e,n,radius)) {
                if(filter&&!filter.has(record.category))continue;
                const b=record.bounds;if(e<b.minE-radius||e>b.maxE+radius||n<b.minN-radius||n>b.maxN+radius)continue;
                const contains=polygonContains(record.geometry,e,n);
                const distance=contains?0:pathDistance(record.paths,e,n);
                if(distance<=radius)hits.push({feature:record.feature,category:record.category,contains,distance,dataset:dataset.id,source:dataset.source});
            }
        }
        hits.sort((a,b)=>Number(b.contains)-Number(a.contains)||a.distance-b.distance);
        return hits.slice(0,Math.max(0,limit));
    }
    function getLabels({mode:labelMode=mode,categories:requested=['district-detail','admin-detail'],bounds=null,limit=Infinity}={}) {
        if(destroyed||limit<=0)return [];
        const active=new Set([...regions,...(labelMode==='national'?[]:['11'])]),selected=new Set(requested),labels=[];
        for(const dataset of datasets.values()) {
            if(!dataset.modes.includes(labelMode)||(dataset.region&&!active.has(dataset.region)))continue;
            for(const record of dataset.records) {
                if(!selected.has(record.category)||(categories&&!categories.has(record.category)))continue;
                const fields=record.feature.properties||{};
                const name=fields.adm_nm||fields.name||fields.fields?.MNG_NAM;if(!name)continue;
                const point=labelPoint(record);if(!point)continue;
                if(bounds&&(point.e<bounds.minE||point.e>bounds.maxE||point.n<bounds.minN||point.n>bounds.maxN))continue;
                const world=geoToWorld(labelMode==='national'?'seoul':labelMode,point.e,point.n);
                labels.push({...world,easting:point.e,northing:point.n,name,category:record.category,feature:record.feature,dataset:dataset.id});
                if(labels.length>=limit)return labels;
            }
        }
        return labels;
    }
    function dispose() {
        if(destroyed)return;destroyed=true;
        for(const controller of controllers.values())controller.abort();
        for(const dataset of datasets.values())disposeDataset(dataset);datasets.clear();scene.remove(group);invalidate();
    }
    return {group,setVisible,setMode,setCategories,setRegions,query,getLabels,addDataset,removeDataset,retry,dispose};
}
