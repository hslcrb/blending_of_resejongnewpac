import test from 'node:test';
import assert from 'node:assert/strict';
import {createSkyMaterial,createCampusNightLights} from '../src/skyVisual.js';
test('낮·밤 하늘과 달·구름 상태를 셰이더에 전달할 수 있다',()=>{
 const material=createSkyMaterial(); assert.ok(material.uniforms.moonDir);assert.ok(material.uniforms.moonIllumination);assert.ok(material.uniforms.sunDir);assert.ok(material.uniforms.cloudAmount);material.dispose();
});
test('야간 조명은 회관 좌표 그룹 안에서 동기화하고 낮에 꺼진다',()=>{
 const campus=createCampusNightLights();assert.equal(campus.group.children.length,4);campus.setIntensity(420);assert.ok(campus.group.children.every(light=>light.intensity===420));campus.setIntensity(0);assert.ok(campus.group.children.every(light=>light.intensity===0));
});
