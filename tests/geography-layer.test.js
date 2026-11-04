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
