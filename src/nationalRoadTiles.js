// [전국 도로 / Nationwide roads] Coordinates and bounds are EPSG:5186 metres.
const MANIFEST='/gis/national-roads/manifest.json';
const valid=b=>Array.isArray(b)&&b.length===4&&b.every(Number.isFinite)&&b[0]<=b[2]&&b[1]<=b[3];
const overlap=(a,b)=>a[0]<=b[2]&&b[0]<=a[2]&&a[1]<=b[3]&&b[1]<=a[3];
const abort=s=>{if(s?.aborted)throw new DOMException('도로 조회가 취소됐습니다.','AbortError');};
async function unpack(response){
 if(!response.ok)throw new Error(`도로 자료 요청 실패: ${response.status}`);
 const bytes=new Uint8Array(await response.arrayBuffer());
 if(bytes[0]===31&&bytes[1]===139){if(typeof DecompressionStream==='undefined')throw new Error('이 브라우저는 gzip 압축 해제를 지원하지 않습니다.');return JSON.parse(await new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'))).text());}
 return JSON.parse(new TextDecoder().decode(bytes));
}
export function createNationalRoadSource({fetcher=fetch,maxCache=24}={}){
 if(!Number.isInteger(maxCache)||maxCache<0)throw new Error('캐시 크기가 올바르지 않습니다.');
 let metadata;const cache=new Map();
 async function manifest(signal){abort(signal);if(!metadata){const response=await fetcher(MANIFEST,{signal});if(!response.ok)throw new Error(`도로 목록 요청 실패: ${response.status}`);const data=await response.json();if(data.version!==1||data.crs!=='EPSG:5186'||!Array.isArray(data.layers))throw new Error('도로 목록 형식이 올바르지 않습니다.');abort(signal);metadata=data;}return metadata;}
 async function shard(entry,signal){abort(signal);if(cache.has(entry.url)){const value=cache.get(entry.url);cache.delete(entry.url);cache.set(entry.url,value);return value;}
  if(typeof entry.url!=='string'||!entry.url.startsWith('/gis/national-roads/')||entry.url.includes('..'))throw new Error('도로 자료 경로가 올바르지 않습니다.');
  const value=await unpack(await fetcher(entry.url,{signal}));if(value.type!=='FeatureCollection'||!Array.isArray(value.features)||value.features.length!==entry.count)throw new Error('도로 자료 형식이 올바르지 않습니다.');abort(signal);
  if(maxCache){cache.set(entry.url,value.features);while(cache.size>maxCache)cache.delete(cache.keys().next().value);}return value.features;
 }
 async function query({layers,bounds,signal}={}){
  if(!Array.isArray(layers)||!layers.length)throw new Error('조회할 도로 종류를 선택해 주세요.');
  if(!valid(bounds)||bounds[2]-bounds[0]>50000||bounds[3]-bounds[1]>50000)throw new Error('도로 조회 범위를 50km 이내로 좁혀 주세요.');
  abort(signal);const index=await manifest(signal),byId=new Map(index.layers.map(x=>[x.id,x]));
  const selected=[...new Set(layers)].flatMap(id=>{const layer=byId.get(id);if(!layer||!Array.isArray(layer.shards))throw new Error(`도로 종류를 찾지 못했습니다: ${id}`);return layer.shards.filter(s=>valid(s.bbox)&&overlap(s.bbox,bounds));});
  if(selected.length>64)throw new Error('도로 조회 범위에 자료가 너무 많습니다. 범위를 좁혀 주세요.');
  const controller=new AbortController(),onAbort=()=>controller.abort();signal?.addEventListener('abort',onAbort,{once:true});if(signal?.aborted)controller.abort();
  let cursor=0;const results=new Array(selected.length);
  async function worker(){for(;;){abort(controller.signal);const i=cursor++;if(i>=selected.length)return;results[i]=await shard(selected[i],controller.signal);}}
  try{await Promise.all(Array.from({length:Math.min(4,selected.length)},worker));abort(controller.signal);return results.flat().filter(f=>valid(f.bbox)&&overlap(f.bbox,bounds));}catch(e){controller.abort();throw e;}finally{signal?.removeEventListener('abort',onAbort);}
 }
 return {manifest,query,clearCache:()=>cache.clear()};
}
