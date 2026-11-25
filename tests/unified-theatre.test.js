import test from 'node:test';import assert from 'node:assert/strict';import * as THREE from 'three';
import {createUnifiedTheatre} from '../src/unifiedTheatre.js';import {theatreToCampus} from '../src/theatrePlacement.js';
test('the existing interior attaches to the exterior group and seats use the same camera',async()=>{
 const detail=new THREE.Group(),camera=new THREE.PerspectiveCamera();const scene=new THREE.Scene();scene.add(detail,camera);
 const interior=new THREE.Group();for(const name of ['GrandCurtain','GrandAcousticShell','GrandProjectionScreen']){const m=new THREE.Mesh(new THREE.PlaneGeometry(16,9),new THREE.MeshBasicMaterial());m.name=name;interior.add(m);}
 const seats=[{id:'1-1',level:1,row:1,position:[1,0,12],eyeHeight:1.4}];
 const api=createUnifiedTheatre({detail,camera,loadGltf:async()=>({scene:interior}),fetcher:async()=>({ok:true,json:async()=>({seats})})});
 await api.load();assert.equal(api.root.parent,detail);assert.equal(interior.parent,api.root);assert.equal(scene.children.filter(x=>x.isCamera).length,1);
 api.sit('1-1');const expected=theatreToCampus({x:1,y:1.4,z:12});assert.ok(camera.position.distanceTo(new THREE.Vector3(expected.x,expected.y,expected.z))<1e-9);assert.equal(api.isSitting(),true);api.stand();assert.equal(api.isSitting(),false);
 api.setStage('open');assert.equal(interior.getObjectByName('GrandCurtain').visible,false);api.dispose();assert.equal(api.root.parent,null);
});
