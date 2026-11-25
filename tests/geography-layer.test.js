import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createGeographyLayer} from '../src/geographyLayer.js';

const polygon={type:'Feature',id:'province:1',properties:{layer:'시도_백지도',fid:1,fields:{MNG_NAM:'서울특별시',year:2026}},geometry:{type:'Polygon',coordinates:[[[197800,552400],[198000,552400],[198000,552600],[197800,552600],[197800,552400]]]}};
const road={type:'Feature',id:'road:1',properties:{layer:'일반국도',fid:1,fields:{ROAD_NAME:'세종대로'}},geometry:{type:'LineString',coordinates:[[197840,552520],[197960,552520]]}};
const data=features=>({type:'FeatureCollection',crs:{type:'name',properties:{name:'EPSG:5186'}},features});

test('lazy layers render in two scene axes and query geometry with original fields',async()=>{
 const scene=new THREE.Scene(),requests=[],statuses=[];
 const layer=createGeographyLayer({scene,onStatus:s=>statuses.push(s),loadDataset:async key=>{requests.push(key);return data(key==='national'?[polygon]:key==='seoul'?[road]:[]);}});
 assert.deepEqual(requests,[]);assert.equal(layer.group.visible,false);
 await layer.setVisible(true);
 assert.deepEqual(requests.sort(),['dong:11','national','seoul','seoulDistricts']);
 assert.deepEqual(await layer.getProvinceNames({minE:197850,minN:552450,maxE:197900,maxN:552500}),['서울특별시']);
 assert.deepEqual(await layer.getProvinceNames({minE:100000,minN:100000,maxE:101000,maxN:101000}),[]);
 const lines=[];layer.group.traverse(o=>{if(o.isLineSegments)lines.push(o)});
 assert.equal(lines.length,2);assert.ok(lines.every(l=>l.material.depthTest===false && l.material.depthWrite===false));
 let hits=await layer.query({mode:'local',x:0,z:0,radius:25});
 assert.ok(hits.some(h=>h.feature.properties.fields.MNG_NAM==='서울특별시' && h.contains));
 assert.ok(hits.some(h=>h.feature.properties.fields.ROAD_NAME==='세종대로' && Math.abs(h.distance-11)<1e-6));
 await layer.setMode('seoul');
 hits=await layer.query({mode:'seoul',x:-2103,z:-2531,radius:25});assert.equal(hits.length,2);
 layer.setCategories(['province']); hits=await layer.query({mode:'seoul',x:-2103,z:-2531,radius:25});
 assert.equal(hits.length,1);assert.equal(hits[0].category,'province');
 assert.ok(statuses.some(s=>s.state==='ready'));
 layer.dispose();assert.equal(scene.children.includes(layer.group),false);
});

test('national mode defers Seoul data; added detail layer, failure and retry work',async()=>{
 const scene=new THREE.Scene(),requests=[];let failed=true;
 const layer=createGeographyLayer({scene,loadDataset:async key=>{requests.push(key);if(key==='seoul' && failed)throw new Error('offline');return data(key==='national'?[polygon]:key==='seoul'?[road]:[]);}});
 await layer.setMode('national');await layer.setVisible(true);assert.deepEqual(requests,['national']);
 await layer.setMode('seoul');assert.ok(requests.includes('seoul'));
 await assert.rejects(layer.query({mode:'seoul',x:-2103,z:-2531,radius:25}),/불러오지 못했습니다/);
 failed=false;await layer.retry();assert.equal(requests.filter(k=>k==='seoul').length,2);
 const extra=data([{...polygon,id:'detail:1',properties:{layer:'detail',fid:1,fields:{name:'종로구'}}}]);
 layer.addDataset('detail',extra,{category:'admin-detail'});
 const hits=await layer.query({mode:'seoul',x:-2103,z:-2531,radius:25});assert.ok(hits.some(h=>h.feature.properties.fields.name==='종로구'));
 layer.removeDataset('detail');const after=await layer.query({mode:'seoul',x:-2103,z:-2531,radius:25});assert.ok(!after.some(h=>h.feature.properties.fields.name==='종로구'));
 layer.dispose();
});


test('pending data arriving after disposal is ignored',async()=>{
 const scene=new THREE.Scene(),pending=[];
 const layer=createGeographyLayer({scene,loadDataset:()=>new Promise(resolve=>pending.push(resolve))});
 const opening=layer.setVisible(true);await new Promise(r=>setTimeout(r,0));
 layer.dispose();for(const resolve of pending)resolve(data([polygon]));await opening;
 assert.equal(scene.children.includes(layer.group),false);assert.equal(layer.group.children.length,0);
});

