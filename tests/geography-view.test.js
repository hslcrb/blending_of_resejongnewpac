import test from 'node:test';
import assert from 'node:assert/strict';
import {ALL_ADMIN_REGIONS,regionCodeFromName,regionCodeFromBuilding} from '../src/geographyView.js';
test('행정동 지역 코드는 자료 기준의 16개 권역과 기존 건물 코드를 연결한다',()=>{
 assert.equal(ALL_ADMIN_REGIONS.length,16);assert.equal(new Set(ALL_ADMIN_REGIONS).size,16);
 for(const [name,code] of [['서울특별시','11'],['부산광역시','26'],['광주광역시','12'],['전라남도','12'],['강원특별자치도','51'],['제주특별자치도','50']]) assert.equal(regionCodeFromName(name),code);
 assert.equal(regionCodeFromBuilding('46170'),'12');assert.equal(regionCodeFromBuilding('29110'),'12');assert.equal(regionCodeFromBuilding('42110'),'51');assert.equal(regionCodeFromName('미확인'),null);
});
