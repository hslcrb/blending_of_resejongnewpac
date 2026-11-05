import test from 'node:test';import assert from 'node:assert/strict';import {walkMotionDelta,walkSubsteps} from '../src/walkMotion.js';
test('visible slow frames retain movement time while collision steps stay small',()=>{
 assert.equal(walkMotionDelta(1000,3000),2);assert.equal(walkMotionDelta(1000,11000),5);assert.equal(walkMotionDelta(0,1000),0);assert.equal(walkMotionDelta(3000,2000),0);
 const dt=walkMotionDelta(1000,6000),steps=walkSubsteps(dt,5);assert.equal(steps,100);assert.ok(dt*5/steps<=.25);
});
