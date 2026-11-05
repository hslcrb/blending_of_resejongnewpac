import test from 'node:test';
import assert from 'node:assert/strict';
import {theatreToCampus,campusToTheatre,isTheatreInterior,canWalkUnified,unifiedFloorHeight} from '../src/theatrePlacement.js';
test('the reused lobby entrance is aligned with the existing exterior glass entrance',()=>{
 const entrance=theatreToCampus({x:0,y:0,z:60});assert.equal(entrance.x,33.1);assert.equal(entrance.y,1.07);assert.ok(Math.abs(entrance.z-3.1)<1e-10);
 const p={x:4,y:8,z:12};const actual=campusToTheatre(theatreToCampus(p));for(const key of ['x','y','z'])assert.ok(Math.abs(actual[key]-p[key])<1e-10);
});
test('the walk crosses the front entrance continuously but cannot cut through side walls',()=>{
 const a=theatreToCampus({x:0,y:0,z:60.1}),b=theatreToCampus({x:0,y:0,z:59.9});
 assert.equal(canWalkUnified(a,b,()=>false,[]),true);
 const sideA=theatreToCampus({x:16,y:0,z:40}),sideB=theatreToCampus({x:15.3,y:0,z:40});
 assert.equal(canWalkUnified(sideA,sideB,()=>true,[]),false);
 assert.equal(isTheatreInterior(b),true);
});
test('interior floors share exterior elevation without a step at the entrance',()=>{
 const a=theatreToCampus({x:0,y:0,z:59.9});assert.equal(unifiedFloorHeight(a),1.07);
 assert.ok(unifiedFloorHeight(theatreToCampus({x:0,y:0,z:20}))>1.07);
});
