import test from 'node:test';
import assert from 'node:assert/strict';
import { createNationalRoadSource } from '../src/nationalRoadTiles.js';
const index={version:1,crs:'EPSG:5186',layers:[{id:'national',shards:[{url:'/gis/national-roads/national/a.json.gz',bbox:[0,0,10,10],count:1},{url:'/gis/national-roads/national/b.json.gz',bbox:[100,100,110,110],count:1}]}]};
const feature={type:'Feature',id:'national:1',bbox:[0,0,10,10],geometry:null,properties:{fid:1,fields:{name:null}}};
function fetcher(log){return async (url,{signal}={})=>{log.push(url);if(signal?.aborted)throw new DOMException('cancelled','AbortError');return url.endsWith('manifest.json')?new Response(JSON.stringify(index)):new Response(JSON.stringify({type:'FeatureCollection',features:[feature]}));};}
test('queries only intersecting shards and rejects a national-scale request',async()=>{const log=[];const src=createNationalRoadSource({fetcher:fetcher(log)});assert.deepEqual(await src.query({layers:['national'],bounds:[0,0,20,20]}),[feature]);assert.equal(log.length,2);await assert.rejects(src.query({layers:['national'],bounds:[0,0,100000,100000]}),/범위/);});
test('rejects canceled request and malformed input',async()=>{const c=new AbortController();c.abort();const src=createNationalRoadSource({fetcher:fetcher([])});await assert.rejects(src.query({layers:['national'],bounds:[0,0,1,1],signal:c.signal}),{name:'AbortError'});await assert.rejects(src.query({layers:['national'],bounds:[3,0,1,1]}),/범위/);});
test('abort stops pending tile fetches without starting queued requests',async()=>{
 const log=[];const many={version:1,crs:'EPSG:5186',layers:[{id:'national',shards:Array.from({length:8},(_,i)=>({url:`/gis/national-roads/${i}.gz`,bbox:[0,0,1,1],count:0}))}]};
 const fetcher=async(url,{signal}={})=>{log.push(url);if(url.endsWith('manifest.json'))return new Response(JSON.stringify(many));return new Promise((resolve,reject)=>{signal.addEventListener('abort',()=>reject(new DOMException('aborted','AbortError')),{once:true});});};
 const src=createNationalRoadSource({fetcher});const c=new AbortController();const request=src.query({layers:['national'],bounds:[0,0,1,1],signal:c.signal});await new Promise(resolve=>setTimeout(resolve,20));c.abort();await assert.rejects(request,{name:'AbortError'});assert.equal(log.length,5);
});
test('failed tile aborts other pending tiles',async()=>{
 const index2={version:1,crs:'EPSG:5186',layers:[{id:'national',shards:[{url:'/gis/national-roads/fail.gz',bbox:[0,0,1,1],count:0},{url:'/gis/national-roads/slow.gz',bbox:[0,0,1,1],count:0}]}]};let stopped=false;
 const fetcher=async(url,{signal}={})=>{if(url.endsWith('manifest.json'))return new Response(JSON.stringify(index2));if(url.endsWith('fail.gz'))return new Response('',{status:503});return new Promise((resolve,reject)=>{signal.addEventListener('abort',()=>{stopped=true;reject(new DOMException('aborted','AbortError'));},{once:true});});};
 await assert.rejects(createNationalRoadSource({fetcher}).query({layers:['national'],bounds:[0,0,1,1]}),/503/);assert.equal(stopped,true);
});
