import { test } from 'node:test';
import assert from 'node:assert/strict';
import { filterCulturalCandidates, formatCulturalField, culturalRegion, pageCulturalCandidates, parseCulturalCollection } from '../src/nationalCulturalData.js';

const feature = (id, region, name, address, field = null) => ({type:'Feature', id, geometry:{type:'Point',coordinates:[126.97,37.57]}, properties:{sourceFid:id,fields:{A4:address,A5:'81-3',A24:name,A30:region,A16:field}}});
const candidates = [feature(5,'11110','세종문화회관','서울특별시 종로구 세종로','0'), feature(6,'51780',null,'강원특별자치도 철원군','********')];

test('search combines region and Korean normalized building name or lot address', () => {
 assert.deepEqual(filterCulturalCandidates(candidates, '서울', '11').map(f=>f.id), [5]);
 assert.deepEqual(filterCulturalCandidates(candidates, '  세종문화회관  ', '11').map(f=>f.id), [5]);
 assert.deepEqual(filterCulturalCandidates(candidates, '81-3', '51').map(f=>f.id), [6]);
 assert.deepEqual(filterCulturalCandidates(candidates, '', '29'), []);
});
test('null and numeric overflow differ from valid zero and text', () => {
 assert.equal(formatCulturalField(null), '미기재');
 assert.equal(formatCulturalField('0'), '0');
 assert.equal(formatCulturalField('********'), '원본 범위 초과 (********)');
 assert.equal(formatCulturalField('A*B', false), 'A*B');
});
test('region code aliases and unknown codes remain explicit', () => {
 assert.equal(culturalRegion('51780'), '강원특별자치도');
 assert.equal(culturalRegion('11110'), '서울특별시');
 assert.equal(culturalRegion(null), '지역 코드 미기재');
 assert.equal(culturalRegion('99110'), '지역 코드 99');
});
test('page boundaries clamp after narrowing and preserve stable candidates', () => {
 const result=pageCulturalCandidates(candidates,4,1);
 assert.equal(result.page,1);assert.equal(result.pages,2);assert.deepEqual(result.items.map(f=>f.id),[6]);
 assert.deepEqual(pageCulturalCandidates([],99,10),{page:0,pages:1,items:[]});
});
test('rejects malformed collections and preserves geographic omissions', () => {
 assert.throws(()=>parseCulturalCollection({features:[]}), /형식/);
 const result=parseCulturalCollection({type:'FeatureCollection',features:[{...candidates[0],geometry:null}]});
 assert.equal(result[0].geometry,null);
});
