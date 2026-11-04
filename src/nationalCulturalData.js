// 전국 변경 건물 정보 / National building change records
// 기존 원문 문자열은 숫자로 변환하지 않습니다.
// Preserve source strings rather than converting values to numbers.
export const CULTURAL_REGIONS = [
    ['11', '서울특별시'], ['26', '부산광역시'], ['27', '대구광역시'],
    ['28', '인천광역시'], ['29', '광주광역시'], ['30', '대전광역시'],
    ['31', '울산광역시'], ['36', '세종특별자치시'], ['41', '경기도'],
    ['51', '강원특별자치도'], ['43', '충청북도'], ['44', '충청남도'],
    ['52', '전북특별자치도'], ['46', '전라남도'], ['47', '경상북도'],
    ['48', '경상남도'], ['50', '제주특별자치도'],
];
const names = new Map(CULTURAL_REGIONS);
const aliases = { '42': '51', '45': '52' };
const regionKey = code => aliases[String(code || '').slice(0, 2)] || String(code || '').slice(0, 2);
const normalize = value => String(value ?? '').normalize('NFKC').toLocaleLowerCase('ko-KR').replace(/\s+/g, ' ').trim();

export function culturalRegion(code) {
    const key = regionKey(code);
    return key ? (names.get(key) || `지역 코드 ${key}`) : '지역 코드 미기재';
}

export function formatCulturalField(value, numeric = true) {
    if (value === null || value === undefined || value === '') return '미기재';
    const text = String(value);
    return numeric && text.includes('*') ? `원본 범위 초과 (${text})` : text;
}

export function filterCulturalCandidates(features, query = '', region = '') {
    const needle = normalize(query);
    return features.filter(feature => {
        const fields = feature.properties.fields;
        if (region && regionKey(fields.A30) !== region) return false;
        if (!needle) return true;
        const values = [fields.A24, fields.A4, fields.A5, `${fields.A4 || ''} ${fields.A5 || ''}`, fields.A9, feature.id];
        return values.some(value => normalize(value).includes(needle));
    });
}

export function pageCulturalCandidates(features, page = 0, size = 10) {
    const pageSize = Number.isInteger(size) && size > 0 ? size : 10;
    const pages = Math.max(1, Math.ceil(features.length / pageSize));
    const safe = Math.min(Math.max(0, Number.isInteger(page) ? page : 0), pages - 1);
    return { page: safe, pages, items: features.slice(safe * pageSize, (safe + 1) * pageSize) };
}

export function parseCulturalCollection(data) {
    if (!data || data.type !== 'FeatureCollection' || !Array.isArray(data.features)) throw new Error('전국 변경 자료 형식이 올바르지 않습니다.');
    const ids = new Set();
    for (const item of data.features) {
        const geometry = item?.geometry;
        const coordinates = geometry?.coordinates;
        if (item?.type !== 'Feature' || !Number.isInteger(item.id) || ids.has(item.id)
            || !item.properties?.fields || typeof item.properties.fields !== 'object'
            || (geometry !== null && (geometry?.type !== 'Point' || !Array.isArray(coordinates) || coordinates.length !== 2
                || !coordinates.every(Number.isFinite) || Math.abs(coordinates[0]) > 180 || Math.abs(coordinates[1]) > 90))) {
            throw new Error('전국 변경 자료 형식이 올바르지 않습니다.');
        }
        ids.add(item.id);
    }
    return data.features;
}
