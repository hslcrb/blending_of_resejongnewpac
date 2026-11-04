import { readFileSync, statSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import test from 'node:test';
import { createNationalMapSource, toSeoulWorld } from '../src/nationalMapLayers.js';
const base='public/gis/extra';const m=JSON.parse(readFileSync(`${base}/manifest.json`));
const sourceCounts={'경위도':23,'고속철도':285,'공항':14,'광역시청':8,'국가경계':2,'국립공원 경계':23,'도청':9,'등대':69,'사찰':268,'산':182,'스키장':23,'시청':77,'실폭하천':847,'일반철도':549,'전통사찰_수정필요':983,'특별광역자치시도경계':81,'항구':129,'해수욕장':71,'해안선':3081,'행정경계':710};
const readShard=shard=>{const bytes=readFileSync('public'+shard.url);assert.equal(bytes.length,shard.bytes);assert.equal(createHash('sha256').update(bytes).digest('hex'),shard.sha256);return JSON.parse(gunzipSync(bytes))};
test('원본 26개 레이어를 모두 포함 또는 제외 사유와 함께 나열한다',()=>{
 assert.equal(m.version,1);assert.equal(m.crs,'EPSG:5186');assert.equal(m.layers.length,20);assert.equal(m.existing.length,2);assert.equal(m.excluded.length,4);
 assert.equal(m.layers.reduce((n,l)=>n+l.sourceCount,0),7434);assert.ok(m.source.provenance.includes('확인되지'));
});
test('모든 기록과 좌표 없는 세 건을 보존하고 파일·속성을 검사한다',()=>{
 for(const layer of m.layers){assert.equal(layer.sourceCount,sourceCounts[layer.name]);let seen=new Set(),located=0,missing=0;
  for(const shard of layer.shards){assert.ok(statSync('public'+shard.url).size<20*1024*1024);let data=readShard(shard);assert.equal(data.features.length,shard.count);
   for(const f of data.features){assert.ok(!seen.has(f.id),f.id);seen.add(f.id);assert.equal(f.properties.layer,layer.name);assert.ok(!('path' in f.properties.fields));
    if(f.geometry){located++;assert.ok(f.bbox.every(Number.isFinite));assert.ok(f.properties.anchorWgs84.every(Number.isFinite));assert.ok(f.properties.anchorWgs84[0]>=120&&f.properties.anchorWgs84[0]<=133);assert.ok(f.properties.anchorWgs84[1]>=30&&f.properties.anchorWgs84[1]<=45);}else missing++;
    assert.doesNotMatch(JSON.stringify(f),/[A-Za-z]:[\\\\/](?:Users|Documents)[\\\\/]/i);
   }}
  assert.equal(seen.size,layer.sourceCount);assert.equal(located,layer.locatedCount);assert.equal(missing,layer.unlocatedCount);
 }
 assert.equal(m.layers.find(x=>x.name==='스키장').unlocatedCount,3);
});
test('범위 질의는 지나는 다른 타일의 장거리 선도 포함하고 미위치 자료는 선택적으로 제공한다',async()=>{
 let requests=[];const mock=async url=>{requests.push(url);const path='public'+url;return new Response(readFileSync(path),{status:200})};const source=createNationalMapSource({fetcher:mock,maxCache:4});
 const layer=m.layers.find(l=>l.name==='경위도');const shard=layer.shards.find(s=>s.bbox&&s.bbox[2]-s.bbox[0]>100000);assert.ok(shard);
 const bbox=[shard.bbox[0],shard.bbox[1],shard.bbox[0]+1,shard.bbox[1]+1];await source.query({layers:['graticule'],bounds:bbox});assert.ok(requests.includes(shard.url));
 const ski=await source.query({layers:['ski-resorts'],includeUnlocated:true});assert.equal(ski.filter(x=>!x.geometry).length,3);
 assert.deepEqual(toSeoulWorld([197897,552531]),{x:-2103,z:-2531});
});
test('취소·실패는 캐시를 오염시키지 않고 다음 요청을 다시 시도한다',async()=>{
 let first=true, loaded=0;const mock=async url=>{if(url.includes('/temples/')&&first){first=false;return new Response('',{status:503})}loaded++;return new Response(readFileSync('public'+url),{status:200})};
 const source=createNationalMapSource({fetcher:mock});const chosen=m.layers.find(l=>l.id==='temples').shards[0];const point=readShard(chosen).features[0].bbox;await assert.rejects(source.query({layers:['temples'],bounds:point}),/503/);
 const results=await source.query({layers:['temples'],bounds:point});assert.ok(results.length>0);const before=loaded;await source.query({layers:['temples'],bounds:point});assert.equal(loaded,before);
 const abort=new AbortController();abort.abort();await assert.rejects(source.query({layers:['temples'],signal:abort.signal}),{name:'AbortError'});
 await assert.rejects(source.query({layers:['unknown']}),/찾지 못했습니다/);
});
test('전국 레이어 묶음은 타일의 전체 기록과 일치하고 전국 조회를 20회로 줄인다',async()=>{
 for(const layer of m.layers){const byId=new Map(layer.shards.flatMap(s=>readShard(s).features).map(f=>[f.id,f]));const overview=readShard(layer.overview);assert.equal(overview.features.length,layer.sourceCount);assert.equal(byId.size,overview.features.length);for(const f of overview.features)assert.deepEqual(f,byId.get(f.id));}
 let requests=[];const source=createNationalMapSource({fetcher:async url=>{requests.push(url);return new Response(readFileSync('public'+url),{status:200})}});
 const result=await source.query({layers:m.layers.map(l=>l.id),bounds:[-500000,-500000,1000000,1500000]});assert.equal(result.length,7431);assert.ok(requests.length<=21,`requests: ${requests.length}`);
});
