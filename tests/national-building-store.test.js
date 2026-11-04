import test from 'node:test';
import assert from 'node:assert/strict';
import {gzipSync} from 'node:zlib';
import {NationalBuildingStore, NationalBuildingLimitError} from '../src/nationalBuildingStore.js';

const fields=Array.from({length:31},(_,i)=>`A${i}`);fields[4]='부산광역시 해운대구 우동';fields[5]='1231-2';fields[27]='*********';fields[29]='U';
const record=[13,96000,50000,[[[95990,49990,100008,49990,100008,50010,95990,50010,95990,49990]]],fields];
const manifest={version:1,source:'CH_D010_00_20261103',sourceCrs:'EPSG:5186',tileSize:10000,precision:0.1,fields:Array.from({length:31},(_,i)=>`A${i}`),totalRecords:1,unlocatedCount:0,maxSpanMeters:420,actions:{U:1,I:0,D:0},tiles:[[0,0,1,600,'hash']]};
function fixture(){const calls=[];return {calls,fetch:async url=>{calls.push(url);return url.endsWith('manifest.json')?Response.json(manifest):new Response(gzipSync(Buffer.from(JSON.stringify({tile:[0,0],records:[record]}))));}}}

test('인접 10km 타일의 경계 건물을 최장 폭 기준으로 빠짐없이 찾고 31개 원본 값을 보존한다',async()=>{
 const f=fixture(),s=new NationalBuildingStore({baseUrl:'/test',fetcher:f.fetch});
 const result=await s.around(10000.2,5000,{radius:0});
 assert.equal(result.hits.length,1);assert.equal(result.hits[0].contains,true);assert.equal(result.hits[0].building.id,13);
 assert.equal(result.hits[0].building.fields.length,31);assert.equal(result.hits[0].building.fields[27],'*********');
 assert.ok(f.calls.some(url=>url.endsWith('/0_0.json.gz')));
 await s.around(10000.2,5000,{radius:0});assert.equal(f.calls.filter(url=>url.endsWith('/0_0.json.gz')).length,1);
});

test('인접 지붕 밖 점은 실제 폴리곤까지의 거리로 분류한다',async()=>{
 const f=fixture(),s=new NationalBuildingStore({baseUrl:'/test',fetcher:f.fetch});
 assert.equal((await s.around(10001.2,5000,{radius:0})).hits.length,0);
 const hits=(await s.around(10001.2,5000,{radius:1})).hits;
 assert.equal(hits.length,1);assert.equal(hits[0].contains,false);assert.ok(Math.abs(hits[0].distance-0.4)<0.11);
});

test('과도한 후보 전송량은 요청 전에 중단하고 다시 좁힐 수 있다',async()=>{
 const f=fixture(),s=new NationalBuildingStore({baseUrl:'/test',fetcher:f.fetch,maxBytes:100});
 await assert.rejects(s.around(10000.2,5000,{radius:0}),NationalBuildingLimitError);
 assert.equal(f.calls.filter(url=>url.endsWith('.json.gz')).length,0);
});

test('중단된 위치 요청은 진행 타일을 취소하고 실패 결과를 캐시에 남기지 않는다',async()=>{
 const f=fixture();let pending=0;
 const fetcher=(url,options)=>url.endsWith('manifest.json')?f.fetch(url):new Promise((resolve,reject)=>{pending++;options.signal.addEventListener('abort',()=>reject(Object.assign(new Error('aborted'),{name:'AbortError'}))) });
 const s=new NationalBuildingStore({baseUrl:'/test',fetcher}),controller=new AbortController();
 const p=s.around(10000.2,5000,{radius:0,signal:controller.signal});await new Promise(r=>setTimeout(r,0));controller.abort();
 await assert.rejects(p,error=>error.name==='AbortError');assert.equal(pending,1);
});
