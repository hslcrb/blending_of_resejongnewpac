import test from 'node:test';
import assert from 'node:assert/strict';
import { skyPreviewDate,seoulSolarPosition } from '../src/skyState.js';
import { nearestFixtures } from '../src/surveyLighting.js';
test('manual sky preview preserves Seoul date across UTC midnight and auto is real time',()=>{
const now=new Date('2026-11-14T23:41:00Z');
assert.equal(skyPreviewDate(now,'auto').toISOString(),now.toISOString());
assert.equal(skyPreviewDate(now,'day').toISOString(),'2026-11-15T03:00:00.000Z');
assert.equal(skyPreviewDate(now,'night').toISOString(),'2026-11-15T13:00:00.000Z');
assert.ok(seoulSolarPosition(skyPreviewDate(now,'day')).elevation>0);
assert.ok(seoulSolarPosition(skyPreviewDate(now,'night')).elevation<0);
});
test('fixture selection is bounded to eight nearby lights without deleting visible fixture geometry',()=>{
const fixtures=Array.from({length:49},(_,i)=>({position:[i,0,0],distance:20,intensity:85}));
assert.equal(nearestFixtures(fixtures,[0,0,0]).length,8);
assert.deepEqual(nearestFixtures(fixtures,[0,0,0]).map(x=>x.position[0]),[0,1,2,3,4,5,6,7]);
assert.equal(nearestFixtures(fixtures,[1000,0,0]).length,0);
assert.equal(fixtures.length,49);
});
import * as THREE from 'three';
import {readFile} from 'node:fs/promises';
import {createSurveyLighting} from '../src/surveyLighting.js';
test('actual survey GLB switches emission off/day and on/night with eight reused local lights',async()=>{
 const original=globalThis.fetch;const parent=new THREE.Group();let ready=false;
 globalThis.fetch=async url=>{const data=await readFile(new URL('../public'+url,import.meta.url));return {ok:true,json:async()=>JSON.parse(data),arrayBuffer:async()=>data.buffer.slice(data.byteOffset,data.byteOffset+data.byteLength)};};
 const controller=createSurveyLighting(parent,{onReady:()=>{ready=true;}});
 try{await controller.ready;assert.equal(ready,true);let materials=[];parent.traverse(o=>{if(o.isMesh)materials.push(o.material)});assert.ok(materials.length>0);assert.ok(materials.every(m=>m.emissiveIntensity===0));controller.setLevel(1);assert.ok(materials.some(m=>m.emissiveIntensity>0));const manifest=JSON.parse(await readFile(new URL('../public/model/survey-20261115/lighting.json',import.meta.url)));controller.update(new THREE.Vector3(...manifest.fixtures[0].position));let points=[];parent.traverse(o=>{if(o.isPointLight)points.push(o)});assert.equal(points.length,8);assert.ok(points.some(o=>o.intensity>0));assert.ok(points.every(o=>!o.castShadow));controller.setLevel(0);assert.ok(points.every(o=>o.intensity===0));assert.ok(materials.every(m=>m.emissiveIntensity===0));}
 finally{controller.dispose();globalThis.fetch=original;assert.equal(parent.children.length,0);}
});
test('survey asset failure removes the empty pool and reports an error without blocking the campus',async()=>{
 const original=globalThis.fetch;const parent=new THREE.Group();let error=null;
 globalThis.fetch=async()=>({ok:false});
 const controller=createSurveyLighting(parent,{onError:e=>{error=e;}});
 try{await controller.ready;assert.ok(error instanceof Error);assert.equal(parent.children.length,0);controller.setLevel(1);controller.update(new THREE.Vector3());}
 finally{controller.dispose();globalThis.fetch=original;}
});
test('disposing before asynchronous survey data arrives never installs late geometry',async()=>{
 const original=globalThis.fetch;const parent=new THREE.Group();let release;const wait=new Promise(resolve=>{release=resolve;});let notified=false;
 globalThis.fetch=async url=>{await wait;const data=await readFile(new URL('../public'+url,import.meta.url));return {ok:true,json:async()=>JSON.parse(data),arrayBuffer:async()=>data.buffer.slice(data.byteOffset,data.byteOffset+data.byteLength)};};
 const controller=createSurveyLighting(parent,{onReady:()=>{notified=true;}});controller.dispose();release();
 try{await controller.ready;assert.equal(notified,false);assert.equal(parent.children.length,0);}
 finally{globalThis.fetch=original;}
});
