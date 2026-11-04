import test from 'node:test';
import assert from 'node:assert/strict';
import { roadViewportBounds, roadAutoAllowed } from '../src/nationalRoadView.js';

test('전국 도로는 잘못된 범위나 50km 초과 범위에서 조회하지 않는다',()=>{
 assert.deepEqual(roadViewportBounds([0,0,50000,50000]),[0,0,50000,50000]);
 assert.equal(roadViewportBounds([0,0,50001,10]),null);
 assert.equal(roadViewportBounds([0,0,NaN,10]),null);
 assert.equal(roadViewportBounds([1,1,0,2]),null);
});
test('걷기에서는 수평선까지 확장된 지면 대신 보행자 주변 10km만 요청한다',()=>{
 assert.deepEqual(roadViewportBounds([-1e6,-1e6,1e6,1e6],{walking:true,position:[200000,550000]}),[195000,545000,205000,555000]);
 assert.equal(roadViewportBounds([0,0,2,2],{walking:true,position:[NaN,0]}),null);
});

test('자동 표시 범위는 10km 이내이며 더 넓은 50km는 직접 요청해야 한다',()=>{
 assert.equal(roadAutoAllowed([0,0,10000,10000]),true);
 assert.equal(roadAutoAllowed([0,0,10001,10]),false);
 assert.equal(roadAutoAllowed(null),false);
});
