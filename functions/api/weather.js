// [김포공항 기상 관측 / Gimpo airport weather observation]
// NOAA는 CORS를 제공하지 않아 같은 출처에서 제한된 단일 관측만 캐시해 전달합니다.
// NOAA does not offer CORS; cache one narrowly scoped observation on the same origin.
const UPSTREAM = 'https://aviationweather.gov/api/data/metar?ids=RKSS&format=json&hours=2';
const MAX_BYTES = 65536;
const unavailable = () => Response.json({ error: '관측 자료를 불러오지 못했습니다.' }, { status: 503, headers: { 'Cache-Control': 'no-store' } });
async function boundedJson(response) {
    const reader = response.body?.getReader();
    if (!reader) throw new Error('empty observation');
    const chunks = []; let size = 0;
    try {
        while (true) {
            const { value, done } = await reader.read();
            if (done) break;
            size += value.byteLength;
            if (size > MAX_BYTES) throw new Error('observation too large');
            chunks.push(value);
        }
    } finally { reader.releaseLock(); }
    const bytes = new Uint8Array(size); let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
    return JSON.parse(new TextDecoder().decode(bytes));
}
export async function getWeather(request, { cache, fetcher = fetch, now = Date.now(), waitUntil = () => {} }) {
    const url = new URL(request.url); url.search = ''; url.hash = '';
    const key = new Request(url.toString(), { method: 'GET' });
    try {
        const cached = await cache.match(key);
        if (cached) return cached;
        const response = await fetcher(UPSTREAM, { headers: { 'User-Agent': 'Sejong3D/1.0 (live.renewsejongpac.rhee.life)' }, signal: AbortSignal.timeout(8000) });
        if (!response.ok) return unavailable();
        const entries = await boundedJson(response);
        if (!Array.isArray(entries)) return unavailable();
        const report = entries.filter(item => item?.icaoId === 'RKSS' && Number.isFinite(item.obsTime))
            .sort((a, b) => b.obsTime - a.obsTime)[0];
        const age = now - report?.obsTime * 1000;
        if (!report || age < -300000 || age > 2 * 3600000) return unavailable();
        const result = Response.json({ station: 'RKSS', observedAt: new Date(report.obsTime * 1000).toISOString(), cover: report.cover ?? null, clouds: Array.isArray(report.clouds) ? report.clouds.slice(0, 8).map(({ cover }) => ({ cover })) : [], temperature: Number.isFinite(report.temp) ? report.temp : null }, { headers: { 'Cache-Control': 'public, max-age=600', 'X-Content-Type-Options': 'nosniff' } });
        waitUntil(cache.put(key, result.clone()).catch(() => {}));
        return result;
    } catch { return unavailable(); }
}
export function onRequestGet(context) {
    return getWeather(context.request, { cache: caches.default, waitUntil: promise => context.waitUntil(promise) });
}
