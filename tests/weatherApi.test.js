import test from 'node:test';
import assert from 'node:assert/strict';
import { getWeather } from '../functions/api/weather.js';
const now = Date.parse('2026-11-04T05:15:00Z');
const sample = [{icaoId:'RKSS',obsTime:Math.floor((now-900000)/1000),cover:'BKN',clouds:[{cover:'BKN'}],temp:18}];
function setup(upstream) {
  const map = new Map(); const pending=[]; let calls=0;
  const cache={async match(req){return map.get(req.url)?.clone()},async put(req,res){map.set(req.url,res.clone())}};
  const fetcher=async () => {calls++; return upstream()};
  return {cache,fetcher,now,waitUntil:p=>pending.push(p),pending,calls:()=>calls};
}
test('김포공항 최신 관측만 반환하고 캐시로 요청을 재사용한다',async()=>{
 const opts=setup(()=>Response.json(sample));
 const first=await getWeather(new Request('https://live.example/api/weather?ignored=1'),opts);
 assert.equal(first.status,200);const json=await first.json(); assert.equal(json.station,'RKSS'); assert.equal(json.cover,'BKN'); assert.equal(json.observedAt,'2026-11-04T05:00:00.000Z');
 await Promise.all(opts.pending);const second=await getWeather(new Request('https://live.example/api/weather?ignored=2'),opts);
 assert.equal(second.status,200);assert.equal(opts.calls(),1);
});
test('오래되거나 없는 관측은 성공으로 위장하지 않는다',async()=>{
 for (const payload of [[],[{...sample[0],obsTime:Math.floor((now-4*3600000)/1000)}]]) {
  const r=await getWeather(new Request('https://live.example/api/weather'),setup(()=>Response.json(payload)));assert.equal(r.status,503);
 }
});