test('시도 전용 질의는 다른 행정동 오류와 무관하지만 전체 질의와 표시 오류는 유지된다',async()=>{
 const scene=new THREE.Scene(),statuses=[];
 const layer=createGeographyLayer({scene,onStatus:s=>statuses.push(s),loadDataset:async key=>{if(key==='dong:41')throw new Error('offline');return data(key==='national'?[polygon]:[]);}});
 await layer.setMode('national');await layer.setRegions(['41']);await layer.setVisible(true);
 const hits=await layer.query({mode:'national',x:-2103,z:-2531,radius:0,categories:['province']});
 assert.equal(hits.length,1);assert.equal(hits[0].category,'province');
 await assert.rejects(layer.query({mode:'national',x:-2103,z:-2531,radius:0}),/dong:41/);
 assert.equal(statuses.at(-1).state,'error');assert.deepEqual(statuses.at(-1).failed,['dong:41']);layer.dispose();
});

test('전국 로딩을 취소하면 진행 중 요청을 중단하고 나머지 요청을 시작하지 않는다',async()=>{
 const scene=new THREE.Scene(),requests=[];let release,aborted=[];
 const gate=new Promise(resolve=>release=resolve);
 const layer=createGeographyLayer({scene,loadDataset:async (key,signal)=>{requests.push(key);if(key.startsWith('dong:')){signal.addEventListener('abort',()=>aborted.push(key));await gate;}return data([polygon]);}});
 await layer.setMode('national');await layer.setVisible(true);
 const opening=layer.setRegions(['11','12','26','27','28','30','31','36','41','43','44','47','48','50','51','52']);
 await new Promise(r=>setTimeout(r,0));await layer.setRegions([]);release();await opening;
 assert.ok(aborted.includes('dong:11'));assert.ok(requests.filter(x=>x.startsWith('dong:')).length<16);
 assert.ok(!layer.group.children.some(g=>g.name.startsWith('GIS dong:')));layer.dispose();
});

test('공유 중인 개별 질의는 표시 권역 변경에도 살아남고 완료 후 해제된다',async()=>{
 const scene=new THREE.Scene();let release,signal,disposed=0,requests=[];
 const gate=new Promise(resolve=>release=resolve);
 const layer=createGeographyLayer({scene,loadDataset:async (key,s)=>{requests.push(key);if(key==='dong:41'){signal=s;await gate;}return data(key==='dong:41'?[polygon]:[]);}});
 layer.group.addEventListener('childadded',e=>{if(e.child.name==='GIS dong:41')e.child.traverse(o=>{if(o.isLineSegments)o.geometry.addEventListener('dispose',()=>disposed++);});});
 await layer.setMode('national');await layer.setVisible(true);
 const opening=layer.setRegions(['41']);await new Promise(r=>setTimeout(r,0));
 const query=layer.query({mode:'national',x:-2103,z:-2531,radius:0,categories:['admin-detail']});
 await layer.setRegions([]);assert.equal(signal.aborted,false);
 release();const hits=await query;await opening;
 assert.equal(requests.filter(x=>x==='dong:41').length,1);assert.equal(hits.length,1);
 assert.ok(!layer.group.children.some(g=>g.name==='GIS dong:41'));assert.ok(disposed>0);layer.dispose();
});

test('취소된 느린 요청 뒤 같은 지역을 다시 켜면 새 요청과 결과가 유지된다',async()=>{
 let release,firstSignal,calls=0;const gate=new Promise(resolve=>release=resolve);
 const layer=createGeographyLayer({scene:new THREE.Scene(),loadDataset:async (key,signal)=>{if(key==='dong:41'){calls++;if(calls===1){firstSignal=signal;await gate;}}return data(key==='dong:41'?[polygon]:[]);}});
 await layer.setMode('national');await layer.setVisible(true);
 const old=layer.setRegions(['41']);await new Promise(r=>setTimeout(r,0));await layer.setRegions([]);assert.equal(firstSignal.aborted,true);
 await layer.setRegions(['41']);assert.equal(calls,2);release();await old;
 const hits=await layer.query({mode:'national',x:-2103,z:-2531,radius:0,categories:['admin-detail']});
 assert.equal(hits.length,1);assert.ok(layer.group.children.some(g=>g.name==='GIS dong:41'));layer.dispose();
});

test('행정동 질의는 지면도로 실패를 무시하되 지면이 포함된 종합 질의는 실패한다',async()=>{
 const statuses=[],layer=createGeographyLayer({scene:new THREE.Scene(),onStatus:s=>statuses.push(s),loadDataset:async key=>{
  if(key==='seoul')throw new Error('roads unavailable');return data(key==='dong:11'?[polygon]:[]);
 }});
 await layer.setVisible(true);
 const admin=await layer.query({mode:'local',x:0,z:0,radius:0,categories:['admin-detail']});
 assert.equal(admin.length,1);assert.equal(admin[0].category,'admin-detail');
 await assert.rejects(layer.query({mode:'local',x:0,z:0,radius:0,categories:['roads','admin-detail']}),/seoul/);
 assert.equal(statuses.at(-1).state,'error');assert.ok(statuses.at(-1).failed.includes('seoul'));
 layer.dispose();
});
