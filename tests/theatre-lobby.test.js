import * as THREE from 'three';
import {createLobby} from '../src/theatreLobby.js';
import test from 'node:test';
import assert from 'node:assert/strict';
test('lobby contains a central opening and navigable first-floor scale',()=>{
 const lobby=createLobby(THREE,{textures:false});
 const box=new THREE.Box3().setFromObject(lobby.group);
 assert.ok(box.min.z<=30.1 && box.max.z>=42.9);
 assert.ok(box.max.y>=9);
 const corridor=new THREE.Raycaster(new THREE.Vector3(0,1.7,41),new THREE.Vector3(0,0,-1),0,11);
 lobby.group.updateMatrixWorld(true);
 const hits=corridor.intersectObjects(lobby.group.children.filter(o=>o.name!=='AuditoriumRamp'),true);
 assert.ok(lobby.group.getObjectByName('AuditoriumRamp')); 
 assert.equal(hits.length,0,'clear central entrance into the auditorium');
 lobby.dispose();
});
