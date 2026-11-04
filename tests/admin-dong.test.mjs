import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, statSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { gunzipSync } from 'node:zlib';
import { resolve } from 'node:path';

const root = resolve('public/gis/admin-dong');
const manifest = JSON.parse(readFileSync(resolve(root, 'manifest.json'), 'utf8'));
const load = filename => {
 const bytes=readFileSync(resolve(root,filename));
 assert.ok(bytes.length < 25*1024*1024, `Cloudflare size ${filename}`);
 assert.equal(createHash('sha256').update(bytes).digest('hex'),manifest.assets[filename].sha256);
 return JSON.parse(gunzipSync(bytes));
};
const expectedGu = '강남구 강동구 강북구 강서구 관악구 광진구 구로구 금천구 노원구 도봉구 동대문구 동작구 마포구 서대문구 서초구 성동구 성북구 송파구 양천구 영등포구 용산구 은평구 종로구 중구 중랑구'.split(' ').sort();

test('전국 행정동 원본을 16개 광역 지역으로 빠짐없이 보존한다', () => {
 assert.equal(manifest.referenceDate,'2026-10-01');
 assert.equal(manifest.crs,'EPSG:4326');
 assert.equal(manifest.source.featureCount,3559);
 assert.equal(manifest.regions.length,16);
 let total=0;const codes=new Set();
 for(const region of manifest.regions){
  const data=load(region.file);assert.equal(data.type,'FeatureCollection');assert.equal(data.features.length,region.count);assert.equal(data.metadata.license,'CC BY 4.0');assert.match(data.metadata.attribution,/SGIS/);
  for(const feature of data.features){const p=feature.properties;assert.equal(p.sido,region.code);assert.ok(p.adm_nm&&p.adm_cd2&&p.sggnm);assert.ok(!codes.has(p.adm_cd2));codes.add(p.adm_cd2);assert.ok(['Polygon','MultiPolygon'].includes(feature.geometry.type));}
  total+=data.features.length;
 }
 assert.equal(total,3559);
});
test('서울 행정동 427개와 자치구 25개 경계 이름을 보존한다', () => {
 const report=JSON.parse(readFileSync(resolve(root,'seoul-validation.json'),'utf8'));
 assert.equal(report.sourceGeometriesValid,3559);assert.equal(report.nameComparison.mismatchesAfterNormalization,0);
 const region=manifest.regions.find(r=>r.code==='11');const dong=load(region.file);const gu=load('seoul-districts.geojson.gz');
 assert.equal(dong.features.length,427);assert.equal(gu.features.length,25);
 assert.deepEqual([...new Set(dong.features.map(f=>f.properties.sggnm))].sort(),expectedGu);
 assert.deepEqual(gu.features.map(f=>f.properties.name).sort(),expectedGu);
 assert.ok(dong.features.some(f=>f.properties.adm_nm==='서울특별시 종로구 사직동'));
 for(const feature of gu.features){assert.ok(feature.properties.sourceDongCount>0);assert.ok(['Polygon','MultiPolygon'].includes(feature.geometry.type));}
});
