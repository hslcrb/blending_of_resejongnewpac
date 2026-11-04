export class NationalBuildingLimitError extends Error { constructor(bytes, tiles) { super(`조회 대상이 너무 큽니다 (${tiles}개 타일, ${Math.ceil(bytes / 1024 / 1024)}MB). 반경을 줄여 주세요.`); this.name = 'NationalBuildingLimitError'; } }
const abortError = () => Object.assign(new Error('조회가 취소되었습니다.'), {name:'AbortError'});
function distanceToRing(ring,x,y) {
 let inside=false, min=Infinity;
 for(let i=0,j=ring.length-2;i<ring.length;j=i,i+=2) {
  const ax=ring[j],ay=ring[j+1],bx=ring[i],by=ring[i+1],dx=bx-ax,dy=by-ay;
  if ((ay>y)!==(by>y) && x<(bx-ax)*(y-ay)/(by-ay)+ax) inside=!inside;
  const t=Math.max(0,Math.min(1,((x-ax)*dx+(y-ay)*dy)/(dx*dx+dy*dy||1)));
  min=Math.min(min,Math.hypot(x-(ax+t*dx),y-(ay+t*dy)));
 }
 return {inside,distance:min};
}
function measure(polygons,x,y) {
 let contains=false,min=Infinity;
 for(const polygon of polygons) {
  if(!polygon.length) continue;
  const rings=polygon.map(r=>distanceToRing(r,x,y));
  min=Math.min(min,...rings.map(r=>r.distance));
  if(rings[0].inside && !rings.slice(1).some(r=>r.inside)) contains=true;
 }
 return {contains,distance:contains?0:min/10};
}
async function readGzip(response) {
 if(!response.ok) throw new Error(`건물 자료 요청 실패 (${response.status})`);
 const bytes=new Uint8Array(await response.arrayBuffer());
 if(bytes[0]===31 && bytes[1]===139) {
  if(typeof DecompressionStream==='undefined') throw new Error('이 브라우저는 압축 해제를 지원하지 않습니다.');
  return JSON.parse(await new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'))).text());
 }
 return JSON.parse(new TextDecoder().decode(bytes));
}
export class NationalBuildingStore {
 constructor({baseUrl='/gis/national-building-changes',fetcher=(...args)=>fetch(...args),maxBytes=8*1024*1024,maxTiles=36,cacheSize=12}={}) {
  this.baseUrl=baseUrl.replace(/\/$/,''); this.fetcher=fetcher; this.maxBytes=maxBytes; this.maxTiles=maxTiles; this.cacheSize=cacheSize; this.cache=new Map(); this.manifestPromise=null;
 }
 manifest() {
  if(!this.manifestPromise) this.manifestPromise=this.fetcher(`${this.baseUrl}/manifest.json`).then(async r=>{if(!r.ok) throw new Error(`건물 목록 요청 실패 (${r.status})`);const m=await r.json();if(m.version!==1||m.sourceCrs!=='EPSG:5186'||m.tileSize!==10000||m.precision!==0.1||!Array.isArray(m.tiles)||!Array.isArray(m.fields)||m.fields.length!==31||!Number.isFinite(m.maxSpanMeters)||m.maxSpanMeters<0) throw new Error('건물 목록 형식이 올바르지 않습니다.');return m;}).catch(e=>{this.manifestPromise=null;throw e;});
  return this.manifestPromise;
 }
 async tile(entry,signal) {
  const [te,tn]=entry,key=`${te}_${tn}`;
  if(signal?.aborted) throw abortError();
  if(this.cache.has(key)) {const value=this.cache.get(key);this.cache.delete(key);this.cache.set(key,value);return value;}
  const data=await readGzip(await this.fetcher(`${this.baseUrl}/${key}.json.gz`,{signal}));
  if(signal?.aborted) throw abortError();
  if(!Array.isArray(data.records)||data.tile?.[0]!==te||data.tile?.[1]!==tn) throw new Error(`건물 타일 ${key} 형식이 올바르지 않습니다.`);
  this.cache.set(key,data.records);while(this.cache.size>this.cacheSize)this.cache.delete(this.cache.keys().next().value);
  return data.records;
 }
 async around(easting,northing,{radius=150,signal,onProgress}={}) {
  if(!Number.isFinite(easting)||!Number.isFinite(northing)||!Number.isFinite(radius)||radius<0||radius>1000) throw new Error('조회 위치 또는 반경이 올바르지 않습니다.');
  const m=await this.manifest();if(signal?.aborted) throw abortError();
  const reach=radius+m.maxSpanMeters+0.2,size=m.tileSize;
  const entries=m.tiles.filter(([e,n])=>e*size<=easting+reach&&(e+1)*size>=easting-reach&&n*size<=northing+reach&&(n+1)*size>=northing-reach);
  const uncached=entries.filter(([e,n])=>!this.cache.has(`${e}_${n}`)); const bytes=uncached.reduce((a,t)=>a+t[3],0);
  if(uncached.length>this.maxTiles||bytes>this.maxBytes) throw new NationalBuildingLimitError(bytes,uncached.length);
  let cursor=0,done=0;const hits=[];
  const worker=async()=>{while(cursor<entries.length){const entry=entries[cursor++];const records=await this.tile(entry,signal);for(const row of records){const [id,x,y,polygons,fields]=row;if(!Array.isArray(polygons)||!Array.isArray(fields)||fields.length!==31) throw new Error('건물 원본 필드 또는 도형이 올바르지 않습니다.');const m=measure(polygons,(easting-entry[0]*size)*10,(northing-entry[1]*size)*10);if(m.distance<=radius)hits.push({...m,building:{id,easting:entry[0]*size+x/10,northing:entry[1]*size+y/10,fields}});}onProgress?.(++done,entries.length);}};
  await Promise.all(Array.from({length:Math.min(4,entries.length)},worker));if(signal?.aborted)throw abortError();hits.sort((a,b)=>a.distance-b.distance);return {hits,manifest:m,tiles:entries.length,bytes};
 }
 dispose(){this.cache.clear();}
}

