import test from 'node:test';
import assert from 'node:assert/strict';
import { seoulSolarPosition, moonPosition, lightingForSun } from '../src/skyState.js';
test('밤에도 건축물 명암을 읽을 수 있게 주변광과 따뜻한 조명이 유지된다',()=>{
 const night=lightingForSun(seoulSolarPosition(new Date('2026-06-20T15:00:00Z')).elevation,0);
 const day=lightingForSun(seoulSolarPosition(new Date('2026-06-21T03:00:00Z')).elevation,0);
 assert.ok(night.ambient>=0.62);assert.ok(night.fill>=0.4);assert.ok(night.facade>0);assert.ok(night.sun<0.01);
 assert.ok(day.sun>0.5);assert.ok(day.facade<0.05);assert.ok(day.daylight>night.daylight);
});
test('달 위치는 UTC 날짜와 서울 위도에 따라 변하고 단위 방향을 유지한다',()=>{
 const a=moonPosition(new Date('2026-11-04T12:00:00Z'),'local');
 const b=moonPosition(new Date('2026-11-04T18:00:00Z'),'local');
 assert.ok(Math.abs(Math.hypot(a.direction.x,a.direction.y,a.direction.z)-1)<1e-10);
 assert.ok(Math.abs(a.elevation-b.elevation)>0.1);
 assert.ok(a.illumination>=0&&a.illumination<=1);
});
test('USNO 2026-11-04 서울 달 방위·고도의 저정밀 기준과 2도 이내로 일치한다',()=>{
 // USNO celnav 21:00 UTC, geocentric altitude 36.0464°, azimuth 120.4056°, illuminated 19%.
 const moon=moonPosition(new Date('2026-11-04T21:00:00Z'),'local');
 assert.ok(Math.abs(moon.elevation*180/Math.PI-36.0464)<2);assert.ok(Math.abs(moon.azimuth*180/Math.PI-120.4056)<2);assert.ok(Math.abs(moon.illumination-.19)<.05);
});
test('달 방향은 회관과 서울 좌표계의 북쪽을 유지한다',()=>{
 const date=new Date('2026-11-04T21:00:00Z');const local=moonPosition(date,'local').direction;const seoul=moonPosition(date,'seoul').direction;
 assert.ok(Math.abs(seoul.x-local.z)<1e-12);assert.ok(Math.abs(seoul.z+local.x)<1e-12);assert.equal(seoul.y,local.y);
});
