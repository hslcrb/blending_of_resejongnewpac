// [서울 태양과 관측 구름 / Seoul sun and observed clouds]
// 태양 위치는 NOAA 근사식이며 구름은 김포공항 관측의 범주값입니다.
// Solar position follows NOAA; cloud amount is an airport observation category.
const LATITUDE = 37.572 * Math.PI / 180;
const LONGITUDE = 126.9763;
export function seoulSolarPosition(date) {
    const local = new Date(date.getTime() + 9 * 60 * 60 * 1000);
    const year = local.getUTCFullYear();
    const day = Math.floor((Date.UTC(year, local.getUTCMonth(), local.getUTCDate()) - Date.UTC(year, 0, 1)) / 86400000) + 1;
    const hours = local.getUTCHours() + local.getUTCMinutes() / 60 + local.getUTCSeconds() / 3600;
    const days = new Date(Date.UTC(year, 1, 29)).getUTCMonth() === 1 ? 366 : 365;
    const gamma = 2 * Math.PI / days * (day - 1 + (hours - 12) / 24);
    const eq = 229.18 * (0.000075 + 0.001868 * Math.cos(gamma) - 0.032077 * Math.sin(gamma) - 0.014615 * Math.cos(2 * gamma) - 0.040849 * Math.sin(2 * gamma));
    const decl = 0.006918 - 0.399912 * Math.cos(gamma) + 0.070257 * Math.sin(gamma) - 0.006758 * Math.cos(2 * gamma) + 0.000907 * Math.sin(2 * gamma) - 0.002697 * Math.cos(3 * gamma) + 0.00148 * Math.sin(3 * gamma);
    const minutes = (hours * 60 + eq + 4 * LONGITUDE - 540 + 1440) % 1440;
    const hourAngle = (minutes / 4 - 180) * Math.PI / 180;
    const elevation = Math.asin(Math.sin(LATITUDE) * Math.sin(decl) + Math.cos(LATITUDE) * Math.cos(decl) * Math.cos(hourAngle));
    const azimuth = (Math.atan2(Math.sin(hourAngle), Math.cos(hourAngle) * Math.sin(LATITUDE) - Math.tan(decl) * Math.cos(LATITUDE)) + Math.PI) % (2 * Math.PI);
    return { azimuth, elevation };
}
export function sunDirection({ azimuth, elevation }, mode = 'local') {
    const horizontal = Math.cos(elevation);
    const north = Math.cos(azimuth) * horizontal, east = Math.sin(azimuth) * horizontal;
    return mode === 'seoul' ? { x: east, y: Math.sin(elevation), z: -north } : { x: north, y: Math.sin(elevation), z: east };
}
export function cloudFractionFromMetar(report) {
    if (!report) return null;
    const amount = { CLR: 0, SKC: 0, NSC: 0, NCD: 0, CAVOK: 0, FEW: 0.2, SCT: 0.4, BKN: 0.75, OVC: 1, VV: 1 };
    const values = [report.cover, ...(Array.isArray(report.clouds) ? report.clouds.map(cloud => cloud.cover) : [])]
        .filter(code => Object.hasOwn(amount, code)).map(code => amount[code]);
    return values.length ? Math.max(...values) : null;
}
