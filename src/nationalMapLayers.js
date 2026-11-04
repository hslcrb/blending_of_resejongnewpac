// [백지도 부가 레이어 / Supplemental overview map layers]
// 레이어와 보이는 영역을 선택할 때만 자료를 불러옵니다.
// Fetch selected layers and only shards whose full geometry bounds can intersect the view.
const URL = '/gis/extra/manifest.json';
const validBox = b => Array.isArray(b) && b.length === 4 && b.every(Number.isFinite) && b[0] <= b[2] && b[1] <= b[3];
const overlaps = (a,b) => a[0] <= b[2] && b[0] <= a[2] && a[1] <= b[3] && b[1] <= a[3];
const throwIfAborted = signal => { if (signal?.aborted) throw new DOMException('지도 조회가 취소됐습니다.', 'AbortError'); };
async function unpack(response) {
    if (!response.ok) throw new Error(`지도 자료 요청 실패: ${response.status}`);
    const bytes = new Uint8Array(await response.arrayBuffer());
    const compressed = bytes[0] === 0x1f && bytes[1] === 0x8b;
    if (compressed && typeof DecompressionStream === 'undefined') throw new Error('이 브라우저는 지도 자료 압축 해제를 지원하지 않습니다.');
    const text = compressed
        ? await new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'))).text()
        : new TextDecoder().decode(bytes);
    return JSON.parse(text);
}
export function toSeoulWorld([easting,northing]) { return { x:easting-200000, z:550000-northing }; }
export function toSejongWorld([easting,northing]) { return { x:northing-552531, z:easting-197897 }; }
export function createNationalMapSource({ fetcher = fetch, maxCache = 24 } = {}) {
    if (!Number.isInteger(maxCache) || maxCache < 0) throw new Error('캐시 크기가 올바르지 않습니다.');
    let metadata = null; const cache = new Map();
    async function manifest(signal) {
        throwIfAborted(signal);
        if (!metadata) {
            const response=await fetcher(URL,{signal});
            if (!response.ok) throw new Error(`지도 목록 요청 실패: ${response.status}`);
            const value=await response.json();
            if (value.version!==1 || value.crs!=='EPSG:5186' || !Array.isArray(value.layers)) throw new Error('지도 목록 형식이 올바르지 않습니다.');
            throwIfAborted(signal);metadata=value;
        }
        return metadata;
    }
    async function shard(entry,signal) {
        throwIfAborted(signal);
        if (cache.has(entry.url)) { const data=cache.get(entry.url);cache.delete(entry.url);cache.set(entry.url,data);return data; }
        if (!entry.url.startsWith('/gis/extra/') || entry.url.includes('..')) throw new Error('지도 자료 경로가 올바르지 않습니다.');
        const data=await unpack(await fetcher(entry.url,{signal}));
        if (data.type!=='FeatureCollection' || !Array.isArray(data.features) || data.features.length!==entry.count) throw new Error('지도 자료 형식이 올바르지 않습니다.');
        throwIfAborted(signal);
        if(maxCache){cache.set(entry.url,data.features);while(cache.size>maxCache)cache.delete(cache.keys().next().value);}
        return data.features;
    }
    async function query({ layers, bounds, includeUnlocated = false, signal } = {}) {
        if (!Array.isArray(layers) || layers.length===0) throw new Error('조회할 지도 레이어를 선택해 주세요.');
        if (bounds !== undefined && !validBox(bounds)) throw new Error('지도 범위가 올바르지 않습니다.');
        const index=await manifest(signal), byId=new Map(index.layers.map(value=>[value.id,value]));
        const ids=[...new Set(layers)];
        for(const id of ids) if(!byId.has(id)) throw new Error(`지도 레이어를 찾지 못했습니다: ${id}`);
        const selected=ids.flatMap(id=>byId.get(id).shards).filter(value=>value.bbox ? (!bounds || overlaps(value.bbox,bounds)) : includeUnlocated);
        const results=new Array(selected.length);let cursor=0;
        async function worker(){for(;;){throwIfAborted(signal);const i=cursor++;if(i>=selected.length)return;results[i]=await shard(selected[i],signal);}}
        await Promise.all(Array.from({length:Math.min(4,selected.length)},worker));
        throwIfAborted(signal);
        // Bounds are conservative envelopes: a returned feature may still miss the exact polygon.
        return results.flat().filter(feature=>feature.bbox ? (!bounds || overlaps(feature.bbox,bounds)) : includeUnlocated);
    }
    return { manifest, query, clearCache:()=>cache.clear() };
}
