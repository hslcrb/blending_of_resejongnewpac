import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createNationalMapRenderer, hitTestNationalFeature, describeNationalFeature } from '../src/nationalMapRenderer.js';
const feature=(id,type,coordinates,bbox,fields={})=>({type:'Feature',id,geometry:{type,coordinates},bbox,properties:{layer:'검사',fid:Number(id.split(':')[1]),fields,anchorWgs84:[126.97,37.57]}});
const point=feature('temples:1','Point',[197900,552530],[197900,552530,197900,552530],{TEXTSTRING:'검사 사찰',빈값:null,숫자:0});
const line=feature('rail:2','LineString',[[197850,552500],[197950,552500]],[197850,552500,197950,552500],{LAYER:'철도'});
const poly=feature('national-parks:3','Polygon',[[[197800,552400],[198000,552400],[198000,552600],[197800,552600],[197800,552400]],[[197880,552480],[197920,552480],[197920,552520],[197880,552520],[197880,552480]]],[197800,552400,198000,552600],{NPK_NM:'검사 공원'});
test('점과 선 거리 및 구멍이 있는 공원의 실제 위치를 판정한다',()=>{
 assert.equal(hitTestNationalFeature(point,197900,552530).distance,0);
 assert.equal(hitTestNationalFeature(line,197900,552530).distance,30);
 assert.equal(hitTestNationalFeature(poly,197850,552450).contains,true);
 assert.equal(hitTestNationalFeature(poly,197900,552500).contains,false);
 assert.equal(hitTestNationalFeature(poly,197900,552500).distance,20);
 const d=describeNationalFeature(point);assert.equal(d.name,'검사 사찰');assert.deepEqual(d.fields.find(x=>x.name==='빈값').value,'미기재');assert.equal(d.fields.find(x=>x.name==='숫자').value,'0');
});
test('실제 장면에 점과 선을 표시하고 폐기 시 GPU 자원을 정리한다',async()=>{
 const scene=new THREE.Scene(), camera=new THREE.PerspectiveCamera();let draws=0;const source={query:async()=>[point,line,poly]};
 const renderer=createNationalMapRenderer({scene,camera,source,draw:()=>draws++});await renderer.update({layers:['temples','rail','national-parks'],bounds:[197000,552000,199000,553000],mode:'seoul',sight:true});
 assert.ok(scene.children[0].children.some(o=>o.isPoints));assert.ok(scene.children[0].children.some(o=>o.isLineSegments));const objects=[...scene.children[0].children];let disposed=0;for(const o of objects)o.geometry.addEventListener('dispose',()=>disposed++);
 const hits=await renderer.inspectAt({easting:197900,northing:552530,radius:35});assert.ok(hits.some(h=>h.feature.id===point.id));assert.ok(hits.some(h=>h.feature.id===line.id));assert.ok(draws>0);
 renderer.dispose();assert.equal(scene.children.length,0);assert.equal(disposed,objects.length);
});
test('느린 이전 범위 요청은 최신 레이어를 덮지 않는다',async()=>{
 let resolveOld;const source={query:({layers})=>layers[0]==='slow'?new Promise(r=>{resolveOld=r}):Promise.resolve([point])};
 const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera();const renderer=createNationalMapRenderer({scene,camera,source});
 const old=renderer.update({layers:['slow'],mode:'seoul'});const fresh=renderer.update({layers:['fresh'],mode:'local'});await fresh;resolveOld([line]);await old;
 assert.ok(scene.children[0].children.some(o=>o.isPoints));assert.equal(scene.children[0].children.some(o=>o.isLineSegments),false);renderer.dispose();
});
test('서울 50km 범위의 모든 부가 레이어를 소수의 배치로 생성한다',async()=>{
 const {createNationalMapSource}=await import('../src/nationalMapLayers.js');const {readFileSync}=await import('node:fs');let requests=0;
 const source=createNationalMapSource({fetcher:async url=>{requests++;return new Response(readFileSync('public'+url),{status:200})}});const index=await source.manifest();
 const scene=new THREE.Scene(),renderer=createNationalMapRenderer({scene,camera:new THREE.PerspectiveCamera(),source});
 const start=performance.now();await renderer.update({layers:index.layers.map(l=>l.id),bounds:[175000,525000,225000,575000],mode:'seoul'});
 const group=scene.children[0],vertices=group.children.reduce((sum,o)=>sum+o.geometry.attributes.position.count,0);
 assert.ok(group.children.length<=25);assert.ok(vertices<100000);assert.ok(requests<50);console.log(`서울 범위: ${group.children.length} batches, ${vertices} vertices, ${requests} requests, ${Math.round(performance.now()-start)}ms (local Node)`);renderer.dispose();
});
test('범위 전환은 진행 중인 돋보기 조회를 취소하고 오래된 결과를 전달하지 않는다',async()=>{
 let calls=0,notified=0;const source={query:({signal})=>{calls++;if(calls===2)return new Promise((resolve,reject)=>signal.addEventListener('abort',()=>reject(new DOMException('aborted','AbortError')),{once:true}));return Promise.resolve([point])}};
 const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(),renderer=createNationalMapRenderer({scene,camera,source,onInspect:()=>notified++});
 await renderer.update({layers:['temples']});const old=renderer.inspectAt({easting:197900,northing:552530});await renderer.update({layers:['airports']});assert.equal(await old,null);assert.equal(notified,0);renderer.dispose();
});
test('카메라가 보는 지면을 EPSG:5186 범위로 계산하고 뷰 이동 시 재조회한다',async()=>{
 const {groundBoundsFromCamera}=await import('../src/nationalMapRenderer.js');const camera=new THREE.OrthographicCamera(-100,100,50,-50,1,5000);camera.position.set(0,1000,0);camera.up.set(0,0,-1);camera.lookAt(0,0,0);camera.updateProjectionMatrix();
 const bounds=groundBoundsFromCamera(camera,'seoul',0);assert.ok(Math.abs(bounds[0]-199900)<.01);assert.ok(Math.abs(bounds[2]-200100)<.01);assert.ok(Math.abs(bounds[1]-549950)<.01);assert.ok(Math.abs(bounds[3]-550050)<.01);
 let calls=[],listeners=new Map();const controls={addEventListener:(n,f)=>listeners.set(n,f),removeEventListener:(n,f)=>{if(listeners.get(n)===f)listeners.delete(n)}};
 const r=createNationalMapRenderer({scene:new THREE.Scene(),camera,controls,source:{query:async opts=>{calls.push(opts);return []}}});await r.update({layers:['temples']});assert.deepEqual(calls[0].bounds,groundBoundsFromCamera(camera,'seoul',2));camera.position.x=500;listeners.get('end')();await new Promise(resolve=>setTimeout(resolve,350));assert.equal(calls.length,2);assert.ok(calls[1].bounds[0]>calls[0].bounds[0]);r.dispose();assert.equal(listeners.size,0);
});
test('레이어 로딩 오류를 보고하고 refresh로 재시도한다',async()=>{
 let attempt=0,status=[];const source={query:async()=>{if(++attempt===1)throw Error('offline');return [point]}};
 const scene=new THREE.Scene(),renderer=createNationalMapRenderer({scene,camera:new THREE.PerspectiveCamera(),source,onStatus:s=>status.push(s.state)});
 await assert.rejects(renderer.update({layers:['temples']}),/offline/);assert.equal(status.at(-1),'error');assert.equal(scene.children[0].children.length,0);
 assert.equal(await renderer.refresh(),true);assert.equal(status.at(-1),'ready');assert.ok(scene.children[0].children.some(o=>o.isPoints));renderer.dispose();
});
test('시설명과 공원명은 기존 지도 레이블과 함께 배치할 후보로 노출된다',async()=>{
 const scene=new THREE.Scene(),renderer=createNationalMapRenderer({scene,camera:new THREE.PerspectiveCamera(),source:{query:async()=>[point,poly,line]}});
 await renderer.update({layers:['temples','national-parks','rail'],mode:'seoul',sight:true});const labels=renderer.getLabels();assert.ok(labels.some(x=>x.name==='검사 사찰'));assert.ok(labels.some(x=>x.name==='검사 공원'));assert.ok(labels.every(x=>x.category==='national-feature'));
 renderer.setSight(false);assert.deepEqual(renderer.getLabels(),[]);renderer.dispose();
});
