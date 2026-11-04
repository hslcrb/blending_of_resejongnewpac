import test from 'node:test';
import assert from 'node:assert/strict';
import {canEnterTheatre, nearestSeat, seatEyePosition, stepInside, theatreFloorHeight} from '../src/theatreNavigation.js';
test('the lobby connects to the auditorium only through its central doorway',()=>{
 assert.equal(canEnterTheatre(0,29.8,0,30.2),true);
 assert.equal(canEnterTheatre(8,29.8,8,30.2),false);
 assert.equal(canEnterTheatre(0,0,0,-2),true);
 assert.equal(canEnterTheatre(0,43,0,44),false);
});
test('walking is bounded by the building and lobby columns',()=>{
 assert.equal(stepInside({x:0,z:38},{x:0,z:38.2}).z,38.2);
 assert.deepEqual(stepInside({x:10,z:34},{x:10,z:34.6}),{x:10,z:34});
 assert.deepEqual(stepInside({x:0,z:42.8},{x:0,z:43.5}),{x:0,z:42.8});
});
test('nearest seat respects distance and seated view follows the provided seat height',()=>{
 const seats=[{id:'A',position:[1,0,6]},{id:'B',position:[3,1,6],eyeHeight:1.08}];
 assert.equal(nearestSeat(seats,1.2,6,1).id,'A');
 assert.equal(nearestSeat(seats,9,9,1),null);
 assert.deepEqual(seatEyePosition(seats[1]),{x:3,y:2.08,z:6});
 assert.ok(theatreFloorHeight(20)>1);
});

test('doorway cannot be bypassed by stepping exactly onto the wall line',()=>{
 assert.equal(canEnterTheatre(8,29.8,8,30),false);
 assert.equal(canEnterTheatre(8,30,8,29.8),false);
});
test('a visitor cannot walk through the seat itself',()=>{
 const seat={id:'A',level:1,position:[1,0,6]};
 assert.deepEqual(stepInside({x:0,z:6},{x:.9,z:6},[seat]),{x:0,z:6});
 assert.deepEqual(stepInside({x:0,z:6},{x:.2,z:6},[seat]),{x:.2,z:6});
});
