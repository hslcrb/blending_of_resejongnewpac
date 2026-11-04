import test from 'node:test';
import assert from 'node:assert/strict';
import {isMapRoute, mapLink, exploreLink} from '../src/experienceRoutes.js';
test('지도와 전시천리안은 명시적인 독립 경로에서만 연다',()=>{
 for(const path of ['/map','/map/']) assert.equal(isMapRoute(path),true);
 for(const path of ['/','/explore','/explore/','/map/other','/theatre/']) assert.equal(isMapRoute(path),false);
});
test('내장 여부를 지키면서 두 체험을 구분한다',()=>{
 assert.equal(mapLink(),'/map/');
 assert.equal(exploreLink(false),'/explore/');
 assert.equal(exploreLink(true),'/explore/?embed=1');
});
