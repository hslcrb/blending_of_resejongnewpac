import test from 'node:test';
import assert from 'node:assert/strict';
import { createCityLayer } from '../src/cityLayer.js';
test('서울 격자에서 상세 회관 영역을 제외하고 나머지 높이와 종류를 보존한다', () => {
 const layer = createCityLayer({version:1,cells:[[3958,11050,20,0],[4000,11000,10,1],[4001,11000,12,2]]});
 const meshes = layer.children.filter(o=>o.isInstancedMesh);
 assert.equal(meshes.reduce((sum,mesh)=>sum+mesh.count,0),2);
 assert.equal(meshes[1].count,1);assert.equal(meshes[2].count,1);
 layer.traverse(o=>{if(o.geometry)o.geometry.dispose();if(o.material)o.material.dispose()});
});
test('형식이 다른 격자 자료는 표시하지 않고 실패한다',()=>assert.throws(()=>createCityLayer({version:2,cells:[]})));
