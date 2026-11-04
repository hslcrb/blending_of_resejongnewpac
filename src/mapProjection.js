// [한국 좌표계 변환 / Korean coordinate transforms]
// EPSG:5186은 GRS80 타원체의 중부 원점(동 200km, 북 600km)이다.
// EPSG:5186 uses the GRS80 ellipsoid and Korean Central Belt origin.
const A = 6378137, FLATTENING = 1 / 298.257222101;
const E2 = FLATTENING * (2 - FLATTENING), E4 = E2 * E2, E6 = E4 * E2;
const EP2 = E2 / (1 - E2), DEG = Math.PI / 180;
const M0 = meridian(38 * DEG);
function meridian(phi) {
    return A * ((1 - E2 / 4 - 3 * E4 / 64 - 5 * E6 / 256) * phi
        - (3 * E2 / 8 + 3 * E4 / 32 + 45 * E6 / 1024) * Math.sin(2 * phi)
        + (15 * E4 / 256 + 45 * E6 / 1024) * Math.sin(4 * phi)
        - 35 * E6 / 3072 * Math.sin(6 * phi));
}

export function latLonTo5186(lon, lat) {
    const p = lat * DEG, l = (lon - 127) * DEG, sin = Math.sin(p), cos = Math.cos(p), tan = Math.tan(p);
    const n = A / Math.sqrt(1 - E2 * sin * sin), t = tan * tan, c = EP2 * cos * cos, a = cos * l;
    return {
        easting: 200000 + n * (a + (1 - t + c) * a ** 3 / 6 + (5 - 18 * t + t * t + 72 * c - 58 * EP2) * a ** 5 / 120),
        northing: 600000 + meridian(p) - M0 + n * tan * (a * a / 2 + (5 - t + 9 * c + 4 * c * c) * a ** 4 / 24 + (61 - 58 * t + t * t + 600 * c - 330 * EP2) * a ** 6 / 720),
    };
}

export function grid5186ToLatLon(easting, northing) {
    const m = M0 + northing - 600000, mu = m / (A * (1 - E2 / 4 - 3 * E4 / 64 - 5 * E6 / 256));
    const e1 = (1 - Math.sqrt(1 - E2)) / (1 + Math.sqrt(1 - E2));
    const p = mu + (3 * e1 / 2 - 27 * e1 ** 3 / 32) * Math.sin(2 * mu)
        + (21 * e1 ** 2 / 16 - 55 * e1 ** 4 / 32) * Math.sin(4 * mu)
        + 151 * e1 ** 3 / 96 * Math.sin(6 * mu) + 1097 * e1 ** 4 / 512 * Math.sin(8 * mu);
    const sin = Math.sin(p), cos = Math.cos(p), tan = Math.tan(p), t = tan * tan, c = EP2 * cos * cos;
    const n = A / Math.sqrt(1 - E2 * sin * sin), r = A * (1 - E2) / (1 - E2 * sin * sin) ** 1.5, d = (easting - 200000) / n;
    const lat = p - n * tan / r * (d * d / 2 - (5 + 3 * t + 10 * c - 4 * c * c - 9 * EP2) * d ** 4 / 24
        + (61 + 90 * t + 298 * c + 45 * t * t - 252 * EP2 - 3 * c * c) * d ** 6 / 720);
    const lon = (127 * DEG + (d - (1 + 2 * t + c) * d ** 3 / 6 + (5 - 2 * c + 28 * t - 3 * c * c + 8 * EP2 + 24 * t * t) * d ** 5 / 120) / cos);
    return {lon: lon / DEG, lat: lat / DEG};
}

// [장면 축 / Scene axes]
// 회관과 서울 개요가 같은 GIS 위치를 바라보도록 축을 바꾼다.
// Adapt the two scene conventions to the same GIS coordinates.
export function geoToWorld(mode, easting, northing) {
    if (mode === 'local') return {x: northing - 552531, z: easting - 197897};
    if (mode === 'seoul') return {x: easting - 200000, z: 550000 - northing};
    throw new Error(`Unknown map mode: ${mode}`);
}
export function worldToGeo(mode, x, z) {
    if (mode === 'local') return {easting: 197897 + z, northing: 552531 + x};
    if (mode === 'seoul') return {easting: 200000 + x, northing: 550000 - z};
    throw new Error(`Unknown map mode: ${mode}`);
}

// [웹 메르카토르 타일 / Web Mercator tile coordinates]
export function lonLatToTile(lon, lat, zoom) {
    const n = 2 ** zoom, clipped = Math.max(-85.0511287798066, Math.min(85.0511287798066, lat)) * DEG;
    return {x: (lon + 180) / 360 * n, y: (1 - Math.asinh(Math.tan(clipped)) / Math.PI) / 2 * n};
}
export function tileToLonLat(x, y, zoom) {
    const n = 2 ** zoom;
    return {lon: x / n * 360 - 180, lat: Math.atan(Math.sinh(Math.PI * (1 - 2 * y / n))) / DEG};
}
