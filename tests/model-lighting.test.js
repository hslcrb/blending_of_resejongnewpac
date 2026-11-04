import test from 'node:test';
import assert from 'node:assert/strict';
import {lightingForSun} from '../src/skyState.js';
import {theatreExposure} from '../src/theatreLighting.js';
test('night models receive a readable fill while daylight retains the prior exposure balance',()=>{
 const night=lightingForSun(-.4,0),day=lightingForSun(1,0);
 assert.ok(night.ambient>=.8 && night.fill>=.54);
 assert.ok(Math.abs(day.ambient-1.4)<1e-12);assert.ok(Math.abs(day.fill-.72)<1e-12);
});
test('interior exposure rises gradually beyond the lobby without changing the already bright foyer',()=>{
 assert.equal(theatreExposure(56),1.18);
 assert.ok(theatreExposure(20)>=1.45);
 assert.ok(theatreExposure(34)>theatreExposure(40));
});
